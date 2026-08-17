import { useEffect, useRef, useState } from "react";
import {
  Bell,
  Check,
  Copy,
  Download,
  Eye,
  Filter,
  FileSearch,
  FolderPlus,
  Grid2x2,
  History,
  List,
  Lock,
  MoreHorizontal,
  Move,
  Pencil,
  Save,
  Share2,
  ShieldCheck,
  Star,
  Tags,
  Trash2,
  UploadCloud,
  UserPlus,
  X,
} from "lucide-react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { CheckoutBadge, EmptyState, PageHeader, TagBadges } from "@/components/app/bits";
import { FileIcon } from "@/components/app/file-icon";
import { ItemContextMenu } from "@/components/app/item-context-menu";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { bumpVersion, fmtDate, fmtSize, parseSizeVal, todayStr } from "@/lib/helpers";
import { CURRENT_USER, findSite, getLibraryContents } from "@/lib/mock-data";
import {
  db,
  emit,
  getLibraryViews,
  isFavorite,
  isFollowing,
  itemFavoriteEntry,
  libraryFavoriteEntry,
  openDocSheet,
  saveLibraryView,
  toggleFavorite,
  toggleFollow,
  useDb,
} from "@/lib/store";
import type { LibraryItem, SavedView, Site } from "@/types";
import { cn } from "@/lib/utils";

type SortKey = "name" | "modifiedBy" | "modified" | "size";

