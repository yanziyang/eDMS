import { useEffect, useMemo, useState } from "react";
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
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Link, useParams } from "react-router-dom";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DocumentDetailsSheet } from "@/features/documents/components/DocumentDetailsSheet";
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
  uploadToFolder,
  uploadToLibrary,
} from "@/features/documents/api";
import { listSites } from "@/features/sites/api";
import { queryKeys } from "@/lib/queryKeys";
import type { ItemDto, LibraryDto } from "@/types/api";

type SortKey = "name" | "size" | "modifiedAt";
type ViewMode = "list" | "grid";

export function LibraryBrowser() {
  const { siteSlug, libraryId } = useParams();
  const queryClient = useQueryClient();

  const [folderId, setFolderId] = useState<string | null>(null);
  const [folderName, setFolderName] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDesc, setSortDesc] = useState(false);
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);

  useEffect(() => {
    setFolderId(null);
    setFolderName("");
    setSelection(new Set());
  }, [libraryId]);

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

  const itemsQuery = useQuery({
    queryKey: folderId
      ? queryKeys.folders.items(folderId)
      : queryKeys.documents.libraryItems(libraryId ?? "unknown"),
    queryFn: () => (folderId ? listFolderItems(folderId) : listItems(libraryId!)),
    enabled: libraryId !== undefined,
  });

  const itemsKey = folderId
    ? queryKeys.folders.items(folderId)
    : queryKeys.documents.libraryItems(libraryId ?? "unknown");
  const invalidateItems = () => queryClient.invalidateQueries({ queryKey: itemsKey });

  const items = useMemo(() => {
    const source = [...(itemsQuery.data ?? [])];
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
  }, [itemsQuery.data, sortKey, sortDesc]);

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
    mutationFn: async (files: File[]) => {
      for (const file of files) {
        try {
          const result = folderId
            ? await uploadToFolder(folderId, file)
            : await uploadToLibrary(libraryId!, file);
          toast.success(`Uploaded ${result.name} (v${result.versionLabel})`);
        } catch {
          toast.error(`Failed to upload ${file.name}`);
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
          <Button variant="outline" size="sm" onClick={() => setCreateFolderOpen(true)}>
            <FolderPlus className="size-4" />
            New folder
          </Button>
          <Button size="sm" onClick={() => setUploadOpen(true)}>
            <Upload className="size-4" />
            Upload
          </Button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Select
            value={`${sortKey}-${sortDesc}`}
            onValueChange={(value) => {
              const [key, desc] = value.split("-");
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
          <h2 className="mt-3 font-medium">This folder is empty</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Upload files or create a subfolder to get started.
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
                    onClick={() => toggleSort("name", sortKey, sortDesc, setSortKey, setSortDesc)}
                  />
                </th>
                <th className="px-4 py-2 font-medium">
                  <SortHeader
                    label="Size"
                    active={sortKey === "size"}
                    desc={sortDesc}
                    onClick={() => toggleSort("size", sortKey, sortDesc, setSortKey, setSortDesc)}
                  />
                </th>
                <th className="px-4 py-2 font-medium">
                  <SortHeader
                    label="Modified"
                    active={sortKey === "modifiedAt"}
                    desc={sortDesc}
                    onClick={() =>
                      toggleSort("modifiedAt", sortKey, sortDesc, setSortKey, setSortDesc)
                    }
                  />
                </th>
                <th className="px-4 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
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
            </tbody>
          </table>
        </div>
      )}

      {viewMode === "grid" && items.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {items.map((item) => (
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
        </div>
      )}

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
        onUpload={(files) => upload.mutate(files)}
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
  onUpload: (files: File[]) => void;
}

function UploadDialog({ open, onOpenChange, pending, onUpload }: UploadDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload files</DialogTitle>
          <DialogDescription>
            Files are versioned automatically if a document with the same name already exists
            here.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
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
              if (files.length > 0) {
                onUpload(files);
              }
              event.target.value = "";
            }}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
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

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}
