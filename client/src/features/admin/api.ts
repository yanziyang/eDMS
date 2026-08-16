import { request } from "@/lib/api-client";
import type { AdminSettingsDto, AuditLogDto, StorageReportDto, UserDto } from "@/types/api";

export function listUsers(search?: string): Promise<UserDto[]> {
  const query = search ? `?search=${encodeURIComponent(search)}` : "";
  return request<UserDto[]>(`/users${query}`);
}

export function getAdminSettings(): Promise<AdminSettingsDto> {
  return request<AdminSettingsDto>("/admin/settings");
}

export function updateAdminSettings(input: {
  maxUploadSizeBytes?: number;
  recycleBinRetentionDays?: number;
  siteCreationRestricted?: boolean;
}): Promise<void> {
  return request<void>("/admin/settings", { method: "PUT", body: JSON.stringify(input) });
}

export function getStorageReport(): Promise<StorageReportDto[]> {
  return request<StorageReportDto[]>("/admin/storage");
}

export function listAuditLog(siteId: string): Promise<AuditLogDto[]> {
  return request<AuditLogDto[]>(`/sites/${siteId}/audit-log`);
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
