/* =========================================================================
   eDMS Clickable Prototype — Application Shell & Behavior
   Vanilla JS, no build step, no external dependencies (works via file://).
   ========================================================================= */

/* ---------------------------------------------------------------------- */
/*  Small helpers                                                          */
/* ---------------------------------------------------------------------- */
function qs(sel, root) { return (root || document).querySelector(sel); }
function qsa(sel, root) { return Array.from((root || document).querySelectorAll(sel)); }
function esc(str) { return String(str == null ? "" : str).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
function getParam(name, fallback) { const v = new URLSearchParams(location.search).get(name); return v || fallback; }
function todayStr() { return "2026-08-15"; }
function shiftDateBack(dateStr, days) { const d = new Date(dateStr + "T00:00:00"); d.setDate(d.getDate() - days); return d.toISOString().slice(0, 10); }
function fmtDate(dateStr) { const d = new Date(dateStr + "T00:00:00"); return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }); }
function fmtSize(bytes) { if (bytes < 1024) return bytes + " B"; const units = ["KB", "MB", "GB"]; let val = bytes / 1024, i = 0; while (val >= 1024 && i < units.length - 1) { val /= 1024; i++; } return val.toFixed(val < 10 ? 1 : 0) + " " + units[i]; }
function initialsOf(name) { return name.split(" ").filter(Boolean).slice(0, 2).map(p => p[0].toUpperCase()).join(""); }
function fileIcoClass(ext) { if (!ext) return "folder"; ext = ext.toLowerCase(); if (ext === "pdf") return "pdf"; if (["docx", "doc"].includes(ext)) return "docx"; if (["xlsx", "xls"].includes(ext)) return "xlsx"; if (["pptx", "ppt"].includes(ext)) return "pptx"; return "generic"; }
function fileIconBlock(item, size) {
  const cls = item.type === "folder" ? "folder" : fileIcoClass(item.ext);
  const iconName = item.type === "folder" ? "folder" : "fileText";
  const sizeStyle = size ? ` style="width:${size}px;height:${size}px;"` : "";
  return `<div class="file-ico ${cls}"${sizeStyle}><svg class="icon" data-icon="${iconName}"></svg></div>`;
}
function checkoutBadge(item) {
  if (!item.checkedOutBy) return "";
  const mine = item.checkedOutBy === CURRENT_USER.name;
  return `<span class="badge ${mine ? "badge-warning" : "badge-secondary"}" data-tooltip="Checked out by ${esc(item.checkedOutBy)}"><svg class="icon icon-sm" data-icon="lock"></svg>${mine ? "You" : esc(item.checkedOutBy.split(" ")[0])}</span>`;
}
function tagBadges(tags) { return (tags || []).map(t => `<span class="badge badge-secondary">${esc(t)}</span>`).join(""); }
function siteIconName(icon) { return icon || "building2"; }

/* ---------------------------------------------------------------------- */
/*  Latest-spec prototype state                                            */
/* ---------------------------------------------------------------------- */
function loadPrototypeState() {
  const defaults = {
    favorites: FAVORITE_SEED.slice(0, 4).map(f => f.key),
    favoriteEntries: {},
    follows: {
      Site: ["finance"],
      Library: ["finance/documents"],
      Folder: [],
      Document: []
    },
    savedViews: {},
    ssoEnforcedGlobally: SSO_SETTINGS.enforcedGlobally
  };
  try {
    const saved = JSON.parse(localStorage.getItem("edms-prototype-state") || "null");
    if (!saved) return defaults;
    return {
      ...defaults,
      ...saved,
      favorites: Array.isArray(saved.favorites) ? saved.favorites : defaults.favorites,
      favoriteEntries: saved.favoriteEntries || {},
      follows: { ...defaults.follows, ...(saved.follows || {}) },
      savedViews: saved.savedViews || {}
    };
  } catch (e) { return defaults; }
}
const prototypeState = loadPrototypeState();
function savePrototypeState() {
  try { localStorage.setItem("edms-prototype-state", JSON.stringify(prototypeState)); } catch (e) {}
}
function favoriteKeyForItem(item, context) {
  const ctx = context || {};
  const site = item.site || ctx.site || getParam("site", "finance");
  const lib = item.lib || ctx.lib || getParam("lib", "documents");
  const folder = item.folder || ctx.folder || getParam("folder", "root");
  return item.type === "folder"
    ? `Folder:${site}/${lib}/${folder}/${item.id || item.name}`
    : `Document:${site}/${lib}/${folder}/${item.name}`;
}
function favoriteEntryForItem(item, context) {
  const key = favoriteKeyForItem(item, context);
  const existing = FAVORITE_SEED.find(f => f.key === key);
  if (existing) return existing;
  const site = item.site || (context && context.site) || getParam("site", "finance");
  const lib = item.lib || (context && context.lib) || getParam("lib", "documents");
  const folder = item.folder || (context && context.folder) || getParam("folder", "root");
  const siteName = findSite(site).name;
  const library = findSite(site).libraries.find(l => l.id === lib);
  return {
    key,
    objectType: item.type === "folder" ? "Folder" : "Document",
    name: item.name,
    location: `${siteName} / ${library ? library.name : lib}${folder !== "root" ? ` / ${folder}` : ""}`,
    ext: item.ext,
    href: item.type === "folder"
      ? `library.html?site=${site}&lib=${lib}&folder=${item.id}`
      : `library.html?site=${site}&lib=${lib}&folder=${folder}`
  };
}
function isFavorite(key) { return prototypeState.favorites.includes(key); }
function registerFavoriteEntry(entry) {
  if (entry && entry.key) prototypeState.favoriteEntries[entry.key] = entry;
}
function toggleFavorite(key, entry) {
  registerFavoriteEntry(entry);
  const i = prototypeState.favorites.indexOf(key);
  if (i >= 0) prototypeState.favorites.splice(i, 1);
  else prototypeState.favorites.push(key);
  savePrototypeState();
  return i < 0;
}
function favoriteButtonHtml(key, label) {
  const active = isFavorite(key);
  return `<button class="btn btn-ghost btn-icon btn-sm favorite-toggle${active ? " active" : ""}" data-favorite-toggle="${esc(key)}" aria-label="${active ? "Remove from favorites" : "Add to favorites"}" data-tooltip="${active ? "Remove from favorites" : "Add to favorites"}"><svg class="icon icon-sm" data-icon="star"></svg></button>`;
}
function getFavoriteCatalog() {
  const dynamic = Object.values(prototypeState.favoriteEntries || {});
  const merged = FAVORITE_SEED.concat(dynamic);
  return merged.filter((entry, i, all) => all.findIndex(other => other.key === entry.key) === i);
}
function followKey(type, site, lib, item) {
  if (type === "Site") return site;
  if (type === "Library") return `${site}/${lib}`;
  return favoriteKeyForItem(item, { site, lib });
}
function isFollowing(type, key) { return (prototypeState.follows[type] || []).includes(key); }
function toggleFollow(type, key) {
  prototypeState.follows[type] = prototypeState.follows[type] || [];
  const i = prototypeState.follows[type].indexOf(key);
  if (i >= 0) prototypeState.follows[type].splice(i, 1);
  else prototypeState.follows[type].push(key);
  savePrototypeState();
  return i < 0;
}
function followButtonHtml(type, key, compact) {
  const active = isFollowing(type, key);
  return `<button class="btn ${compact ? "btn-ghost btn-sm" : "btn-outline btn-sm"} follow-toggle${active ? " active" : ""}" data-follow-toggle="${esc(key)}" data-follow-type="${type}"><svg class="icon icon-sm" data-icon="bell"></svg>${active ? "Following" : "Follow"}</button>`;
}
function getLibraryViews(site, lib) {
  const key = `${site}/${lib}`;
  const base = (LIBRARY_VIEWS[key] || [{ id: "all-items", name: "All items", owner: "Shared", shared: true, filter: "", sortKey: "name", sortDir: "asc", groupBy: "none", isDefault: true }]).map(v => ({ ...v }));
  const personal = Array.isArray(prototypeState.savedViews[key]) ? prototypeState.savedViews[key] : [];
  return base.concat(personal);
}
function currentLibraryViewKey() { return `${getParam("site", "finance")}/${getParam("lib", "documents")}`; }

/* ---------------------------------------------------------------------- */
/*  Icon system — inline SVG paths injected into <svg data-icon="name">    */
/* ---------------------------------------------------------------------- */
const ICONS = {
  home: '<path d="M3 9.5 12 3l9 6.5"/><path d="M5 10v10a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V10"/>',
  folder: '<path d="M3 7a2 2 0 0 1 2-2h4.5l2 2H19a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/>',
  folderPlus: '<path d="M3 7a2 2 0 0 1 2-2h4.5l2 2H19a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/>',
  fileText: '<path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="13 2 13 8 19 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/><line x1="8" y1="9" x2="10" y2="9"/>',
  fileSearch: '<path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h7"/><polyline points="13 2 13 8 19 8"/><circle cx="16" cy="17" r="3"/><line x1="18.3" y1="19.3" x2="21" y2="22"/>',
  search: '<circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 6.5-2.5 8-2.5 8h17S18 14.5 18 8z"/><path d="M13.73 20a2 2 0 0 1-3.46 0"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1"/>',
  userPlus: '<path d="M14 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="8" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="16" y1="11" x2="22" y2="11"/>',
  moreHorizontal: '<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>',
  chevronDown: '<polyline points="6 9 12 15 18 9"/>',
  chevronRight: '<polyline points="9 6 15 12 9 18"/>',
  chevronLeft: '<polyline points="15 6 9 12 15 18"/>',
  x: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
  check: '<polyline points="20 6 9 17 4 12"/>',
  checkCircle2: '<path d="M22 11.1V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>',
  xCircle: '<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>',
  plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
  uploadCloud: '<path d="M16 16l-4-4-4 4"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
  trash2: '<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/>',
  pencil: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  move: '<polyline points="5 9 2 12 5 15"/><polyline points="9 5 12 2 15 5"/><polyline points="15 19 12 22 9 19"/><polyline points="19 9 22 12 19 15"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="12" y1="2" x2="12" y2="22"/>',
  eye: '<path d="M1.5 12S5 5 12 5s10.5 7 10.5 7-3.5 7-10.5 7S1.5 12 1.5 12z"/><circle cx="12" cy="12" r="3"/>',
  lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  lockOpen: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.75-1.4"/>',
  shieldCheck: '<path d="M12 22s7.5-3.5 7.5-10V5.5L12 2 4.5 5.5V12C4.5 18.5 12 22 12 22z"/><polyline points="9 12 11 14 15 10"/>',
  share2: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.6" y1="13.5" x2="15.4" y2="17.5"/><line x1="15.4" y1="6.5" x2="8.6" y2="10.5"/>',
  history: '<path d="M3 12a9 9 0 1 0 3-6.7"/><polyline points="3 4 3 9 8 9"/><polyline points="12 7 12 12 16 14"/>',
  rotateCcw: '<polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>',
  building2: '<path d="M6 22V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v18"/><path d="M14 9h5a1 1 0 0 1 1 1v12"/><line x1="9" y1="7" x2="9" y2="7.01"/><line x1="9" y1="11" x2="9" y2="11.01"/><line x1="9" y1="15" x2="9" y2="15.01"/><line x1="17" y1="13" x2="17" y2="13.01"/><line x1="17" y1="17" x2="17" y2="17.01"/><line x1="3" y1="22" x2="21" y2="22"/>',
  star: '<polygon points="12 2 15.1 8.6 22 9.3 17 14 18.2 21 12 17.6 5.8 21 7 14 2 9.3 8.9 8.6"/>',
  filter: '<polygon points="22 3 2 3 10 12.5 10 19 14 21 14 12.5"/>',
  info: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="11"/><line x1="12" y1="8" x2="12.01" y2="8"/>',
  alertTriangle: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h16.9a2 2 0 0 0 1.7-3L13.6 3.9a2 2 0 0 0-3.4 0z"/><line x1="12" y1="9" x2="12" y2="13.5"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
  database: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M20 12c0 1.66-3.58 3-8 3s-8-1.34-8-3"/><path d="M4 5v14c0 1.66 3.58 3 8 3s8-1.34 8-3V5"/>',
  tag: '<path d="M20.6 13.4 13 21a2 2 0 0 1-2.8 0L3 13.8V4a1 1 0 0 1 1-1h9.8a2 2 0 0 1 1.4.6l5.4 5.4a2 2 0 0 1 0 2.8z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
  menu: '<line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>',
  grid3x3: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>',
  list: '<line x1="9" y1="6" x2="21" y2="6"/><line x1="9" y1="12" x2="21" y2="12"/><line x1="9" y1="18" x2="21" y2="18"/><line x1="4" y1="6" x2="4.01" y2="6"/><line x1="4" y1="12" x2="4.01" y2="12"/><line x1="4" y1="18" x2="4.01" y2="18"/>',
  rocket: '<path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 19 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>',
  server: '<rect x="2" y="3" width="20" height="7" rx="1.5"/><rect x="2" y="14" width="20" height="7" rx="1.5"/><line x1="6" y1="6.5" x2="6.01" y2="6.5"/><line x1="6" y1="17.5" x2="6.01" y2="17.5"/>',
  megaphone: '<path d="M3 11v3a1 1 0 0 0 1 1h2l3.5 5v-15L6 9H4a1 1 0 0 0-1 2z"/><path d="M14 7a4 4 0 0 1 0 10"/><path d="M17.5 4.5a9 9 0 0 1 0 15"/>',
  landmark: '<line x1="3" y1="22" x2="21" y2="22"/><line x1="6" y1="18" x2="6" y2="11"/><line x1="10" y1="18" x2="10" y2="11"/><line x1="14" y1="18" x2="14" y2="11"/><line x1="18" y1="18" x2="18" y2="11"/><polygon points="12 2 21 8 3 8"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
  barChart: '<line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/>',
  sun: '<circle cx="12" cy="12" r="4.5"/><line x1="12" y1="2" x2="12" y2="4.5"/><line x1="12" y1="19.5" x2="12" y2="22"/><line x1="4.2" y1="4.2" x2="6" y2="6"/><line x1="18" y1="18" x2="19.8" y2="19.8"/><line x1="2" y1="12" x2="4.5" y2="12"/><line x1="19.5" y1="12" x2="22" y2="12"/><line x1="4.2" y1="19.8" x2="6" y2="18"/><line x1="18" y1="6" x2="19.8" y2="4.2"/>',
  moon: '<path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z"/>',
  logOut: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>',
  arrowLeft: '<line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>',
  mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><polyline points="2 7 12 13 22 7"/>',
  sliders: '<line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>',
  globe: '<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>',
  badgeCheck: '<path d="M12 2l2.4 1.4 2.8-.3 1.1 2.6 2.6 1.1-.3 2.8L22 12l-1.4 2.4.3 2.8-2.6 1.1-1.1 2.6-2.8-.3L12 22l-2.4-1.4-2.8.3-1.1-2.6-2.6-1.1.3-2.8L2 12l1.4-2.4-.3-2.8 2.6-1.1 1.1-2.6 2.8.3z"/><polyline points="9 12 11 14 15 10"/>',
  clock: '<circle cx="12" cy="12" r="9.5"/><polyline points="12 7 12 12 15.5 14"/>',
  trendingUp: '<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>',
  externalLink: '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>',
  palette: '<circle cx="13.5" cy="6.5" r=".6"/><circle cx="17.5" cy="10.5" r=".6"/><circle cx="8.5" cy="7.5" r=".6"/><circle cx="6.5" cy="12.5" r=".6"/><path d="M12 2a10 10 0 1 0 0 20 2 2 0 0 0 1.5-3.3 1.6 1.6 0 0 1 1.2-2.7H17a5 5 0 0 0 5-5A10 10 0 0 0 12 2z"/>',
  key: '<circle cx="7.5" cy="15.5" r="5.5"/><path d="M21 2l-9.6 9.6"/><path d="M15.5 7.5 19 4"/><path d="M18 8l3-3"/>',
  inbox: '<polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
  archive: '<polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5" rx="1"/><line x1="10" y1="12" x2="14" y2="12"/>',
  save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>',
  panelLeft: '<rect x="3" y="4" width="18" height="16" rx="2"/><line x1="9" y1="4" x2="9" y2="20"/>'
};
function hydrateIcons(root) {
  qsa("svg[data-icon]", root || document).forEach(svg => {
    const name = svg.getAttribute("data-icon");
    if (ICONS[name] && svg.dataset.hydrated !== "1") {
      svg.setAttribute("viewBox", "0 0 24 24");
      svg.innerHTML = ICONS[name];
      svg.dataset.hydrated = "1";
    }
  });
}

