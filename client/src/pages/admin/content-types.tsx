import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LoaderCircle, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
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
import { Textarea } from "@/components/ui/textarea";
import {
  addContentTypeColumn,
  createContentType,
  deleteContentType,
  deleteContentTypeColumn,
  listContentTypes,
  parseChoiceOptions,
  updateContentType,
  updateContentTypeColumn,
  type ContentTypeColumnInput,
  type ContentTypeInput,
} from "@/features/content-types/api";
import { listLibraries } from "@/features/documents/api";
import { listSites } from "@/features/sites/api";
import { queryKeys } from "@/lib/queryKeys";
import type { ContentTypeColumnDto, ContentTypeDto, LibraryDto, MetadataDataType } from "@/types/api";

const DATA_TYPES: MetadataDataType[] = ["Text", "Number", "Date", "Choice", "Boolean", "User", "Lookup"];

export function AdminContentTypes() {
  const queryClient = useQueryClient();
  const [siteId, setSiteId] = useState("");
  const [libraryId, setLibraryId] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ContentTypeDto | null>(null);
  const [deleting, setDeleting] = useState<ContentTypeDto | null>(null);
  const [columnsForId, setColumnsForId] = useState<string | null>(null);

  const sites = useQuery({
    queryKey: queryKeys.sites.list(),
    queryFn: listSites,
  });

  const libraries = useQuery({
    queryKey: queryKeys.libraries.list(siteId),
    queryFn: () => listLibraries(siteId),
    enabled: siteId !== "",
  });

  const scope = siteId === "" ? null : libraryId;
  const contentTypes = useQuery({
    queryKey: queryKeys.contentTypes.list(scope ?? undefined),
    queryFn: () => listContentTypes(scope),
    enabled: siteId === "" || libraryId !== "",
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: queryKeys.contentTypes.all });

  const save = useMutation({
    mutationFn: async ({
      contentTypeId,
      input,
    }: {
      contentTypeId: string | null;
      input: ContentTypeInput;
    }) => {
      if (contentTypeId) {
        await updateContentType(contentTypeId, input);
      } else {
        await createContentType(input);
      }
    },
    onSuccess: (_data, variables) => {
      toast.success(variables.contentTypeId ? "Content type updated" : "Content type created");
      setFormOpen(false);
      setEditing(null);
      invalidate();
    },
    onError: (_error, variables) =>
      toast.error(variables.contentTypeId ? "Failed to update content type" : "Failed to create content type"),
  });

  const remove = useMutation({
    mutationFn: (contentTypeId: string) => deleteContentType(contentTypeId),
    onSuccess: () => {
      toast.success("Content type deleted");
      setDeleting(null);
      invalidate();
    },
    onError: () => toast.error("Failed to delete content type"),
  });

  const columnsFor = contentTypes.data?.find((contentType) => contentType.id === columnsForId) ?? null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ct-scope-site" className="text-xs text-muted-foreground">
            Scope
          </Label>
          <Select
            value={siteId}
            onValueChange={(value) => {
              setSiteId(value);
              setLibraryId("");
            }}
          >
            <SelectTrigger id="ct-scope-site" className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Org-wide</SelectItem>
              {(sites.data ?? []).map((site) => (
                <SelectItem key={site.id} value={site.id}>
                  {site.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {siteId !== "" && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ct-scope-library" className="text-xs text-muted-foreground">
              Library
            </Label>
            <Select value={libraryId} onValueChange={setLibraryId}>
              <SelectTrigger id="ct-scope-library" className="w-56">
                <SelectValue placeholder="Select a library" />
              </SelectTrigger>
              <SelectContent>
                {(libraries.data ?? []).map((library) => (
                  <SelectItem key={library.id} value={library.id}>
                    {library.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <Button
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          <Plus className="size-4" />
          New content type
        </Button>
      </div>

      {siteId !== "" && libraryId === "" && (
        <div className="rounded-xl border border-dashed bg-card/60 p-10 text-center text-sm text-muted-foreground">
          Pick a library to see its content types.
        </div>
      )}

      {contentTypes.isLoading && <div className="text-sm text-muted-foreground">Loading…</div>}
      {contentTypes.isError && (
        <div className="text-sm text-destructive">Failed to load content types.</div>
      )}

      {contentTypes.data && contentTypes.data.length === 0 && (
        <div className="rounded-xl border border-dashed bg-card/60 p-10 text-center text-sm text-muted-foreground">
          No content types in this scope yet.
        </div>
      )}

      {contentTypes.data && contentTypes.data.length > 0 && (
        <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left">
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Scope</th>
                <th className="px-4 py-2 font-medium">Columns</th>
                <th className="px-4 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {contentTypes.data.map((contentType) => (
                <tr key={contentType.id} className="border-b last:border-0">
                  <td className="px-4 py-2">
                    <div className="font-medium">{contentType.name}</div>
                    {contentType.description && (
                      <div className="text-xs text-muted-foreground">{contentType.description}</div>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    {contentType.libraryId === null ? (
                      <Badge variant="outline">Org-wide</Badge>
                    ) : (
                      <span className="text-muted-foreground">
                        {libraries.data?.find((library) => library.id === contentType.libraryId)?.name ??
                          "Library"}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {contentType.columns.length} column{contentType.columns.length === 1 ? "" : "s"}
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Edit ${contentType.name}`}
                        onClick={() => {
                          setEditing(contentType);
                          setFormOpen(true);
                        }}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Columns ${contentType.name}`}
                        onClick={() => setColumnsForId(contentType.id)}
                      >
                        Columns
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Delete ${contentType.name}`}
                        onClick={() => setDeleting(contentType)}
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

      <ContentTypeFormDialog
        open={formOpen}
        onOpenChange={(open) => {
          if (!open) {
            setFormOpen(false);
            setEditing(null);
          }
        }}
        pending={save.isPending}
        initial={editing}
        defaultLibraryId={libraryId}
        libraries={libraries.data ?? []}
        onSubmit={(input) => save.mutate({ contentTypeId: editing?.id ?? null, input })}
      />

      <Dialog open={deleting !== null} onOpenChange={(open) => {
        if (!open) setDeleting(null);
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{deleting ? `Delete "${deleting.name}"?` : "Delete"}</DialogTitle>
            <DialogDescription>
              The content type and its column definitions will be removed. Existing documents keep
              their stored values.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleting && remove.mutate(deleting.id)}
              disabled={remove.isPending}
            >
              {remove.isPending && <LoaderCircle className="size-4 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ColumnsEditorDialog
        contentType={columnsFor}
        onOpenChange={(open) => {
          if (!open) setColumnsForId(null);
        }}
      />
    </div>
  );
}

interface ContentTypeFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pending: boolean;
  initial: ContentTypeDto | null;
  defaultLibraryId: string;
  libraries: LibraryDto[];
  onSubmit: (input: ContentTypeInput) => void;
}

function ContentTypeFormDialog({
  open,
  onOpenChange,
  pending,
  initial,
  defaultLibraryId,
  libraries,
  onSubmit,
}: ContentTypeFormDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [libraryId, setLibraryId] = useState("");

  useEffect(() => {
    if (open) {
      setName(initial?.name ?? "");
      setDescription(initial?.description ?? "");
      setLibraryId(initial?.libraryId ?? defaultLibraryId);
    }
  }, [open, initial, defaultLibraryId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initial ? "Edit content type" : "New content type"}</DialogTitle>
          <DialogDescription>
            Custom metadata fields applied to documents in this library.
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (name.trim() === "") {
              return;
            }
            onSubmit({
              name: name.trim(),
              description: description.trim() === "" ? null : description.trim(),
              libraryId: libraryId === "" ? null : libraryId,
            });
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ct-name">Name</Label>
            <Input id="ct-name" value={name} onChange={(event) => setName(event.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ct-description">Description</Label>
            <Input
              id="ct-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ct-library">Library</Label>
            <Select value={libraryId} onValueChange={setLibraryId}>
              <SelectTrigger id="ct-library" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Org-wide</SelectItem>
                {libraries.map((library) => (
                  <SelectItem key={library.id} value={library.id}>
                    {library.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending || name.trim() === ""}>
              {pending && <LoaderCircle className="size-4 animate-spin" />}
              {initial ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ColumnsEditorDialog({
  contentType,
  onOpenChange,
}: {
  contentType: ContentTypeDto | null;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [columnFormOpen, setColumnFormOpen] = useState(false);
  const [editingColumn, setEditingColumn] = useState<ContentTypeColumnDto | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: queryKeys.contentTypes.all });

  const saveColumn = useMutation({
    mutationFn: async ({
      columnId,
      input,
    }: {
      columnId: string | null;
      input: ContentTypeColumnInput;
    }) => {
      if (columnId) {
        await updateContentTypeColumn(columnId, input);
      } else {
        await addContentTypeColumn(contentType!.id, input);
      }
    },
    onSuccess: (_data, variables) => {
      toast.success(variables.columnId ? "Column updated" : "Column added");
      setColumnFormOpen(false);
      setEditingColumn(null);
      invalidate();
    },
    onError: (_error, variables) =>
      toast.error(variables.columnId ? "Failed to update column" : "Failed to add column"),
  });

  const removeColumn = useMutation({
    mutationFn: (columnId: string) => deleteContentTypeColumn(columnId),
    onSuccess: () => {
      toast.success("Column deleted");
      invalidate();
    },
    onError: () => toast.error("Failed to delete column"),
  });

  return (
    <Dialog open={contentType !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{contentType ? `Columns of ${contentType.name}` : "Columns"}</DialogTitle>
          <DialogDescription>
            Custom metadata fields captured on upload and editable on each document.
          </DialogDescription>
        </DialogHeader>
        {contentType && (
          <div className="flex flex-col gap-4">
            {contentType.columns.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                No columns yet. Add one to capture custom metadata.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-foreground/70">
                    <th className="py-2 pr-2 font-medium">Name</th>
                    <th className="py-2 pr-2 font-medium">Type</th>
                    <th className="py-2 pr-2 font-medium">Required</th>
                    <th className="py-2 pr-2 font-medium">Options</th>
                    <th className="py-2 pr-2 font-medium">Default</th>
                    <th className="py-2 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {contentType.columns.map((column) => (
                    <tr key={column.id} className="border-b last:border-0">
                      <td className="py-2 pr-2 font-medium">{column.name}</td>
                      <td className="py-2 pr-2 text-muted-foreground">{column.dataType}</td>
                      <td className="py-2 pr-2">{column.isRequired ? "Yes" : "No"}</td>
                      <td className="py-2 pr-2 text-muted-foreground">{column.choiceOptions ?? "—"}</td>
                      <td className="py-2 pr-2 text-muted-foreground">{column.defaultValue ?? "—"}</td>
                      <td className="py-2 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label={`Edit ${column.name}`}
                            onClick={() => {
                              setEditingColumn(column);
                              setColumnFormOpen(true);
                            }}
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label={`Delete ${column.name}`}
                            disabled={removeColumn.isPending}
                            onClick={() => removeColumn.mutate(column.id)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div>
              <Button
                size="sm"
                onClick={() => {
                  setEditingColumn(null);
                  setColumnFormOpen(true);
                }}
              >
                <Plus className="size-4" />
                Add column
              </Button>
            </div>
          </div>
        )}
        <ColumnFormDialog
          open={columnFormOpen}
          onOpenChange={(open) => {
            if (!open) {
              setColumnFormOpen(false);
              setEditingColumn(null);
            }
          }}
          pending={saveColumn.isPending}
          initial={editingColumn}
          onSubmit={(input) => saveColumn.mutate({ columnId: editingColumn?.id ?? null, input })}
        />
      </DialogContent>
    </Dialog>
  );
}

function ColumnFormDialog({
  open,
  onOpenChange,
  pending,
  initial,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pending: boolean;
  initial: ContentTypeColumnDto | null;
  onSubmit: (input: ContentTypeColumnInput) => void;
}) {
  const [name, setName] = useState("");
  const [dataType, setDataType] = useState<MetadataDataType>("Text");
  const [isRequired, setIsRequired] = useState(false);
  const [choiceOptions, setChoiceOptions] = useState("");
  const [defaultValue, setDefaultValue] = useState("");

  useEffect(() => {
    if (open) {
      setName(initial?.name ?? "");
      setDataType(initial?.dataType ?? "Text");
      setIsRequired(initial?.isRequired ?? false);
      setChoiceOptions(initial?.choiceOptions ?? "");
      setDefaultValue(initial?.defaultValue ?? "");
    }
  }, [open, initial]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initial ? "Edit column" : "Add column"}</DialogTitle>
          <DialogDescription>Define a custom metadata field.</DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (name.trim() === "") {
              return;
            }
            let choicePayload: string | null = null;
            if (dataType === "Choice" && choiceOptions.trim() !== "") {
              const parsed = parseChoiceOptions(choiceOptions);
              if (parsed.length === 0) {
                toast.error("Choice options must be a JSON array of strings");
                return;
              }
              choicePayload = JSON.stringify(parsed);
            }
            onSubmit({
              name: name.trim(),
              dataType,
              isRequired,
              choiceOptions: choicePayload,
              defaultValue: defaultValue.trim() === "" ? null : defaultValue.trim(),
            });
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="col-name">Name</Label>
            <Input id="col-name" value={name} onChange={(event) => setName(event.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="col-type">Data type</Label>
            <Select value={dataType} onValueChange={(value) => setDataType(value as MetadataDataType)}>
              <SelectTrigger id="col-type" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DATA_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="col-required"
              checked={isRequired}
              onCheckedChange={(checked) => setIsRequired(checked === true)}
            />
            <Label htmlFor="col-required">Required</Label>
          </div>
          {dataType === "Choice" && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="col-choices">Choice options</Label>
              <Textarea
                id="col-choices"
                rows={3}
                value={choiceOptions}
                onChange={(event) => setChoiceOptions(event.target.value)}
                placeholder='["Acme","Globex"]'
              />
              <p className="text-xs text-muted-foreground">JSON array of strings.</p>
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="col-default">Default value</Label>
            <Input
              id="col-default"
              value={defaultValue}
              onChange={(event) => setDefaultValue(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending || name.trim() === ""}>
              {pending && <LoaderCircle className="size-4 animate-spin" />}
              {initial ? "Save" : "Add"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