export function Library() {
  const { slug = "finance", lib: libId = "", folder = "root" } = useParams();
  const [searchParams] = useSearchParams();
  useDb();

  const site = findSite(slug);
  const lib = site.libraries.find((l) => l.id === libId) ?? site.libraries[0];
  const key = `${site.slug}/${lib.id}/${folder}`;
  const entry = db.libraries[key] ?? getLibraryContents(site.slug, lib.id, folder);

  const navigate = useNavigate();
  const [view, setView] = useState<"list" | "grid">("list");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "name", dir: "asc" });
  const [selection, setSelection] = useState<Set<number>>(new Set());
  const [filter, setFilter] = useState("");
  const [groupBy, setGroupBy] = useState<SavedView["groupBy"]>("none");
  const [viewId, setViewId] = useState("all");
  const [saveViewOpen, setSaveViewOpen] = useState(false);
  const [bulkEditOpen, setBulkEditOpen] = useState(false);

  const [uploadOpen, setUploadOpen] = useState(false);
  const [quickInput, setQuickInput] = useState<{
    title: string;
    label: string;
    value: string;
    confirmLabel: string;
    onConfirm: (v: string) => void;
  } | null>(null);
  const [moveCopy, setMoveCopy] = useState<{ index: number; mode: "move" | "copy" } | null>(null);
  const [shareItem, setShareItem] = useState<LibraryItem | null>(null);
  const [previewItem, setPreviewItem] = useState<LibraryItem | null>(null);

  const action = searchParams.get("action");
  const libraryKey = `${site.slug}/${lib.id}/${folder}`;
  const views = getLibraryViews(libraryKey);
  const libraryEntry = libraryFavoriteEntry(site, lib);
  const following = isFollowing("library", `${site.slug}/${lib.id}`);

  useEffect(() => {
    setView("list");
    const defaultView = getLibraryViews(libraryKey).find((candidate) => candidate.isDefault) ?? getLibraryViews(libraryKey)[0];
    setViewId(defaultView?.id ?? "all");
    setFilter(defaultView?.filter ?? "");
    setSort({ key: defaultView?.sortKey ?? "name", dir: defaultView?.sortDir ?? "asc" });
    setGroupBy(defaultView?.groupBy ?? "none");
    setSelection(new Set());
  }, [slug, libId, folder, libraryKey]);

  useEffect(() => {
    if (action === "upload") setUploadOpen(true);
    if (action === "newfolder") {
      setQuickInput({
        title: "New folder",
        label: "Folder name",
        value: "",
        confirmLabel: "Create",
        onConfirm: (v) => {
          entry.items.unshift({
            type: "folder",
            id: v.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
            name: v,
            modified: todayStr(),
            modifiedBy: CURRENT_USER.name,
          });
          emit();
          toast.success(`Folder "${v}" created`);
        },
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, libId, folder, action]);

  const sortedItems = (() => {
    const query = filter.trim().toLowerCase();
    const items = entry.items.filter((item) => {
      if (!query) return true;
      return [item.name, item.modifiedBy, item.ext || "", ...(item.tags || [])].some((value) =>
        value.toLowerCase().includes(query)
      );
    });
    items.sort((a, b) => {
      if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
      if (sort.key === "size") {
        const av = parseSizeVal(a);
        const bv = parseSizeVal(b);
        return sort.dir === "asc" ? av - bv : bv - av;
      }
      const av = a[sort.key] || "";
      const bv = b[sort.key] || "";
      const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true });
      return sort.dir === "asc" ? cmp : -cmp;
    });
    return items;
  })();

  const groupedItems = (() => {
    if (groupBy === "none") return [{ label: "", items: sortedItems.map((item, index) => ({ item, index })) }];
    const groups = new Map<string, Array<{ item: LibraryItem; index: number }>>();
    sortedItems.forEach((item, index) => {
      const label = groupBy === "type" ? (item.type === "folder" ? "Folders" : "Files") : item.modifiedBy;
      const group = groups.get(label) ?? [];
      group.push({ item, index });
      groups.set(label, group);
    });
    return Array.from(groups, ([label, items]) => ({ label, items }));
  })();

  const itemEntry = (item: LibraryItem) => itemFavoriteEntry(item, { site: site.slug, lib: lib.id, folder });

  const applyView = (id: string) => {
    const selected = views.find((candidate) => candidate.id === id);
    if (!selected) return;
    setViewId(id);
    setFilter(selected.filter);
    setSort({ key: selected.sortKey, dir: selected.sortDir });
    setGroupBy(selected.groupBy);
  };

  const toggleSelect = (i: number, checked: boolean) => {
    setSelection((prev) => {
      const next = new Set(prev);
      if (checked) next.add(i);
      else next.delete(i);
      return next;
    });
  };

  const allSelected = sortedItems.length > 0 && selection.size === sortedItems.length;

  const deleteItem = (i: number) => {
    const item = sortedItems[i];
    const realIdx = entry.items.indexOf(item);
    entry.items.splice(realIdx, 1);
    emit();
    toast.success(`"${item.name}" moved to Recycle Bin`, {
      action: {
        label: "Undo",
        onClick: () => {
          entry.items.splice(realIdx, 0, item);
          emit();
          toast.success("Restored");
        },
      },
    });
    if (db.sheet?.item === item) db.sheet = null;
  };

  const toggleCheckout = (i: number) => {
    const item = sortedItems[i];
    if (item.checkedOutBy && item.checkedOutBy !== CURRENT_USER.name) {
      toast.error("Can't check in", { description: `This file is checked out by ${item.checkedOutBy}.` });
      return;
    }
    if (item.checkedOutBy === CURRENT_USER.name) {
      item.checkedOutBy = null;
      item.version = bumpVersion(item.version);
      item.modified = todayStr();
      item.modifiedBy = CURRENT_USER.name;
      toast.success("Checked in", { description: `New version ${item.version} created.` });
    } else {
      item.checkedOutBy = CURRENT_USER.name;
      toast.success("Checked out", { description: "Only you can upload a new version until you check in." });
    }
    emit();
  };

  const title = folder === "root" ? lib.name : entry.name;
  const isRoot = folder === "root";

  const getItemActions = (item: LibraryItem, index: number) => ({
    favorite: isFavorite(itemEntry(item).key),
    onFavorite: () => toggleFavorite(itemEntry(item)),
    onOpen: () => openItem(item, navigate, slug, lib.id, folder),
    onPreview: () => setPreviewItem(item),
    onRename: () =>
      setQuickInput({
        title: "Rename",
        label: "Name",
        value: item.name,
        confirmLabel: "Rename",
        onConfirm: (value) => {
          item.name = value;
          emit();
          toast.success("Renamed successfully");
        },
      }),
    onMove: () => setMoveCopy({ index, mode: "move" }),
    onCopy: () => setMoveCopy({ index, mode: "copy" }),
    onVersions: () => openDocSheet(item, "versions", { site: slug, lib: lib.id, folder }),
    onCheckout: () => toggleCheckout(index),
    onPermissions: () => openDocSheet(item, "permissions", { site: slug, lib: lib.id, folder }),
    onShare: () => setShareItem(item),
    onDelete: () => deleteItem(index),
  });

  return (
    <div>
      <CrumbBar>
        <CrumbLink to="/home">Home</CrumbLink>
        <CrumbSep />
        <CrumbLink to={`/sites/${site.slug}`}>{site.name}</CrumbLink>
        <CrumbSep />
        <CrumbLink to={`/sites/${site.slug}/${lib.id}/root`}>{lib.name}</CrumbLink>
        {!isRoot && entry.parent && (
          <>
            <CrumbSep />
            <span className="font-medium text-foreground">{entry.name}</span>
          </>
        )}
      </CrumbBar>

      <PageHeader
        title={title}
        subtitle="Upload, organize, and manage documents with version history and permissions."
        actions={
          <>
            <Button
              variant={following ? "secondary" : "outline"}
              onClick={() => toggleFollow("library", `${site.slug}/${lib.id}`)}
            >
              <Bell data-icon="inline-start" />
              {following ? "Following" : "Follow"}
            </Button>
            <Button
              variant="outline"
              size="icon"
              className={isFavorite(libraryEntry.key) ? "text-amber-500 hover:text-amber-600" : undefined}
              aria-label={isFavorite(libraryEntry.key) ? "Remove library from favorites" : "Add library to favorites"}
              onClick={() => toggleFavorite(libraryEntry)}
            >
              <Star className={isFavorite(libraryEntry.key) ? "fill-current" : undefined} />
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                setQuickInput({
                  title: "New folder",
                  label: "Folder name",
                  value: "",
                  confirmLabel: "Create",
                  onConfirm: (v) => {
                    entry.items.unshift({
                      type: "folder",
                      id: v.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
                      name: v,
                      modified: todayStr(),
                      modifiedBy: CURRENT_USER.name,
                    });
                    emit();
                    toast.success(`Folder "${v}" created`);
                  },
                })
              }
            >
              <FolderPlus data-icon="inline-start" />
              New folder
            </Button>
            <Button onClick={() => setUploadOpen(true)}>
              <UploadCloud data-icon="inline-start" />
              Upload
            </Button>
          </>
        }
      />

      {selection.size > 0 && (
        <div className="mb-3.5 flex items-center gap-3 rounded-[var(--radius)] border border-primary/25 bg-accent px-3.5 py-2 text-[13px] font-medium text-accent-foreground">
          <Check className="size-3.5" />
          <span>
            {selection.size} item{selection.size === 1 ? "" : "s"} selected
          </span>
          <div className="flex-1" />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => toast.info(`Preparing ${selection.size} item(s) for download…`)}
          >
            <Download data-icon="inline-start" />
            Download
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setBulkEditOpen(true)}>
            <Pencil data-icon="inline-start" />
            Edit properties
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              const idxs = Array.from(selection).sort((a, b) => b - a);
              idxs.forEach((i) => entry.items.splice(entry.items.indexOf(sortedItems[i]), 1));
              setSelection(new Set());
              emit();
              toast.success(`${idxs.length} item(s) moved to Recycle Bin`);
            }}
          >
            <Trash2 data-icon="inline-start" />
            Delete
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setSelection(new Set())}>
            <X data-icon="inline-start" />
            Clear
          </Button>
        </div>
      )}

      <div className="mb-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <div className="relative min-w-[190px] max-w-[270px] flex-1">
            <Filter className="pointer-events-none absolute left-2.5 top-2 size-3.5 text-muted-foreground" />
            <Input
              className="h-8 pl-8 text-[12.5px]"
              placeholder="Filter this library…"
              value={filter}
              onChange={(e) => {
                setFilter(e.target.value);
                setViewId("custom");
              }}
              aria-label="Filter this library"
            />
          </div>
          <Select value={viewId} onValueChange={applyView}>
            <SelectTrigger className="h-8 w-[170px] text-[12.5px]" aria-label="Saved library view">
              <SelectValue placeholder="Saved view" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {viewId === "custom" && <SelectItem value="custom">Custom view</SelectItem>}
                {views.map((savedView) => (
                  <SelectItem key={savedView.id} value={savedView.id}>
                    {savedView.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <Select value={groupBy} onValueChange={(value) => { setGroupBy(value as SavedView["groupBy"]); setViewId("custom"); }}>
            <SelectTrigger className="h-8 w-[135px] text-[12.5px]" aria-label="Group library items">
              <SelectValue placeholder="Group by" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="none">No grouping</SelectItem>
                <SelectItem value="type">Type</SelectItem>
                <SelectItem value="modifiedBy">Modified by</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => setSaveViewOpen(true)}>
            <Save data-icon="inline-start" />
            Save view
          </Button>
          <span className="hidden text-xs text-muted-foreground xl:inline">
            Drag and drop files anywhere on this page to upload
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <div className="inline-flex overflow-hidden rounded-[calc(var(--radius)-2px)] border">
            <Button
              variant="ghost"
              size="sm"
              className={cn("rounded-none border-r", view === "list" && "bg-secondary text-secondary-foreground")}
              onClick={() => setView("list")}
              aria-label="List view"
            >
              <List data-icon="inline-start" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={cn("rounded-none", view === "grid" && "bg-secondary text-secondary-foreground")}
              onClick={() => setView("grid")}
              aria-label="Grid view"
            >
              <Grid2x2 data-icon="inline-start" />
            </Button>
          </div>
        </div>
      </div>

      {sortedItems.length === 0 ? (
        <div className="rounded-[var(--radius)] border bg-card">
          <EmptyState
            icon={<FolderPlus className="size-6" />}
            title="This folder is empty"
            description="Upload files or create a subfolder to get started."
            actions={
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setQuickInput({
                      title: "New folder",
                      label: "Folder name",
                      value: "",
                      confirmLabel: "Create",
                      onConfirm: (v) => {
                        entry.items.unshift({
                          type: "folder",
                          id: v.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
                          name: v,
                          modified: todayStr(),
                          modifiedBy: CURRENT_USER.name,
                        });
                        emit();
                        toast.success(`Folder "${v}" created`);
                      },
                    })
                  }
                >
                  <FolderPlus data-icon="inline-start" />
                  New folder
                </Button>
                <Button size="sm" onClick={() => setUploadOpen(true)}>
                  <UploadCloud data-icon="inline-start" />
                  Upload
                </Button>
              </>
            }
          />
        </div>
      ) : (
        <>
          {view === "list" && (
            <>
              <div className="hidden overflow-x-auto rounded-[var(--radius)] border bg-card md:block">
                <Table className="text-[13.3px]">
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead className="w-9">
                        <Checkbox
                          checked={allSelected}
                          onCheckedChange={(c) => {
                            if (c) setSelection(new Set(sortedItems.map((_, i) => i)));
                            else setSelection(new Set());
                          }}
                          aria-label="Select all"
                        />
                      </TableHead>
                      <SortHead label="Name" active={sort.key === "name"} dir={sort.dir} onClick={() => sortBy("name", sort, setSort)} />
                      <SortHead label="Modified by" active={sort.key === "modifiedBy"} dir={sort.dir} onClick={() => sortBy("modifiedBy", sort, setSort)} />
                      <SortHead label="Modified" active={sort.key === "modified"} dir={sort.dir} onClick={() => sortBy("modified", sort, setSort)} />
                      <SortHead label="Size" active={sort.key === "size"} dir={sort.dir} onClick={() => sortBy("size", sort, setSort)} />
                      <TableHead className="w-10 text-right" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {groupedItems.flatMap((group) => group.items).map(({ item, index: i }) => (
                      <ItemContextMenu item={item} {...getItemActions(item, i)}>
                        <TableRow
                          key={item.name + i}
                          className={cn(selection.has(i) && "bg-accent")}
                        >
                        <TableCell className="w-9">
                          <Checkbox
                            checked={selection.has(i)}
                            onCheckedChange={(c) => toggleSelect(i, !!c)}
                            onClick={(e) => e.stopPropagation()}
                            aria-label={`Select ${item.name}`}
                          />
                        </TableCell>
                        <TableCell className="max-w-[340px]">
                          <RowName
                            item={item}
                            onOpen={() => openItem(item, navigate, slug, lib.id, folder)}
                          />
                          {item.tags?.length ? (
                            <div className="mt-1 flex gap-1 pl-[2.75rem]">
                              <TagBadges tags={item.tags} />
                            </div>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{item.modifiedBy}</TableCell>
                        <TableCell className="text-muted-foreground">{fmtDate(item.modified)}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {item.type === "folder" ? "—" : item.size}
                        </TableCell>
                        <TableCell className="w-10 text-right">
                          <RowMenu
                            item={item}
                            index={i}
                            {...getItemActions(item, i)}
                          />
                        </TableCell>
                        </TableRow>
                      </ItemContextMenu>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile card list */}
              <div className="overflow-hidden rounded-[var(--radius)] border bg-card md:hidden">
                {groupedItems.flatMap((group) => group.items).map(({ item, index: i }) => (
                  <ItemContextMenu item={item} {...getItemActions(item, i)}>
                    <div
                      key={item.name + i}
                      className={cn("flex items-center gap-3 border-b px-3.5 py-3.5 last:border-b-0", selection.has(i) && "bg-accent")}
                    >
                    <Checkbox
                      checked={selection.has(i)}
                      onCheckedChange={(c) => toggleSelect(i, !!c)}
                      aria-label={`Select ${item.name}`}
                    />
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 items-center gap-3 text-left"
                      onClick={() => openItem(item, navigate, slug, lib.id, folder)}
                    >
                      <FileIcon item={item} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 text-[13.5px] font-medium">
                          <span className="truncate">{item.name}</span>
                          <CheckoutBadge checkedOutBy={item.checkedOutBy} />
                        </div>
                        <div className="mt-0.5 text-[11.5px] text-muted-foreground">
                          {item.type === "folder"
                            ? `${item.modifiedBy} · ${fmtDate(item.modified)}`
                            : `${item.size} · ${fmtDate(item.modified)}`}
                        </div>
                      </div>
                    </button>
                          <RowMenu
                            item={item}
                            index={i}
                            {...getItemActions(item, i)}
                          />
                    </div>
                  </ItemContextMenu>
                ))}
              </div>
            </>
          )}

          {view === "grid" && (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(148px,1fr))] gap-3.5">
              {groupedItems.flatMap((group) => group.items).map(({ item, index: i }) => (
                <ItemContextMenu item={item} {...getItemActions(item, i)}>
                  <div
                    key={item.name + i}
                    className={cn(
                      "relative rounded-[var(--radius)] border bg-card p-4 text-center hover:border-primary/40 hover:bg-muted/40",
                      selection.has(i) && "bg-accent"
                    )}
                  >
                  <span className="absolute left-2 top-2">
                    <Checkbox
                      checked={selection.has(i)}
                      onCheckedChange={(c) => toggleSelect(i, !!c)}
                      aria-label={`Select ${item.name}`}
                    />
                  </span>
                  <span className="absolute right-1.5 top-1.5">
                    <RowMenu
                      item={item}
                      index={i}
                      {...getItemActions(item, i)}
                    />
                  </span>
                  <button
                    type="button"
                    className="w-full"
                    onClick={() => openItem(item, navigate, slug, lib.id, folder)}
                  >
                    <FileIcon item={item} size={44} className="mx-auto mb-2.5 mt-1 size-11" iconClassName="size-5" />
                    <div className="tile-name text-[12.3px] font-medium leading-[1.3]">{item.name}</div>
                    <div className="mt-1 text-[11px] text-muted-foreground">
                      {item.type === "folder" ? fmtDate(item.modified) : item.size}
                    </div>
                  </button>
                  </div>
                </ItemContextMenu>
              ))}
            </div>
          )}
        </>
      )}

      <UploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        site={site}
        onUploaded={(item) => {
          entry.items.unshift(item);
          emit();
        }}
      />

      {quickInput && (
        <QuickInputDialog
          title={quickInput.title}
          label={quickInput.label}
          value={quickInput.value}
          confirmLabel={quickInput.confirmLabel}
          onConfirm={(v) => {
            if (v) quickInput.onConfirm(v);
            setQuickInput(null);
          }}
          onCancel={() => setQuickInput(null)}
        />
      )}

      {moveCopy && (
        <MoveCopyDialog
          mode={moveCopy.mode}
          item={sortedItems[moveCopy.index]}
          onConfirm={(destLabel) => {
            const item = sortedItems[moveCopy.index];
            const idx = entry.items.indexOf(item);
            if (moveCopy.mode === "copy") {
              const copyItem: LibraryItem = {
                ...item,
                name:
                  item.type === "folder"
                    ? item.name + " - Copy"
                    : item.name.replace(/(\.[^.]+)?$/, (m) => " - Copy" + m),
                version: "1.0",
                checkedOutBy: null,
                modified: todayStr(),
                modifiedBy: CURRENT_USER.name,
              };
              entry.items.splice(idx + 1, 0, copyItem);
              toast.success(`Copied to ${destLabel}`, { description: `"${copyItem.name}" was created.` });
            } else {
              entry.items.splice(idx, 1);
              toast.success(`Moved to ${destLabel}`, { description: `"${item.name}" is no longer in this folder.` });
            }
            emit();
            setMoveCopy(null);
          }}
          onCancel={() => setMoveCopy(null)}
        />
      )}

      {shareItem && (
        <ShareDialog item={shareItem} onClose={() => setShareItem(null)} />
      )}

      {previewItem && <PreviewDialog item={previewItem} onClose={() => setPreviewItem(null)} />}

      {saveViewOpen && (
        <SaveViewDialog
          open={saveViewOpen}
          onOpenChange={setSaveViewOpen}
          current={{ filter, sortKey: sort.key, sortDir: sort.dir, groupBy }}
          canSetDefault={CURRENT_USER.role === "System Administrator"}
          onSave={(view) => {
            saveLibraryView(libraryKey, view);
            setViewId(view.id);
            setSaveViewOpen(false);
            toast.success(`Saved view "${view.name}"`);
          }}
        />
      )}

      {bulkEditOpen && (
        <BulkMetadataDialog
          open={bulkEditOpen}
          onOpenChange={setBulkEditOpen}
          items={sortedItems.filter((_, index) => selection.has(index))}
          onSaved={() => {
            setBulkEditOpen(false);
            setSelection(new Set());
            emit();
          }}
        />
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Sub-components                                                     */
/* ---------------------------------------------------------------- */

function CrumbBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-1 text-[13px] text-muted-foreground">
      {children}
    </div>
  );
}
function CrumbLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link to={to} className="hover:text-foreground">
      {children}
    </Link>
  );
}
function CrumbSep() {
  return <span className="text-muted-foreground/50">›</span>;
}

function SortHead({
  label,
  active,
  dir,
  onClick,
}: {
  label: string;
  active: boolean;
  dir: "asc" | "desc";
  onClick: () => void;
}) {
  return (
    <TableHead
      className={cn("cursor-pointer select-none hover:text-foreground")}
      onClick={onClick}
    >
      {label}
      <span className="ml-1">{active ? (dir === "asc" ? "↑" : "↓") : ""}</span>
    </TableHead>
  );
}

function sortBy(key: SortKey, sort: { key: SortKey; dir: "asc" | "desc" }, setSort: (s: { key: SortKey; dir: "asc" | "desc" }) => void) {
  if (sort.key === key) setSort({ key, dir: sort.dir === "asc" ? "desc" : "asc" });
  else setSort({ key, dir: "asc" });
}

function openItem(item: LibraryItem, navigate: (to: string) => void, slug: string, libId: string, folder = "root") {
  if (item.type === "folder") {
    navigate(`/sites/${slug}/${libId}/${item.id}`);
  } else {
    openDocSheet(item, "properties", { site: slug, lib: libId, folder });
  }
}

function RowName({
  item,
  onOpen,
}: {
  item: LibraryItem;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      className="flex w-full min-w-0 items-center gap-2.5 text-left font-medium"
      onClick={onOpen}
    >
      <FileIcon item={item} />
      <span className="min-w-0 flex-1 truncate">{item.name}</span>
      <CheckoutBadge checkedOutBy={item.checkedOutBy} />
    </button>
  );
}

function RowMenu({
  item,
  index,
  favorite,
  onFavorite,
  onOpen,
  onPreview,
  onRename,
  onMove,
  onCopy,
  onVersions,
  onCheckout,
  onPermissions,
  onShare,
  onDelete,
}: {
  item: LibraryItem;
  index: number;
  favorite: boolean;
  onFavorite: () => void;
  onOpen: () => void;
  onPreview: () => void;
  onRename: () => void;
  onMove: () => void;
  onCopy: () => void;
  onVersions: () => void;
  onCheckout: () => void;
  onPermissions: () => void;
  onShare: () => void;
  onDelete: () => void;
}) {
  void index;
  const isFolder = item.type === "folder";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label="More actions">
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[210px]">
        <DropdownMenuItem onSelect={onOpen}>
          <Eye data-icon="inline-start" />
          Open
        </DropdownMenuItem>
        {!isFolder && (
          <DropdownMenuItem onSelect={onPreview}>
            <FileSearch data-icon="inline-start" />
            Preview
          </DropdownMenuItem>
        )}
        {!isFolder && (
          <DropdownMenuItem
            onSelect={() => toast.info(`Downloading ${item.name}…`)}
          >
            <Download data-icon="inline-start" />
            Download
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onSelect={onFavorite}>
          <Star data-icon="inline-start" className={favorite ? "fill-current text-amber-500" : undefined} />
          {favorite ? "Remove from favorites" : "Add to favorites"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onRename}>
          <Pencil data-icon="inline-start" />
          Rename
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onMove}>
          <Move data-icon="inline-start" />
          Move to
        </DropdownMenuItem>
        {!isFolder && (
          <DropdownMenuItem onSelect={onCopy}>
            <Copy data-icon="inline-start" />
            Copy to
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        {!isFolder && (
          <>
            <DropdownMenuItem onSelect={onVersions}>
              <History data-icon="inline-start" />
              Version history
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onCheckout}>
              <Lock data-icon="inline-start" />
              Check out / in
            </DropdownMenuItem>
          </>
        )}
        <DropdownMenuItem onSelect={onPermissions}>
          <ShieldCheck data-icon="inline-start" />
          Manage access
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onShare}>
          <Share2 data-icon="inline-start" />
          Share
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={onDelete} className="text-destructive">
          <Trash2 data-icon="inline-start" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* ---------------------------------------------------------------- */
/* Upload dialog                                                     */
/* ---------------------------------------------------------------- */

interface UploadRow {
  name: string;
  ext: string;
  pct: number;
  done: boolean;
  sizeBytes: number;
  error?: string;
}

function UploadDialog({
  open,
  onOpenChange,
  site,
  onUploaded,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  site: Site;
  onUploaded: (item: LibraryItem) => void;
}) {
  const [rows, setRows] = useState<UploadRow[]>([]);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const timersRef = useRef<ReturnType<typeof setInterval>[]>([]);

  const allDone = rows.length > 0 && rows.every((r) => r.done || !!r.error);

  const addFiles = (files: FileList | null) => {
    if (!files?.length) return;
    const list = Array.from(files).slice(0, 8);
    list.forEach((f) => {
      const ext = (f.name.split(".").pop() || "").toLowerCase();
      const sizeBytes = f.size || 245000;
      const exceedsQuota = site.storageUsedGB + sizeBytes / (1024 ** 3) > site.storageQuotaGB;
      if (exceedsQuota) {
        setRows((prev) => [...prev, { name: f.name, ext, pct: 0, done: false, sizeBytes, error: "Storage quota exceeded" }]);
        toast.error(`Upload blocked for ${f.name}`, {
          description: `${site.name} has reached its ${site.storageQuotaGB} GB storage quota.`,
        });
        return;
      }
      setRows((prev) => [...prev, { name: f.name, ext, pct: 0, done: false, sizeBytes }]);
      const timer = setInterval(() => {
        setRows((prev) =>
          prev.map((r) => {
            if (r.name !== f.name || r.done) return r;
            const pct = Math.min(100, r.pct + Math.random() * 24 + 14);
            if (pct >= 100) {
              clearInterval(timer);
              onUploaded({
                type: "file",
                name: f.name,
                ext: ext || "generic",
                size: fmtSize(sizeBytes),
                modified: todayStr(),
                modifiedBy: CURRENT_USER.name,
                version: "1.0",
                tags: [],
                checkedOutBy: null,
              });
              return { ...r, pct: 100, done: true };
            }
            return { ...r, pct };
          })
        );
      }, 220);
      timersRef.current.push(timer);
    });
  };

  const close = () => {
    timersRef.current.forEach(clearInterval);
    timersRef.current = [];
    setRows([]);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Upload files</DialogTitle>
          <DialogDescription>
            Files are versioned automatically if a document with the same name already exists here.
          </DialogDescription>
        </DialogHeader>
        <div>
          <label
            className={cn(
              "flex cursor-pointer flex-col items-center gap-2 rounded-[var(--radius)] border-2 border-dashed px-6 py-10 text-center",
              dragging ? "border-primary bg-accent" : "border-border"
            )}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              addFiles(e.dataTransfer.files);
            }}
          >
            <UploadCloud className="size-9 stroke-[1.6] text-primary" />
            <div>
              <span className="font-semibold text-primary">Click to browse</span> or drag files here
            </div>
            <div className="text-xs text-muted-foreground">
              Up to 250 MB per file · blocked types configured in Admin → Settings
            </div>
            <input
              ref={inputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => addFiles(e.target.files)}
            />
          </label>
          <div className="mt-3 rounded-[var(--radius)] border bg-muted/35 px-3 py-2 text-xs text-muted-foreground">
            <div className="flex items-center justify-between gap-3">
              <span>Storage quota</span>
              <span className="font-medium text-foreground">
                {site.storageUsedGB.toFixed(1)} GB of {site.storageQuotaGB} GB used
              </span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, (site.storageUsedGB / site.storageQuotaGB) * 100)}%` }} />
            </div>
          </div>
          {rows.length > 0 && (
            <div className="mt-4 flex flex-col gap-3">
              {rows.map((r) => (
                <div key={r.name} className="flex items-center gap-3">
                  <FileIcon item={{ type: "file", ext: r.ext }} className="size-[30px]" iconClassName="size-3.5" />
                  <div className="min-w-0 flex-1">
                    <div className="flex justify-between gap-2 text-[13px]">
                      <span className="truncate">{r.name}</span>
                      <span className={cn("shrink-0", r.error ? "text-destructive" : "text-muted-foreground")}>
                        {r.error || (r.done ? "Done" : Math.round(r.pct) + "%")}
                      </span>
                    </div>
                    <div className="mt-1 h-[7px] overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn("h-full rounded-full", r.error ? "bg-destructive" : r.done ? "bg-success" : "bg-primary")}
                        style={{ width: r.pct + "%" }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={close}>
            Cancel
          </Button>
          <Button disabled={!allDone} onClick={close}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------------------------------------------------------- */
/* Quick input dialog (rename / new folder)                          */
/* ---------------------------------------------------------------- */

function QuickInputDialog({
  title,
  label,
  value,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  title: string;
  label: string;
  value: string;
  confirmLabel: string;
  onConfirm: (v: string) => void;
  onCancel: () => void;
}) {
  const [val, setVal] = useState(value);
  return (
    <Dialog open onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="max-w-[380px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div>
          <Label className="text-[13px]">{label}</Label>
          <Input
            className="mt-1.5"
            value={val}
            onChange={(e) => setVal(e.target.value)}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onConfirm(val.trim());
              }
            }}
          />
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={() => onConfirm(val.trim())}>{confirmLabel}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SaveViewDialog({
  open,
  onOpenChange,
  current,
  canSetDefault,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  current: Pick<SavedView, "filter" | "sortKey" | "sortDir" | "groupBy">;
  canSetDefault: boolean;
  onSave: (view: SavedView) => void;
}) {
  const [name, setName] = useState("");
  const [isDefault, setIsDefault] = useState(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Save current view</DialogTitle>
          <DialogDescription>
            Save the current filter, sort, and grouping so the library can be opened the same way next time.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const trimmed = name.trim();
            if (!trimmed) return;
            onSave({
              id: `${trimmed.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`,
              name: trimmed,
              ...current,
              isDefault: canSetDefault && isDefault,
            });
            setName("");
            setIsDefault(false);
          }}
        >
          <Label htmlFor="save-view-name" className="text-[13px]">View name</Label>
          <Input
            id="save-view-name"
            className="mt-1.5"
            placeholder="e.g. Recently modified files"
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoFocus
            required
          />
          <div className="mt-4 rounded-[var(--radius)] border bg-muted/30 px-3 py-2.5 text-xs text-muted-foreground">
            <div className="font-medium text-foreground">Current settings</div>
            <div className="mt-1">Filter: {current.filter || "None"}</div>
            <div>Sort: {current.sortKey} ({current.sortDir}) · Group: {current.groupBy}</div>
          </div>
          {canSetDefault && (
            <label className="mt-4 flex cursor-pointer items-center gap-2 text-[13px]">
              <Checkbox checked={isDefault} onCheckedChange={(checked) => setIsDefault(!!checked)} />
              Make this the default view for this library
            </label>
          )}
          <DialogFooter className="mt-5">
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">Save view</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function BulkMetadataDialog({
  open,
  onOpenChange,
  items,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: LibraryItem[];
  onSaved: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");

  const save = () => {
    const nextTags = tags.split(",").map((tag) => tag.trim()).filter(Boolean);
    const failures: string[] = [];
    let updated = 0;
    items.forEach((item) => {
      if (item.checkedOutBy && item.checkedOutBy !== CURRENT_USER.name) {
        failures.push(`${item.name} (checked out by ${item.checkedOutBy})`);
        return;
      }
      if (title.trim()) item.title = title.trim();
      if (description.trim()) item.description = description.trim();
      if (nextTags.length) item.tags = nextTags;
      item.modified = todayStr();
      item.modifiedBy = CURRENT_USER.name;
      updated += 1;
    });
    if (updated) toast.success(`Updated metadata on ${updated} item${updated === 1 ? "" : "s"}`);
    if (failures.length) {
      toast.error(`${failures.length} item${failures.length === 1 ? "" : "s"} could not be updated`, {
        description: failures.join(", "),
      });
    }
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Edit properties</DialogTitle>
          <DialogDescription>
            Apply metadata to {items.length} selected item{items.length === 1 ? "" : "s"}. Blank fields are left unchanged.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div>
            <Label htmlFor="bulk-title" className="text-[13px]">Title</Label>
            <Input id="bulk-title" className="mt-1.5" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Set a common title" />
          </div>
          <div>
            <Label htmlFor="bulk-description" className="text-[13px]">Description</Label>
            <Textarea id="bulk-description" className="mt-1.5" rows={3} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Set a common description" />
          </div>
          <div>
            <Label htmlFor="bulk-tags" className="flex items-center gap-1.5 text-[13px]"><Tags className="size-3.5" />Tags</Label>
            <Input id="bulk-tags" className="mt-1.5" value={tags} onChange={(event) => setTags(event.target.value)} placeholder="Comma-separated tags" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={!title.trim() && !description.trim() && !tags.trim()}>Apply changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------------------------------------------------------- */
/* Move / Copy dialog                                                */
/* ---------------------------------------------------------------- */

function MoveCopyDialog({
  mode,
  item,
  onConfirm,
  onCancel,
}: {
  mode: "move" | "copy";
  item: LibraryItem;
  onConfirm: (destLabel: string) => void;
  onCancel: () => void;
}) {
  const destinations = db.sites.flatMap((s) =>
    s.libraries.map((l) => ({ value: `${s.slug}/${l.id}`, label: `${s.name} / ${l.name}` }))
  );
  const [value, setValue] = useState(destinations[0].value);
  void item;
  return (
    <Dialog open onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="max-w-[380px]">
        <DialogHeader>
          <DialogTitle>{mode === "move" ? "Move to" : "Copy to"}</DialogTitle>
        </DialogHeader>
        <div>
          <Label className="text-[13px]">Destination</Label>
          <Select value={value} onValueChange={setValue}>
            <SelectTrigger className="mt-1.5 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {destinations.map((d) => (
                  <SelectItem key={d.value} value={d.value}>
                    {d.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              const d = destinations.find((x) => x.value === value) ?? destinations[0];
              onConfirm(d.label);
            }}
          >
            {mode === "move" ? "Move here" : "Copy here"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------------------------------------------------------- */
/* Share dialog                                                      */
/* ---------------------------------------------------------------- */

function ShareDialog({ item, onClose }: { item: LibraryItem; onClose: () => void }) {
  const [people, setPeople] = useState(["Sarah Chen", "Finance Members"]);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Share</DialogTitle>
          <div className="mt-2 flex items-center gap-2">
            <FileIcon item={item} size={34} className="size-[34px]" iconClassName="size-4" />
            <span className="truncate text-sm font-medium">{item.name}</span>
          </div>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div>
            <Label className="text-[13px]">Invite people or groups</Label>
            <InputGroup className="mt-1.5">
              <InputGroupAddon>
                <UserPlus />
              </InputGroupAddon>
              <InputGroupInput placeholder="Search internal people or groups…" />
            </InputGroup>
            <div className="mt-2 flex flex-wrap gap-1">
              {people.map((p) => (
                <span
                  key={p}
                  className="inline-flex h-5 items-center gap-0.5 rounded-full bg-secondary px-2 text-[11px] font-medium text-secondary-foreground"
                >
                  {p}
                  <button
                    type="button"
                    className="ml-0.5 text-muted-foreground hover:text-foreground"
                    onClick={() => setPeople((prev) => prev.filter((x) => x !== p))}
                    aria-label={`Remove ${p}`}
                  >
                    <X className="size-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>
          <div>
            <Label className="text-[13px]">Permission level</Label>
            <Select defaultValue="view">
              <SelectTrigger className="mt-1.5 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="view">Can view</SelectItem>
                  <SelectItem value="edit">Can edit</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[13px]">Message (optional)</Label>
            <Textarea className="mt-1.5" rows={2} placeholder="Add a note…" />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="shareNotify" defaultChecked />
            <label htmlFor="shareNotify" className="cursor-pointer text-[13px]">
              Send an email notification
            </label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              onClose();
              toast.success(`Shared "${item.name}"`, {
                description: "An email notification was sent to the people you added.",
              });
            }}
          >
            <Share2 data-icon="inline-start" />
            Share
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------------------------------------------------------- */
/* Preview dialog                                                    */
/* ---------------------------------------------------------------- */

function PreviewDialog({ item, onClose }: { item: LibraryItem; onClose: () => void }) {
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[640px]">
        <DialogHeader>
          <DialogTitle>{item.name}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4 rounded-[var(--radius)] bg-muted px-6 py-10">
          <FileIcon item={item} size={46} iconClassName="size-5" />
          <div className="text-center">
            <div className="text-sm font-medium">Preview not available in this prototype</div>
            <div className="mx-auto mt-1 max-w-[34ch] text-xs text-muted-foreground">
              In the production app, PDF and image files preview inline; Office files render via a
              server-side conversion service.
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          <Button onClick={() => toast.info(`Downloading ${item.name}…`)}>
            <Download data-icon="inline-start" />
            Download
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
