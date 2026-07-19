// Server-only (sufixo .server.ts) — ver aviso em google-oauth.server.ts.
// Cliente mínimo da Drive API v3 usando fetch — sem SDK, só o necessário
// para listar recursivamente, baixar binário e exportar Google Workspace
// (Docs/Sheets/Slides) para PDF.

const DRIVE_API = "https://www.googleapis.com/drive/v3";
const FOLDER_MIME = "application/vnd.google-apps.folder";
const GOOGLE_WORKSPACE_MIME_PREFIX = "application/vnd.google-apps.";

const SHORTCUT_MIME = "application/vnd.google-apps.shortcut";

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  parents?: string[];
  size?: string;
  modifiedTime: string;
  createdTime: string;
  md5Checksum?: string;
  webViewLink?: string;
  trashed?: boolean;
  shortcutDetails?: { targetId: string; targetMimeType: string };
}

const LIST_FIELDS =
  "id, name, mimeType, parents, size, modifiedTime, createdTime, md5Checksum, webViewLink, trashed, shortcutDetails(targetId,targetMimeType)";

async function driveFetch(accessToken: string, path: string): Promise<Response> {
  const res = await fetch(`${DRIVE_API}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Drive API ${path} falhou: ${res.status} ${await res.text()}`);
  }
  return res;
}

export async function getConnectedAccountEmail(accessToken: string): Promise<string | null> {
  const res = await driveFetch(accessToken, `/about?fields=user(emailAddress,displayName)`);
  const data = (await res.json()) as { user?: { emailAddress?: string } };
  return data.user?.emailAddress ?? null;
}

