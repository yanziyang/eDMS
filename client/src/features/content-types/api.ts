import { request } from "@/lib/api-client";
import type {
  ContentTypeDto,
  DocumentMetadataDto,
  MetadataDataType,
  MetadataValueInput,
} from "@/types/api";

export interface ContentTypeInput {
  name: string;
  description?: string | null;
  libraryId?: string | null;
}

export interface ContentTypeColumnInput {
  name: string;
  dataType: MetadataDataType;
  isRequired: boolean;
  choiceOptions?: string | null;
  defaultValue?: string | null;
}

export function listContentTypes(libraryId?: string | null): Promise<ContentTypeDto[]> {
  const query = libraryId ? `?libraryId=${encodeURIComponent(libraryId)}` : "";
  return request<ContentTypeDto[]>(`/admin/content-types${query}`);
}

export function createContentType(input: ContentTypeInput): Promise<string> {
  return request<string>("/admin/content-types", { method: "POST", body: JSON.stringify(input) });
}

export function updateContentType(contentTypeId: string, input: ContentTypeInput): Promise<void> {
  return request<void>(`/admin/content-types/${contentTypeId}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export function deleteContentType(contentTypeId: string): Promise<void> {
  return request<void>(`/admin/content-types/${contentTypeId}`, { method: "DELETE" });
}

export function addContentTypeColumn(contentTypeId: string, input: ContentTypeColumnInput): Promise<string> {
  return request<string>(`/admin/content-types/${contentTypeId}/columns`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateContentTypeColumn(columnId: string, input: ContentTypeColumnInput): Promise<void> {
  return request<void>(`/admin/columns/${columnId}`, { method: "PUT", body: JSON.stringify(input) });
}

export function deleteContentTypeColumn(columnId: string): Promise<void> {
  return request<void>(`/admin/columns/${columnId}`, { method: "DELETE" });
}

export function getDocumentMetadata(documentId: string): Promise<DocumentMetadataDto> {
  return request<DocumentMetadataDto>(`/documents/${documentId}/metadata`);
}

export function updateDocumentMetadata(documentId: string, values: MetadataValueInput[]): Promise<void> {
  return request<void>(`/documents/${documentId}/metadata-values`, {
    method: "PUT",
    body: JSON.stringify({ values }),
  });
}

export function parseChoiceOptions(value: string | null): string[] {
  if (!value) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === "string") : [];
  } catch {
    return [];
  }
}
