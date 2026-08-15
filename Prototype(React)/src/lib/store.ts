import { useSyncExternalStore } from "react";
import type { LibraryItem } from "@/types";
import {
  LIBRARY_CONTENTS,
  RECYCLE_BIN_ITEMS,
  SAMPLE_GROUPS,
  SAMPLE_USERS,
  SITES,
  THEME_META,
} from "@/lib/mock-data";

export type ThemeId = (typeof THEME_META)[number]["id"];

export interface SheetState {
  item: LibraryItem;
  tab: "properties" | "versions" | "permissions" | "activity";
}

export interface Db {
  sites: typeof SITES;
  users: typeof SAMPLE_USERS;
  groups: typeof SAMPLE_GROUPS;
  recycle: typeof RECYCLE_BIN_ITEMS;
  libraries: Record<string, { name: string; parent: { folder: string; label: string } | null; items: LibraryItem[] }>;
  theme: ThemeId;
  sheet: SheetState | null;
}

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
  theme: themeId,
  sheet: null,
};

const listeners = new Set<() => void>();

let snapshot = { v: 0 };

export function emit() {
  snapshot = { v: snapshot.v + 1 };
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

export function openDocSheet(item: LibraryItem, tab: SheetState["tab"] = "properties") {
  db.sheet = { item, tab };
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
