import { request } from "@/lib/api-client";
import type { RecycleBinItemDto } from "@/types/api";

export type RecycleBinObjectType = "Document" | "Folder";

export function listRecycleBin(siteId: string): Promise<RecycleBinItemDto[]> {
  return request<RecycleBinItemDto[]>(`/sites/${siteId}/recycle-bin`);
}

export function restoreRecycleBinItem(itemId: string, objectType: RecycleBinObjectType): Promise<void> {
  return request<void>(`/recycle-bin/${itemId}/restore?objectType=${objectType}`, { method: "POST" });
}

export function permanentlyDeleteRecycleBinItem(
  itemId: string,
  objectType: RecycleBinObjectType,
): Promise<void> {
  return request<void>(`/recycle-bin/${itemId}?objectType=${objectType}`, { method: "DELETE" });
}
