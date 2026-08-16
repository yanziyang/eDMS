import { request, requestBlob } from "@/lib/api-client";
import type { DocumentDto, DocumentVersionDto, ItemDto, LibraryDto, MetadataValueInput, UploadResult } from "@/types/api";

export function listLibraries(siteId: string): Promise<LibraryDto[]> {
  return request<LibraryDto[]>(`/sites/${siteId}/libraries`);
}

export function listItems(libraryId: string): Promise<ItemDto[]> {
  return request<ItemDto[]>(`/libraries/${libraryId}/items`);
}

export function listFolderItems(folderId: string): Promise<ItemDto[]> {
  return request<ItemDto[]>(`/folders/${folderId}/items`);
}

export function uploadToLibrary(
  libraryId: string,
  file: File,
  metadata?: MetadataValueInput[],
): Promise<UploadResult> {
  const form = new FormData();
  form.append("file", file);
  if (metadata && metadata.length > 0) {
    form.append("metadata", JSON.stringify(metadata));
  }
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

export function moveDocument(
  documentId: string,
  input: { destinationLibraryId: string; destinationFolderId: string | null },
): Promise<string> {
  return request<string>(`/documents/${documentId}/move`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function copyDocument(
  documentId: string,
  input: { destinationLibraryId: string; destinationFolderId: string | null },
): Promise<string> {
  return request<string>(`/documents/${documentId}/copy`, {
    method: "POST",
    body: JSON.stringify(input),
  });
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

export function getDocument(documentId: string): Promise<DocumentDto> {
  return request<DocumentDto>(`/documents/${documentId}`);
}

export function updateDocument(
  documentId: string,
  input: { name?: string; title?: string | null; description?: string | null },
): Promise<void> {
  return request<void>(`/documents/${documentId}`, { method: "PUT", body: JSON.stringify(input) });
}

export function listDocumentVersions(documentId: string): Promise<DocumentVersionDto[]> {
  return request<DocumentVersionDto[]>(`/documents/${documentId}/versions`);
}

export function restoreVersion(documentId: string, versionId: string): Promise<void> {
  return request<void>(`/documents/${documentId}/versions/${versionId}/restore`, { method: "POST" });
}

export function checkOutDocument(documentId: string): Promise<void> {
  return request<void>(`/documents/${documentId}/checkout`, { method: "POST" });
}

export function checkInDocument(documentId: string, comment?: string): Promise<void> {
  return request<void>(`/documents/${documentId}/checkin`, {
    method: "POST",
    body: JSON.stringify({ comment: comment ?? null }),
  });
}

export function discardCheckout(documentId: string): Promise<void> {
  return request<void>(`/documents/${documentId}/discard-checkout`, { method: "POST" });
}
