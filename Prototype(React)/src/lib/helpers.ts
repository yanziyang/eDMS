import type { DocActivity, DocVersion, LibraryItem } from "@/types";
import { CURRENT_USER } from "@/lib/mock-data";

export function todayStr() {
  return "2026-08-15";
}

export function shiftDateBack(dateStr: string, days: number) {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

export function fmtDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function initialsOf(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join("");
}

export function fileIcoClass(ext?: string | null) {
  if (!ext) return "folder";
  ext = ext.toLowerCase();
  if (ext === "pdf") return "pdf";
  if (["docx", "doc"].includes(ext)) return "docx";
  if (["xlsx", "xls"].includes(ext)) return "xlsx";
  if (["pptx", "ppt"].includes(ext)) return "pptx";
  return "generic";
}

export function bumpVersion(v?: string | null) {
  const n = parseFloat(v || "1.0");
  return (Math.floor(n) + 1).toFixed(1);
}

export function parseSizeVal(item: LibraryItem) {
  if (item.type === "folder") return -1;
  const m = /([\d.]+)\s*(KB|MB|GB)/i.exec(item.size || "");
  if (!m) return 0;
  const n = parseFloat(m[1]);
  const mult = { KB: 1, MB: 1024, GB: 1024 * 1024 }[m[2].toUpperCase() as "KB" | "MB" | "GB"];
  return n * mult;
}

export function fmtSize(bytes: number) {
  if (bytes < 1024) return bytes + " B";
  const units = ["KB", "MB", "GB"];
  let val = bytes / 1024,
    i = 0;
  while (val >= 1024 && i < units.length - 1) {
    val /= 1024;
    i++;
  }
  return val.toFixed(val < 10 ? 1 : 0) + " " + units[i];
}

const VERB_MAP: Record<string, string> = {
  Upload: "uploaded",
  Download: "downloaded",
  View: "viewed",
  EditMetadata: "edited",
  Delete: "deleted",
  Restore: "restored",
  Rename: "renamed",
  Move: "moved",
  Copy: "copied",
  CheckOut: "checked out",
  CheckIn: "checked in",
  PermissionChange: "changed permissions on",
  Share: "shared",
  Login: "signed in",
};

export function actionVerb(action: string) {
  return VERB_MAP[action] || action.toLowerCase();
}

export function generateVersions(item: LibraryItem): DocVersion[] {
  const major = Math.max(1, Math.round(parseFloat(item.version || "1.0")));
  const people = [item.modifiedBy, "Sarah Chen", "Jordan Reyes", "Marcus Johnson"];
  const versions: DocVersion[] = [];
  for (let v = major; v >= 1; v--) {
    versions.push({
      version: v === major ? item.version || "1.0" : v + ".0",
      by: v === major ? item.modifiedBy : people[v % people.length],
      date: v === major ? item.modified : shiftDateBack(item.modified, (major - v) * 9 + 3),
      size: item.size || "—",
      comment: v === major ? "Latest changes" : v === 1 ? "Initial upload" : "Periodic update",
    });
  }
  return versions;
}

export function generateActivity(item: LibraryItem): DocActivity[] {
  return [
    { action: "Modified", by: item.modifiedBy, date: item.modified, icon: "pencil" },
    { action: "Downloaded", by: "Elena Rodriguez", date: shiftDateBack(item.modified, 2), icon: "download" },
    { action: "Viewed", by: "David Kim", date: shiftDateBack(item.modified, 3), icon: "eye" },
    { action: "Shared with Site Members", by: item.modifiedBy, date: shiftDateBack(item.modified, 5), icon: "share" },
    { action: "Uploaded", by: item.modifiedBy, date: shiftDateBack(item.modified, Math.max(6, Math.round(parseFloat(item.version || "1") * 9))), icon: "upload" },
  ];
}

export function exportCsv(filename: string, rows: string[][]) {
  const csv = rows
    .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export const CURRENT_USER_REF = CURRENT_USER;