/* ---------------------------------------------------------------------- */
/*  Theme engine                                                           */
/* ---------------------------------------------------------------------- */
const THEME_META = [
  { id: "default", name: "Default", desc: "Light · Indigo accent", bg: "#ffffff", sidebar: "#f7f8fb", primary: "#4338ca", card: "#eef0f6" },
  { id: "midnight", name: "Midnight", desc: "Dark · Indigo accent", bg: "#0d1424", sidebar: "#0a1020", primary: "#a5b4fc", card: "#18213a" },
  { id: "ocean", name: "Ocean", desc: "Light · Blue accent", bg: "#fbfeff", sidebar: "#eef7fb", primary: "#0a79b3", card: "#e3f2f9" },
  { id: "forest", name: "Forest", desc: "Light · Green accent", bg: "#fdfcf9", sidebar: "#f5f4ea", primary: "#1f7a4d", card: "#eaf2e3" }
];
function applyTheme(id) {
  document.documentElement.setAttribute("data-theme", id);
  try { localStorage.setItem("edms-theme", id); } catch (e) {}
  qsa("[data-theme-active]").forEach(el => el.classList.toggle("active", el.getAttribute("data-theme-active") === id));
}
function currentTheme() { return document.documentElement.getAttribute("data-theme") || "default"; }
function quickToggleTheme() { applyTheme(currentTheme() === "midnight" ? "default" : "midnight"); }

/* ---------------------------------------------------------------------- */
/*  Toast system                                                           */
/* ---------------------------------------------------------------------- */
function ensurePortals() {
  if (!qs("#toastViewport")) {
    const v = document.createElement("div");
    v.id = "toastViewport";
    v.className = "toast-viewport";
    document.body.appendChild(v);
  }
  if (!qs("#sheetPortal")) {
    const s = document.createElement("div");
    s.id = "sheetPortal";
    s.className = "sheet-overlay";
    s.innerHTML = '<div class="sheet" id="sheetInner"></div>';
    document.body.appendChild(s);
  }
  if (!qs("#cmdkOverlay")) {
    const c = document.createElement("div");
    c.id = "cmdkOverlay";
    c.className = "cmdk-overlay";
    c.innerHTML = `
      <div class="cmdk">
        <div class="cmdk-input-wrap">
          <svg class="icon" data-icon="search"></svg>
          <input class="cmdk-input" id="cmdkInput" placeholder="Search sites, documents, or jump to a page…" autocomplete="off">
          <kbd class="key">Esc</kbd>
        </div>
        <div class="cmdk-list" id="cmdkList"></div>
        <div class="cmdk-footer">
          <span><kbd class="key">&uarr;</kbd> <kbd class="key">&darr;</kbd> to navigate</span>
          <span><kbd class="key">Enter</kbd> to select</span>
          <span style="margin-left:auto;">eDMS prototype</span>
        </div>
      </div>`;
    document.body.appendChild(c);
    hydrateIcons(c);
  }
  if (!qs("#contextMenuPortal")) {
    const c = document.createElement("div");
    c.id = "contextMenuPortal";
    c.className = "context-menu-portal";
    c.setAttribute("role", "menu");
    document.body.appendChild(c);
  }
}
function showToast(opts) {
  ensurePortals();
  const viewport = qs("#toastViewport");
  const variant = opts.variant || "default";
  const iconName = variant === "destructive" ? "xCircle" : variant === "info" ? "info" : "checkCircle2";
  const el = document.createElement("div");
  el.className = "toast" + (variant !== "default" ? " " + variant : "");
  el.innerHTML = `
    <div class="icon-wrap"><svg class="icon icon-sm" data-icon="${iconName}"></svg></div>
    <div class="flex-1 min-w-0">
      <div class="toast-title">${esc(opts.title || "")}</div>
      ${opts.desc ? `<div class="toast-desc">${esc(opts.desc)}</div>` : ""}
      ${opts.actionLabel ? `<button class="btn btn-link text-sm mt-2" style="font-size:12px;" data-toast-action>${esc(opts.actionLabel)}</button>` : ""}
    </div>
    <button class="toast-close" data-toast-close><svg class="icon icon-sm" data-icon="x"></svg></button>`;
  viewport.appendChild(el);
  hydrateIcons(el);
  const remove = () => { el.style.opacity = "0"; el.style.transform = "translateY(6px)"; setTimeout(() => el.remove(), 160); };
  el.querySelector("[data-toast-close]").addEventListener("click", remove);
  if (opts.onAction) el.querySelector("[data-toast-action]")?.addEventListener("click", () => { opts.onAction(); remove(); });
  const timer = setTimeout(remove, opts.duration || 5000);
  el.addEventListener("mouseenter", () => clearTimeout(timer));
}

/* ---------------------------------------------------------------------- */
/*  Dropdown menus (fixed-position, computed on open so they escape any    */
/*  ancestor's overflow:auto — e.g. a scrollable table)                    */
/* ---------------------------------------------------------------------- */
function closeAllDropdowns() { qsa(".dropdown-menu.open").forEach(m => m.classList.remove("open")); }
function closeContextMenu() {
  const menu = qs("#contextMenuPortal");
  if (menu) { menu.classList.remove("open"); menu.innerHTML = ""; }
}
function contextMenuItemsFor(item, scope) {
  if (scope === "recycle") return [
    ["restore", "rotateCcw", "Restore"],
    ["purge", "trash2", "Permanently delete"]
  ];
  if (scope === "favorite") return [
    ["open-favorite", "externalLink", "Open"],
    ["unfavorite", "star", "Remove from favorites"]
  ];
  const isFolder = item && item.type === "folder";
  return isFolder
    ? [["open", "eye", "Open"], ["rename", "pencil", "Rename"], ["move", "move", "Move to"], ["follow", "bell", "Follow / unfollow"], ["permissions", "shieldCheck", "Manage access"], ["share", "share2", "Share"], ["delete", "trash2", "Delete"]]
    : [["open", "eye", "Open"], ["preview", "fileSearch", "Preview"], ["download", "download", "Download"], ["rename", "pencil", "Rename"], ["move", "move", "Move to"], ["copy", "copy", "Copy to"], ["versions", "history", "Version history"], ["checkout", "lock", "Check out / in"], ["follow", "bell", "Follow / unfollow"], ["favorite", "star", "Favorite / unfavorite"], ["permissions", "shieldCheck", "Manage access"], ["share", "share2", "Share"], ["delete", "trash2", "Delete"]];
}
function openContextMenu(event, options) {
  event.preventDefault();
  event.stopPropagation();
  ensurePortals();
  closeAllDropdowns();
  const menu = qs("#contextMenuPortal");
  const items = contextMenuItemsFor(options.item, options.scope);
  menu.innerHTML = items.map(([action, icon, label], i) => `<button class="context-menu-item${action === "delete" || action === "purge" ? " destructive" : ""}" role="menuitem" data-context-action="${action}" data-context-index="${options.index == null ? "" : options.index}" data-context-scope="${options.scope || "library"}" data-context-key="${esc(options.key || "")}" data-context-position="${i}"><svg class="icon icon-sm" data-icon="${icon}"></svg>${label}</button>`).join("");
  menu.classList.add("open");
  const mw = menu.offsetWidth || 220, mh = menu.offsetHeight || 300;
  const x = Math.min(event.clientX || 8, window.innerWidth - mw - 8);
  const y = Math.min(event.clientY || 8, window.innerHeight - mh - 8);
  menu.style.left = Math.max(8, x) + "px";
  menu.style.top = Math.max(8, y) + "px";
  hydrateIcons(menu);
}
function openDropdown(trigger) {
  const menu = trigger.parentElement.querySelector(".dropdown-menu");
  if (!menu) return;
  const wasOpen = menu.classList.contains("open");
  closeAllDropdowns();
  if (wasOpen) return;
  const r = trigger.getBoundingClientRect();
  menu.style.visibility = "hidden";
  menu.classList.add("open");
  const mw = menu.offsetWidth || 210, mh = menu.offsetHeight || 200;
  let left = r.right - mw;
  left = Math.max(8, Math.min(left, window.innerWidth - mw - 8));
  let top = r.bottom + 6;
  if (top + mh > window.innerHeight - 8) top = r.top - mh - 6;
  menu.style.left = left + "px";
  menu.style.top = Math.max(8, top) + "px";
  menu.style.visibility = "";
}

/* ---------------------------------------------------------------------- */
/*  Dialogs (modal)                                                        */
/* ---------------------------------------------------------------------- */
function openDialog(id) { const el = document.getElementById(id); if (el) el.classList.add("open"); }
function closeDialog(el) { if (el) el.classList.remove("open"); }
function closeTopOverlay() { const open = qsa(".overlay.open"); if (open.length) closeDialog(open[open.length - 1]); }

/* ---------------------------------------------------------------------- */
/*  Sheet (slide-over) — generic portal, used for document details         */
/* ---------------------------------------------------------------------- */
function openSheet(html) {
  ensurePortals();
  qs("#sheetInner").innerHTML = html;
  qs("#sheetPortal").classList.add("open");
  hydrateIcons(qs("#sheetInner"));
}
function closeSheet() { const p = qs("#sheetPortal"); if (p) p.classList.remove("open"); }

