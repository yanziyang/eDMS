import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowUp,
  ChevronRight,
  Copy,
  Download,
  FileText,
  Folder,
  FolderPlus,
  LayoutGrid,
  List,
  LoaderCircle,
  MoveRight,
  Settings2,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DocumentDetailsSheet } from "@/features/documents/components/DocumentDetailsSheet";
import { FollowToggle } from "@/features/notifications/components/FollowToggle";
import {
  createLibraryView,
  listLibraryViews,
} from "@/features/library-views/api";
import {
  deserializeFilterConfig,
  deserializeSortConfig,
  serializeFilterConfig,
  serializeSortConfig,
  type LibraryViewGroupBy,
} from "@/features/library-views/config";
import {
  copyDocument,
  createFolder,
  deleteDocument,
  deleteFolder,
  downloadDocument,
  listFolderItems,
  listItems,
  listLibraries,
  moveDocument,
  updateLibrary,
  uploadToFolder,
  uploadToLibrary,
} from "@/features/documents/api";
import { listContentTypes } from "@/features/content-types/api";
import { buildMetadataValues, MetadataFields } from "@/features/content-types/components/MetadataFields";
import { listSites } from "@/features/sites/api";
import { abortUpload, completeUpload, startUpload } from "@/features/uploads/api";
import { LARGE_FILE_THRESHOLD, uploadChunks } from "@/features/uploads/chunkedUpload";
import { ApiError } from "@/lib/api-client";
import { queryKeys } from "@/lib/queryKeys";
import type {
  ContentTypeColumnDto,
  ItemDto,
  LibraryDto,
  LibraryViewDto,
  MetadataValueInput,
} from "@/types/api";

type SortKey = "name" | "size" | "modifiedAt";
type ViewMode = "list" | "grid";

