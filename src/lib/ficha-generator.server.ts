// Server-only (sufixo .server.ts) — ver aviso em google-oauth.server.ts.
// Preenche o .odt oficial "Edital 119-2026 - Modelo Ficha de Avaliação"
// (fornecido pela SMC) com as notas aprovadas pela avaliadora e a minuta de
// parecer final. Não recria o layout: manipula o arquivo real (zip + XML do
// OpenDocument), preservando cabeçalho, tabelas e formatação originais —
// só os campos em branco (INSCRITO, Pontuação Obtida, parecer, assinatura)
// são preenchidos.
import { unzipSync, zipSync } from "fflate";
import { FICHA_EDITAL_119_2026_TEMPLATE_BASE64 } from "./ficha-template.server";

const CONTENT_XML = "content.xml";

// Nome fixo: plataforma de uso exclusivo desta avaliadora (Edital 119/2026).
const AVALIADORA_NOME = "Viviane da Rocha Palma";

function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Localiza a primeira célula de tabela ainda vazia (identificada pelo par de
// estilos célula+parágrafo) e insere o valor. Quando o mesmo par de estilos
// se repete (ex.: uma "Pontuação Obtida" por critério), chamar esta função
// em sequência sempre acerta a próxima célula em branco, porque a que acabou
// de ser preenchida deixa de bater com o padrão "vazio".
function fillCell(xml: string, cellStyle: string, pStyle: string, value: string): string {
  const pattern = `<table:table-cell table:style-name="${cellStyle}" office:value-type="string"><text:p text:style-name="${pStyle}"/></table:table-cell>`;
  const idx = xml.indexOf(pattern);
  if (idx === -1) {
    throw new Error(
      `Modelo da ficha mudou de estrutura: não encontrei a célula ${cellStyle}/${pStyle} vazia. Geração cancelada para não produzir uma ficha incorreta.`,
    );
  }
  const replacement = `<table:table-cell table:style-name="${cellStyle}" office:value-type="string"><text:p text:style-name="${pStyle}">${escapeXml(value)}</text:p></table:table-cell>`;
  return xml.slice(0, idx) + replacement + xml.slice(idx + pattern.length);
}

function setInscrito(xml: string, nome: string): string {
  const pattern =
    '<table:table-cell table:style-name="Tabela4.B1" office:value-type="string"><text:p text:style-name="P6"/></table:table-cell>';
  const idx = xml.indexOf(pattern);
  if (idx === -1) throw new Error("Modelo da ficha mudou: célula INSCRITO não encontrada.");
  const replacement =
    '<table:table-cell table:style-name="Tabela4.B1" office:value-type="string"><text:p text:style-name="P6">' +
    escapeXml(nome) +
    "</text:p></table:table-cell>";
  return xml.slice(0, idx) + replacement + xml.slice(idx + pattern.length);
}

// Substitui o parágrafo inteiro que contém a linha pontilhada reservada ao
// parecer (estilo de texto "T26") por um parágrafo por linha do texto real.
function setParecer(xml: string, paragrafos: string[]): string {
  const marker = '<text:span text:style-name="T26">';
  const markerIdx = xml.indexOf(marker);
  if (markerIdx === -1)
    throw new Error("Modelo da ficha mudou: marcador do parecer não encontrado.");
  const pOpenIdx = xml.lastIndexOf("<text:p ", markerIdx);
  const pCloseIdx = xml.indexOf("</text:p>", markerIdx) + "</text:p>".length;
  if (pOpenIdx === -1 || pCloseIdx === -1) {
    throw new Error("Modelo da ficha mudou: não foi possível delimitar o parágrafo do parecer.");
  }
  const replacement = paragrafos
    .filter((p) => p.trim().length > 0)
    .map((p) => `<text:p text:style-name="P36">${escapeXml(p.trim())}</text:p>`)
    .join("");
  return xml.slice(0, pOpenIdx) + replacement + xml.slice(pCloseIdx);
}

function setSignatureName(xml: string, nome: string): string {
  const marker = '<text:span text:style-name="T28">';
  const startIdx = xml.indexOf(marker);
  if (startIdx === -1)
    throw new Error("Modelo da ficha mudou: linha de assinatura não encontrada.");
  const contentStart = startIdx + marker.length;
  const contentEnd = xml.indexOf("</text:span>", contentStart);
  if (contentEnd === -1) throw new Error("Modelo da ficha mudou: linha de assinatura incompleta.");
  return xml.slice(0, contentStart) + escapeXml(nome) + xml.slice(contentEnd);
}

export type TipoProponente = "pessoa_fisica" | "pessoa_juridica_ou_coletivo";

export interface FichaScores {
  A: number;
  B: number;
  C: number;
  D: number;
  E: number;
  F: number;
  G: number;
}

export interface BuildFichaParams {
  nomeProponente: string;
  tipoProponente: TipoProponente;
  scores: FichaScores;
  parecerTexto: string;
}

export function buildFichaOdt(params: BuildFichaParams): Buffer {
  const templateBytes = Buffer.from(FICHA_EDITAL_119_2026_TEMPLATE_BASE64, "base64");
  const files = unzipSync(new Uint8Array(templateBytes));

  const contentBytes = files[CONTENT_XML];
  if (!contentBytes)
    throw new Error("Arquivo modelo inválido: content.xml não encontrado no .odt.");

  let xml = new TextDecoder("utf-8").decode(contentBytes);

  xml = setInscrito(xml, params.nomeProponente);

  const mandatorySubtotal =
    params.scores.A + params.scores.B + params.scores.C + params.scores.D + params.scores.E;
  const bonusSubtotal = params.scores.F + params.scores.G;

  // Critérios A–E, nesta ordem — Tabela5.D2 + P14 se repete 5 vezes no molde.
  // Cada fillCell() consome a 1ª célula ainda vazia que casar o padrão: depois
  // de preenchida, ela deixa de bater com o padrão "vazio" e sai da contagem —
  // por isso a ocorrência buscada é sempre 1, nunca um índice fixo crescente.
  const mandatoryOrder: Array<keyof FichaScores> = ["A", "B", "C", "D", "E"];
  for (const criterion of mandatoryOrder) {
    xml = fillCell(xml, "Tabela5.D2", "P14", String(params.scores[criterion]));
  }
  xml = fillCell(xml, "Tabela5.D2", "P7", String(mandatorySubtotal));

  // Só a tabela de bônus correspondente ao tipo de proponente é preenchida —
  // a outra fica em branco, como uma avaliadora humana também deixaria.
  const bonusTable = params.tipoProponente === "pessoa_fisica" ? "Tabela2" : "Tabela3";
  xml = fillCell(xml, `${bonusTable}.D2`, "P29", String(params.scores.F));
  xml = fillCell(xml, `${bonusTable}.D2`, "P29", String(params.scores.G));
  xml = fillCell(xml, `${bonusTable}.D2`, "P31", String(bonusSubtotal));

  const paragrafos = params.parecerTexto.split(/\n{1,}/);
  xml = setParecer(xml, paragrafos);

  xml = setSignatureName(xml, AVALIADORA_NOME);

  const outFiles: Record<
    string,
    Uint8Array | [Uint8Array, { level: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 }]
  > = {};
  // O mimetype precisa vir primeiro e sem compressão — exigência do formato ODF.
  outFiles["mimetype"] = [files["mimetype"], { level: 0 }];
  for (const [path, bytes] of Object.entries(files)) {
    if (path === "mimetype") continue;
    outFiles[path] = path === CONTENT_XML ? new TextEncoder().encode(xml) : bytes;
  }

  const zipped = zipSync(outFiles);
  return Buffer.from(zipped);
}