/* ---------------------------------------------------------------------- */
/*  Document details sheet content (reused by library.html + search.html)  */
/* ---------------------------------------------------------------------- */
function generateVersions(item) {
  const major = Math.max(1, Math.round(parseFloat(item.version || "1.0")));
  const people = [item.modifiedBy, "Sarah Chen", "Jordan Reyes", "Marcus Johnson"];
  const versions = [];
  for (let v = major; v >= 1; v--) {
    versions.push({
      version: v === major ? item.version : v + ".0",
      by: v === major ? item.modifiedBy : people[v % people.length],
      date: v === major ? item.modified : shiftDateBack(item.modified, (major - v) * 9 + 3),
      size: item.size,
      comment: v === major ? "Latest changes" : v === 1 ? "Initial upload" : "Periodic update"
    });
  }
  return versions;
}
function generateActivity(item) {
  return [
    { action: "Modified", by: item.modifiedBy, date: item.modified, icon: "pencil" },
    { action: "Downloaded", by: "Elena Rodriguez", date: shiftDateBack(item.modified, 2), icon: "download" },
    { action: "Viewed", by: "David Kim", date: shiftDateBack(item.modified, 3), icon: "eye" },
    { action: "Shared with Site Members", by: item.modifiedBy, date: shiftDateBack(item.modified, 5), icon: "share2" },
    { action: "Uploaded", by: item.modifiedBy, date: shiftDateBack(item.modified, Math.max(6, Math.round(parseFloat(item.version || 1) * 9))), icon: "uploadCloud" }
  ];
}
let sheetBreakInherit = false;
function renderDocSheet(item, activeTab) {
  activeTab = activeTab || "properties";
  sheetBreakInherit = false;
  const favoriteEntry = favoriteEntryForItem(item);
  registerFavoriteEntry(favoriteEntry);
  item._favoriteKey = favoriteEntry.key;
  const itemFollowKey = followKey("Document", item.site || getParam("site", "finance"), item.lib || getParam("lib", "documents"), item);
  const versions = generateVersions(item);
  const activity = generateActivity(item);
  const tab = key => activeTab === key ? " active" : "";
  const html = `
    <div class="sheet-header">
      <div class="flex items-start gap-3">
        ${fileIconBlock(item, 40)}
        <div class="min-w-0 flex-1">
          <div class="font-semibold text-base truncate" title="${esc(item.name)}">${esc(item.name)}</div>
          <div class="text-muted text-xs mt-1">${esc(item.size || "")} &middot; v${esc(item.version || "1.0")} &middot; modified ${fmtDate(item.modified)}</div>
        </div>
        <div class="flex items-center gap-1">
          ${favoriteButtonHtml(favoriteEntry.key)}
          <button class="btn btn-ghost btn-icon btn-sm" onclick="closeSheet()"><svg class="icon" data-icon="x"></svg></button>
        </div>
      </div>
      ${item.checkedOutBy ? `<div class="alert alert-warning mt-3"><svg class="icon" data-icon="lock"></svg><div><div class="alert-title">Checked out</div>This file is checked out by ${item.checkedOutBy === CURRENT_USER.name ? "you" : esc(item.checkedOutBy)}. Others cannot upload a new version until it's checked in.</div></div>` : ""}
      <div class="tabs-list mt-3" data-tabs="docsheet">
        <button class="tab-trigger${tab("properties")}" data-tab-trigger="properties">Properties</button>
        <button class="tab-trigger${tab("versions")}" data-tab-trigger="versions">Versions</button>
        <button class="tab-trigger${tab("permissions")}" data-tab-trigger="permissions">Permissions</button>
        <button class="tab-trigger${tab("activity")}" data-tab-trigger="activity">Activity</button>
      </div>
    </div>
    <div class="sheet-body" data-tabs="docsheet">
      <div class="tab-panel${tab("properties")}" data-tab-panel="properties">
        <div class="field"><label class="label">Title</label><input class="input" value="${esc(item.name.replace(/\.[^.]+$/, ""))}"></div>
        <div class="field"><label class="label">Description</label><textarea class="textarea" placeholder="Add a description…" rows="3"></textarea></div>
        <div class="field"><label class="label">Tags</label><div class="flex flex-wrap gap-2">${tagBadges(item.tags) || '<span class="text-muted text-xs">No tags yet</span>'}</div></div>
        <div class="flex items-center justify-between p-3 border rounded mt-3"><div><div class="text-sm font-medium">Follow this document</div><div class="text-xs text-muted">Get alerts for new versions, deletes, or permission changes.</div></div>${followButtonHtml("Document", itemFollowKey)}</div>
        <div class="separator"></div>
        <div class="grid" style="grid-template-columns:1fr 1fr;gap:.75rem;font-size:12.5px;">
          <div><div class="text-muted text-xs">File size</div><div class="font-medium mt-1">${esc(item.size || "—")}</div></div>
          <div><div class="text-muted text-xs">File type</div><div class="font-medium mt-1 capitalize">${esc(item.ext || "—")}</div></div>
          <div><div class="text-muted text-xs">Modified by</div><div class="font-medium mt-1">${esc(item.modifiedBy)}</div></div>
          <div><div class="text-muted text-xs">Modified</div><div class="font-medium mt-1">${fmtDate(item.modified)}</div></div>
          <div><div class="text-muted text-xs">Created by</div><div class="font-medium mt-1">${esc(item.modifiedBy)}</div></div>
          <div><div class="text-muted text-xs">Current version</div><div class="font-medium mt-1">${esc(item.version || "1.0")}</div></div>
        </div>
      </div>
      <div class="tab-panel${tab("versions")}" data-tab-panel="versions">
        <div class="flex gap-2 mb-3">
          ${item.checkedOutBy === CURRENT_USER.name
            ? `<button class="btn btn-secondary btn-sm" data-row-action="checkin-sheet"><svg class="icon icon-sm" data-icon="lockOpen"></svg>Check in</button>`
            : item.checkedOutBy
            ? `<button class="btn btn-secondary btn-sm" disabled><svg class="icon icon-sm" data-icon="lock"></svg>Checked out by ${esc(item.checkedOutBy)}</button>`
            : `<button class="btn btn-secondary btn-sm" data-row-action="checkout-sheet"><svg class="icon icon-sm" data-icon="lock"></svg>Check out</button>`}
        </div>
        <div class="table-wrap"><table class="data-table"><thead><tr><th>Version</th><th>Modified by</th><th>Date</th><th>Size</th><th></th></tr></thead><tbody>
          ${versions.map((v, i) => `<tr>
            <td><span class="font-medium">${esc(v.version)}</span>${i === 0 ? ' <span class="badge badge-default">Current</span>' : ""}</td>
            <td>${esc(v.by)}</td><td>${fmtDate(v.date)}</td><td>${esc(v.size)}</td>
            <td class="text-right">${i === 0 ? "" : `<button class="btn btn-ghost btn-sm" data-row-action="restore-version" data-version="${esc(v.version)}">Restore</button>`}</td>
          </tr>`).join("")}
        </tbody></table></div>
      </div>
      <div class="tab-panel${tab("permissions")}" data-tab-panel="permissions">
        <div id="sheetPermsBody">${permissionsTabHtml()}</div>
      </div>
      <div class="tab-panel${tab("activity")}" data-tab-panel="activity">
        <div class="flex flex-col gap-1">
          ${activity.map(a => `<div class="flex items-start gap-3 py-2 border-b" style="border-color:hsl(var(--border));">
            <div class="stat-icon" style="width:28px;height:28px;flex-shrink:0;"><svg class="icon icon-sm" data-icon="${a.icon}"></svg></div>
            <div class="min-w-0"><div class="text-sm"><span class="font-medium">${esc(a.by)}</span> ${a.action.toLowerCase()}</div><div class="text-muted text-xs mt-1">${fmtDate(a.date)}</div></div>
          </div>`).join("")}
        </div>
      </div>
    </div>
    <div class="sheet-footer">
      ${followButtonHtml("Document", itemFollowKey)}
      <button class="btn btn-outline btn-sm" data-row-action="share-sheet"><svg class="icon icon-sm" data-icon="share2"></svg>Share</button>
      <button class="btn btn-outline btn-sm" data-row-action="download-sheet"><svg class="icon icon-sm" data-icon="download"></svg>Download</button>
      <button class="btn btn-primary btn-sm" onclick="closeSheet()">Done</button>
    </div>`;
  openSheet(html);
  window._sheetItem = item;
}
function permissionsTabHtml() {
  if (!sheetBreakInherit) {
    return `
      <div class="alert alert-info mb-3"><svg class="icon" data-icon="info"></svg><div>This item inherits permissions from its library. Break inheritance to set unique access.</div></div>
      <div class="flex flex-col gap-2">
        ${[["Site Owners", "Full Control"], ["Site Members", "Contribute"], ["Site Visitors", "Read"]].map(([name, level]) => `
          <div class="flex items-center gap-3 p-2 border rounded">
            <div class="avatar avatar-sm"><svg class="icon icon-sm" data-icon="users"></svg></div>
            <div class="flex-1 text-sm font-medium">${name}</div>
            <span class="badge badge-secondary">${level}</span>
          </div>`).join("")}
      </div>
      <button class="btn btn-outline btn-sm mt-3" data-row-action="break-inherit"><svg class="icon icon-sm" data-icon="shieldCheck"></svg>Stop inheriting permissions</button>`;
  }
  return `
    <div class="alert alert-warning mb-3"><svg class="icon" data-icon="alertTriangle"></svg><div>This item now has unique permissions. Changes here no longer follow the library.</div></div>
    <div class="flex flex-col gap-2">
      ${[["Site Owners", "Full Control"], ["Site Members", "Contribute"], ["Sarah Chen", "Read"]].map(([name, level]) => `
        <div class="flex items-center gap-3 p-2 border rounded">
          <div class="avatar avatar-sm">${name.includes(" ") && !name.startsWith("Site") ? initialsOf(name) : `<svg class="icon icon-sm" data-icon="users"></svg>`}</div>
          <div class="flex-1 text-sm font-medium">${name}</div>
          <span class="badge badge-secondary">${level}</span>
          <button class="btn btn-ghost btn-icon btn-sm"><svg class="icon icon-sm" data-icon="x"></svg></button>
        </div>`).join("")}
    </div>
    <div class="flex gap-2 mt-3">
      <button class="btn btn-outline btn-sm" data-row-action="grant-access"><svg class="icon icon-sm" data-icon="userPlus"></svg>Grant access</button>
      <button class="btn btn-ghost btn-sm" data-row-action="reset-inherit">Reset to inherited</button>
    </div>`;
}

/* ---------------------------------------------------------------------- */
/*  Command palette                                                        */
/* ---------------------------------------------------------------------- */
function buildCommandItems() {
  const nav = [
    { group: "Navigate", icon: "home", label: "Home", href: "home.html" },
    { group: "Navigate", icon: "search", label: "Advanced search", href: "search.html" },
    { group: "Navigate", icon: "star", label: "Favorites", href: "favorites.html" },
    { group: "Navigate", icon: "trash2", label: "Recycle Bin", href: "recycle-bin.html" },
    { group: "Navigate", icon: "user", label: "My Profile & Preferences", href: "profile.html" },
    { group: "Navigate", icon: "users", label: "Admin: Users", href: "admin-users.html" },
    { group: "Navigate", icon: "userPlus", label: "Admin: Groups", href: "admin-groups.html" },
    { group: "Navigate", icon: "building2", label: "Admin: Sites", href: "admin-sites.html" },
    { group: "Navigate", icon: "settings", label: "Admin: Settings", href: "admin-settings.html" },
    { group: "Navigate", icon: "barChart", label: "Admin: Storage Report", href: "admin-storage.html" },
    { group: "Navigate", icon: "clock", label: "Admin: Audit Log", href: "admin-audit-log.html" }
  ];
  const sites = SITES.map(s => ({ group: "Sites", icon: siteIconName(s.icon), label: s.name, href: `site-home.html?site=${s.slug}` }));
  const docs = SEARCH_INDEX.slice(0, 40).map(d => ({ group: "Documents", icon: "fileText", label: d.name, sub: d.siteName, href: `library.html?site=${d.site}&lib=${d.lib}&folder=${d.folder}` }));
  return [...nav, ...sites, ...docs];
}
let cmdkItems = [], cmdkActive = 0;
function openCmdk() {
  ensurePortals();
  cmdkItems = buildCommandItems();
  qs("#cmdkOverlay").classList.add("open");
  const input = qs("#cmdkInput");
  input.value = "";
  renderCmdk("");
  setTimeout(() => input.focus(), 30);
}
function closeCmdk() { const el = qs("#cmdkOverlay"); if (el) el.classList.remove("open"); }
function renderCmdk(query) {
  const list = qs("#cmdkList");
  const q = query.trim();
  const qLower = q.toLowerCase();
  let filtered = qLower ? cmdkItems.filter(i => i.label.toLowerCase().includes(qLower)) : cmdkItems.slice(0, 12);
  if (q) {
    filtered = [{ group: "Search", icon: "search", label: `Search everywhere for "${q}"`, href: `search.html?q=${encodeURIComponent(q)}` }, ...filtered];
  }
  cmdkActive = 0;
  if (!filtered.length) { list.innerHTML = `<div class="cmdk-empty">No results for “${esc(query)}”.</div>`; return; }
  const groups = {};
  filtered.slice(0, 30).forEach(i => { (groups[i.group] = groups[i.group] || []).push(i); });
  let idx = 0;
  list.innerHTML = Object.entries(groups).map(([g, items]) => `
    <div class="cmdk-group-label">${g}</div>
    ${items.map(i => {
      const html = `<div class="cmdk-item${idx === 0 ? " active" : ""}" data-cmdk-idx="${idx}" data-href="${esc(i.href)}">
        <svg class="icon icon-sm" data-icon="${i.icon}"></svg>
        <span class="truncate">${esc(i.label)}</span>
        ${i.sub ? `<span class="kbd-hint">${esc(i.sub)}</span>` : ""}
      </div>`;
      idx++;
      return html;
    }).join("")}
  `).join("");
  hydrateIcons(list);
  window._cmdkFiltered = filtered.slice(0, 30);
}
function cmdkMove(delta) {
  const items = qsa(".cmdk-item", qs("#cmdkList"));
  if (!items.length) return;
  cmdkActive = (cmdkActive + delta + items.length) % items.length;
  items.forEach((el, i) => el.classList.toggle("active", i === cmdkActive));
  items[cmdkActive].scrollIntoView({ block: "nearest" });
}
function cmdkGo() {
  const items = window._cmdkFiltered || [];
  const item = items[cmdkActive];
  if (item) location.href = item.href;
}

/* ---------------------------------------------------------------------- */
/*  App shell — sidebar + topbar, injected on every authenticated page      */
/* ---------------------------------------------------------------------- */
function buildSidebar() {
  const page = document.body.dataset.page;
  const curSite = getParam("site", "");
  let sitesHtml = "";
  SITES.forEach(s => {
    const isActive = (page === "site-home" || page === "library") && curSite === s.slug;
    sitesHtml += `<a class="sidebar-link${isActive ? " active" : ""}" href="site-home.html?site=${s.slug}">
      <span class="sidebar-site-dot" style="background:${s.color}"></span>
      <span class="truncate">${esc(s.name)}</span>
    </a>`;
    if (isActive) {
      sitesHtml += `<div class="sidebar-sub">` + s.libraries.map(l => {
        const libActive = page === "library" && getParam("lib", "") === l.id;
        return `<a class="sidebar-link${libActive ? " active" : ""}" href="library.html?site=${s.slug}&lib=${l.id}&folder=root"><svg class="icon icon-sm" data-icon="folder"></svg><span class="truncate">${esc(l.name)}</span></a>`;
      }).join("") + `</div>`;
    }
  });
  const link = (p, href, icon, label, extra) => `<a class="sidebar-link${page === p ? " active" : ""}" href="${href}"><svg class="icon" data-icon="${icon}"></svg><span class="truncate">${label}</span>${extra || ""}</a>`;
  return `
    <div class="sidebar-brand">
      <div class="mark">DM</div>
      <div><div class="brand-name">eDMS</div><div class="brand-sub">Prototype</div></div>
    </div>
    <div class="sidebar-scroll">
      ${link("home", "home.html", "home", "Home")}
      <div class="sidebar-section-label">Sites</div>
      ${sitesHtml}
      <div class="sidebar-section-label">Library</div>
      ${link("favorites", "favorites.html", "star", "Favorites", `<span class="badge-count">${prototypeState.favorites.length}</span>`)}
      ${link("recycle-bin", "recycle-bin.html", "trash2", "Recycle Bin")}
      <div class="sidebar-section-label">Admin Center</div>
      ${link("admin-users", "admin-users.html", "users", "Users")}
      ${link("admin-groups", "admin-groups.html", "userPlus", "Groups")}
      ${link("admin-sites", "admin-sites.html", "building2", "Sites")}
      ${link("admin-storage", "admin-storage.html", "barChart", "Storage Report")}
      ${link("admin-audit-log", "admin-audit-log.html", "clock", "Audit Log")}
      ${link("admin-settings", "admin-settings.html", "settings", "Settings")}
    </div>
    <div class="sidebar-footer">eDMS Prototype &middot; v1.0<br>Not connected to a real backend.</div>`;
}
function buildTopbar() {
  const unread = NOTIFICATIONS.filter(n => n.unread).length;
  return `
    <button class="btn btn-ghost btn-icon menu-toggle" id="mobileMenuBtn" aria-label="Open menu"><svg class="icon" data-icon="menu"></svg></button>
    <div class="topbar-search">
      <button class="topbar-search-btn" id="topSearchBtn"><svg class="icon icon-sm" data-icon="search"></svg><span class="label-text">Search sites, documents…</span><kbd>Ctrl K</kbd></button>
    </div>
    <div class="flex items-center gap-2" style="margin-left:auto;">
      <div class="dropdown">
        <button class="btn btn-primary btn-sm" data-dropdown-trigger><svg class="icon icon-sm" data-icon="plus"></svg><span class="desktop-only">New</span></button>
        <div class="dropdown-menu">
          <div class="dropdown-label">Create</div>
          <a class="dropdown-item" href="library.html?site=finance&lib=documents&folder=root&action=upload"><svg class="icon" data-icon="uploadCloud"></svg>Upload file</a>
          <a class="dropdown-item" href="library.html?site=finance&lib=documents&folder=root&action=newfolder"><svg class="icon" data-icon="folderPlus"></svg>New folder</a>
          <a class="dropdown-item" href="admin-sites.html?action=newsite"><svg class="icon" data-icon="building2"></svg>New site</a>
        </div>
      </div>
      <div class="dropdown">
        <button class="btn btn-ghost btn-icon" data-dropdown-trigger aria-label="Notifications" style="position:relative;">
          <svg class="icon" data-icon="bell"></svg>
          ${unread ? `<span style="position:absolute;top:6px;right:6px;width:8px;height:8px;border-radius:99px;background:hsl(var(--destructive));border:2px solid hsl(var(--background));"></span>` : ""}
        </button>
        <div class="dropdown-menu" style="width:320px;min-width:320px;">
          <div class="dropdown-label">Notifications</div>
          ${NOTIFICATIONS.map(n => `<div class="notif-item">
            ${n.unread ? '<span class="unread-dot"></span>' : '<span style="width:7px;flex-shrink:0;"></span>'}
            <div class="notif-ico"><svg class="icon icon-sm" data-icon="${n.icon}"></svg></div>
            <div class="min-w-0"><div class="notif-title">${esc(n.title)}</div><div class="notif-desc">${esc(n.desc)}</div><div class="notif-time">${esc(n.time)}</div></div>
          </div>`).join("")}
          <div class="dropdown-sep"></div>
          <div class="dropdown-item" style="justify-content:center;color:hsl(var(--primary));font-weight:600;">View all notifications</div>
        </div>
      </div>
      <button class="btn btn-ghost btn-icon" id="quickThemeBtn" aria-label="Toggle dark mode" data-tooltip="Quick theme toggle"><svg class="icon" data-icon="sun" id="quickThemeIcon"></svg></button>
      <div class="dropdown">
        <button data-dropdown-trigger style="display:flex;align-items:center;gap:.5rem;padding:.25rem .4rem .25rem .25rem;border-radius:999px;border:1px solid transparent;" onmouseover="this.style.borderColor='hsl(var(--border))'" onmouseout="this.style.borderColor='transparent'">
          <div class="avatar avatar-md">${esc(CURRENT_USER.initials)}</div>
          <svg class="icon icon-sm desktop-only" data-icon="chevronDown"></svg>
        </button>
        <div class="dropdown-menu" style="width:250px;min-width:250px;">
          <div class="user-menu-header"><div class="um-name">${esc(CURRENT_USER.name)}</div><div class="um-email">${esc(CURRENT_USER.email)}</div></div>
          <div class="dropdown-sep"></div>
          <a class="dropdown-item" href="profile.html"><svg class="icon" data-icon="user"></svg>My Profile</a>
          <a class="dropdown-item" href="profile.html#preferences"><svg class="icon" data-icon="sliders"></svg>Preferences &amp; Theme</a>
          <a class="dropdown-item" href="admin-users.html"><svg class="icon" data-icon="shieldCheck"></svg>Admin Center</a>
          <div class="dropdown-sep"></div>
          <a class="dropdown-item destructive" href="index.html"><svg class="icon" data-icon="logOut"></svg>Sign out</a>
        </div>
      </div>
    </div>`;
}
function injectShell() {
  const sidebarRoot = qs("#sidebarRoot");
  const topbarRoot = qs("#topbarRoot");
  if (sidebarRoot) sidebarRoot.innerHTML = buildSidebar();
  if (topbarRoot) topbarRoot.innerHTML = buildTopbar();
  hydrateIcons();
  const quickIcon = qs("#quickThemeIcon");
  if (quickIcon) quickIcon.setAttribute("data-icon", currentTheme() === "midnight" ? "moon" : "sun");
  qs("#quickThemeBtn")?.addEventListener("click", () => { quickToggleTheme(); const ic = qs("#quickThemeIcon"); ic.dataset.hydrated = ""; ic.setAttribute("data-icon", currentTheme() === "midnight" ? "moon" : "sun"); hydrateIcons(); });
  qs("#topSearchBtn")?.addEventListener("click", openCmdk);
  qs("#mobileMenuBtn")?.addEventListener("click", () => { qs("#appSidebar").classList.add("open"); qs("#sidebarBackdrop")?.classList.add("open"); });
  qs("#sidebarBackdrop")?.addEventListener("click", () => { qs("#appSidebar").classList.remove("open"); qs("#sidebarBackdrop").classList.remove("open"); });
}

/* ---------------------------------------------------------------------- */
/*  Global delegated event handling (dropdowns, dialogs, tabs, row actions) */
/* ---------------------------------------------------------------------- */
document.addEventListener("click", function (e) {
  const ddTrigger = e.target.closest("[data-dropdown-trigger]");
  if (ddTrigger) { e.stopPropagation(); openDropdown(ddTrigger); return; }
  if (!e.target.closest(".dropdown-menu")) closeAllDropdowns();
  if (!e.target.closest("#contextMenuPortal")) closeContextMenu();

  const dialogTrigger = e.target.closest("[data-dialog-trigger]");
  if (dialogTrigger) { openDialog(dialogTrigger.getAttribute("data-dialog-trigger")); return; }
  const dialogClose = e.target.closest("[data-dialog-close]");
  if (dialogClose) { closeDialog(dialogClose.closest(".overlay")); return; }
  if (e.target.classList.contains("overlay")) { closeDialog(e.target); return; }
  if (e.target.id === "sheetPortal") { closeSheet(); return; }
  if (e.target.id === "cmdkOverlay") { closeCmdk(); return; }

  const favoriteToggle = e.target.closest("[data-favorite-toggle]");
  if (favoriteToggle) {
    const key = favoriteToggle.getAttribute("data-favorite-toggle");
    const entry = window._sheetItem && window._sheetItem._favoriteKey === key ? favoriteEntryForItem(window._sheetItem) : getFavoriteCatalog().find(f => f.key === key);
    const active = toggleFavorite(key, entry);
    qsa(`[data-favorite-toggle="${CSS.escape(key)}"]`).forEach(btn => {
      btn.classList.toggle("active", active);
      btn.setAttribute("aria-label", active ? "Remove from favorites" : "Add to favorites");
      btn.setAttribute("data-tooltip", active ? "Remove from favorites" : "Add to favorites");
    });
    if (document.body.dataset.page === "favorites") renderFavoritesPage();
    if (window._sheetItem && window._sheetItem._favoriteKey === key) renderDocSheet(window._sheetItem, "properties");
    showToast({ title: active ? "Added to favorites" : "Removed from favorites", desc: active ? "You can find it in Favorites." : "The item is no longer pinned." });
    return;
  }
  const followToggle = e.target.closest("[data-follow-toggle]");
  if (followToggle) {
    const type = followToggle.getAttribute("data-follow-type");
    const key = followToggle.getAttribute("data-follow-toggle");
    const active = toggleFollow(type, key);
    qsa(`[data-follow-toggle="${CSS.escape(key)}"]`).forEach(btn => {
      btn.classList.toggle("active", active);
      btn.innerHTML = `<svg class="icon icon-sm" data-icon="bell"></svg>${active ? "Following" : "Follow"}`;
    });
    hydrateIcons();
    showToast({ title: active ? `Following ${type.toLowerCase()}` : `Unfollowed ${type.toLowerCase()}`, desc: active ? "You will receive activity alerts within this scope." : "Alerts for this scope are turned off." });
    return;
  }

  const contextAction = e.target.closest("[data-context-action]");
  if (contextAction) {
    const action = contextAction.getAttribute("data-context-action");
    const scope = contextAction.getAttribute("data-context-scope");
    const idx = contextAction.getAttribute("data-context-index");
    closeContextMenu();
    if (scope === "favorite") {
      const key = contextAction.getAttribute("data-context-key");
      if (action === "open-favorite") {
        const favorite = getFavoriteCatalog().find(f => f.key === key);
        if (favorite) location.href = favorite.href;
      } else if (action === "unfavorite") {
        toggleFavorite(key);
        renderFavoritesPage();
      }
      return;
    }
    if (scope === "recycle") {
      handleRecycleAction(action, parseInt(idx, 10));
      return;
    }
    if (idx !== "") handleRowAction(action, contextAction);
    return;
  }

  const tabTrigger = e.target.closest("[data-tab-trigger]");
  if (tabTrigger) {
    const key = tabTrigger.getAttribute("data-tab-trigger");
    const groupName = tabTrigger.closest("[data-tabs]")?.getAttribute("data-tabs");
    const scope = groupName ? `[data-tabs="${groupName}"] ` : "";
    qsa(`${scope}[data-tab-trigger]`).forEach(b => b.classList.toggle("active", b === tabTrigger));
    qsa(`${scope}[data-tab-panel]`).forEach(p => p.classList.toggle("active", p.getAttribute("data-tab-panel") === key));
    return;
  }

  const cmdkItem = e.target.closest(".cmdk-item");
  if (cmdkItem) { location.href = cmdkItem.getAttribute("data-href"); return; }

  const rowActionEl = e.target.closest("[data-row-action]");
  if (rowActionEl) { handleRowAction(rowActionEl.getAttribute("data-row-action"), rowActionEl); return; }

  if (e.target.closest("#quickInputConfirmBtn")) {
    const val = qs("#quickInputField").value.trim();
    if (val && window._quickInputConfirm) window._quickInputConfirm(val);
    closeDialog(qs("#quickInputDialog"));
    return;
  }
  if (e.target.closest("#moveCopyConfirmBtn")) { performMoveCopy(); return; }
  if (e.target.closest("#shareSendBtn")) {
    const name = window._shareItem ? window._shareItem.name : "item";
    showToast({ title: `Shared "${name}"`, desc: "An email notification was sent to the people you added." });
    closeDialog(qs("#shareDialog"));
    return;
  }
});
document.addEventListener("change", function (e) {
  const rowCheck = e.target.closest(".row-check");
  if (rowCheck) { toggleSelect(parseInt(rowCheck.dataset.index, 10), rowCheck.checked); return; }
  const selectAll = e.target.closest("#selectAllCheckbox");
  if (selectAll && typeof currentItems !== "undefined") {
    currentItems.forEach((_, i) => (selectAll.checked ? selectedIndexes.add(i) : selectedIndexes.delete(i)));
    updateSelectionUI();
  }
});
document.addEventListener("keydown", function (e) {
  if (e.key === "Escape") { closeAllDropdowns(); closeContextMenu(); closeTopOverlay(); closeSheet(); closeCmdk(); }
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); openCmdk(); }
  if (e.key === "Enter" && e.target.id === "quickInputField") { e.preventDefault(); qs("#quickInputConfirmBtn").click(); }
  if (qs("#cmdkOverlay")?.classList.contains("open")) {
    if (e.key === "ArrowDown") { e.preventDefault(); cmdkMove(1); }
    if (e.key === "ArrowUp") { e.preventDefault(); cmdkMove(-1); }
    if (e.key === "Enter") { e.preventDefault(); cmdkGo(); }
  }
});
document.addEventListener("input", function (e) {
  if (e.target.id === "cmdkInput") renderCmdk(e.target.value);
});

let contextLongPressTimer = null;
function contextTargetOptions(target) {
  const scope = target.getAttribute("data-context-scope") || "library";
  const index = target.getAttribute("data-context-index");
  if (scope === "recycle") return { scope, index, item: recycleItems[parseInt(index, 10)] };
  if (scope === "favorite") {
    const key = target.getAttribute("data-context-key");
    return { scope, index, key, item: getFavoriteCatalog().find(f => f.key === key) };
  }
  return { scope, index, item: currentItems[parseInt(index, 10)] };
}
document.addEventListener("contextmenu", function (e) {
  const target = e.target.closest("[data-context-index]");
  if (!target) return;
  const options = contextTargetOptions(target);
  if (options.item) openContextMenu(e, options);
});
document.addEventListener("pointerdown", function (e) {
  if (e.pointerType !== "touch") return;
  const target = e.target.closest("[data-context-index]");
  if (!target) return;
  const options = contextTargetOptions(target);
  if (!options.item) return;
  contextLongPressTimer = setTimeout(() => openContextMenu({
    preventDefault() {}, stopPropagation() {}, clientX: e.clientX, clientY: e.clientY
  }, options), 650);
});
document.addEventListener("pointerup", () => clearTimeout(contextLongPressTimer));
document.addEventListener("pointercancel", () => clearTimeout(contextLongPressTimer));
document.addEventListener("pointermove", () => clearTimeout(contextLongPressTimer));
document.addEventListener("keydown", function (e) {
  if (!(e.key === "ContextMenu" || (e.key === "F10" && e.shiftKey))) return;
  const target = e.target.closest?.("[data-context-index]");
  if (!target) return;
  const rect = target.getBoundingClientRect();
  const options = contextTargetOptions(target);
  if (!options.item) return;
  e.preventDefault();
  openContextMenu({ preventDefault() {}, stopPropagation() {}, clientX: rect.left + 24, clientY: rect.top + 24 }, options);
});

/* ---------------------------------------------------------------------- */
/*  Row-action handler — shared by library.html + search.html sheets       */
/* ---------------------------------------------------------------------- */
function handleRowAction(action, el) {
  const idx = el.getAttribute("data-index") !== null ? parseInt(el.getAttribute("data-index"), 10) : null;
  const item = idx !== null && typeof currentItems !== "undefined" ? currentItems[idx] : window._sheetItem;
  switch (action) {
    case "open":
      if (item.type === "folder") location.href = folderHref(item);
      else openDocSheetByIndex(idx, "properties");
      break;
    case "preview":
      qs("#previewName").textContent = item.name;
      qs("#previewIcoWrap").innerHTML = fileIconBlock(item, 46);
      hydrateIcons(qs("#previewIcoWrap"));
      openDialog("previewDialog");
      break;
    case "download": case "download-sheet":
      showToast({ title: `Downloading ${item.name}…`, variant: "info" });
      break;
    case "rename":
      openQuickInput({ title: "Rename", label: "Name", value: item.name, confirmLabel: "Rename", onConfirm: v => { if (v) { item.name = v; renderLibraryItems(); showToast({ title: "Renamed successfully" }); } } });
      break;
    case "move":
      openMoveCopyDialog(idx, "move");
      break;
    case "copy":
      openMoveCopyDialog(idx, "copy");
      break;
    case "versions":
      openDocSheetByIndex(idx, "versions");
      break;
    case "permissions":
      openDocSheetByIndex(idx, "permissions");
      break;
    case "share": case "share-sheet":
      openShareDialog(item);
      break;
    case "favorite": {
      const entry = favoriteEntryForItem(item);
      const active = toggleFavorite(entry.key, entry);
      showToast({ title: active ? "Added to favorites" : "Removed from favorites", desc: active ? `${item.name} is pinned for quick access.` : `${item.name} was unpinned.` });
      if (window._sheetItem === item) renderDocSheet(item, "properties");
      break;
    }
    case "follow": {
      const type = item.type === "folder" ? "Folder" : "Document";
      const key = followKey(type, item.site || getParam("site", "finance"), item.lib || getParam("lib", "documents"), item);
      const active = toggleFollow(type, key);
      showToast({ title: active ? `Following ${type.toLowerCase()}` : `Unfollowed ${type.toLowerCase()}`, desc: active ? "Activity alerts are enabled." : "Activity alerts are disabled." });
      break;
    }
    case "checkout":
      toggleCheckout(idx);
      break;
    case "checkout-sheet":
      window._sheetItem.checkedOutBy = CURRENT_USER.name;
      showToast({ title: "Checked out", desc: "Only you can upload a new version until you check in." });
      renderDocSheet(window._sheetItem, "versions");
      syncSheetItemToList();
      break;
    case "checkin-sheet":
      window._sheetItem.checkedOutBy = null;
      window._sheetItem.version = bumpVersion(window._sheetItem.version);
      window._sheetItem.modified = todayStr();
      window._sheetItem.modifiedBy = CURRENT_USER.name;
      showToast({ title: "Checked in", desc: `New version ${window._sheetItem.version} created.` });
      renderDocSheet(window._sheetItem, "versions");
      syncSheetItemToList();
      break;
    case "restore-version":
      showToast({ title: `Restored version ${el.getAttribute("data-version")}`, desc: "A new version was created from the restored content." });
      break;
    case "break-inherit":
      sheetBreakInherit = true;
      qs("#sheetPermsBody").innerHTML = permissionsTabHtml();
      hydrateIcons(qs("#sheetPermsBody"));
      showToast({ title: "Unique permissions enabled" });
      break;
    case "reset-inherit":
      sheetBreakInherit = false;
      qs("#sheetPermsBody").innerHTML = permissionsTabHtml();
      hydrateIcons(qs("#sheetPermsBody"));
      showToast({ title: "Reset to inherited permissions" });
      break;
    case "grant-access":
      showToast({ title: "Access granted", desc: "Invited people will receive an email notification." });
      break;
    case "delete":
      deleteItem(idx);
      break;
  }
}
function bumpVersion(v) { const n = parseFloat(v || "1.0"); return (Math.floor(n) + 1).toFixed(1); }
function folderHref(item) {
  const site = getParam("site", "finance"), lib = getParam("lib", "documents");
  return `library.html?site=${site}&lib=${lib}&folder=${item.id}`;
}
function syncSheetItemToList() {
  if (!window._sheetItem) return;
  if (typeof currentItems !== "undefined") {
    const i = currentItems.findIndex(it => it.name === window._sheetItem.name);
    if (i > -1) currentItems[i] = window._sheetItem;
  }
  if (qs("#libTableBody")) renderLibraryItems();
  else if (qs("#searchResultsList")) renderSearchResults();
}

/* ---------------------------------------------------------------------- */
/*  Quick single-input dialog (Rename / New folder)                        */
/* ---------------------------------------------------------------------- */
function openQuickInput(opts) {
  qs("#quickInputTitle").textContent = opts.title;
  qs("#quickInputLabel").textContent = opts.label;
  qs("#quickInputField").value = opts.value || "";
  qs("#quickInputConfirmBtn").textContent = opts.confirmLabel || "Save";
  window._quickInputConfirm = opts.onConfirm;
  openDialog("quickInputDialog");
  setTimeout(() => qs("#quickInputField").focus(), 30);
}

/* ---------------------------------------------------------------------- */
/*  Move / Copy dialog                                                     */
/* ---------------------------------------------------------------------- */
function openMoveCopyDialog(idx, mode) {
  window._moveCopyIdx = idx; window._moveCopyMode = mode;
  qs("#moveCopyTitle").textContent = mode === "move" ? "Move to" : "Copy to";
  qs("#moveCopyConfirmBtn").textContent = mode === "move" ? "Move here" : "Copy here";
  const sel = qs("#moveCopyDestination");
  sel.innerHTML = SITES.flatMap(s => s.libraries.map(l => `<option value="${s.slug}/${l.id}">${esc(s.name)} / ${esc(l.name)}</option>`)).join("");
  openDialog("moveCopyDialog");
}
function performMoveCopy() {
  const idx = window._moveCopyIdx, mode = window._moveCopyMode;
  const item = currentItems[idx];
  if (!item) { closeDialog(qs("#moveCopyDialog")); return; }
  const destSelect = qs("#moveCopyDestination");
  const destText = destSelect.options[destSelect.selectedIndex] ? destSelect.options[destSelect.selectedIndex].textContent : "destination";
  if (mode === "copy") {
    const copy = Object.assign({}, item, {
      name: item.type === "folder" ? item.name + " - Copy" : item.name.replace(/(\.[^.]+)?$/, m => " - Copy" + m),
      version: "1.0", checkedOutBy: null, modified: todayStr(), modifiedBy: CURRENT_USER.name
    });
    currentItems.splice(idx + 1, 0, copy);
    showToast({ title: `Copied to ${destText}`, desc: `"${copy.name}" was created.` });
  } else {
    currentItems.splice(idx, 1);
    showToast({ title: `Moved to ${destText}`, desc: `"${item.name}" is no longer in this folder.` });
  }
  renderLibraryItems();
  closeSheet();
  closeDialog(qs("#moveCopyDialog"));
}

/* ---------------------------------------------------------------------- */
/*  Share dialog                                                           */
/* ---------------------------------------------------------------------- */
function openShareDialog(item) {
  window._shareItem = item;
  qs("#shareItemName").textContent = item.name;
  qs("#shareIcoWrap").innerHTML = fileIconBlock(item, 34);
  hydrateIcons(qs("#shareIcoWrap"));
  qs("#sharePeopleInput").value = "";
  openDialog("shareDialog");
}

/* ---------------------------------------------------------------------- */
/*  DOMContentLoaded bootstrap                                             */
/* ---------------------------------------------------------------------- */
document.addEventListener("DOMContentLoaded", function () {
  ensurePortals();
  injectShell();
  hydrateIcons();
  const page = document.body.dataset.page;
  const initFns = {
    home: initHomePage, "site-home": initSiteHomePage, library: initLibraryPage, search: initSearchPage, favorites: initFavoritesPage,
    "recycle-bin": initRecycleBinPage, profile: initProfilePage, "admin-users": initAdminUsersPage,
    "admin-groups": initAdminGroupsPage, "admin-sites": initAdminSitesPage, "admin-settings": initAdminSettingsPage,
    "admin-storage": initAdminStoragePage, "admin-audit-log": initAdminAuditLogPage
  };
  if (initFns[page]) initFns[page]();
  hydrateIcons();
});

/* ======================================================================= *
 *  PAGE: home.html                                                        *
 * ======================================================================= */
function initHomePage() {
  qs("#greetingName").textContent = CURRENT_USER.name.split(" ")[0];
  qs("#statTotalSites").textContent = SITES.length;
  qs("#statStorage").textContent = SITES.reduce((s, x) => s + x.storageUsedGB, 0).toFixed(1) + " GB";
  qs("#statDocs").textContent = SEARCH_INDEX.length + "+";
  qs("#statNotifs").textContent = NOTIFICATIONS.filter(n => n.unread).length;

  qs("#siteGrid").innerHTML = SITES.map(s => `
    <a class="site-card" href="site-home.html?site=${s.slug}">
      <div class="site-icon" style="background:${s.color}"><svg class="icon" data-icon="${siteIconName(s.icon)}"></svg></div>
      <div class="site-name">${esc(s.name)}</div>
      <div class="site-desc">${esc(s.description)}</div>
      <div class="site-meta"><span>${s.libraries.length} librar${s.libraries.length === 1 ? "y" : "ies"}</span><span>${s.members} members</span></div>
    </a>`).join("");

  qs("#quickAccessList").innerHTML = QUICK_ACCESS.map(q => `
    <a class="recent-item" href="library.html?site=${q.site}&lib=${q.lib}&folder=${q.folder}">
      ${fileIconBlock({ type: "file", ext: q.ext })}
      <div class="min-w-0 flex-1"><div class="text-sm font-medium truncate">${esc(q.name)}</div><div class="text-muted text-xs">${esc(findSite(q.site).name)}</div></div>
      <svg class="icon icon-sm text-muted" data-icon="chevronRight"></svg>
    </a>`).join("");

  const recentEl = qs("#recentDocumentsList");
  if (recentEl) {
    recentEl.innerHTML = RECENT_DOCUMENTS.map(d => `
      <a class="recent-item" href="library.html?site=${d.site}&lib=${d.lib}&folder=${d.folder}">
        ${fileIconBlock({ type: "file", ext: d.ext })}
        <div class="min-w-0 flex-1"><div class="text-sm font-medium truncate">${esc(d.name)}</div><div class="text-muted text-xs">${esc(findSite(d.site).name)} / ${esc(d.action.toLowerCase())}</div></div>
        <span class="text-muted text-xs flex-none">${esc(d.touchedAt)}</span>
      </a>`).join("");
  }

  qs("#recentActivityList").innerHTML = AUDIT_LOG.slice(0, 6).map(a => `
    <div class="flex items-center gap-3 py-2 border-b" style="border-color:hsl(var(--border));">
      <div class="avatar avatar-sm">${initialsOf(a.user)}</div>
      <div class="min-w-0 flex-1 text-sm"><span class="font-medium">${esc(a.user)}</span> <span class="text-muted">${actionVerb(a.action)}</span> ${a.object !== "—" ? `<span class="font-medium">${esc(a.object)}</span>` : ""}</div>
      <div class="text-muted text-xs flex-none">${esc(a.time.split(" ")[1])}</div>
    </div>`).join("");
  hydrateIcons();
}
function actionVerb(action) {
  const map = { Upload: "uploaded", Download: "downloaded", View: "viewed", EditMetadata: "edited", Delete: "deleted", Restore: "restored", Rename: "renamed", Move: "moved", Copy: "copied", CheckOut: "checked out", CheckIn: "checked in", PermissionChange: "changed permissions on", Share: "shared", Login: "signed in" };
  return map[action] || action.toLowerCase();
}

/* ======================================================================= *
 *  PAGE: site-home.html                                                   *
 * ======================================================================= */
function initSiteHomePage() {
  const site = findSite(getParam("site", "finance"));
  document.title = site.name + " — eDMS";
  qs("#siteHeaderIcon").style.background = site.color;
  qs("#siteHeaderIcon").innerHTML = `<svg class="icon icon-lg" data-icon="${siteIconName(site.icon)}"></svg>`;
  qs("#siteHeaderName").textContent = site.name;
  qs("#siteHeaderDesc").textContent = site.description;
  qs("#siteHeaderMembers").textContent = site.members + " members";
  qs("#siteHeaderStorage").textContent = site.storageUsedGB.toFixed(1) + " GB of " + site.storageQuotaGB + " GB used";
  qs("#siteStorageBar").style.width = Math.min(100, (site.storageUsedGB / site.storageQuotaGB) * 100) + "%";
  qs("#siteBreadcrumbName").textContent = site.name;
  const siteFavoriteKey = `Site:${site.slug}`;
  const siteFollowKey = followKey("Site", site.slug);
  if (qs("#siteFavoriteControl")) qs("#siteFavoriteControl").innerHTML = favoriteButtonHtml(siteFavoriteKey);
  if (qs("#siteFollowControl")) qs("#siteFollowControl").innerHTML = followButtonHtml("Site", siteFollowKey);

  qs("#siteLibraryGrid").innerHTML = site.libraries.map(l => {
    const data = getLibraryContents(site.slug, l.id, "root");
    const libraryFollowKey = followKey("Library", site.slug, l.id);
    return `<div class="card site-library-card" style="padding:1.1rem;display:flex;gap:.85rem;align-items:center;">
      <a class="flex items-center gap-3 flex-1 min-w-0" href="library.html?site=${site.slug}&lib=${l.id}&folder=root">
        <div class="file-ico folder" style="width:44px;height:44px;"><svg class="icon" data-icon="folder"></svg></div>
        <div class="flex-1 min-w-0"><div class="font-medium text-sm">${esc(l.name)}</div><div class="text-muted text-xs mt-1">${data.items.length} items</div></div>
        <svg class="icon text-muted" data-icon="chevronRight"></svg>
      </a>
      ${followButtonHtml("Library", libraryFollowKey, true)}
    </div>`;
  }).join("");

  const siteActivity = AUDIT_LOG.filter(a => a.site === site.name).slice(0, 8);
  qs("#siteActivityList").innerHTML = (siteActivity.length ? siteActivity : AUDIT_LOG.slice(0, 5)).map(a => `
    <div class="flex items-center gap-3 py-2 border-b" style="border-color:hsl(var(--border));">
      <div class="avatar avatar-sm">${initialsOf(a.user)}</div>
      <div class="min-w-0 flex-1 text-sm"><span class="font-medium">${esc(a.user)}</span> <span class="text-muted">${actionVerb(a.action)}</span> ${a.object !== "—" ? `<span class="font-medium">${esc(a.object)}</span>` : ""}</div>
      <div class="text-muted text-xs flex-none">${a.time.split(" ")[0].slice(5)}</div>
    </div>`).join("");

  qs("#siteMembersBody").innerHTML = ["Owners", "Members", "Visitors"].map((role, i) => {
    const count = [2, Math.max(2, site.members - 4), 2][i];
    return `<div class="flex items-center justify-between py-2 border-b" style="border-color:hsl(var(--border));">
      <div class="flex items-center gap-2 text-sm"><svg class="icon icon-sm text-muted" data-icon="users"></svg><span class="font-medium">${site.name} ${role}</span></div>
      <span class="text-muted text-xs">${count} members</span>
    </div>`;
  }).join("");
  hydrateIcons();
}

/* ======================================================================= *
 *  PAGE: library.html — the flagship interactive page                     *
 * ======================================================================= */
let currentItems = [];
let currentSort = { key: "name", dir: "asc" };
let selectedIndexes = new Set();
let libView = "list";
let currentLibraryFilter = "";
let currentLibraryGroupBy = "none";
let currentLibraryViewId = "all-items";

function initLibraryPage() {
  const site = findSite(getParam("site", "finance"));
  const libId = getParam("lib", site.libraries[0].id);
  const folder = getParam("folder", "root");
  const lib = site.libraries.find(l => l.id === libId) || site.libraries[0];
  const data = getLibraryContents(site.slug, lib.id, folder);
  currentItems = data.items.slice();
  currentSort = { key: "name", dir: "asc" };
  currentLibraryFilter = "";
  currentLibraryGroupBy = "none";
  currentLibraryViewId = "all-items";

  document.title = `${lib.name} · ${site.name} — eDMS`;
  qs("#libPageTitle").textContent = folder === "root" ? lib.name : data.name;
  qs("#libSiteName").textContent = site.name;
  qs("#libSiteHref").setAttribute("href", `site-home.html?site=${site.slug}`);
  qs("#libLibraryName").textContent = lib.name;
  qs("#libLibraryHref").setAttribute("href", `library.html?site=${site.slug}&lib=${lib.id}&folder=root`);

  const crumbExtra = qs("#libBreadcrumbExtra");
  if (folder !== "root" && data.parent) {
    crumbExtra.innerHTML = `<svg class="icon icon-sm sep" data-icon="chevronRight"></svg><span class="current">${esc(data.name)}</span>`;
  } else { crumbExtra.innerHTML = ""; }

  if (qs("#libraryFollowControl")) qs("#libraryFollowControl").innerHTML = followButtonHtml("Library", followKey("Library", site.slug, lib.id));
  renderLibraryViewPicker(site.slug, lib.id);
  const defaultView = getLibraryViews(site.slug, lib.id).find(v => v.isDefault);
  if (defaultView) applyLibraryView(defaultView, false);

  renderLibraryItems();
  initUploadDropzone();

  qs("#viewListBtn").addEventListener("click", () => setLibView("list"));
  qs("#viewGridBtn").addEventListener("click", () => setLibView("grid"));
  qsa("[data-sort-key]").forEach(h => h.addEventListener("click", () => sortLibrary(h.getAttribute("data-sort-key"))));
  qs("#newFolderBtn")?.addEventListener("click", () => {
    openQuickInput({ title: "New folder", label: "Folder name", value: "", confirmLabel: "Create", onConfirm: v => { if (v) { currentItems.unshift({ type: "folder", id: v.toLowerCase().replace(/[^a-z0-9]+/g, "-"), name: v, modified: todayStr(), modifiedBy: CURRENT_USER.name }); renderLibraryItems(); showToast({ title: `Folder "${v}" created` }); } } });
  });
  qs("#bulkDeleteBtn")?.addEventListener("click", bulkDelete);
  qs("#bulkDownloadBtn")?.addEventListener("click", () => showToast({ title: `Preparing ${selectedIndexes.size} item(s) for download…`, variant: "info" }));
  qs("#bulkZipBtn")?.addEventListener("click", () => showToast({ title: `Preparing ZIP for ${selectedIndexes.size} item(s)…`, desc: "Folders and documents will keep their library structure.", variant: "info" }));
  qs("#bulkMoveBtn")?.addEventListener("click", () => showToast({ title: `Move ${selectedIndexes.size} item(s)`, desc: "The production app opens a destination picker here.", variant: "info" }));
  qs("#bulkEditBtn")?.addEventListener("click", openBulkEditDialog);
  qs("#bulkEditForm")?.addEventListener("submit", submitBulkEdit);
  qs("#clearSelectionBtn")?.addEventListener("click", clearSelection);
  qs("#libraryViewPicker")?.addEventListener("change", e => {
    const view = getLibraryViews(site.slug, lib.id).find(v => v.id === e.target.value);
    if (view) applyLibraryView(view);
  });
  qs("#libraryFilterInput")?.addEventListener("input", e => { currentLibraryFilter = e.target.value.trim().toLowerCase(); currentLibraryViewId = "custom"; renderLibraryItems(); });
  qs("#groupBySelect")?.addEventListener("change", e => { currentLibraryGroupBy = e.target.value; currentLibraryViewId = "custom"; renderLibraryItems(); });
  qs("#saveViewBtn")?.addEventListener("click", openSaveViewDialog);
  qs("#saveViewForm")?.addEventListener("submit", submitSaveView);

  const action = getParam("action", "");
  if (action === "upload") openDialog("uploadDialog");
  if (action === "newfolder") qs("#newFolderBtn")?.click();

  hydrateIcons();
}

function setLibView(v) {
  libView = v;
  qs("#libListWrap").classList.toggle("hidden", v !== "list");
  qs("#libGridWrap").classList.toggle("hidden", v !== "grid");
  qs("#viewListBtn").classList.toggle("active", v === "list");
  qs("#viewGridBtn").classList.toggle("active", v === "grid");
}

function renderLibraryViewPicker(site, lib) {
  const picker = qs("#libraryViewPicker");
  if (!picker) return;
  const views = getLibraryViews(site, lib);
  picker.innerHTML = views.map(v => `<option value="${esc(v.id)}">${esc(v.name)}${v.isDefault ? " · default" : v.owner === "You" ? " · personal" : ""}</option>`).join("");
  picker.value = currentLibraryViewId === "custom" ? "" : currentLibraryViewId;
}
function applyLibraryView(view, render) {
  currentLibraryViewId = view.id;
  currentLibraryFilter = (view.filter || "").toLowerCase();
  currentLibraryGroupBy = view.groupBy || "none";
  currentSort = { key: view.sortKey || "name", dir: view.sortDir || "asc" };
  if (qs("#libraryFilterInput")) qs("#libraryFilterInput").value = view.filter || "";
  if (qs("#groupBySelect")) qs("#groupBySelect").value = currentLibraryGroupBy;
  if (qs("#libraryViewPicker")) qs("#libraryViewPicker").value = view.id;
  sortLibraryItems();
  if (render !== false) renderLibraryItems();
}
function sortLibraryItems() {
  const key = currentSort.key;
  currentItems.sort((a, b) => {
    if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
    let av, bv;
    if (key === "size") { av = parseSizeVal(a); bv = parseSizeVal(b); return currentSort.dir === "asc" ? av - bv : bv - av; }
    av = a[key] || ""; bv = b[key] || "";
    const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true });
    return currentSort.dir === "asc" ? cmp : -cmp;
  });
}
function visibleLibraryEntries() {
  const q = currentLibraryFilter;
  return currentItems.map((item, index) => ({ item, index })).filter(({ item }) => {
    if (!q) return true;
    return [item.name, item.modifiedBy, ...(item.tags || [])].some(v => String(v || "").toLowerCase().includes(q));
  });
}
function groupLabelFor(item) {
  if (currentLibraryGroupBy === "type") return item.type === "folder" ? "Folders" : "Documents";
  if (currentLibraryGroupBy === "modifiedBy") return item.modifiedBy || "Unknown owner";
  return "";
}
function renderGrouped(entries, rowRenderer, separatorRenderer) {
  if (currentLibraryGroupBy === "none") return entries.map(rowRenderer).join("");
  let lastGroup = null;
  return entries.map(entry => {
    const group = groupLabelFor(entry.item);
    const prefix = group !== lastGroup ? separatorRenderer(group) : "";
    lastGroup = group;
    return prefix + rowRenderer(entry);
  }).join("");
}
function openSaveViewDialog() {
  if (!qs("#saveViewDialog")) return;
  qs("#saveViewName").value = "";
  qs("#saveViewShared").checked = false;
  qs("#saveViewDefault").checked = false;
  qs("#saveViewState").textContent = `Filter: ${currentLibraryFilter || "none"} · Sort: ${currentSort.key} ${currentSort.dir} · Group: ${currentLibraryGroupBy === "none" ? "none" : currentLibraryGroupBy}`;
  openDialog("saveViewDialog");
}
function submitSaveView(e) {
  e.preventDefault();
  const name = qs("#saveViewName").value.trim();
  if (!name) return;
  const key = currentLibraryViewKey();
  prototypeState.savedViews[key] = prototypeState.savedViews[key] || [];
  if (qs("#saveViewDefault").checked) {
    (LIBRARY_VIEWS[key] || []).forEach(v => { v.isDefault = false; });
    prototypeState.savedViews[key].forEach(v => { v.isDefault = false; });
  }
  const view = { id: `personal-${Date.now()}`, name, owner: qs("#saveViewShared").checked ? "Shared" : "You", shared: qs("#saveViewShared").checked, filter: currentLibraryFilter, sortKey: currentSort.key, sortDir: currentSort.dir, groupBy: currentLibraryGroupBy, isDefault: qs("#saveViewDefault").checked };
  prototypeState.savedViews[key].push(view);
  savePrototypeState();
  renderLibraryViewPicker(getParam("site", "finance"), getParam("lib", "documents"));
  currentLibraryViewId = view.id;
  qs("#libraryViewPicker").value = view.id;
  closeDialog(qs("#saveViewDialog"));
  showToast({ title: `View "${name}" saved`, desc: view.isDefault ? "It is now the default view for this Library." : view.shared ? "Shared with people who can access this Library." : "Saved to your personal Views." });
}

function renderLibraryItems() {
  const tbody = qs("#libTableBody"), cards = qs("#libCardsBody"), grid = qs("#libGridBody"), empty = qs("#libEmptyState");
  if (!tbody || !cards || !grid || !empty) return;
  selectedIndexes.clear();
  const entries = visibleLibraryEntries();
  const has = entries.length > 0;
  qs("#libListWrap").classList.toggle("hidden", !has || libView !== "list");
  qs("#libGridWrap").classList.toggle("hidden", !has || libView !== "grid");
  empty.classList.toggle("hidden", has);
  if (!has) { updateSelectionUI(); return; }

  tbody.innerHTML = renderGrouped(entries, entry => libTableRow(entry.item, entry.index), group => `<tr class="group-row"><td colspan="6">${esc(group)}</td></tr>`);
  cards.innerHTML = renderGrouped(entries, entry => libCardRow(entry.item, entry.index), group => `<div class="group-label">${esc(group)}</div>`);
  grid.innerHTML = renderGrouped(entries, entry => libGridTile(entry.item, entry.index), group => `<div class="group-label">${esc(group)}</div>`);
  hydrateIcons();
  updateSelectionUI();
}

function libRowMenu(idx, isFolder) {
  const items = isFolder
    ? [["open", "eye", "Open"], ["rename", "pencil", "Rename"], ["move", "move", "Move to"], ["follow", "bell", "Follow / unfollow"], ["permissions", "shieldCheck", "Manage access"], ["share", "share2", "Share"], ["__sep", "", ""], ["delete", "trash2", "Delete"]]
    : [["open", "eye", "Open"], ["preview", "fileSearch", "Preview"], ["download", "download", "Download"], ["__sep", "", ""], ["rename", "pencil", "Rename"], ["move", "move", "Move to"], ["copy", "copy", "Copy to"], ["__sep", "", ""], ["versions", "history", "Version history"], ["checkout", "lock", "Check out / in"], ["follow", "bell", "Follow / unfollow"], ["favorite", "star", "Favorite / unfavorite"], ["permissions", "shieldCheck", "Manage access"], ["share", "share2", "Share"], ["__sep", "", ""], ["delete", "trash2", "Delete"]];
  return `<div class="dropdown">
    <button class="btn btn-ghost btn-icon btn-sm" data-dropdown-trigger aria-label="More actions"><svg class="icon icon-sm" data-icon="moreHorizontal"></svg></button>
    <div class="dropdown-menu">
      ${items.map(([action, icon, label]) => action === "__sep" ? `<div class="dropdown-sep"></div>` : `<button class="dropdown-item${action === "delete" ? " destructive" : ""}" data-row-action="${action}" data-index="${idx}"><svg class="icon" data-icon="${icon}"></svg>${label}</button>`).join("")}
    </div>
  </div>`;
}

function libTableRow(item, i) {
  const isFolder = item.type === "folder";
  const nameCell = isFolder
    ? `<a href="${folderHrefFor(item)}" class="row-name"><span></span>${fileIconBlock(item)}<span class="name-text">${esc(item.name)}</span></a>`
    : `<button class="row-name" style="text-align:left;width:100%;" data-row-action="open" data-index="${i}">${fileIconBlock(item)}<span class="name-text">${esc(item.name)}</span>${checkoutBadge(item)}</button>`;
  return `<tr tabindex="0" class="${selectedIndexes.has(i) ? "selected" : ""}" data-context-index="${i}" data-context-scope="library">
    <td class="checkbox-col"><input type="checkbox" class="row-check" data-index="${i}"></td>
    <td style="max-width:340px;">${nameCell}${item.tags && item.tags.length ? `<div class="flex gap-1 mt-1" style="padding-left:2.75rem;">${tagBadges(item.tags)}</div>` : ""}</td>
    <td class="text-muted">${esc(item.modifiedBy)}</td>
    <td class="text-muted">${fmtDate(item.modified)}</td>
    <td class="text-muted">${isFolder ? "—" : esc(item.size)}</td>
    <td class="actions-col">${libRowMenu(i, isFolder)}</td>
  </tr>`;
}
function libCardRow(item, i) {
  const isFolder = item.type === "folder";
  return `<div tabindex="0" class="lib-item-card ${selectedIndexes.has(i) ? "selected" : ""}" data-context-index="${i}" data-context-scope="library">
    <input type="checkbox" class="row-check" data-index="${i}">
    ${isFolder ? `<a href="${folderHrefFor(item)}" class="flex items-center gap-3 flex-1 min-w-0">${fileIconBlock(item)}<div class="meta"><div class="title">${esc(item.name)}</div><div class="sub">${esc(item.modifiedBy)} &middot; ${fmtDate(item.modified)}</div></div></a>`
      : `<button data-row-action="open" data-index="${i}" class="flex items-center gap-3 flex-1 min-w-0" style="text-align:left;">${fileIconBlock(item)}<div class="meta"><div class="title">${esc(item.name)} ${checkoutBadge(item)}</div><div class="sub">${esc(item.size)} &middot; ${fmtDate(item.modified)}</div></div></button>`}
    ${libRowMenu(i, isFolder)}
  </div>`;
}
function libGridTile(item, i) {
  const isFolder = item.type === "folder";
  const inner = `${fileIconBlock(item)}<div class="tile-name">${esc(item.name)}</div><div class="tile-sub">${isFolder ? fmtDate(item.modified) : esc(item.size)}</div>`;
  return `<div tabindex="0" class="file-tile ${selectedIndexes.has(i) ? "selected" : ""}" data-context-index="${i}" data-context-scope="library">
    <input type="checkbox" class="row-check tile-check" data-index="${i}">
    <div class="tile-menu">${libRowMenu(i, isFolder)}</div>
    ${isFolder ? `<a href="${folderHrefFor(item)}">${inner}</a>` : `<button data-row-action="open" data-index="${i}" style="width:100%;">${inner}</button>`}
  </div>`;
}
function folderHrefFor(item) {
  const site = getParam("site", "finance"), lib = getParam("lib", "documents");
  return `library.html?site=${site}&lib=${lib}&folder=${item.id}`;
}

function toggleSelect(idx, checked) {
  if (checked) selectedIndexes.add(idx); else selectedIndexes.delete(idx);
  updateSelectionUI();
}
function updateSelectionUI() {
  const bar = qs("#selectionBar");
  if (!bar) return;
  const count = selectedIndexes.size;
  bar.classList.toggle("open", count > 0);
  const label = qs("#selectionCount"); if (label) label.textContent = count + (count === 1 ? " item selected" : " items selected");
  qsa(".row-check").forEach(cb => {
    const idx = parseInt(cb.getAttribute("data-index"), 10);
    cb.checked = selectedIndexes.has(idx);
    const wrap = cb.closest("tr, .lib-item-card, .file-tile");
    if (wrap) wrap.classList.toggle("selected", selectedIndexes.has(idx));
  });
  const selectAll = qs("#selectAllCheckbox");
  if (selectAll) selectAll.checked = currentItems.length > 0 && count === currentItems.length;
}
function clearSelection() { selectedIndexes.clear(); updateSelectionUI(); }
function bulkDelete() {
  const idxs = Array.from(selectedIndexes).sort((a, b) => b - a);
  const n = idxs.length;
  idxs.forEach(i => currentItems.splice(i, 1));
  renderLibraryItems();
  showToast({ title: `${n} item(s) moved to Recycle Bin`, variant: "default" });
}
function bulkEditTargets() {
  return Array.from(selectedIndexes).sort((a, b) => a - b).map(index => ({ index, item: currentItems[index] })).filter(entry => entry.item);
}
function renderBulkEditPreview(results) {
  const el = qs("#bulkEditResults");
  if (!el) return;
  el.innerHTML = results.map(result => `<div class="bulk-result-row"><div class="min-w-0 flex-1"><div class="text-sm font-medium truncate">${esc(result.item.name)}</div><div class="text-xs text-muted">${esc(result.reason)}</div></div><span class="badge ${result.ok ? "badge-success" : "badge-destructive"}">${result.ok ? "Updated" : "Not updated"}</span></div>`).join("");
}
function openBulkEditDialog() {
  const targets = bulkEditTargets();
  if (!targets.length) return;
  qs("#bulkEditSelectionSummary").textContent = `${targets.length} selected · ${targets.filter(t => t.item.type === "file").length} documents can be edited`;
  renderBulkEditPreview(targets.map(({ item }) => ({ item, ok: !(item.type === "folder" || (item.checkedOutBy && item.checkedOutBy !== CURRENT_USER.name)), reason: item.type === "folder" ? "Folders are skipped by metadata edit" : item.checkedOutBy && item.checkedOutBy !== CURRENT_USER.name ? `Checked out by ${item.checkedOutBy}` : "Ready to update" })));
  openDialog("bulkEditDialog");
}
function submitBulkEdit(e) {
  e.preventDefault();
  const title = qs("#bulkEditTitle").value.trim();
  const description = qs("#bulkEditDescription").value.trim();
  const tags = qs("#bulkEditTags").value.split(",").map(t => t.trim()).filter(Boolean);
  if (!title && !description && !tags.length) {
    showToast({ title: "Choose at least one field", desc: "Leave a field blank to keep its existing value.", variant: "destructive" });
    return;
  }
  const results = bulkEditTargets().map(({ item }) => {
    if (item.type === "folder") return { item, ok: false, reason: "Folders are skipped by metadata edit" };
    if (item.checkedOutBy && item.checkedOutBy !== CURRENT_USER.name) return { item, ok: false, reason: `Checked out by ${item.checkedOutBy}` };
    if (title) item.name = title + (item.ext ? `.${item.ext}` : "");
    if (description) item.description = description;
    if (tags.length) item.tags = tags.slice();
    item.modified = todayStr(); item.modifiedBy = CURRENT_USER.name;
    return { item, ok: true, reason: "Metadata saved" };
  });
  renderBulkEditPreview(results);
  renderLibraryItems();
  const updated = results.filter(r => r.ok).length, failed = results.length - updated;
  showToast({ title: `${updated} item(s) updated`, desc: failed ? `${failed} item(s) were not changed. See the per-item results.` : "Shared metadata was applied to the selection." , variant: failed ? "info" : "default" });
  qs("#bulkEditForm").reset();
}
function deleteItem(idx) {
  const item = currentItems[idx];
  currentItems.splice(idx, 1);
  renderLibraryItems();
  showToast({ title: `"${item.name}" moved to Recycle Bin`, actionLabel: "Undo", onAction: () => { currentItems.splice(idx, 0, item); renderLibraryItems(); showToast({ title: "Restored" }); } });
  closeSheet();
}
function toggleCheckout(idx) {
  const item = currentItems[idx];
  if (item.checkedOutBy && item.checkedOutBy !== CURRENT_USER.name) {
    showToast({ title: "Can't check in", desc: `This file is checked out by ${item.checkedOutBy}.`, variant: "destructive" });
    return;
  }
  if (item.checkedOutBy === CURRENT_USER.name) {
    item.checkedOutBy = null; item.version = bumpVersion(item.version); item.modified = todayStr(); item.modifiedBy = CURRENT_USER.name;
    showToast({ title: "Checked in", desc: `New version ${item.version} created.` });
  } else {
    item.checkedOutBy = CURRENT_USER.name;
    showToast({ title: "Checked out", desc: "Only you can upload a new version until you check in." });
  }
  renderLibraryItems();
}
function openDocSheetByIndex(idx, tab) {
  const item = currentItems[idx];
  if (!item) return;
  if (item.type === "folder") { location.href = folderHrefFor(item); return; }
  renderDocSheet(item, tab || "properties");
}
function parseSizeVal(item) {
  if (item.type === "folder") return -1;
  const m = /([\d.]+)\s*(KB|MB|GB)/i.exec(item.size || "");
  if (!m) return 0;
  const n = parseFloat(m[1]); const mult = { KB: 1, MB: 1024, GB: 1024 * 1024 }[m[2].toUpperCase()];
  return n * mult;
}
function sortLibrary(key) {
  if (currentSort.key === key) currentSort.dir = currentSort.dir === "asc" ? "desc" : "asc";
  else { currentSort.key = key; currentSort.dir = "asc"; }
  currentLibraryViewId = "custom";
  sortLibraryItems();
  renderLibraryItems();
  qsa("[data-sort-key]").forEach(h => {
    const arrow = h.querySelector(".sort-arrow");
    if (!arrow) return;
    arrow.textContent = h.getAttribute("data-sort-key") === key ? (currentSort.dir === "asc" ? " ↑" : " ↓") : "";
  });
}

/* Upload dialog */
function initUploadDropzone() {
  const dz = qs("#dropzone"); const input = qs("#fileInput");
  if (!dz || dz.dataset.wired === "1") return;
  dz.dataset.wired = "1";
  const uploadSite = findSite(getParam("site", "finance"));
  const remaining = Math.max(0, uploadSite.storageQuotaGB - uploadSite.storageUsedGB);
  if (qs("#uploadQuotaStatus")) qs("#uploadQuotaStatus").innerHTML = `<svg class="icon icon-sm" data-icon="database"></svg><span><strong>${remaining.toFixed(1)} GB remaining</strong> in ${esc(uploadSite.name)} · files that exceed the configured quota are rejected individually.</span>`;
  dz.addEventListener("dragover", e => { e.preventDefault(); dz.classList.add("drag-over"); });
  dz.addEventListener("dragleave", () => dz.classList.remove("drag-over"));
  dz.addEventListener("drop", e => { e.preventDefault(); dz.classList.remove("drag-over"); handleFiles(e.dataTransfer.files); });
  input.addEventListener("change", () => handleFiles(input.files));
  qs("#uploadDoneBtn").addEventListener("click", () => {
    closeDialog(qs("#uploadDialog"));
    qs("#uploadList").innerHTML = "";
    qs("#uploadDoneBtn").disabled = true;
    renderLibraryItems();
  });
}
let pendingUploads = 0;
function handleFiles(fileList) {
  const list = qs("#uploadList");
  const files = Array.from(fileList).slice(0, 8);
  if (!files.length) return;
  qs("#uploadDoneBtn").disabled = true;
  const uploadSite = findSite(getParam("site", "finance"));
  const remainingBytes = Math.max(0, uploadSite.storageQuotaGB - uploadSite.storageUsedGB) * 1024 * 1024 * 1024;
  files.forEach(f => {
    pendingUploads++;
    const ext = (f.name.split(".").pop() || "").toLowerCase();
    const row = document.createElement("div");
    row.className = "upload-row";
    row.innerHTML = `<div class="file-ico ${fileIcoClass(ext)}" style="width:30px;height:30px;flex-shrink:0;"><svg class="icon icon-sm" data-icon="fileText"></svg></div>
      <div class="upload-info"><div class="upload-name"><span class="truncate">${esc(f.name)}</span><span class="pct">0%</span></div><div class="progress mt-1"><div class="progress-bar" style="width:0%"></div></div><div class="upload-error"></div></div>`;
    list.appendChild(row);
    hydrateIcons(row);
    let rejectionReason = "";
    if (f.size > 250 * 1024 * 1024) rejectionReason = "File exceeds the 250 MB maximum size.";
    if (["exe", "bat", "cmd", "msi", "scr"].includes(ext)) rejectionReason = `.${ext} files are blocked by Admin settings.`;
    if (f.size > remainingBytes || f.name.toLowerCase().includes("quota")) rejectionReason = `${uploadSite.name} has only ${Math.max(0, uploadSite.storageQuotaGB - uploadSite.storageUsedGB).toFixed(1)} GB remaining; this file would exceed the configured quota.`;
    animateUploadRow(row, f, ext, rejectionReason);
  });
}
function animateUploadRow(row, file, ext, rejectionReason) {
  const bar = row.querySelector(".progress-bar"), pct = row.querySelector(".pct"), error = row.querySelector(".upload-error");
  let p = 0;
  const timer = setInterval(() => {
    p += Math.random() * 24 + 14;
    if (p >= 100) {
      p = 100; clearInterval(timer);
      if (rejectionReason) {
        bar.classList.add("error"); pct.textContent = "Rejected"; error.textContent = rejectionReason; error.classList.add("visible");
      } else {
        bar.classList.add("success"); pct.textContent = "Done";
        currentItems.unshift({ type: "file", name: file.name, ext: ext || "generic", size: fmtSize(file.size || 245000), modified: todayStr(), modifiedBy: CURRENT_USER.name, version: "1.0", tags: [], checkedOutBy: null });
      }
      pendingUploads--;
      if (pendingUploads <= 0) qs("#uploadDoneBtn").disabled = false;
    } else { pct.textContent = Math.round(p) + "%"; }
    bar.style.width = p + "%";
  }, 220);
}

/* ======================================================================= *
 *  PAGE: search.html                                                      *
 * ======================================================================= */
function initSearchPage() {
  const q = getParam("q", "");
  qs("#searchInput").value = q;
  qs("#searchInput").addEventListener("keydown", e => { if (e.key === "Enter") runSearch(); });
  qs("#searchGoBtn").addEventListener("click", runSearch);
  runSearch();
}
function runSearch() {
  const q = qs("#searchInput").value.trim();
  const params = new URLSearchParams(location.search);
  if (q) params.set("q", q); else params.delete("q");
  history.replaceState(null, "", "search.html" + (params.toString() ? "?" + params.toString() : ""));
  renderSearchResults();
}
function renderSearchResults() {
  if (!qs("#searchInput") || !qs("#searchResultsList")) return;
  const q = qs("#searchInput").value.trim().toLowerCase();
  const siteFilters = qsa(".search-filter[data-filter-type=site]:checked").map(c => c.value);
  const typeFilters = qsa(".search-filter[data-filter-type=type]:checked").map(c => c.value);
  let results = SEARCH_INDEX.filter(d => {
    const matchesQ = !q || d.name.toLowerCase().includes(q) || (d.tags || []).some(t => t.toLowerCase().includes(q));
    const matchesSite = !siteFilters.length || siteFilters.includes(d.site);
    const matchesType = !typeFilters.length || typeFilters.includes(d.ext);
    return matchesQ && matchesSite && matchesType;
  });
  qs("#searchResultCount").textContent = results.length;
  qs("#searchQueryLabel").textContent = q ? `“${q}”` : "all documents";
  const list = qs("#searchResultsList");
  if (!results.length) {
    list.innerHTML = "";
    qs("#searchEmptyState").classList.remove("hidden");
    return;
  }
  qs("#searchEmptyState").classList.add("hidden");
  list.innerHTML = results.map((d, i) => `
    <button class="card search-result-row" data-search-idx="${i}" style="display:flex;align-items:center;gap:.9rem;padding:.9rem 1.1rem;width:100%;text-align:left;margin-bottom:.6rem;">
      ${fileIconBlock(d)}
      <div class="min-w-0 flex-1">
        <div class="font-medium text-sm truncate">${esc(d.name)} ${checkoutBadge(d)}</div>
        <div class="text-muted text-xs mt-1">${esc(d.siteName)} &middot; modified ${fmtDate(d.modified)} by ${esc(d.modifiedBy)}</div>
        ${d.tags && d.tags.length ? `<div class="flex gap-1 mt-1">${tagBadges(d.tags)}</div>` : ""}
      </div>
      <span class="text-muted text-xs flex-none desktop-only">${esc(d.size)}</span>
    </button>`).join("");
  window._searchResults = results;
  qsa(".search-result-row").forEach(row => row.addEventListener("click", () => {
    const item = window._searchResults[parseInt(row.getAttribute("data-search-idx"), 10)];
    currentItems = window._searchResults;
    renderDocSheet(item, "properties");
  }));
  hydrateIcons();
}

/* ======================================================================= *
 *  PAGE: favorites.html                                                    *
 * ======================================================================= */
function initFavoritesPage() {
  qsa("[data-favorite-filter]").forEach(btn => btn.addEventListener("click", () => {
    qsa("[data-favorite-filter]").forEach(b => b.classList.toggle("active", b === btn));
    renderFavoritesPage(btn.getAttribute("data-favorite-filter"));
  }));
  renderFavoritesPage("all");
}
function renderFavoritesPage(filter) {
  const list = qs("#favoritesList");
  if (!list) return;
  const activeFilter = filter || qs("[data-favorite-filter].active")?.getAttribute("data-favorite-filter") || "all";
  const catalog = getFavoriteCatalog().filter(entry => isFavorite(entry.key));
  const entries = activeFilter === "all" ? catalog : catalog.filter(entry => entry.objectType.toLowerCase() === activeFilter);
  qs("#favoritesCount") && (qs("#favoritesCount").textContent = catalog.length);
  qs("#favoritesEmptyState")?.classList.toggle("hidden", entries.length > 0);
  if (!entries.length) { list.innerHTML = ""; return; }
  const groups = ["Site", "Library", "Folder", "Document"].filter(type => entries.some(entry => entry.objectType === type));
  list.innerHTML = groups.map(type => `
    <section class="favorite-group">
      <div class="flex items-center justify-between mb-2"><h2 class="text-sm font-semibold">${type === "Library" ? "Libraries" : `${type}s`}</h2><span class="text-xs text-muted">${entries.filter(entry => entry.objectType === type).length}</span></div>
      <div class="card favorite-list">${entries.filter(entry => entry.objectType === type).map((entry, i) => `
        <div tabindex="0" class="favorite-row" data-context-scope="favorite" data-context-index="${i}" data-context-key="${esc(entry.key)}">
          <a class="flex items-center gap-3 min-w-0 flex-1" href="${entry.href}">
            ${entry.objectType === "Document" ? fileIconBlock({ type: "file", ext: entry.ext }) : `<div class="file-ico ${entry.objectType === "Site" ? "site-favorite" : "folder"}"><svg class="icon" data-icon="${entry.icon || "folder"}"></svg></div>`}
            <div class="min-w-0"><div class="text-sm font-medium truncate">${esc(entry.name)}</div><div class="text-xs text-muted truncate">${esc(entry.location)}</div></div>
          </a>
          <span class="badge badge-secondary">${esc(entry.objectType)}</span>
          ${favoriteButtonHtml(entry.key)}
        </div>`).join("")}</div>
    </section>`).join("");
  hydrateIcons();
}

/* ======================================================================= *
 *  PAGE: recycle-bin.html                                                 *
 * ======================================================================= */
let recycleItems = [];
let recycleSelected = new Set();
function initRecycleBinPage() {
  recycleItems = RECYCLE_BIN_ITEMS.slice();
  renderRecycleBin();
  qs("#recycleEmptyAllBtn")?.addEventListener("click", () => {
    if (!recycleItems.length) return;
    recycleItems = [];
    renderRecycleBin();
    showToast({ title: "Recycle Bin emptied" });
  });
}
function renderRecycleBin() {
  recycleSelected.clear();
  const tbody = qs("#recycleTableBody");
  const has = recycleItems.length > 0;
  qs("#recycleTableWrap").classList.toggle("hidden", !has);
  qs("#recycleEmptyState").classList.toggle("hidden", has);
  qs("#recycleCount").textContent = recycleItems.length;
  tbody.innerHTML = recycleItems.map((item, i) => `
    <tr tabindex="0" data-context-scope="recycle" data-context-index="${i}">
      <td class="checkbox-col"><input type="checkbox" class="recycle-check" data-index="${i}"></td>
      <td><div class="row-name">${fileIconBlock(item)}<span class="name-text">${esc(item.name)}</span></div></td>
      <td class="text-muted">${esc(item.site)}</td>
      <td class="text-muted">${esc(item.originalPath)}</td>
      <td class="text-muted">${esc(item.deletedBy)}</td>
      <td class="text-muted">${esc(item.deletedAt)}</td>
      <td class="actions-col">
        <div class="flex gap-1 justify-end">
          <button class="btn btn-ghost btn-icon btn-sm" data-tooltip="Restore" data-recycle-action="restore" data-index="${i}"><svg class="icon icon-sm" data-icon="rotateCcw"></svg></button>
          <button class="btn btn-ghost btn-icon btn-sm" data-tooltip="Delete permanently" data-recycle-action="purge" data-index="${i}"><svg class="icon icon-sm" data-icon="trash2"></svg></button>
        </div>
      </td>
    </tr>`).join("");
  hydrateIcons();
  qsa("[data-recycle-action]").forEach(btn => btn.addEventListener("click", () => {
    handleRecycleAction(btn.getAttribute("data-recycle-action"), parseInt(btn.getAttribute("data-index"), 10));
  }));
}
function handleRecycleAction(action, index) {
  const item = recycleItems[index];
  if (!item) return;
  recycleItems.splice(index, 1);
  renderRecycleBin();
  if (action === "restore") showToast({ title: `"${item.name}" restored`, desc: `Back in ${item.site} / ${item.originalPath}` });
  else showToast({ title: `"${item.name}" permanently deleted`, variant: "destructive" });
}

/* ======================================================================= *
 *  PAGE: profile.html                                                     *
 * ======================================================================= */
function initProfilePage() {
  qs("#profileName").value = CURRENT_USER.name;
  qs("#profileEmail").value = CURRENT_USER.email;
  qs("#profileTitle").value = CURRENT_USER.title;
  qs("#profileAvatarInitials").textContent = CURRENT_USER.initials;
  qs("#profileRoleBadge").textContent = CURRENT_USER.role;

  renderThemeGrid();

  qs("#profileForm")?.addEventListener("submit", e => { e.preventDefault(); showToast({ title: "Profile updated" }); });
  qs("#passwordForm")?.addEventListener("submit", e => { e.preventDefault(); showToast({ title: "Password changed successfully" }); e.target.reset(); });
  qs("#notifForm")?.addEventListener("submit", e => { e.preventDefault(); showToast({ title: "Notification preferences saved" }); });
}
function renderThemeGrid() {
  qs("#themeGrid").innerHTML = THEME_META.map(t => `
    <button class="theme-swatch" data-theme-active="${t.id}" data-set-theme="${t.id}">
      <div class="swatch-preview" style="background:${t.bg}">
        <div class="swatch-sidebar" style="background:${t.sidebar}"></div>
        <div class="swatch-main">
          <div class="swatch-bar" style="width:60%;background:${t.primary}"></div>
          <div class="swatch-bar" style="width:90%;background:${t.card}"></div>
          <div class="swatch-bar" style="width:75%;background:${t.card}"></div>
        </div>
      </div>
      <div class="swatch-name">${t.name}${t.id === currentTheme() ? ' <svg class="icon icon-sm" data-icon="check"></svg>' : ""}</div>
      <div class="swatch-desc">${t.desc}</div>
    </button>`).join("");
  qsa(".theme-swatch[data-theme-active]").forEach(el => el.classList.toggle("active", el.getAttribute("data-theme-active") === currentTheme()));
  hydrateIcons();
  qsa("[data-set-theme]").forEach(btn => btn.addEventListener("click", () => {
    const id = btn.getAttribute("data-set-theme");
    applyTheme(id);
    const meta = THEME_META.find(t => t.id === id);
    showToast({ title: `Theme changed to ${meta.name}` });
    renderThemeGrid();
  }));
}

/* ======================================================================= *
 *  PAGE: admin-users.html                                                 *
 * ======================================================================= */
let adminUsers = [];
function initAdminUsersPage() {
  adminUsers = SAMPLE_USERS.slice();
  renderAdminUsers();
  qs("#userSearchInput")?.addEventListener("input", renderAdminUsers);
  qs("#userSsoForm")?.addEventListener("submit", submitUserSsoSettings);
  qs("#addUserForm")?.addEventListener("submit", e => {
    e.preventDefault();
    const name = qs("#newUserName").value.trim(); if (!name) return;
    adminUsers.unshift({ name, email: qs("#newUserEmail").value.trim() || "new.user@edms-demo.local", title: qs("#newUserTitle").value.trim() || "—", dept: qs("#newUserDept").value || "IT Operations", role: "Member", status: "Active", lastActive: "Just invited" });
    renderAdminUsers();
    closeDialog(qs("#addUserDialog"));
    e.target.reset();
    showToast({ title: `Invitation sent to ${name}` });
  });
}
function openUserSsoDialog(index) {
  const user = adminUsers[index];
  if (!user) return;
  qs("#userSsoName").textContent = user.name;
  qs("#userSsoEmail").textContent = user.email;
  qs("#userLocalLoginDisabled").checked = user.localLoginDisabled === true;
  qs("#userSsoExempt").checked = user.ssoExempt === true;
  qs("#userSsoIndex").value = index;
  openDialog("userSsoDialog");
}
function submitUserSsoSettings(e) {
  e.preventDefault();
  const index = parseInt(qs("#userSsoIndex").value, 10);
  const user = adminUsers[index];
  if (!user) return;
  user.localLoginDisabled = qs("#userLocalLoginDisabled").checked;
  user.ssoExempt = qs("#userSsoExempt").checked;
  closeDialog(qs("#userSsoDialog"));
  renderAdminUsers();
  showToast({ title: "SSO settings updated", desc: `${user.name}'s local-login and break-glass settings were saved.` });
}
function renderAdminUsers() {
  const q = (qs("#userSearchInput")?.value || "").toLowerCase();
  const filtered = adminUsers.filter(u => !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || u.dept.toLowerCase().includes(q));
  qs("#userCountLabel").textContent = `${filtered.length} of ${adminUsers.length} users`;
  qs("#adminUsersBody").innerHTML = filtered.map((u) => {
    const realIdx = adminUsers.indexOf(u);
    return `<tr>
      <td><div class="row-name"><div class="avatar avatar-sm">${initialsOf(u.name)}</div><div><div class="name-text">${esc(u.name)}${u.name === CURRENT_USER.name ? ' <span class="badge badge-outline">You</span>' : ""}</div><div class="name-sub">${esc(u.email)}</div></div></div></td>
      <td class="text-muted">${esc(u.title)}</td>
      <td class="text-muted">${esc(u.dept)}</td>
      <td><span class="badge ${u.role === "System Administrator" ? "badge-default" : u.role === "Site Owner" ? "badge-warning" : "badge-secondary"}">${esc(u.role)}</span></td>
      <td class="text-muted">${esc(u.lastActive)}</td>
      <td><label class="switch"><input type="checkbox" ${u.status === "Active" ? "checked" : ""} data-user-toggle="${realIdx}"><span class="slider"></span></label></td>
      <td class="actions-col"><button class="btn btn-outline btn-sm" data-user-sso-edit="${realIdx}">SSO</button></td>
    </tr>`;
  }).join("");
  qsa("[data-user-toggle]").forEach(sw => sw.addEventListener("change", () => {
    const i = parseInt(sw.getAttribute("data-user-toggle"), 10);
    adminUsers[i].status = sw.checked ? "Active" : "Inactive";
    showToast({ title: `${adminUsers[i].name} ${sw.checked ? "reactivated" : "deactivated"}`, desc: sw.checked ? "Account access restored." : "All active sessions revoked." });
  }));
  qsa("[data-user-sso-edit]").forEach(btn => btn.addEventListener("click", () => openUserSsoDialog(parseInt(btn.getAttribute("data-user-sso-edit"), 10))));
}

