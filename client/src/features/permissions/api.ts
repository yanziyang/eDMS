import { request } from "@/lib/api-client";
import type { PermissionLevel, PermissionsStateDto, PrincipalType } from "@/types/api";

export function getPermissions(objectType: string, objectId: string): Promise<PermissionsStateDto> {
  return request<PermissionsStateDto>(`/${objectType}/objects/${objectId}/permissions`);
}

export function grantPermission(
  objectType: string,
  objectId: string,
  input: { principalType: PrincipalType; principalId: string; level: PermissionLevel },
): Promise<void> {
  return request<void>(`/${objectType}/objects/${objectId}/permissions`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function revokePermission(
  objectType: string,
  objectId: string,
  principalType: PrincipalType,
  principalId: string,
): Promise<void> {
  return request<void>(`/${objectType}/objects/${objectId}/permissions/${principalType}/${principalId}`, {
    method: "DELETE",
  });
}

export function resetPermissions(objectType: string, objectId: string): Promise<void> {
  return request<void>(`/${objectType}/objects/${objectId}/permissions/reset`, { method: "POST" });
}

export function share(
  objectType: string,
  objectId: string,
  input: { principalId: string; level: PermissionLevel },
): Promise<void> {
  return request<void>(`/${objectType}/objects/${objectId}/share`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}
