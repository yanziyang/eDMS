import { request, requestRaw } from "@/lib/api-client";
import type { MetadataValueInput, UploadResult, UploadSessionDto } from "@/types/api";

export interface StartUploadInput {
  libraryId: string;
  folderId?: string | null;
  fileName: string;
  totalBytes: number;
  metadata?: MetadataValueInput[];
}

export function startUpload(input: StartUploadInput): Promise<UploadSessionDto> {
  return request<UploadSessionDto>("/uploads", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function getUploadStatus(sessionId: string): Promise<UploadSessionDto> {
  return request<UploadSessionDto>(`/uploads/${sessionId}`);
}

export async function appendChunk(sessionId: string, offset: number, chunk: Blob): Promise<UploadSessionDto> {
  return requestRaw<UploadSessionDto>(`/uploads/${sessionId}/chunks?offset=${offset}`, {
    method: "PUT",
    body: await chunk.arrayBuffer(),
  });
}

export function completeUpload(sessionId: string, metadata?: MetadataValueInput[]): Promise<UploadResult> {
  return request<UploadResult>(`/uploads/${sessionId}/complete`, {
    method: "POST",
    body: JSON.stringify({ metadata: metadata && metadata.length > 0 ? metadata : null }),
  });
}

export function abortUpload(sessionId: string): Promise<void> {
  return request<void>(`/uploads/${sessionId}`, { method: "DELETE" });
}
