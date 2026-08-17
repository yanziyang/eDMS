// Hierarchical query-key factory (TDS §7.4). All TanStack Query keys come from here
// so mutation-driven cache invalidation can target subtrees exhaustively.
export const queryKeys = {
  sites: {
    all: ["sites"] as const,
    list: () => [...queryKeys.sites.all, "list"] as const,
    detail: (slugOrId: string) => [...queryKeys.sites.all, "detail", slugOrId] as const,
  },
  libraries: {
    all: ["libraries"] as const,
    list: (siteId: string) => [...queryKeys.libraries.all, "list", siteId] as const,
  },
  libraryViews: {
    all: ["library-views"] as const,
    list: (libraryId: string) => [...queryKeys.libraryViews.all, "list", libraryId] as const,
  },
  groups: {
    all: ["groups"] as const,
    list: (siteId?: string) =>
      siteId ? ([...queryKeys.groups.all, "list", siteId] as const) : ([...queryKeys.groups.all, "list"] as const),
  },
  folders: {
    all: ["folders"] as const,
    items: (folderId: string) => [...queryKeys.folders.all, "items", folderId] as const,
  },
  documents: {
    all: ["documents"] as const,
    libraryItems: (libraryId: string) => [...queryKeys.documents.all, "library-items", libraryId] as const,
    detail: (documentId: string) => [...queryKeys.documents.all, "detail", documentId] as const,
    versions: (documentId: string) => [...queryKeys.documents.all, "versions", documentId] as const,
    metadata: (documentId: string) => [...queryKeys.documents.all, "metadata", documentId] as const,
  },
  contentTypes: {
    all: ["content-types"] as const,
    list: (libraryId?: string) =>
      libraryId
        ? ([...queryKeys.contentTypes.all, "list", libraryId] as const)
        : ([...queryKeys.contentTypes.all, "list"] as const),
    detail: (contentTypeId: string) => [...queryKeys.contentTypes.all, "detail", contentTypeId] as const,
  },
  permissions: {
    all: ["permissions"] as const,
    forObject: (objectType: string, objectId: string) =>
      [...queryKeys.permissions.all, objectType, objectId] as const,
  },
  shareLinks: {
    all: ["share-links"] as const,
    forObject: (objectType: string, objectId: string) =>
      [...queryKeys.shareLinks.all, objectType, objectId] as const,
  },
  recycleBin: {
    all: ["recycle-bin"] as const,
    list: (siteId: string) => [...queryKeys.recycleBin.all, "list", siteId] as const,
  },
  search: {
    all: ["search"] as const,
    results: (query: string, siteId?: string, libraryId?: string) =>
      [...queryKeys.search.all, "results", query, siteId ?? null, libraryId ?? null] as const,
  },
  admin: {
    all: ["admin"] as const,
    users: (search?: string) => (search ? ([...queryKeys.admin.all, "users", search] as const) : ([...queryKeys.admin.all, "users"] as const)),
    settings: () => [...queryKeys.admin.all, "settings"] as const,
    storage: () => [...queryKeys.admin.all, "storage"] as const,
    auditLog: (siteId: string) => [...queryKeys.admin.all, "audit-log", siteId] as const,
  },
  me: {
    all: ["me"] as const,
    current: () => [...queryKeys.me.all, "current"] as const,
    favorites: () => [...queryKeys.me.all, "favorites"] as const,
    recent: () => [...queryKeys.me.all, "recent"] as const,
  },
  notifications: {
    all: ["notifications"] as const,
    list: (unreadOnly = false) => [...queryKeys.notifications.all, "list", unreadOnly] as const,
    subscriptions: () => [...queryKeys.notifications.all, "subscriptions"] as const,
  },
  auth: {
    all: ["auth"] as const,
    ssoProviders: () => [...queryKeys.auth.all, "sso-providers"] as const,
  },
} as const;
