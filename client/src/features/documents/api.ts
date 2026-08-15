import { request, requestBlob } from "@/lib/api-client";
import type { ItemDto, LibraryDto, UploadResult } from "@/types/api";

export function listLibraries(siteId: string): Promise<LibraryDto[]> {
  return request<LibraryDto[]>(`/sites/${siteId}/libraries`);
}

export function listItems(libraryId: string): Promise<ItemDto[]> {
  return request<ItemDto[]>(`/libraries/${libraryId}/items`);
}

export function listFolderItems(folderId: string): Promise<ItemDto[]> {
  return request<ItemDto[]>(`/folders/${folderId}/items`);
}

export function uploadToLibrary(libraryId: string, file: File): Promise<UploadResult> {
  const form = new FormData();
  form.append("file", file);
  return request<UploadResult>(`/libraries/${libraryId}/documents`, { method: "POST", body: form });
}

export function uploadToFolder(folderId: string, file: File): Promise<UploadResult> {
  const form = new FormData();
  form.append("file", file);
  return request<UploadResult>(`/folders/${folderId}/documents`, { method: "POST", body: form });
}

export function createFolder(libraryId: string | null, parentFolderId: string | null, name: string): Promise<string> {
  const url = parentFolderId
    ? `/folders/${parentFolderId}/folders`
    : `/libraries/${libraryId}/folders`;
  return request<string>(url, { method: "POST", body: JSON.stringify({ name }) });
}

export function deleteDocument(documentId: string): Promise<void> {
  return request<void>(`/documents/${documentId}`, { method: "DELETE" });
}

export function deleteFolder(folderId: string): Promise<void> {
  return request<void>(`/folders/${folderId}`, { method: "DELETE" });
}

export async function downloadDocument(documentId: string, fileName: string): Promise<void> {
  const blob = await requestBlob(`/documents/${documentId}/download`);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