/* ======================================================================= *
 *  PAGE: admin-groups.html                                                *
 * ======================================================================= */
function initAdminGroupsPage() {
  renderGroupsTable();
  qs("#createGroupForm")?.addEventListener("submit", e => {
    e.preventDefault();
    const name = qs("#newGroupName").value.trim(); if (!name) return;
    SAMPLE_GROUPS.unshift({ name, type: "Custom group", members: 1, site: "Cross-site (Read)" });
    renderGroupsTable();
    closeDialog(qs("#createGroupDialog"));
    e.target.reset();
    showToast({ title: `Group "${name}" created` });
  });
}
function renderGroupsTable() {
  qs("#adminGroupsBody").innerHTML = SAMPLE_GROUPS.map(g => `
    <tr>
      <td><div class="row-name"><svg class="icon" data-icon="users"></svg><span class="name-text">${esc(g.name)}</span></div></td>
      <td><span class="badge ${g.type === "Custom group" ? "badge-default" : "badge-secondary"}">${esc(g.type)}</span></td>
      <td class="text-muted">${esc(g.site)}</td>
      <td class="text-muted">${g.members} members</td>
      <td class="actions-col">
        <button class="btn btn-outline btn-sm" data-dialog-trigger="manageGroupDialog" data-group-name="${esc(g.name)}">Manage</button>
      </td>
    </tr>`).join("");
  hydrateIcons();
  qsa('[data-dialog-trigger="manageGroupDialog"]').forEach(btn => btn.addEventListener("click", () => {
    qs("#manageGroupName").textContent = btn.getAttribute("data-group-name");
    qs("#manageGroupMembers").innerHTML = SAMPLE_USERS.slice(0, 5).map(u => `
      <div class="flex items-center gap-2 py-2 border-b" style="border-color:hsl(var(--border));">
        <div class="avatar avatar-sm">${initialsOf(u.name)}</div>
        <div class="flex-1 text-sm">${esc(u.name)}</div>
        <button class="btn btn-ghost btn-icon btn-sm"><svg class="icon icon-sm" data-icon="x"></svg></button>
      </div>`).join("");
    hydrateIcons(qs("#manageGroupMembers"));
  }));
}