// Diagnóstico temporário: roda várias variações da consulta de listagem
// direto contra a API e devolve o resultado cru de cada uma, pra descobrir
// por que uma pasta com conteúdo real e visível no navegador está
// retornando vazio via files.list.
export async function diagnoseDriveAccess(accessToken: string, folderId: string) {
  async function probeFiles(label: string, query: Record<string, string>) {
    const params = new URLSearchParams({
      fields: "files(id,name,mimeType), nextPageToken",
      pageSize: "50",
      ...query,
    });
    try {
      const res = await fetch(`${DRIVE_API}/files?${params.toString()}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const body = await res.text();
      return { label, status: res.status, ok: res.ok, body: body.slice(0, 2000) };
    } catch (err) {
      return {
        label,
        status: 0,
        ok: false,
        body: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async function probeAbout() {
    try {
      const res = await fetch(`${DRIVE_API}/about?fields=user,storageQuota`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const body = await res.text();
      return {
        label: "about?fields=user,storageQuota",
        status: res.status,
        ok: res.ok,
        body: body.slice(0, 1000),
      };
    } catch (err) {
      return {
        label: "about?fields=user,storageQuota",
        status: 0,
        ok: false,
        body: err instanceof Error ? err.message : String(err),
      };
    }
  }

  const [bare, withAllDrives, withCorporaAllDrives, recentFilesNoFilter, aboutMe] =
    await Promise.all([
      probeFiles("q=in-parents (sem flags)", { q: `'${folderId}' in parents and trashed = false` }),
      probeFiles("q=in-parents + supportsAllDrives + includeItemsFromAllDrives", {
        q: `'${folderId}' in parents and trashed = false`,
        supportsAllDrives: "true",
        includeItemsFromAllDrives: "true",
      }),
      probeFiles("q=in-parents + corpora=allDrives", {
        q: `'${folderId}' in parents and trashed = false`,
        supportsAllDrives: "true",
        includeItemsFromAllDrives: "true",
        corpora: "allDrives",
      }),
      probeFiles("lista geral sem filtro de parents (o que a conta enxerga por padrão)", {
        q: `trashed = false`,
        supportsAllDrives: "true",
        includeItemsFromAllDrives: "true",
      }),
      probeAbout(),
    ]);

  return { folderId, bare, withAllDrives, withCorporaAllDrives, recentFilesNoFilter, aboutMe };
}

export async function getFileMetadata(accessToken: string, fileId: string): Promise<DriveFile> {
  const res = await driveFetch(
    accessToken,
    `/files/${fileId}?fields=${LIST_FIELDS}&supportsAllDrives=true`,
  );
  return res.json();
}

// Atalhos (application/vnd.google-apps.shortcut) apontam para o item real em
// outro lugar do Drive — sem resolver, um atalho para pasta nunca é
// reconhecido como pasta (mimeType do atalho é sempre "shortcut", nunca
// "folder"), e um atalho para arquivo não tem conteúdo próprio para baixar.
// Mantém o nome do atalho (é o que aparece na pasta-fonte), troca id/mimeType
// pelo alvo real; para atalho de arquivo, busca metadados reais do alvo
// (modifiedTime/checksum do atalho não refletem o conteúdo real).
async function resolveShortcut(accessToken: string, file: DriveFile): Promise<DriveFile> {
  if (file.mimeType !== SHORTCUT_MIME || !file.shortcutDetails?.targetId) return file;
  const { targetId, targetMimeType } = file.shortcutDetails;
  if (targetMimeType === FOLDER_MIME) {
    return { ...file, id: targetId, mimeType: targetMimeType };
  }
  const target = await getFileMetadata(accessToken, targetId);
  return { ...target, name: file.name };
}

export async function listFolderChildren(
  accessToken: string,
  folderId: string,
): Promise<DriveFile[]> {
  const files: DriveFile[] = [];
  let pageToken: string | undefined;
  const fields = `nextPageToken, files(${LIST_FIELDS})`;
  do {
    const params = new URLSearchParams({
      q: `'${folderId}' in parents and trashed = false`,
      fields,
      pageSize: "1000",
      supportsAllDrives: "true",
      includeItemsFromAllDrives: "true",
      corpora: "allDrives",
    });
    if (pageToken) params.set("pageToken", pageToken);
    const res = await driveFetch(accessToken, `/files?${params.toString()}`);
    const data = (await res.json()) as { files: DriveFile[]; nextPageToken?: string };
    files.push(...data.files);
    pageToken = data.nextPageToken;
  } while (pageToken);
  return Promise.all(files.map((f) => resolveShortcut(accessToken, f)));
}

export function isFolder(file: DriveFile): boolean {
  return file.mimeType === FOLDER_MIME;
}

export function isGoogleWorkspaceFile(file: DriveFile): boolean {
  return file.mimeType.startsWith(GOOGLE_WORKSPACE_MIME_PREFIX) && !isFolder(file);
}

export async function downloadFileBinary(accessToken: string, fileId: string): Promise<Buffer> {
  const res = await driveFetch(accessToken, `/files/${fileId}?alt=media&supportsAllDrives=true`);
  return Buffer.from(await res.arrayBuffer());
}

export async function exportWorkspaceFileAsPdf(
  accessToken: string,
  fileId: string,
): Promise<Buffer> {
  const res = await driveFetch(accessToken, `/files/${fileId}/export?mimeType=application/pdf`);
  return Buffer.from(await res.arrayBuffer());
}

// Percorre recursivamente uma pasta raiz, retornando toda a árvore achatada
// com o caminho relativo de cada item — usada tanto no baseline quanto no sync.
export interface WalkedItem {
  file: DriveFile;
  parentPath: string;
  /** id da subpasta de 1º nível (a pasta do proponente) a que este item pertence */
  topLevelFolderId?: string;
}

export async function walkFolderRecursive(
  accessToken: string,
  rootFolderId: string,
): Promise<WalkedItem[]> {
  const result: WalkedItem[] = [];

  async function walk(folderId: string, path: string, topLevelFolderId: string | undefined) {
    const children = await listFolderChildren(accessToken, folderId);
    for (const child of children) {
      const isTopLevel = path === "";
      const childTopLevelId = isTopLevel ? child.id : topLevelFolderId;
      result.push({ file: child, parentPath: path, topLevelFolderId: childTopLevelId });
      if (isFolder(child)) {
        await walk(child.id, `${path}/${child.name}`, childTopLevelId);
      }
    }
  }

  await walk(rootFolderId, "", undefined);
  return result;
}
