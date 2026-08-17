export interface SiteLibrary {
  id: string;
  name: string;
}

export interface Site {
  slug: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  members: number;
  storageUsedGB: number;
  storageQuotaGB: number;
  libraries: SiteLibrary[];
  status?: "Active" | "Archived";
}

export interface LibraryItem {
  type: "folder" | "file";
  id?: string;
  name: string;
  title?: string;
  description?: string;
  ext?: string;
  size?: string;
  modified: string;
  modifiedBy: string;
  version?: string;
  tags?: string[];
  checkedOutBy?: string | null;
}

export interface LibraryFolder {
  name: string;
  parent: { folder: string; label: string } | null;
  items: LibraryItem[];
}

export interface SearchDoc extends LibraryItem {
  site: string;
  lib: string;
  folder: string;
  siteName: string;
}

export interface User {
  name: string;
  email: string;
  title: string;
  dept: string;
  role: string;
  status: "Active" | "Inactive";
  lastActive: string;
}

export interface Group {
  name: string;
  type: string;
  members: number;
  site: string;
}

export interface AuditEntry {
  time: string;
  user: string;
  action: string;
  object: string;
  site: string;
  ip: string;
}

export interface RecycleItem {
  type: "folder" | "file";
  name: string;
  ext: string | null;
  size: string;
  site: string;
  originalPath: string;
  deletedBy: string;
  deletedAt: string;
}

export interface Notification {
  icon: string;
  title: string;
  desc: string;
  time: string;
  unread: boolean;
}

export interface QuickAccessDoc {
  site: string;
  lib: string;
  folder: string;
  name: string;
  ext: string;
}

export type FavoriteType = "site" | "library" | "folder" | "document";

export interface FavoriteEntry {
  key: string;
  type: FavoriteType;
  name: string;
  href: string;
  detail: string;
  ext?: string;
}

export type FollowType = "site" | "library";

export interface SavedView {
  id: string;
  name: string;
  filter: string;
  sortKey: "name" | "modifiedBy" | "modified" | "size";
  sortDir: "asc" | "desc";
  groupBy: "none" | "type" | "modifiedBy";
  isDefault?: boolean;
}

export interface RecentDocument {
  site: string;
  lib: string;
  folder: string;
  name: string;
  ext: string;
  modified: string;
  modifiedBy: string;
  action: "Viewed" | "Uploaded" | "Modified";
}

export interface DocVersion {
  version: string;
  by: string;
  date: string;
  size: string;
  comment: string;
}

export interface DocActivity {
  action: string;
  by: string;
  date: string;
  icon: string;
}