/* ======================================================================= *
 *  PAGE: admin-sites.html                                                 *
 * ======================================================================= */
function initAdminSitesPage() {
  qs("#adminSitesBody").innerHTML = SITES.map((s, i) => `
    <tr data-site-row="${i}">
      <td><div class="row-name"><div class="site-icon" style="width:30px;height:30px;background:${s.color};"><svg class="icon icon-sm" data-icon="${siteIconName(s.icon)}"></svg></div><span class="name-text">${esc(s.name)}</span></div></td>
      <td class="text-muted">${s.libraries.length}</td>
      <td class="text-muted">${s.members}</td>
      <td style="min-width:160px;">
        <div class="flex items-center justify-between text-xs text-muted mb-1"><span>${s.storageUsedGB.toFixed(1)} GB</span><span>${s.storageQuotaGB} GB</span></div>
        <div class="progress"><div class="progress-bar" style="width:${Math.min(100, (s.storageUsedGB / s.storageQuotaGB) * 100)}%"></div></div>
      </td>
      <td><span class="badge badge-success" data-site-status="${i}">Active</span></td>
      <td class="actions-col">
        <div class="dropdown">
          <button class="btn btn-ghost btn-icon btn-sm" data-dropdown-trigger><svg class="icon icon-sm" data-icon="moreHorizontal"></svg></button>
          <div class="dropdown-menu">
            <a class="dropdown-item" href="site-home.html?site=${s.slug}"><svg class="icon" data-icon="eye"></svg>Open site</a>
            <button class="dropdown-item" data-site-permissions="${i}"><svg class="icon" data-icon="shieldCheck"></svg>Permissions</button>
            <div class="dropdown-sep"></div>
            <button class="dropdown-item destructive" data-site-archive="${i}"><svg class="icon" data-icon="trash2"></svg>Archive site</button>
          </div>
        </div>
      </td>
    </tr>`).join("");
  hydrateIcons();
  qsa("[data-site-archive]").forEach(btn => btn.addEventListener("click", () => {
    const i = btn.getAttribute("data-site-archive");
    qs(`[data-site-status="${i}"]`).outerHTML = `<span class="badge badge-outline" data-site-status="${i}">Archived</span>`;
    showToast({ title: `${SITES[i].name} archived`, desc: "Members retain read access to existing content." });
  }));
  qsa("[data-site-permissions]").forEach(btn => btn.addEventListener("click", () => showToast({ title: "Opening site permissions…", variant: "info" })));
  qs("#createSiteForm")?.addEventListener("submit", e => { e.preventDefault(); showToast({ title: `Site "${qs("#newSiteName").value || "Untitled"}" created` }); closeDialog(qs("#createSiteDialog")); e.target.reset(); });
  if (getParam("action", "") === "newsite") openDialog("createSiteDialog");
}

