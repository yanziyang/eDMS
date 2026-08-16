import { request } from "@/lib/api-client";
import type { GroupDto } from "@/types/api";

export function listGroups(siteId?: string): Promise<GroupDto[]> {
  const query = siteId ? `?siteId=${encodeURIComponent(siteId)}` : "";
  return request<GroupDto[]>(`/groups${query}`);
}

export function createGroup(input: {
  name: string;
  description?: string | null;
  siteId?: string | null;
}): Promise<string> {
  return request<string>("/groups", { method: "POST", body: JSON.stringify(input) });
}

export function deleteGroup(groupId: string): Promise<void> {
  return request<void>(`/groups/${groupId}`, { method: "DELETE" });
}

export function addGroupMember(groupId: string, userId: string): Promise<void> {
  return request<void>(`/groups/${groupId}/members/${userId}`, { method: "POST" });
}

export function removeGroupMember(groupId: string, userId: string): Promise<void> {
  return request<void>(`/groups/${groupId}/members/${userId}`, { method: "DELETE" });
}
