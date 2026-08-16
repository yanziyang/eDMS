import { request } from "@/lib/api-client";
import type { ShareLinkDto, ShareLinkLevel } from "@/types/api";

export function createShareLink(
  objectType: string,
  objectId: string,
  level: ShareLinkLevel,
  expiresAt?: string,
): Promise<ShareLinkDto> {
  const body: { level: ShareLinkLevel; expiresAt?: string } = { level };
  if (expiresAt) {
    body.expiresAt = expiresAt;
  }
  return request<ShareLinkDto>(`/${objectType}/objects/${objectId}/share-links`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function listShareLinks(objectType: string, objectId: string): Promise<ShareLinkDto[]> {
  return request<ShareLinkDto[]>(`/${objectType}/objects/${objectId}/share-links`);
}

export function revokeShareLink(linkId: string): Promise<void> {
  return request<void>(`/share-links/${linkId}`, { method: "DELETE" });
}
