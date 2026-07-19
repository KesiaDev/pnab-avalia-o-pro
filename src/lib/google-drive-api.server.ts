// Server-only (sufixo .server.ts) — ver aviso em google-oauth.server.ts.
// Cliente mínimo da Drive API v3 usando fetch — sem SDK, só o necessário
// para listar recursivamente, baixar binário e exportar Google Workspace
// (Docs/Sheets/Slides) para PDF.

const DRIVE_API = "https://www.googleapis.com/drive/v3";
const FOLDER_MIME = "application/vnd.google-apps.folder";
const GOOGLE_WORKSPACE_MIME_PREFIX = "application/vnd.google-apps.";

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
}

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

export async function getFileMetadata(accessToken: string, fileId: string): Promise<DriveFile> {
  const fields =
    "id, name, mimeType, parents, size, modifiedTime, createdTime, md5Checksum, webViewLink, trashed";
  const res = await driveFetch(
    accessToken,
    `/files/${fileId}?fields=${fields}&supportsAllDrives=true`,
  );
  return res.json();
}

export async function listFolderChildren(
  accessToken: string,
  folderId: string,
): Promise<DriveFile[]> {
  const files: DriveFile[] = [];
  let pageToken: string | undefined;
  const fields =
    "nextPageToken, files(id, name, mimeType, parents, size, modifiedTime, createdTime, md5Checksum, webViewLink, trashed)";
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
  return files;
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
