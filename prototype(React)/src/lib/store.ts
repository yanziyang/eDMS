import { useSyncExternalStore } from "react";
import type {
  FavoriteEntry,
  FavoriteType,
  FollowType,
  LibraryItem,
  RecentDocument,
  SavedView,
  Site,
  SiteLibrary,
} from "@/types";
import {
  FAVORITE_ENTRIES,
  LIBRARY_CONTENTS,
  RECENT_DOCUMENTS,
  RECYCLE_BIN_ITEMS,
  SAVED_VIEWS,
  SAMPLE_GROUPS,
  SAMPLE_USERS,
  SITES,
  THEME_META,
} from "@/lib/mock-data";

export type ThemeId = (typeof THEME_META)[number]["id"];

export interface SheetState {
  item: LibraryItem;
  tab: "properties" | "versions" | "permissions" | "activity";
  context?: SheetContext;
}

export interface SheetContext {
  site: string;
  lib: string;
  folder: string;
}

export interface ItemLocation extends SheetContext {}

export interface Db {
  sites: typeof SITES;
  users: typeof SAMPLE_USERS;
  groups: typeof SAMPLE_GROUPS;
  recycle: typeof RECYCLE_BIN_ITEMS;
  libraries: Record<string, { name: string; parent: { folder: string; label: string } | null; items: LibraryItem[] }>;
  favorites: string[];
  favoriteEntries: Record<string, FavoriteEntry>;
  follows: Record<FollowType, string[]>;
  savedViews: Record<string, SavedView[]>;
  recent: RecentDocument[];
  theme: ThemeId;
  sheet: SheetState | null;
}

interface PersistedPrototypeState {
  favorites?: string[];
  favoriteEntries?: Record<string, FavoriteEntry>;
  follows?: Record<FollowType, string[]>;
  savedViews?: Record<string, SavedView[]>;
  recent?: RecentDocument[];
}

const WORKSPACE_STATE_KEY = "edms-prototype-state";

function readWorkspaceState(): PersistedPrototypeState {
  try {
    return JSON.parse(localStorage.getItem(WORKSPACE_STATE_KEY) || "{}") as PersistedPrototypeState;
  } catch {
    return {};
  }
}

const savedWorkspace = readWorkspaceState();

let themeId: ThemeId = "default";
try {
  const saved = localStorage.getItem("edms-theme");
  if (saved && THEME_META.some((t) => t.id === saved)) themeId = saved as ThemeId;
} catch {
  /* ignore */
}
document.documentElement.setAttribute("data-theme", themeId);

export const db: Db = {
  sites: SITES,
  users: SAMPLE_USERS,
  groups: SAMPLE_GROUPS,
  recycle: RECYCLE_BIN_ITEMS,
  libraries: LIBRARY_CONTENTS,
  favorites: savedWorkspace.favorites ?? FAVORITE_ENTRIES.map((entry) => entry.key),
  favoriteEntries: {
    ...Object.fromEntries(FAVORITE_ENTRIES.map((entry) => [entry.key, entry])),
    ...(savedWorkspace.favoriteEntries ?? {}),
  },
  follows: savedWorkspace.follows ?? { site: ["finance"], library: ["finance/documents"] },
  savedViews: savedWorkspace.savedViews ?? SAVED_VIEWS,
  recent: savedWorkspace.recent ?? RECENT_DOCUMENTS,
  theme: themeId,
  sheet: null,
};

const listeners = new Set<() => void>();

let snapshot = { v: 0 };

function persistWorkspaceState() {
  try {
    localStorage.setItem(
      WORKSPACE_STATE_KEY,
      JSON.stringify({
        favorites: db.favorites,
        favoriteEntries: db.favoriteEntries,
        follows: db.follows,
        savedViews: db.savedViews,
        recent: db.recent,
      } satisfies PersistedPrototypeState)
    );
  } catch {
    /* ignore */
  }
}

export function emit() {
  snapshot = { v: snapshot.v + 1 };
  persistWorkspaceState();
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useDb(): Db {
  useSyncExternalStore(subscribe, () => snapshot);
  return db;
}

export function applyTheme(id: ThemeId) {
  db.theme = id;
  document.documentElement.setAttribute("data-theme", id);
  try {
    localStorage.setItem("edms-theme", id);
  } catch {
    /* ignore */
  }
  emit();
}

export function quickToggleTheme() {
  applyTheme(db.theme === "midnight" ? "default" : "midnight");
}

export function openDocSheet(
  item: LibraryItem,
  tab: SheetState["tab"] = "properties",
  context?: SheetContext,
) {
  db.sheet = { item, tab, context };
  emit();
}

export function setDocSheetTab(tab: SheetState["tab"]) {
  if (db.sheet) {
    db.sheet.tab = tab;
    emit();
  }
}

export function closeDocSheet() {
  db.sheet = null;
  emit();
}

export function favoriteKey(type: FavoriteType, value: string) {
  return `${type}:${value}`;
}

export function siteFavoriteEntry(site: Site): FavoriteEntry {
  return {
    key: favoriteKey("site", site.slug),
    type: "site",
    name: site.name,
    href: `/sites/${site.slug}`,
    detail: `Site · ${site.members} members`,
  };
}

export function libraryFavoriteEntry(site: Site, library: SiteLibrary): FavoriteEntry {
  return {
    key: favoriteKey("library", `${site.slug}/${library.id}`),
    type: "library",
    name: library.name,
    href: `/sites/${site.slug}/${library.id}/root`,
    detail: `Library · ${site.name}`,
  };
}

export function itemFavoriteEntry(item: LibraryItem, location: ItemLocation): FavoriteEntry {
  const itemId = item.id || item.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const type: FavoriteType = item.type === "folder" ? "folder" : "document";
  const value = `${location.site}/${location.lib}/${location.folder}/${itemId}`;
  return {
    key: favoriteKey(type, value),
    type,
    name: item.name,
    href:
      item.type === "folder"
        ? `/sites/${location.site}/${location.lib}/${itemId}`
        : `/sites/${location.site}/${location.lib}/${location.folder}`,
    detail: `${type === "folder" ? "Folder" : "Document"} · ${location.site} / ${location.lib}`,
    ext: item.ext,
  };
}

export function isFavorite(key: string) {
  return db.favorites.includes(key);
}

export function toggleFavorite(entry: FavoriteEntry) {
  const index = db.favorites.indexOf(entry.key);
  if (index >= 0) db.favorites.splice(index, 1);
  else db.favorites.push(entry.key);
  db.favoriteEntries[entry.key] = entry;
  emit();
}

export function isFollowing(type: FollowType, value: string) {
  return db.follows[type].includes(value);
}

export function toggleFollow(type: FollowType, value: string) {
  const followed = db.follows[type];
  const index = followed.indexOf(value);
  if (index >= 0) followed.splice(index, 1);
  else followed.push(value);
  emit();
}

export function getLibraryViews(key: string) {
  return db.savedViews[key] ?? [
    { id: "all", name: "All items", filter: "", sortKey: "name", sortDir: "asc", groupBy: "none", isDefault: true },
  ];
}

export function saveLibraryView(key: string, view: SavedView) {
  const views = db.savedViews[key] ? [...db.savedViews[key]] : [];
  const next = view.isDefault ? views.map((candidate) => ({ ...candidate, isDefault: false })) : views;
  const existingIndex = next.findIndex((candidate) => candidate.id === view.id);
  if (existingIndex >= 0) next[existingIndex] = view;
  else next.push(view);
  db.savedViews[key] = next;
  emit();
}