/* ======================================================================= *
 *  PAGE: admin-settings.html                                              *
 * ======================================================================= */
function initAdminSettingsPage() {
  qsa(".settings-form").forEach(f => f.addEventListener("submit", e => { e.preventDefault(); showToast({ title: "Settings saved" }); }));
  const toggle = qs("#ssoEnforcedToggle");
  if (toggle) toggle.checked = prototypeState.ssoEnforcedGlobally === true;
  qs("#ssoSettingsForm")?.addEventListener("submit", e => {
    e.preventDefault();
    const enabled = qs("#ssoEnforcedToggle").checked;
    const exemptAdmins = SAMPLE_USERS.filter(u => u.role === "System Administrator" && u.status === "Active" && u.ssoExempt === true);
    const error = qs("#ssoSettingsError");
    if (enabled && !exemptAdmins.length) {
      error.textContent = "Keep at least one active System Administrator exempt from SSO-only login before enabling this safeguard.";
      error.classList.remove("hidden");
      return;
    }
    error.classList.add("hidden");
    prototypeState.ssoEnforcedGlobally = enabled;
    savePrototypeState();
    showToast({ title: enabled ? "SSO-only login enforced" : "SSO-only login disabled", desc: enabled ? "Local login remains available to break-glass administrators." : "Users may sign in with either configured provider." });
  });
}