export function LibraryBrowser() {
  const { siteSlug, libraryId } = useParams();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();

  const [folderId, setFolderId] = useState<string | null>(null);
  const [folderName, setFolderName] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDesc, setSortDesc] = useState(false);
  const [filterText, setFilterText] = useState("");
  const [groupBy, setGroupBy] = useState<LibraryViewGroupBy>("none");
  const [activeViewId, setActiveViewId] = useState<string | null>(null);
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [saveViewOpen, setSaveViewOpen] = useState(false);
  const [saveViewName, setSaveViewName] = useState("");
  const [saveViewShared, setSaveViewShared] = useState(false);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const defaultViewAppliedLibraryRef = useRef<string | null>(null);
  const requestedFolderId = searchParams.get("folderId");
  const requestedDocumentId = searchParams.get("documentId");

  useEffect(() => {
    setFolderId(requestedFolderId);
    setFolderName(requestedFolderId ? "Folder" : "");
    setSelectedDocumentId(requestedDocumentId);
    setSelection(new Set());
  }, [libraryId, requestedDocumentId, requestedFolderId]);

  const sites = useQuery({
    queryKey: queryKeys.sites.list(),
    queryFn: listSites,
  });
  const site = sites.data?.find((candidate) => candidate.urlSlug === siteSlug);

  const libraries = useQuery({
    queryKey: queryKeys.libraries.list(site?.id ?? "unknown"),
    queryFn: () => listLibraries(site!.id),
    enabled: site !== undefined,
  });
  const library = libraries.data?.find((candidate) => candidate.id === libraryId);

  const libraryViewsQuery = useQuery({
    queryKey: queryKeys.libraryViews.list(libraryId ?? "unknown"),
    queryFn: () => listLibraryViews(libraryId!),
    enabled: libraryId !== undefined,
    retry: false,
  });

  const applySavedView = useCallback((view: LibraryViewDto) => {
    const filter = deserializeFilterConfig(view.filterConfig);
    const sort = deserializeSortConfig(view.sortConfig);
    setFilterText(filter.text);
    setSortKey(sort.key);
    setSortDesc(sort.descending);
    setGroupBy(view.groupByColumn === "kind" ? "kind" : "none");
    setActiveViewId(view.id);
    setSelection(new Set());
  }, []);

  useEffect(() => {
    if (!libraryId) {
      defaultViewAppliedLibraryRef.current = null;
      return;
    }

    if (
      !libraryViewsQuery.data
      || defaultViewAppliedLibraryRef.current === libraryId
    ) {
      return;
    }

    defaultViewAppliedLibraryRef.current = libraryId;
    const defaultView = libraryViewsQuery.data.find((view) => view.isDefault);
    if (defaultView) {
      applySavedView(defaultView);
    }
  }, [applySavedView, libraryId, libraryViewsQuery.data]);

  const itemsQuery = useQuery({
    queryKey: folderId
      ? queryKeys.folders.items(folderId)
      : queryKeys.documents.libraryItems(libraryId ?? "unknown"),
    queryFn: () => (folderId ? listFolderItems(folderId) : listItems(libraryId!)),
    enabled: libraryId !== undefined,
  });

  const contentTypesQuery = useQuery({
    queryKey: queryKeys.contentTypes.list(libraryId ?? "unknown"),
    queryFn: () => listContentTypes(libraryId!),
    enabled: libraryId !== undefined,
    retry: false,
  });
  const uploadContentType = contentTypesQuery.data?.[0] ?? null;

  const itemsKey = folderId
    ? queryKeys.folders.items(folderId)
    : queryKeys.documents.libraryItems(libraryId ?? "unknown");
  const invalidateItems = () => queryClient.invalidateQueries({ queryKey: itemsKey });

  const items = useMemo(() => {
    const normalizedFilter = filterText.trim().toLocaleLowerCase();
    const source = (itemsQuery.data ?? []).filter(
      (item) => normalizedFilter.length === 0 || item.name.toLocaleLowerCase().includes(normalizedFilter),
    );
    source.sort((a, b) => {
      const direction = sortDesc ? -1 : 1;
      if (sortKey === "name") {
        return direction * a.name.localeCompare(b.name);
      }
      if (sortKey === "size") {
        return direction * (a.sizeBytes - b.sizeBytes);
      }
      return direction * (new Date(a.modifiedAt).getTime() - new Date(b.modifiedAt).getTime());
    });
    return source;
  }, [filterText, itemsQuery.data, sortKey, sortDesc]);

  const groupedItems = useMemo(() => {
    if (groupBy === "none") {
      return [{ label: null, items }];
    }

    return [
      { label: "Folders", items: items.filter((item) => item.kind === "folder") },
      { label: "Documents", items: items.filter((item) => item.kind === "document") },
    ].filter((group) => group.items.length > 0);
  }, [groupBy, items]);

  const selectedItems = items.filter((item) => selection.has(item.id));
  const singleSelectedDocument =
    selectedItems.length === 1 && selectedItems[0].kind === "document" ? selectedItems[0] : null;

  const toggleSelection = (itemId: string) => {
    setSelection((current) => {
      const next = new Set(current);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  const allSelected = items.length > 0 && items.every((item) => selection.has(item.id));

  const toggleSelectAll = () => {
    setSelection(allSelected ? new Set() : new Set(items.map((item) => item.id)));
  };

  const clearSelection = () => setSelection(new Set());

  const deleteItem = useMutation({
    mutationFn: (item: ItemDto) =>
      item.kind === "document" ? deleteDocument(item.documentId!) : deleteFolder(item.folderId!),
    onSuccess: () => {
      toast.success("Item deleted");
      invalidateItems();
    },
    onError: () => toast.error("Failed to delete item"),
  });

  const bulkDelete = useMutation({
    mutationFn: async (targets: ItemDto[]) => {
      for (const item of targets) {
        if (item.kind === "document") {
          await deleteDocument(item.documentId!);
        } else {
          await deleteFolder(item.folderId!);
        }
      }
    },
    onSuccess: (_data, targets) => {
      toast.success(`Deleted ${targets.length} item${targets.length === 1 ? "" : "s"}`);
      clearSelection();
      invalidateItems();
    },
    onError: () => toast.error("Failed to delete selected items"),
  });

  const createFolderMutation = useMutation({
    mutationFn: (name: string) => createFolder(folderId ? null : libraryId!, folderId, name),
    onSuccess: () => {
      toast.success("Folder created");
      setCreateFolderOpen(false);
      invalidateItems();
    },
    onError: () => toast.error("Failed to create folder"),
  });

  const upload = useMutation({
    mutationFn: async ({ files, metadata }: { files: File[]; metadata: MetadataValueInput[] }) => {
      for (const file of files) {
        try {
          const result = folderId
            ? await uploadToFolder(folderId, file)
            : await uploadToLibrary(libraryId!, file, metadata);
          toast.success(`Uploaded ${result.name} (v${result.versionLabel})`);
        } catch (error) {
          toast.error(uploadErrorText(error, file.name));
        }
      }
    },
    onSettled: () => {
      setUploadOpen(false);
      invalidateItems();
    },
  });

  const moveOrCopy = useMutation({
    mutationFn: ({
      documentId,
      destinationLibraryId,
      destinationFolderId,
      mode,
    }: {
      documentId: string;
      destinationLibraryId: string;
      destinationFolderId: string | null;
      mode: "move" | "copy";
    }) =>
      mode === "move"
        ? moveDocument(documentId, { destinationLibraryId, destinationFolderId })
        : copyDocument(documentId, { destinationLibraryId, destinationFolderId }),
    onSuccess: (_data, variables) => {
      toast.success(variables.mode === "move" ? "Document moved" : "Document copied");
      clearSelection();
      setMoveOpen(false);
      invalidateItems();
    },
    onError: (_error, variables) =>
      toast.error(variables.mode === "move" ? "Failed to move document" : "Failed to copy document"),
  });

  const saveViewMutation = useMutation({
    mutationFn: (name: string) => {
      if (!libraryId) {
        throw new Error("A library is required to save a view.");
      }

      return createLibraryView(libraryId, {
        name,
        filterConfig: serializeFilterConfig({ text: filterText }),
        sortConfig: serializeSortConfig({ key: sortKey, descending: sortDesc }),
        groupByColumn: groupBy === "none" ? null : groupBy,
        isShared: saveViewShared,
      });
    },
    onSuccess: (view) => {
      toast.success("View saved");
      setSaveViewOpen(false);
      setSaveViewName("");
      setSaveViewShared(false);
      setActiveViewId(view.id);
      queryClient.invalidateQueries({ queryKey: queryKeys.libraryViews.list(libraryId ?? "unknown") });
    },
    onError: () => toast.error("Failed to save view"),
  });

  const handleSavedViewChange = (value: string) => {
    if (value === "save-current") {
      setSaveViewName("");
      setSaveViewShared(false);
      setSaveViewOpen(true);
      return;
    }

    const view = libraryViewsQuery.data?.find((candidate) => candidate.id === value);
    if (view) {
      applySavedView(view);
    }
  };

  const siteName = site?.name ?? siteSlug ?? "Site";
  const libraryName = library?.name ?? "Documents";

  return (
    <div>
      <div className="mb-4 flex items-center gap-1 text-sm">
        <Link to="/" className="text-muted-foreground hover:text-foreground">
          Sites
        </Link>
        <ChevronRight className="size-4 text-muted-foreground" />
        <Link
          to={`/sites/${siteSlug}`}
          className="text-muted-foreground hover:text-foreground"
        >
          {siteName}
        </Link>
        <ChevronRight className="size-4 text-muted-foreground" />
        <button
          className="text-muted-foreground hover:text-foreground"
          onClick={() => {
            setFolderId(null);
            setFolderName("");
            clearSelection();
          }}
        >
          {libraryName}
        </button>
        {folderId && (
          <>
            <ChevronRight className="size-4 text-muted-foreground" />
            <span className="text-foreground">{folderName}</span>
          </>
        )}
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{libraryName}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Upload, organize, and manage documents with version history and permissions.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {libraryId && (
            <FollowToggle objectType="Library" objectId={libraryId} itemName={libraryName} />
          )}
          <Button variant="outline" size="sm" onClick={() => setCreateFolderOpen(true)}>
            <FolderPlus className="size-4" />
            New folder
          </Button>
          <Button size="sm" onClick={() => setUploadOpen(true)}>
            <Upload className="size-4" />
            Upload
          </Button>
          <Button variant="ghost" size="icon" aria-label="Library settings" onClick={() => setSettingsOpen(true)}>
            <Settings2 className="size-4" />
          </Button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={activeViewId ?? "custom"}
            onValueChange={handleSavedViewChange}
          >
            <SelectTrigger aria-label="Saved view" className="w-48">
              <SelectValue placeholder="Current view" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="custom" disabled>Current view</SelectItem>
              <SelectGroup>
                <SelectLabel>Shared views</SelectLabel>
                {(libraryViewsQuery.data ?? [])
                  .filter((view) => view.ownerId === null)
                  .map((view) => (
                    <SelectItem key={view.id} value={view.id}>
                      {view.name}{view.isDefault ? " (default)" : ""}
                    </SelectItem>
                  ))}
              </SelectGroup>
              <SelectGroup>
                <SelectLabel>My views</SelectLabel>
                {(libraryViewsQuery.data ?? [])
                  .filter((view) => view.ownerId !== null)
                  .map((view) => (
                    <SelectItem key={view.id} value={view.id}>{view.name}</SelectItem>
                  ))}
              </SelectGroup>
              <SelectItem value="save-current">Save current as…</SelectItem>
            </SelectContent>
          </Select>
          <Input
            aria-label="Filter items"
            className="w-48"
            placeholder="Filter by name…"
            value={filterText}
            onChange={(event) => {
              setActiveViewId(null);
              setFilterText(event.target.value);
              clearSelection();
            }}
          />
          <Select
            value={groupBy}
            onValueChange={(value) => {
              setActiveViewId(null);
              setGroupBy(value as LibraryViewGroupBy);
            }}
          >
            <SelectTrigger aria-label="Group items" className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No grouping</SelectItem>
              <SelectItem value="kind">By type</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={`${sortKey}-${sortDesc ? "desc" : "asc"}`}
            onValueChange={(value) => {
              const [key, desc] = value.split("-");
              setActiveViewId(null);
              setSortKey(key as SortKey);
              setSortDesc(desc === "desc");
            }}
          >
            <SelectTrigger aria-label="Sort items" className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name-asc">Name (A–Z)</SelectItem>
              <SelectItem value="name-desc">Name (Z–A)</SelectItem>
              <SelectItem value="size-asc">Size (smallest first)</SelectItem>
              <SelectItem value="size-desc">Size (largest first)</SelectItem>
              <SelectItem value="modifiedAt-desc">Newest first</SelectItem>
              <SelectItem value="modifiedAt-asc">Oldest first</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label={viewMode === "list" ? "Grid view" : "List view"}
            onClick={() => setViewMode(viewMode === "list" ? "grid" : "list")}
          >
            {viewMode === "list" ? <LayoutGrid className="size-4" /> : <List className="size-4" />}
          </Button>
        </div>

        {selection.size > 0 && (
          <div className="flex items-center gap-2 rounded-lg border bg-muted/50 px-3 py-1.5 text-sm">
            <span className="text-muted-foreground">{selection.size} selected</span>
            {singleSelectedDocument && (
              <Button variant="ghost" size="sm" onClick={() => setMoveOpen(true)}>
                <MoveRight className="size-4" />
                Move / Copy
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              disabled={bulkDelete.isPending}
              onClick={() => bulkDelete.mutate(selectedItems)}
            >
              {bulkDelete.isPending ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <Trash2 className="size-4" />
              )}
              Delete
            </Button>
            <Button variant="ghost" size="sm" onClick={clearSelection}>
              <X className="size-4" />
              Clear
            </Button>
          </div>
        )}
      </div>

      {itemsQuery.isLoading && <div className="text-sm text-muted-foreground">Loading…</div>}
      {itemsQuery.isError && (
        <div className="text-sm text-destructive">Failed to load items.</div>
      )}

      {itemsQuery.data && items.length === 0 && (
        <div className="rounded-lg border border-dashed p-10 text-center">
          <Folder className="mx-auto size-10 text-muted-foreground" />
          <h2 className="mt-3 font-medium">
            {filterText.trim() ? "No matching items" : "This folder is empty"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {filterText.trim()
              ? "Try a different name filter."
              : "Upload files or create a subfolder to get started."}
          </p>
        </div>
      )}

      {viewMode === "list" && items.length > 0 && (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-left">
                <th className="w-10 px-4 py-2">
                  <Checkbox
                    aria-label="Select all"
                    checked={allSelected}
                    onCheckedChange={toggleSelectAll}
                  />
                </th>
                <th className="px-4 py-2 font-medium">
                  <SortHeader
                    label="Name"
                    active={sortKey === "name"}
                    desc={sortDesc}
                    onClick={() => {
                      setActiveViewId(null);
                      toggleSort("name", sortKey, sortDesc, setSortKey, setSortDesc);
                    }}
                  />
                </th>
                <th className="px-4 py-2 font-medium">
                  <SortHeader
                    label="Size"
                    active={sortKey === "size"}
                    desc={sortDesc}
                    onClick={() => {
                      setActiveViewId(null);
                      toggleSort("size", sortKey, sortDesc, setSortKey, setSortDesc);
                    }}
                  />
                </th>
                <th className="px-4 py-2 font-medium">
                  <SortHeader
                    label="Modified"
                    active={sortKey === "modifiedAt"}
                    desc={sortDesc}
                    onClick={() => {
                      setActiveViewId(null);
                      toggleSort("modifiedAt", sortKey, sortDesc, setSortKey, setSortDesc);
                    }}
                  />
                </th>
                <th className="px-4 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {groupedItems.map((group) => (
                <Fragment key={group.label ?? "all-items"}>
                  {group.label && (
                    <tr className="border-b bg-muted/20">
                      <td colSpan={5} className="px-4 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {group.label}
                      </td>
                    </tr>
                  )}
                  {group.items.map((item) => (
                    <tr key={item.id} className="border-b last:border-0">
                  <td className="px-4 py-2">
                    <Checkbox
                      aria-label={`Select ${item.name}`}
                      checked={selection.has(item.id)}
                      onCheckedChange={() => toggleSelection(item.id)}
                    />
                  </td>
                  <td className="px-4 py-2">
                    {item.kind === "folder" ? (
                      <button
                        onClick={() => {
                          setFolderId(item.folderId!);
                          setFolderName(item.name);
                          clearSelection();
                        }}
                        className="flex items-center gap-2 font-medium hover:underline"
                      >
                        <Folder className="size-4 text-amber-500" />
                        {item.name}
                      </button>
                    ) : (
                      <button
                        onClick={() => setSelectedDocumentId(item.documentId!)}
                        className="flex items-center gap-2 font-medium hover:underline"
                      >
                        <FileText className="size-4 text-blue-500" />
                        {item.name}
                        {item.checkedOutBy && (
                          <Badge variant="outline" className="text-xs">
                            Checked out
                          </Badge>
                        )}
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {item.kind === "document" ? formatBytes(item.sizeBytes) : "—"}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {new Date(item.modifiedAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-1">
                      {item.kind === "document" && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Download ${item.name}`}
                          onClick={() => downloadDocument(item.documentId!, item.name)}
                        >
                          <Download className="size-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Delete ${item.name}`}
                        disabled={deleteItem.isPending}
                        onClick={() => deleteItem.mutate(item)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </td>
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {viewMode === "grid" && items.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {groupedItems.map((group) => (
            <Fragment key={group.label ?? "all-items"}>
              {group.label && (
                <div className="col-span-full text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {group.label}
                </div>
              )}
              {group.items.map((item) => (
                <div
                  key={item.id}
                  className="group relative flex flex-col gap-2 rounded-lg border bg-card p-4"
                >
              <div className="absolute left-3 top-3">
                <Checkbox
                  aria-label={`Select ${item.name}`}
                  checked={selection.has(item.id)}
                  onCheckedChange={() => toggleSelection(item.id)}
                />
              </div>
              <button
                className="flex flex-1 flex-col items-center gap-2 pt-4 text-center"
                onClick={() => {
                  if (item.kind === "folder") {
                    setFolderId(item.folderId!);
                    setFolderName(item.name);
                    clearSelection();
                  } else {
                    setSelectedDocumentId(item.documentId!);
                  }
                }}
              >
                {item.kind === "folder" ? (
                  <Folder className="size-10 text-amber-500" />
                ) : (
                  <FileText className="size-10 text-blue-500" />
                )}
                <span className="line-clamp-2 break-all text-sm font-medium">{item.name}</span>
                {item.checkedOutBy && (
                  <Badge variant="outline" className="text-xs">
                    Checked out
                  </Badge>
                )}
              </button>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{item.kind === "document" ? formatBytes(item.sizeBytes) : "—"}</span>
                <span>{new Date(item.modifiedAt).toLocaleDateString()}</span>
              </div>
                </div>
              ))}
            </Fragment>
          ))}
        </div>
      )}

      <SaveLibraryViewDialog
        open={saveViewOpen}
        onOpenChange={setSaveViewOpen}
        name={saveViewName}
        onNameChange={setSaveViewName}
        shared={saveViewShared}
        onSharedChange={setSaveViewShared}
        pending={saveViewMutation.isPending}
        onSubmit={() => saveViewMutation.mutate(saveViewName.trim())}
      />

      <CreateFolderDialog
        open={createFolderOpen}
        onOpenChange={setCreateFolderOpen}
        pending={createFolderMutation.isPending}
        onSubmit={(name) => createFolderMutation.mutate(name)}
      />

      <UploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        pending={upload.isPending}
        libraryId={libraryId ?? ""}
        folderId={folderId}
        showMetadata={folderId === null && uploadContentType !== null && uploadContentType.columns.length > 0}
        metadataColumns={uploadContentType?.columns ?? []}
        onUpload={(files, metadata) => upload.mutate({ files, metadata })}
        onChunkedCompleted={invalidateItems}
      />

      <LibrarySettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        siteId={libraries.data?.find((candidate) => candidate.id === libraryId)?.siteId ?? ""}
        library={library ?? null}
      />

      {singleSelectedDocument && (
        <MoveCopyDialog
          open={moveOpen}
          onOpenChange={setMoveOpen}
          libraries={libraries.data ?? []}
          documentName={singleSelectedDocument.name}
          pending={moveOrCopy.isPending}
          onAction={(destinationLibraryId, destinationFolderId, mode) =>
            moveOrCopy.mutate({
              documentId: singleSelectedDocument.documentId!,
              destinationLibraryId,
              destinationFolderId,
              mode,
            })
          }
        />
      )}

      {selectedDocumentId !== null && (
        <DocumentDetailsSheet
          documentId={selectedDocumentId}
          open
          onOpenChange={(open) => {
            if (!open) setSelectedDocumentId(null);
          }}
        />
      )}
    </div>
  );
}

function toggleSort(
  key: SortKey,
  currentKey: SortKey,
  currentDesc: boolean,
  setSortKey: (key: SortKey) => void,
  setSortDesc: (desc: boolean) => void,
) {
  if (currentKey === key) {
    setSortDesc(!currentDesc);
  } else {
    setSortKey(key);
    setSortDesc(false);
  }
}

function SortHeader({
  label,
  active,
  desc,
  onClick,
}: {
  label: string;
  active: boolean;
  desc: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className="inline-flex items-center gap-1 hover:underline"
      onClick={onClick}
      aria-label={`Sort by ${label.toLowerCase()}`}
    >
      {label}
      {active && (desc ? <ArrowDown className="size-3" /> : <ArrowUp className="size-3" />)}
    </button>
  );
}

interface SaveLibraryViewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  name: string;
  onNameChange: (name: string) => void;
  shared: boolean;
  onSharedChange: (shared: boolean) => void;
  pending: boolean;
  onSubmit: () => void;
}

function SaveLibraryViewDialog({
  open,
  onOpenChange,
  name,
  onNameChange,
  shared,
  onSharedChange,
  pending,
  onSubmit,
}: SaveLibraryViewDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Save library view</DialogTitle>
          <DialogDescription>
            Save the current filter, sort, and grouping settings for quick access later.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="saved-view-name">View name</Label>
            <Input
              id="saved-view-name"
              aria-label="View name"
              placeholder="e.g. Active policies"
              value={name}
              onChange={(event) => onNameChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && name.trim().length > 0 && !pending) {
                  onSubmit();
                }
              }}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={shared}
              onCheckedChange={(checked) => onSharedChange(checked === true)}
            />
            <span>Share with everyone who can access this library</span>
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={pending || name.trim().length === 0} onClick={onSubmit}>
            {pending && <LoaderCircle data-icon="inline-start" className="animate-spin" />}
            Save view
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface CreateFolderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pending: boolean;
  onSubmit: (name: string) => void;
}

function CreateFolderDialog({ open, onOpenChange, pending, onSubmit }: CreateFolderDialogProps) {
  const [name, setName] = useState("");

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value) setName("");
        onOpenChange(value);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New folder</DialogTitle>
          <DialogDescription>The folder will be created in the current location.</DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (name.trim() !== "") {
              onSubmit(name.trim());
              setName("");
            }
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="folder-name">Folder name</Label>
            <Input
              id="folder-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="New folder name"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending || name.trim() === ""}>
              {pending && <LoaderCircle className="size-4 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface UploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pending: boolean;
  libraryId: string;
  folderId: string | null;
  showMetadata: boolean;
  metadataColumns: ContentTypeColumnDto[];
  onUpload: (files: File[], metadata: MetadataValueInput[]) => void;
  onChunkedCompleted: () => void;
}

interface ChunkedQueueItem {
  file: File;
  metadata: MetadataValueInput[];
  sessionId: string | null;
}

interface ChunkedUploadState {
  fileName: string;
  sessionId: string | null;
  uploadedBytes: number;
  totalBytes: number;
  failed: boolean;
  errorText: string;
}

function UploadDialog({
  open,
  onOpenChange,
  pending,
  libraryId,
  folderId,
  showMetadata,
  metadataColumns,
  onUpload,
  onChunkedCompleted,
}: UploadDialogProps) {
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [chunked, setChunked] = useState<ChunkedUploadState | null>(null);
  const queueRef = useRef<ChunkedQueueItem[]>([]);
  const pendingSmallRef = useRef<{ files: File[]; metadata: MetadataValueInput[] }>({ files: [], metadata: [] });
  const uploadingRef = useRef(false);

  useEffect(() => {
    const next: Record<string, string> = {};
    for (const column of metadataColumns) {
      next[column.id] = column.defaultValue ?? "";
    }
    setDraft(next);
  }, [metadataColumns, open]);

  useEffect(() => {
    if (!open) {
      setChunked(null);
      queueRef.current = [];
      pendingSmallRef.current = { files: [], metadata: [] };
      uploadingRef.current = false;
    }
  }, [open]);

  async function runChunked(item: ChunkedQueueItem, sessionId: string): Promise<boolean> {
    uploadingRef.current = true;
    let lastProgress = { uploadedBytes: 0, totalBytes: item.file.size };
    try {
      await uploadChunks(item.file, sessionId, (progress) => {
        lastProgress = progress;
        setChunked({
          fileName: item.file.name,
          sessionId,
          uploadedBytes: progress.uploadedBytes,
          totalBytes: progress.totalBytes,
          failed: false,
          errorText: "",
        });
      });
      const result = await completeUpload(sessionId, item.metadata);
      setChunked(null);
      uploadingRef.current = false;
      toast.success(`Uploaded ${result.name} (v${result.versionLabel})`);
      onChunkedCompleted();
      onOpenChange(false);
      return true;
    } catch (error) {
      setChunked({
        fileName: item.file.name,
        sessionId,
        uploadedBytes: lastProgress.uploadedBytes,
        totalBytes: lastProgress.totalBytes,
        failed: true,
        errorText: chunkedErrorText(error),
      });
      uploadingRef.current = false;
      return false;
    }
  }

  async function startChunked(item: ChunkedQueueItem): Promise<boolean> {
    if (!item.sessionId) {
      setChunked({
        fileName: item.file.name,
        sessionId: null,
        uploadedBytes: 0,
        totalBytes: item.file.size,
        failed: false,
        errorText: "",
      });
      try {
        const session = await startUpload({
          libraryId,
          folderId,
          fileName: item.file.name,
          totalBytes: item.file.size,
          metadata: item.metadata,
        });
        item.sessionId = session.sessionId;
      } catch (error) {
        setChunked((current) =>
          current
            ? { ...current, failed: true, errorText: chunkedErrorText(error) }
            : current,
        );
        uploadingRef.current = false;
        return false;
      }
    }
    return runChunked(item, item.sessionId);
  }

  async function processQueue(): Promise<void> {
    while (queueRef.current.length > 0) {
      const item = queueRef.current[0];
      const ok = await startChunked(item);
      if (!ok) {
        return;
      }
      queueRef.current.shift();
    }
    const small = pendingSmallRef.current;
    pendingSmallRef.current = { files: [], metadata: [] };
    if (small.files.length > 0) {
      onUpload(small.files, small.metadata);
    }
  }

  function requestClose(): void {
    if (uploadingRef.current) {
      return;
    }
    if (chunked?.sessionId) {
      void abortUpload(chunked.sessionId).catch(() => {});
    }
    onOpenChange(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (value) {
          onOpenChange(value);
          return;
        }
        requestClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload files</DialogTitle>
          <DialogDescription>
            Files are versioned automatically if a document with the same name already exists
            here.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          {chunked === null ? (
            <>
              {showMetadata && (
                <div className="rounded-lg border bg-muted/50 p-3">
                  <div className="text-sm font-medium">Metadata</div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Required fields are marked with *. Values apply to all uploaded files.
                  </p>
                  <div className="mt-3">
                    <MetadataFields
                      columns={metadataColumns}
                      draft={draft}
                      onChange={(columnId, value) =>
                        setDraft((current) => ({ ...current, [columnId]: value }))
                      }
                    />
                  </div>
                </div>
              )}
              <Label
                htmlFor="upload-files"
                className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed p-8 text-center"
              >
                <Upload className="size-8 text-muted-foreground" />
                <span className="text-sm">
                  <span className="font-medium text-primary">Click to browse</span> or drag files
                  here
                </span>
              </Label>
              <Input
                id="upload-files"
                type="file"
                multiple
                disabled={pending}
                className="sr-only"
                onChange={(event) => {
                  const files = Array.from(event.target.files ?? []);
                  event.target.value = "";
                  if (files.length === 0) {
                    return;
                  }
                  const metadata = buildMetadataValues(metadataColumns, draft);
                  const small = files.filter((file) => file.size < LARGE_FILE_THRESHOLD);
                  const large = files.filter((file) => file.size >= LARGE_FILE_THRESHOLD);
                  queueRef.current = large.map((file) => ({ file, metadata, sessionId: null }));
                  pendingSmallRef.current = { files: small, metadata };
                  void processQueue();
                }}
              />
            </>
          ) : (
            <div className="flex flex-col gap-2 rounded-lg border p-4">
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate font-medium">{chunked.fileName}</span>
                <span className="text-muted-foreground">
                  {chunked.totalBytes > 0
                    ? Math.round((chunked.uploadedBytes / chunked.totalBytes) * 100)
                    : 0}
                  %
                </span>
              </div>
              <Progress
                value={
                  chunked.totalBytes > 0
                    ? Math.round((chunked.uploadedBytes / chunked.totalBytes) * 100)
                    : 0
                }
              />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {formatBytes(chunked.uploadedBytes)} / {formatBytes(chunked.totalBytes)}
                </span>
                {chunked.failed && (
                  <span>Paused — progress is kept so you can resume</span>
                )}
              </div>
              {chunked.failed && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-2 text-sm text-destructive">
                  {chunked.errorText}
                </div>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          {chunked === null && (
            <Button variant="outline" onClick={requestClose} disabled={pending}>
              Cancel
            </Button>
          )}
          {chunked !== null && chunked.failed && (
            <>
              {chunked.sessionId && (
                <Button onClick={() => void processQueue()}>
                  <Upload className="size-4" />
                  Resume
                </Button>
              )}
              <Button variant="outline" onClick={requestClose}>
                Cancel
              </Button>
            </>
          )}
          {chunked !== null && !chunked.failed && (
            <Button variant="outline" disabled>
              Cancel
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface MoveCopyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  libraries: LibraryDto[];
  documentName: string;
  pending: boolean;
  onAction: (
    destinationLibraryId: string,
    destinationFolderId: string | null,
    mode: "move" | "copy",
  ) => void;
}

function MoveCopyDialog({
  open,
  onOpenChange,
  libraries,
  documentName,
  pending,
  onAction,
}: MoveCopyDialogProps) {
  const [destinationLibraryId, setDestinationLibraryId] = useState("");
  const [destinationFolderId, setDestinationFolderId] = useState<string>("root");

  const destinationFolders = useQuery({
    queryKey: queryKeys.documents.libraryItems(destinationLibraryId || "none"),
    queryFn: () => listItems(destinationLibraryId),
    enabled: open && destinationLibraryId !== "",
  });

  const folders = (destinationFolders.data ?? []).filter((item) => item.kind === "folder");

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        setDestinationLibraryId("");
        setDestinationFolderId("root");
        onOpenChange(value);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Move or copy &quot;{documentName}&quot;</DialogTitle>
          <DialogDescription>
            Pick a destination library and, optionally, a folder inside it.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="dest-library">Destination library</Label>
            <Select value={destinationLibraryId} onValueChange={setDestinationLibraryId}>
              <SelectTrigger id="dest-library" className="w-full">
                <SelectValue placeholder="Select a library" />
              </SelectTrigger>
              <SelectContent>
                {libraries.map((library) => (
                  <SelectItem key={library.id} value={library.id}>
                    {library.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="dest-folder">Destination folder</Label>
            <Select
              value={destinationFolderId}
              onValueChange={setDestinationFolderId}
              disabled={destinationLibraryId === ""}
            >
              <SelectTrigger id="dest-folder" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="root">Library root</SelectItem>
                {folders.map((folder) => (
                  <SelectItem key={folder.folderId!} value={folder.folderId!}>
                    {folder.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {destinationLibraryId !== "" && destinationFolders.isLoading && (
              <p className="text-sm text-muted-foreground">Loading folders…</p>
            )}
            {destinationLibraryId !== "" && destinationFolders.isError && (
              <p className="text-sm text-destructive">Failed to load folders.</p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="outline"
            disabled={pending || destinationLibraryId === ""}
            onClick={() =>
              onAction(
                destinationLibraryId,
                destinationFolderId === "root" ? null : destinationFolderId,
                "copy",
              )
            }
          >
            {pending && <LoaderCircle className="size-4 animate-spin" />}
            <Copy className="size-4" />
            Copy
          </Button>
          <Button
            disabled={pending || destinationLibraryId === ""}
            onClick={() =>
              onAction(
                destinationLibraryId,
                destinationFolderId === "root" ? null : destinationFolderId,
                "move",
              )
            }
          >
            {pending && <LoaderCircle className="size-4 animate-spin" />}
            <MoveRight className="size-4" />
            Move
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function uploadErrorText(error: unknown, fileName: string): string {
  const quotaMessage = quotaErrorText(error);
  if (quotaMessage) {
    return `Failed to upload ${fileName}: ${quotaMessage}`;
  }

  const detail = error instanceof ApiError ? error.problem.detail : null;
  return detail ? `Failed to upload ${fileName}: ${detail}` : `Failed to upload ${fileName}`;
}

function chunkedErrorText(error: unknown): string {
  const quotaMessage = quotaErrorText(error);
  if (quotaMessage) {
    return `Upload failed: ${quotaMessage}`;
  }

  const detail = error instanceof ApiError ? error.problem.detail : null;
  return detail ? `Upload failed: ${detail}` : "Upload failed. You can resume from where it stopped.";
}

function quotaErrorText(error: unknown): string | null {
  if (!(error instanceof ApiError) || error.problem.type !== "urn:edms:quota-exceeded") {
    return null;
  }

  const { siteName, quotaBytes, detail } = error.problem;
  if (siteName && typeof quotaBytes === "number") {
    return `Site "${siteName}" storage quota exceeded (${formatBytes(quotaBytes)} limit).`;
  }

  return detail ?? "The Site storage quota has been exceeded.";
}

interface LibrarySettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  siteId: string;
  library: LibraryDto | null;
}

function LibrarySettingsDialog({ open, onOpenChange, siteId, library }: LibrarySettingsDialogProps) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [enableVersioning, setEnableVersioning] = useState(true);
  const [enableMinorVersions, setEnableMinorVersions] = useState(false);
  const [requireCheckout, setRequireCheckout] = useState(false);
  const [minorVersionsRetained, setMinorVersionsRetained] = useState("");

  useEffect(() => {
    if (library && open) {
      setName(library.name);
      setDescription(library.description ?? "");
      setEnableVersioning(library.enableVersioning);
      setEnableMinorVersions(library.enableMinorVersions);
      setRequireCheckout(library.requireCheckout);
      setMinorVersionsRetained(library.minorVersionsRetained?.toString() ?? "");
    }
  }, [library, open]);

  const save = useMutation({
    mutationFn: () =>
      updateLibrary(siteId, library!.id, {
        name,
        description,
        enableVersioning,
        enableMinorVersions,
        requireCheckout,
        minorVersionsRetained: minorVersionsRetained === "" ? null : Number(minorVersionsRetained),
      }),
    onSuccess: () => {
      toast.success("Library settings saved");
      queryClient.invalidateQueries({ queryKey: queryKeys.libraries.list(siteId) });
      onOpenChange(false);
    },
    onError: () => toast.error("Failed to save library settings"),
  });

  if (!library) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Library settings</DialogTitle>
          <DialogDescription>
            Versioning options for &quot;{library.name}&quot;.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="settings-name">Name</Label>
            <Input
              id="settings-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="settings-description">Description</Label>
            <Input
              id="settings-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={enableVersioning}
              onCheckedChange={(value) => setEnableVersioning(value === true)}
            />
            Enable versioning
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={enableMinorVersions}
              onCheckedChange={(value) => setEnableMinorVersions(value === true)}
            />
            Enable minor versions
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={requireCheckout}
              onCheckedChange={(value) => setRequireCheckout(value === true)}
            />
            Require check-out before editing
          </label>
          <div className="flex flex-col gap-2">
            <Label htmlFor="settings-cap">Retained minor versions (blank = unlimited)</Label>
            <Input
              id="settings-cap"
              type="number"
              min={1}
              value={minorVersionsRetained}
              onChange={(event) => setMinorVersionsRetained(event.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending || name.trim() === ""}>
            {save.isPending && <LoaderCircle className="size-4 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}
