export interface SiteMembershipDto {
  siteId: string;
  siteSlug: string;
  role: "Owner" | "Member" | "Visitor";
}

export interface CurrentUserDto {
  id: string;
  email: string;
  displayName: string;
  isSystemAdmin: boolean;
  siteMemberships: SiteMembershipDto[];
}

export interface LoginResponse {
  accessToken: string;
  expiresInSeconds: number;
  user: CurrentUserDto;
}

export interface RefreshResponse {
  accessToken: string;
  expiresInSeconds: number;
}

export interface ProblemDetails {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  errors?: Record<string, string[]>;
}

export interface SiteDto {
  id: string;
  name: string;
  description: string | null;
  urlSlug: string;
  storageQuotaBytes: number | null;
  storageUsedBytes: number;
  createdAt: string;
}

export interface GroupDto {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  siteId: string | null;
  memberIds: string[];
}

export interface UserDto {
  id: string;
  email: string;
  displayName: string;
  isActive: boolean;
  isSystemAdmin: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface LibraryDto {
  id: string;
  siteId: string;
  name: string;
  description: string | null;
  enableVersioning: boolean;
  enableMinorVersions: boolean;
  requireCheckout: boolean;
}

export interface ItemDto {
  kind: "folder" | "document";
  id: string;
  name: string;
  sizeBytes: number;
  modifiedAt: string;
  folderId: string | null;
  documentId: string | null;
}

export interface UploadResult {
  documentId: string;
  name: string;
  versionId: string;
  versionLabel: string;
  sizeBytes: number;
  status: string;
}