/* ======================================================================= *
 *  PAGE: admin-storage.html — statistics / report                         *
 * ======================================================================= */
function initAdminStoragePage() {
  const totalUsed = SITES.reduce((s, x) => s + x.storageUsedGB, 0);
  const totalQuota = SITES.reduce((s, x) => s + x.storageQuotaGB, 0);
  qs("#reportTotalStorage").textContent = totalUsed.toFixed(1) + " GB";
  qs("#reportTotalQuota").textContent = "of " + totalQuota + " GB provisioned";
  qs("#reportTotalDocs").textContent = SEARCH_INDEX.length.toLocaleString() + "+";
  qs("#reportTotalSites").textContent = SITES.length;
  qs("#reportTotalUsers").textContent = SAMPLE_USERS.filter(u => u.status === "Active").length;

  renderSiteStorageBarChart();
  renderFileTypeDonut();
  renderStorageTrendChart();

  const top = SITES.slice().sort((a, b) => b.storageUsedGB - a.storageUsedGB);
  qs("#topLibrariesBody").innerHTML = top.map(s => `
    <tr>
      <td><div class="row-name"><span class="sidebar-site-dot" style="background:${s.color}"></span><span class="name-text">${esc(s.name)}</span></div></td>
      <td class="text-muted">${s.libraries.length}</td>
      <td style="min-width:140px;">
        <div class="flex items-center justify-between text-xs text-muted mb-1"><span>${s.storageUsedGB.toFixed(1)} GB</span><span>${Math.round((s.storageUsedGB / s.storageQuotaGB) * 100)}%</span></div>
        <div class="progress"><div class="progress-bar" style="width:${Math.min(100, (s.storageUsedGB / s.storageQuotaGB) * 100)}%"></div></div>
      </td>
    </tr>`).join("");
}
function renderSiteStorageBarChart() {
  const el = qs("#siteStorageChart"); if (!el) return;
  const max = Math.max(...SITES.map(s => s.storageQuotaGB));
  const w = 640, h = 240, padL = 36, padB = 28, padT = 14, padR = 12;
  const chartW = w - padL - padR, chartH = h - padB - padT;
  const gap = chartW / SITES.length, barW = gap * 0.5;
  let bars = "", labels = "", grid = "";
  for (let g = 0; g <= 4; g++) {
    const gy = padT + chartH - (g / 4) * chartH;
    grid += `<line class="grid-line" x1="${padL}" x2="${w - padR}" y1="${gy}" y2="${gy}"/><text x="${padL - 8}" y="${gy + 3}" text-anchor="end">${Math.round((max * g) / 4)}</text>`;
  }
  SITES.forEach((s, i) => {
    const x = padL + i * gap + (gap - barW) / 2;
    const usedH = (s.storageUsedGB / max) * chartH, quotaH = (s.storageQuotaGB / max) * chartH;
    bars += `<rect x="${x}" y="${padT + chartH - quotaH}" width="${barW}" height="${quotaH}" rx="4" fill="hsl(var(--muted))"/>`;
    bars += `<rect x="${x}" y="${padT + chartH - usedH}" width="${barW}" height="${usedH}" rx="4" fill="${s.color}"><title>${s.name}: ${s.storageUsedGB} GB</title></rect>`;
    labels += `<text x="${x + barW / 2}" y="${h - 8}" text-anchor="middle">${esc(s.name.split(" ")[0])}</text>`;
  });
  el.innerHTML = `<svg class="chart-svg" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">${grid}${bars}${labels}</svg>`;
}
function renderFileTypeDonut() {
  const el = qs("#fileTypeDonut"); if (!el) return;
  const total = FILE_TYPE_BREAKDOWN.reduce((s, d) => s + d.value, 0);
  const cx = 90, cy = 90, r = 62, sw = 24;
  let angle = -90, paths = "";
  FILE_TYPE_BREAKDOWN.forEach(d => {
    const frac = d.value / total, sweep = frac * 360;
    const large = sweep > 180 ? 1 : 0;
    const a0 = (angle * Math.PI) / 180, a1 = ((angle + sweep - 0.5) * Math.PI) / 180;
    const x0 = cx + r * Math.cos(a0), y0 = cy + r * Math.sin(a0);
    const x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
    paths += `<path d="M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}" fill="none" stroke="${d.color}" stroke-width="${sw}" stroke-linecap="round"><title>${d.label}: ${d.value}%</title></path>`;
    angle += sweep;
  });
  el.innerHTML = `<svg class="chart-svg" viewBox="0 0 180 180" xmlns="http://www.w3.org/2000/svg">${paths}<text x="90" y="86" text-anchor="middle" style="font-size:20px;font-weight:700;fill:hsl(var(--foreground));">${total.toFixed(0)}%</text><text x="90" y="102" text-anchor="middle" style="font-size:10px;">of storage</text></svg>`;
  qs("#fileTypeLegend").innerHTML = FILE_TYPE_BREAKDOWN.map(d => `<div class="legend-item"><span class="legend-dot" style="background:${d.color}"></span>${d.label} &middot; ${d.value}%</div>`).join("");
}
function renderStorageTrendChart() {
  const el = qs("#storageTrendChart"); if (!el) return;
  const w = 640, h = 200, padL = 36, padB = 26, padT = 14, padR = 16;
  const chartW = w - padL - padR, chartH = h - padB - padT;
  const max = Math.max(...STORAGE_TREND) * 1.15;
  const stepX = chartW / (STORAGE_TREND.length - 1);
  const pts = STORAGE_TREND.map((v, i) => [padL + i * stepX, padT + chartH - (v / max) * chartH]);
  const linePath = "M " + pts.map(p => p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" L ");
  const areaPath = linePath + ` L ${pts[pts.length - 1][0]} ${padT + chartH} L ${pts[0][0]} ${padT + chartH} Z`;
  let grid = "";
  for (let g = 0; g <= 3; g++) { const gy = padT + chartH - (g / 3) * chartH; grid += `<line class="grid-line" x1="${padL}" x2="${w - padR}" y1="${gy}" y2="${gy}"/><text x="${padL - 8}" y="${gy + 3}" text-anchor="end">${Math.round((max * g) / 3)}</text>`; }
  const labels = STORAGE_TREND_LABELS.map((l, i) => `<text x="${pts[i][0]}" y="${h - 6}" text-anchor="middle">${l}</text>`).join("");
  const dots = pts.map(p => `<circle cx="${p[0]}" cy="${p[1]}" r="3.5" fill="hsl(var(--chart-1))" stroke="hsl(var(--card))" stroke-width="2"/>`).join("");
  el.innerHTML = `<svg class="chart-svg" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="hsl(var(--chart-1))" stop-opacity="0.28"/><stop offset="100%" stop-color="hsl(var(--chart-1))" stop-opacity="0"/></linearGradient></defs>
    ${grid}<path d="${areaPath}" fill="url(#trendFill)" stroke="none"/><path d="${linePath}" fill="none" stroke="hsl(var(--chart-1))" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>${dots}${labels}
  </svg>`;
}

