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

export interface SsoProvidersDto {
  oidc: boolean;
  saml: boolean;
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
  rejectionReason?: "quota-exceeded" | string;
  siteName?: string;
  quotaBytes?: number;
  storageUsedBytes?: number;
  incomingSizeBytes?: number;
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
  localLoginDisabled: boolean;
  ssoExempt: boolean;
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
  minorVersionsRetained: number | null;
}

export interface LibraryViewDto {
  id: string;
  libraryId: string;
  ownerId: string | null;
  name: string;
  filterConfig: string;
  sortConfig: string;
  groupByColumn: string | null;
  isDefault: boolean;
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
  rejectionReason?: "file-too-large" | "blocked-extension" | "checked-out-by-other-user" | "quota-exceeded";
}

export interface UploadSessionDto {
  sessionId: string;
  fileName: string;
  totalBytes: number;
  uploadedBytes: number;
  chunkSize: number;
  expiresAt: string;
}

export type PermissionLevel = "FullControl" | "Contribute" | "Read" | "NoAccess";

export type FavoriteObjectType = "Site" | "Library" | "Folder" | "Document";

export interface FavoriteItemDto {
  objectId: string;
  objectType: FavoriteObjectType;
  name: string;
  location: string;
  siteSlug: string;
  libraryId: string | null;
  folderId: string | null;
}

export type AuditAction =
  | "Upload"
  | "View"
  | "EditMetadata"
  | "CheckIn";

export interface RecentDocumentDto {
  documentId: string;
  name: string;
  siteId: string;
  siteName: string;
  siteSlug: string;
  libraryId: string;
  libraryName: string;
  folderId: string | null;
  folderPath: string | null;
  lastTouchedAt: string;
  lastAction: AuditAction;
}

export type ShareLinkLevel = "Read" | "Contribute";

export interface ShareLinkDto {
  id: string;
  token: string;
  level: ShareLinkLevel;
  expiresAt: string | null;
}

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
  ssoEnforcedGlobally: boolean;
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

export type AlertFrequency = "Immediate" | "Daily" | "Weekly";
export type FollowableObjectType = "Site" | "Library" | "Folder" | "Document";

export interface AlertSubscriptionDto {
  id: string;
  objectType: FollowableObjectType;
  objectId: string;
  objectName: string;
  frequency: AlertFrequency;
  createdAt: string;
}

export interface NotificationDto {
  id: string;
  kind: "SharedWithMe" | "FollowedItemChanged";
  objectType: FollowableObjectType;
  objectId: string;
  objectName: string;
  message: string;
  frequency: AlertFrequency;
  occurredAt: string;
  isRead: boolean;
}

export interface MetadataValueInput {
  columnDefinitionId: string;
  value: string | null;
}
