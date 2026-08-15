import { request } from "@/lib/api-client";
import type { UserDto } from "@/types/api";

export function listUsers(search?: string): Promise<UserDto[]> {
  const query = search ? `?search=${encodeURIComponent(search)}` : "";
  return request<UserDto[]>(`/users${query}`);
}

export function createUser(input: {
  email: string;
  displayName: string;
  tempPassword: string;
  isSystemAdmin: boolean;
}): Promise<string> {
  return request<string>("/users", { method: "POST", body: JSON.stringify(input) });
}

export function setUserActive(userId: string, active: boolean): Promise<void> {
  return request<void>(`/users/${userId}/${active ? "reactivate" : "deactivate"}`, { method: "POST" });
}
