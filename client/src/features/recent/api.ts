import { request } from "@/lib/api-client";
import type { RecentDocumentDto } from "@/types/api";

export function listRecent(): Promise<RecentDocumentDto[]> {
  return request<RecentDocumentDto[]>("/me/recent");
}
