import { request } from "@/lib/api-client";
import type { GroupDto } from "@/types/api";

export function listGroups(siteId?: string): Promise<GroupDto[]> {
  const query = siteId ? `?siteId=${encodeURIComponent(siteId)}` : "";
  return request<GroupDto[]>(`/groups${query}`);
}

export function addGroupMember(groupId: string, userId: string): Promise<void> {
  return request<void>(`/groups/${groupId}/members/${userId}`, { method: "POST" });
}

export function removeGroupMember(groupId: string, userId: string): Promise<void> {
  return request<void>(`/groups/${groupId}/members/${userId}`, { method: "DELETE" });
}
