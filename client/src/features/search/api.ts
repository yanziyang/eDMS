import { request } from "@/lib/api-client";

export interface SearchResultItem {
  documentId: string;
  name: string;
  sizeBytes: number;
  siteId: string;
  libraryId: string;
  folderPath: string | null;
  modifiedAt: string;
}

export function search(q: string): Promise<SearchResultItem[]> {
  return request<SearchResultItem[]>(`/search?q=${encodeURIComponent(q)}`);
}
