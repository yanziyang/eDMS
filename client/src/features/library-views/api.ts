import { request } from "@/lib/api-client";
import type { LibraryViewDto } from "@/types/api";

export interface CreateLibraryViewRequest {
  name: string;
  filterConfig: string;
  sortConfig: string;
  groupByColumn: string | null;
  isShared: boolean;
}

export interface UpdateLibraryViewRequest {
  name: string;
  filterConfig: string;
  sortConfig: string;
  groupByColumn: string | null;
}

export function listLibraryViews(libraryId: string): Promise<LibraryViewDto[]> {
  return request<LibraryViewDto[]>(`/libraries/${libraryId}/views`);
}

export function createLibraryView(
  libraryId: string,
  input: CreateLibraryViewRequest,
): Promise<LibraryViewDto> {
  return request<LibraryViewDto>(`/libraries/${libraryId}/views`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateLibraryView(
  libraryId: string,
  viewId: string,
  input: UpdateLibraryViewRequest,
): Promise<void> {
  return request<void>(`/libraries/${libraryId}/views/${viewId}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export function deleteLibraryView(libraryId: string, viewId: string): Promise<void> {
  return request<void>(`/libraries/${libraryId}/views/${viewId}`, { method: "DELETE" });
}

export function setDefaultLibraryView(libraryId: string, viewId: string): Promise<void> {
  return request<void>(`/libraries/${libraryId}/views/${viewId}/set-default`, { method: "POST" });
}