/* ======================================================================= *
 *  PAGE: admin-audit-log.html                                             *
 * ======================================================================= */
function initAdminAuditLogPage() {
  qs("#auditActionFilter").innerHTML = `<option value="">All actions</option>` + AUDIT_ACTIONS.map(a => `<option value="${a}">${a}</option>`).join("");
  renderAuditLog();
  qs("#auditActionFilter").addEventListener("change", renderAuditLog);
  qs("#auditSearchInput").addEventListener("input", renderAuditLog);
  qs("#auditExportBtn").addEventListener("click", exportAuditCsv);
}
function renderAuditLog() {
  const actionF = qs("#auditActionFilter").value;
  const q = qs("#auditSearchInput").value.toLowerCase();
  const filtered = AUDIT_LOG.filter(a => (!actionF || a.action === actionF) && (!q || a.user.toLowerCase().includes(q) || a.object.toLowerCase().includes(q) || a.site.toLowerCase().includes(q)));
  qs("#auditCountLabel").textContent = `${filtered.length} of ${AUDIT_LOG.length} events`;
  qs("#auditTableBody").innerHTML = filtered.map(a => `
    <tr>
      <td class="text-muted">${esc(a.time)}</td>
      <td><div class="row-name"><div class="avatar avatar-sm">${initialsOf(a.user)}</div><span class="name-text">${esc(a.user)}</span></div></td>
      <td><span class="badge ${auditBadgeClass(a.action)}">${esc(a.action)}</span></td>
      <td class="text-muted">${esc(a.object)}</td>
      <td class="text-muted">${esc(a.site)}</td>
      <td class="text-muted">${esc(a.ip)}</td>
    </tr>`).join("");
}
function auditBadgeClass(action) {
  if (["Delete"].includes(action)) return "badge-destructive";
  if (["Upload", "CheckIn", "Restore"].includes(action)) return "badge-success";
  if (["PermissionChange", "Share"].includes(action)) return "badge-warning";
  return "badge-secondary";
}
function exportAuditCsv() {
  const rows = [["Time", "User", "Action", "Object", "Site", "IP"], ...AUDIT_LOG.map(a => [a.time, a.user, a.action, a.object, a.site, a.ip])];
  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "edms-audit-log.csv";
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
  showToast({ title: "Audit log exported", desc: "edms-audit-log.csv" });
}
