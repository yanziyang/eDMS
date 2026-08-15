import { request } from "@/lib/api-client";
import type { SiteDto } from "@/types/api";

export function listSites(): Promise<SiteDto[]> {
  return request<SiteDto[]>("/sites");
}

export function createSite(input: {
  name: string;
  description?: string;
  urlSlug: string;
}): Promise<string> {
  return request<string>("/sites", { method: "POST", body: JSON.stringify(input) });
}

export function updateSite(id: string, input: {
  name: string;
  description?: string;
  storageQuotaBytes?: number | null;
}): Promise<void> {
  return request<void>(`/sites/${id}`, { method: "PUT", body: JSON.stringify(input) });
}

export function deleteSite(id: string): Promise<void> {
  return request<void>(`/sites/${id}`, { method: "DELETE" });
}
