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
  checkedOutBy: string | null;
}

export interface UploadResult {
  documentId: string;
  name: string;
  versionId: string;
  versionLabel: string;
  sizeBytes: number;
  status: string;
}

export type PermissionLevel = "FullControl" | "Contribute" | "Read" | "NoAccess";

export type PrincipalType = "User" | "Group";

export interface DocumentDto {
  id: string;
  libraryId: string;
  folderId: string | null;
  name: string;
  title: string | null;
  description: string | null;
  contentType: string;
  sizeBytes: number;
  checkedOutBy: string | null;
  checkedOutAt: string | null;
  createdAt: string;
  modifiedAt: string | null;
  versionLabel: string;
}

export interface DocumentVersionDto {
  id: string;
  versionMajor: number;
  versionMinor: number;
  sizeBytes: number;
  comment: string | null;
  isMajor: boolean;
  createdBy: string;
  createdAt: string;
}

export interface PermissionEntryDto {
  principalType: PrincipalType;
  principalId: string;
  principalName: string;
  level: PermissionLevel;
  source: "Direct" | "Inherited";
}

export interface PermissionsStateDto {
  hasUniqueAcl: boolean;
  entries: PermissionEntryDto[];
}

export interface RecycleBinItemDto {
  id: string;
  kind: "document" | "folder";
  name: string;
  deletedAt: string;
  deletedBy: string;
  siteId: string;
}

export interface AdminSettingsDto {
  maxUploadSizeBytes: number;
  recycleBinRetentionDays: number;
  siteCreationRestricted: boolean;
  accessTokenLifetimeMinutes: number;
  refreshTokenLifetimeDays: number;
  appName: string;
}

export interface StorageReportDto {
  siteId: string;
  siteName: string;
  usedBytes: number;
}

export interface AuditLogDto {
  id: string;
  timestamp: string;
  userId: string;
  action: string;
  objectType: string;
  objectId: string;
  objectName: string;
  siteId: string;
  ipAddress: string;
}

export type MetadataDataType = "Text" | "Number" | "Date" | "Choice" | "Boolean" | "User" | "Lookup";

export interface ContentTypeColumnDto {
  id: string;
  name: string;
  dataType: MetadataDataType;
  isRequired: boolean;
  choiceOptions: string | null;
  defaultValue: string | null;
}

export interface ContentTypeDto {
  id: string;
  libraryId: string | null;
  name: string;
  description: string | null;
  columns: ContentTypeColumnDto[];
}

export interface DocumentMetadataDto {
  contentTypeId: string | null;
  contentTypeName: string | null;
  columns: DocumentMetadataColumnDto[];
}

export interface DocumentMetadataColumnDto {
  columnDefinitionId: string;
  name: string;
  dataType: MetadataDataType;
  isRequired: boolean;
  choiceOptions: string | null;
  defaultValue: string | null;
  value: string | null;
}

export interface MetadataValueInput {
  columnDefinitionId: string;
  value: string | null;
}
