// Server-only (sufixo .server.ts) — ver aviso em google-oauth.server.ts.
// Cliente do Lovable AI Gateway, formato compatível com /v1/chat/completions
// da OpenAI. Usado por todos os módulos em src/lib/agents/*.server.ts.
import type { z } from "zod";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const DEFAULT_MODEL = "openai/gpt-5.5";
const MAX_FILE_BYTES = 15 * 1024 * 1024; // Seção 8: "arquivo ilegível deve ser marcado, não interpretado"
// Limite do TOTAL combinado por chamada — sem isso, um proponente com muitos
// arquivos grandes (cada um dentro do limite individual) pode montar um
// payload grande o bastante para estourar memória/tempo do Worker, o que
// derruba a função inteira com um erro genérico (sem chegar a lançar um
// Error nosso, então nem aparece mensagem clara pro usuário).
const MAX_TOTAL_BYTES = 30 * 1024 * 1024;
// Sem timeout próprio, uma resposta lenta do gateway (comum em chamadas que
// pedem pra IA raciocinar sobre vários critérios de uma vez, com vários PDFs
// anexados) trava o processo até a infraestrutura matá-lo à força — sem
// nenhuma chance de cair no catch/registrar erro (foi o que aconteceu com
// agent_runs ficando "em_andamento" pra sempre, sem error_message nenhuma).
// Com o timeout, isso vira um erro tratável, capturado e visível.
const REQUEST_TIMEOUT_MS = 180_000;
// Uma nova tentativa em caso de timeout ou 5xx transitório — o gateway
// costuma responder rápido no retry quando o modelo travou na primeira vez.
const MAX_RETRIES = 1;
const RETRY_BACKOFF_MS = 2_000;

const JSON_ONLY_SUFFIX =
  "\n\nResponda estritamente em JSON válido, sem texto antes ou depois, sem bloco de código markdown. " +
  "Nunca invente, presuma ou complete informação que não esteja explicitamente nos documentos fornecidos. " +
  "Quando não houver comprovação suficiente, use a redação padronizada de insuficiência do prompt-mestre.";

export interface AgentFile {
  name: string;
  mimeType: string;
  data: Buffer;
}

interface ChatContentBlock {
  type: "text" | "file";
  text?: string;
  file?: { filename: string; file_data: string };
}

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string | ChatContentBlock[];
}

export interface CallAgentParams<T> {
  systemPrompt: string;
  userPrompt: string;
  files?: AgentFile[];
  responseSchema: z.ZodType<T>;
  model?: string;
}

export interface CallAgentResult<T> {
  data: T;
  raw: string;
  skippedFiles: string[];
}

function requireApiKey(): string {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("Missing LOVABLE_API_KEY env var");
  return key;
}

function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return (fenced ? fenced[1] : text).trim();
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function requestCompletion(
  model: string,
  apiKey: string,
  messages: ChatMessage[],
): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  // O timeout precisa cobrir a leitura do corpo da resposta (res.json()), não
  // só o fetch() inicial — um `finally` logo após o fetch resolver limparia o
  // timer assim que os cabeçalhos chegassem, deixando a leitura do corpo (onde
  // o JSON grande é de fato transmitido) sem nenhuma proteção. Foi exatamente
  // essa lacuna que deixou uma trava silenciosa acontecer mesmo com o timeout
  // já em produção.
  try {
    const res = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
      body: JSON.stringify({ model, messages }),
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`AI Gateway falhou: ${res.status} ${await res.text()}`);
    }
    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    return json.choices?.[0]?.message?.content ?? "";
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(
        `AI Gateway não respondeu em ${REQUEST_TIMEOUT_MS / 1000}s — tempo limite excedido.`,
      );
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

export async function callAgent<T>(params: CallAgentParams<T>): Promise<CallAgentResult<T>> {
  const apiKey = requireApiKey();
  const model = params.model ?? DEFAULT_MODEL;

  const skippedFiles: string[] = [];
  const fileBlocks: ChatContentBlock[] = [];
  let totalBytes = 0;
  for (const file of params.files ?? []) {
    if (file.data.length > MAX_FILE_BYTES || totalBytes + file.data.length > MAX_TOTAL_BYTES) {
      skippedFiles.push(file.name);
      continue;
    }
    totalBytes += file.data.length;
    fileBlocks.push({
      type: "file",
      file: {
        filename: file.name,
        file_data: `data:${file.mimeType};base64,${file.data.toString("base64")}`,
      },
    });
  }

  const userText =
    skippedFiles.length > 0
      ? `${params.userPrompt}\n\nAviso: os seguintes arquivos foram ignorados por excederem o tamanho processável e não devem ser interpretados como ausentes de conteúdo: ${skippedFiles.join(", ")}.`
      : params.userPrompt;

  const messages: ChatMessage[] = [
    { role: "system", content: params.systemPrompt + JSON_ONLY_SUFFIX },
    { role: "user", content: [{ type: "text", text: userText }, ...fileBlocks] },
  ];

  let raw = await requestCompletion(model, apiKey, messages);
  let parsed = params.responseSchema.safeParse(safeJsonParse(extractJson(raw)));

  if (!parsed.success) {
    const retryMessages: ChatMessage[] = [
      ...messages,
      { role: "assistant", content: raw },
      {
        role: "user",
        content: `A resposta anterior não é um JSON válido no formato esperado (${parsed.error.message}). Responda de novo, só com o JSON puro, sem texto ao redor e sem bloco de código.`,
      },
    ];
    raw = await requestCompletion(model, apiKey, retryMessages);
    parsed = params.responseSchema.safeParse(safeJsonParse(extractJson(raw)));
  }

  if (!parsed.success) {
    throw new Error(`Resposta do agente fora do formato esperado: ${parsed.error.message}`);
  }

  return { data: parsed.data, raw, skippedFiles };
}
