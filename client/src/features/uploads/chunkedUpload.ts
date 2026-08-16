import { appendChunk, getUploadStatus } from "./api";
import type { UploadSessionDto } from "@/types/api";

export const LARGE_FILE_THRESHOLD = 100 * 1024 * 1024;

export interface ChunkUploadProgress {
  uploadedBytes: number;
  totalBytes: number;
}

export async function uploadChunks(
  file: File,
  sessionId: string,
  onProgress: (progress: ChunkUploadProgress) => void,
): Promise<UploadSessionDto> {
  const session = await getUploadStatus(sessionId);
  let uploadedBytes = Math.min(session.uploadedBytes, session.totalBytes);
  const totalBytes = session.totalBytes;

  onProgress({ uploadedBytes, totalBytes });

  while (uploadedBytes < totalBytes) {
    const end = Math.min(uploadedBytes + session.chunkSize, totalBytes);
    const updated = await appendChunk(sessionId, uploadedBytes, file.slice(uploadedBytes, end));
    uploadedBytes = Math.min(updated.uploadedBytes, updated.totalBytes);
    onProgress({ uploadedBytes, totalBytes: updated.totalBytes });
  }

  return { ...session, uploadedBytes };
}
