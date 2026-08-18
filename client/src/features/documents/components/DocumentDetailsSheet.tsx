import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Download,
  FileText,
  FileWarning,
  LoaderCircle,
  Lock,
  LockOpen,
  RefreshCw,
  RotateCcw,
  Share2,
  ShieldCheck,
  Undo2,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/features/auth/auth-context";
import {
  checkInDocument,
  checkOutDocument,
  discardCheckout,
  downloadDocument,
  getDocument,
  getDocumentPreview,
  listDocumentVersions,
  restoreVersion,
  updateDocument,
} from "@/features/documents/api";
import { getDocumentMetadata, updateDocumentMetadata } from "@/features/content-types/api";
import {
  buildMetadataValues,
  MetadataFields,
  missingRequiredColumns,
  type MetadataFieldColumn,
} from "@/features/content-types/components/MetadataFields";
import { FavoriteToggle } from "@/features/favorites/components/FavoriteToggle";
import { grantPermission, getPermissions, resetPermissions, revokePermission } from "@/features/permissions/api";
import { FollowToggle } from "@/features/notifications/components/FollowToggle";
import { queryKeys } from "@/lib/queryKeys";
import type {
  DocumentDto,
  DocumentMetadataColumnDto,
  PermissionLevel,
  PermissionsStateDto,
  PrincipalType,
} from "@/types/api";
import { ShareDialog } from "./ShareDialog";

interface DocumentDetailsSheetProps {
  documentId: string;
  open: boolean;
  openShare?: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DocumentDetailsSheet({ documentId, open, openShare = false, onOpenChange }: DocumentDetailsSheetProps) {
  const [shareOpen, setShareOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      setShareOpen(false);
    } else if (openShare) {
      setShareOpen(true);
    }
  }, [open, openShare]);

  const detail = useQuery({
    queryKey: queryKeys.documents.detail(documentId),
    queryFn: () => getDocument(documentId),
    enabled: open,
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg max-sm:!w-full">
        {detail.isLoading && (
          <div className="p-4 text-sm text-muted-foreground">Loading…</div>
        )}
        {detail.isError && (
          <div className="p-4 text-sm text-destructive">Failed to load document.</div>
        )}
        {detail.data && (
          <>
            <SheetHeader>
              <div className="flex items-start gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <FileText className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <SheetTitle className="truncate">{detail.data.name}</SheetTitle>
                  <SheetDescription>
                    {formatBytes(detail.data.sizeBytes)} · v{detail.data.versionLabel} ·{" "}
                    {detail.data.contentType}
                  </SheetDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => setShareOpen(true)}>
                  <Share2 className="size-4" />
                  Share
                </Button>
                <FollowToggle objectType="Document" objectId={documentId} itemName={detail.data.name} />
              </div>
            </SheetHeader>

            <Tabs defaultValue="properties" className="min-h-0 flex-1">
              <TabsList>
                <TabsTrigger value="preview" className="text-foreground/70">
                  Preview
                </TabsTrigger>
                <TabsTrigger value="properties" className="text-foreground/70">
                  Properties
                </TabsTrigger>
                <TabsTrigger value="versions" className="text-foreground/70">
                  Versions
                </TabsTrigger>
                <TabsTrigger value="permissions" className="text-foreground/70">
                  Permissions
                </TabsTrigger>
              </TabsList>
              <TabsContent value="preview" className="mt-4">
                <PreviewTab document={detail.data} />
              </TabsContent>
              <TabsContent value="properties" className="mt-4">
                <PropertiesTab document={detail.data} />
              </TabsContent>
              <TabsContent value="versions" className="mt-4">
                <VersionsTab document={detail.data} />
              </TabsContent>
              <TabsContent value="permissions" className="mt-4">
                <PermissionsTab documentId={documentId} />
              </TabsContent>
            </Tabs>

            <ShareDialog
              open={shareOpen}
              onOpenChange={setShareOpen}
              documentId={documentId}
              documentName={detail.data.name}
            />
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

type PreviewState =
  | { kind: "loading" }
  | { kind: "ready"; url: string }
  | { kind: "error" }
  | { kind: "unavailable" };

function PreviewTab({ document }: { document: DocumentDto }) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<PreviewState>(() =>
    isPreviewable(document.contentType) ? { kind: "loading" } : { kind: "unavailable" },
  );
  const objectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isPreviewable(document.contentType)) {
      return;
    }
    let cancelled = false;
    setState({ kind: "loading" });
    getDocumentPreview(document.id)
      .then((blob) => {
        if (cancelled) {
          return;
        }
        const contentType = blob.type || document.contentType;
        if (!isBrowserRenderable(contentType)) {
          setState({ kind: "unavailable" });
          return;
        }
        const url = URL.createObjectURL(blob);
        objectUrlRef.current = url;
        setState({ kind: "ready", url });
      })
      .catch(() => {
        if (!cancelled) {
          setState({ kind: "error" });
        }
      });
    return () => {
      cancelled = true;
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, [attempt, document.id, document.contentType, document.versionLabel]);

  if (state.kind === "unavailable") {
    return <PreviewUnavailable document={document} />;
  }

  if (state.kind === "error") {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-6 text-center">
        <p className="text-sm text-destructive">Failed to load preview.</p>
        <Button variant="outline" size="sm" onClick={() => setAttempt((current) => current + 1)}>
          <RefreshCw className="size-4" />
          Try again
        </Button>
      </div>
    );
  }

  if (state.kind === "ready") {
    return <iframe src={state.url} title="Preview" className="h-[420px] w-full rounded-lg border" />;
  }

  return (
    <div className="flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground">
      <LoaderCircle className="size-4 animate-spin" />
      Loading preview…
    </div>
  );
}

function PreviewUnavailable({ document }: { document: DocumentDto }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-6 text-center">
      <FileWarning className="size-8 text-muted-foreground" />
      <div>
        <p className="text-sm font-medium">Preview not available for this file type</p>
        {isOfficeContentType(document.contentType) && (
          <p className="mt-1 text-xs text-muted-foreground">
            Office preview conversion is unavailable right now. Download the file to view it.
          </p>
        )}
      </div>
      <Button variant="outline" size="sm" onClick={() => downloadDocument(document.id, document.name)}>
        <Download className="size-4" />
        Download
      </Button>
    </div>
  );
}

function isBrowserRenderable(contentType: string): boolean {
  return (
    contentType === "application/pdf" ||
    contentType.startsWith("image/") ||
    contentType.startsWith("text/")
  );
}

function isOfficeContentType(contentType: string): boolean {
  return (
    contentType === "application/msword" ||
    contentType === "application/vnd.ms-excel" ||
    contentType === "application/vnd.ms-powerpoint" ||
    contentType.startsWith("application/vnd.openxmlformats-officedocument.")
  );
}

function isPreviewable(contentType: string): boolean {
  return isBrowserRenderable(contentType) || isOfficeContentType(contentType);
}

function PropertiesTab({ document }: { document: DocumentDto }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(document.name);
  const [title, setTitle] = useState(document.title ?? "");
  const [description, setDescription] = useState(document.description ?? "");

  const save = useMutation({
    mutationFn: () => {
      const renamed = name.trim() !== document.name;
      return updateDocument(document.id, {
        ...(renamed ? { name: name.trim() } : {}),
        title: title.trim() === "" ? null : title.trim(),
        description: description.trim() === "" ? null : description.trim(),
      });
    },
    onSuccess: () => {
      toast.success("Document updated");
      if (name.trim() !== document.name) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.documents.libraryItems(document.libraryId),
        });
        if (document.folderId) {
          queryClient.invalidateQueries({ queryKey: queryKeys.folders.items(document.folderId) });
        }
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.documents.detail(document.id) });
    },
    onError: () => toast.error("Failed to update document"),
  });

  const meta = [
    ["File size", formatBytes(document.sizeBytes)],
    ["File type", document.contentType],
    ["Current version", `v${document.versionLabel}`],
    ["Created", formatDate(document.createdAt)],
    ["Modified", document.modifiedAt ? formatDate(document.modifiedAt) : "—"],
  ] as const;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="doc-name">Name</Label>
          <Input id="doc-name" value={name} onChange={(event) => setName(event.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="doc-title">Title</Label>
          <Input id="doc-title" value={title} onChange={(event) => setTitle(event.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="doc-description">Description</Label>
          <Textarea
            id="doc-description"
            rows={3}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending && <LoaderCircle className="size-4 animate-spin" />}
            Save
          </Button>
          <FavoriteToggle objectType="Document" objectId={document.id} itemName={document.name} />
          {document.checkedOutBy ? (
            <Badge variant="outline" className="gap-1">
              <Lock className="size-3" />
              Checked out
            </Badge>
          ) : (
            <Badge variant="outline">Checked in</Badge>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        {meta.map(([key, value]) => (
          <div key={key}>
            <div className="text-xs text-foreground/70">{key}</div>
            <div className="mt-0.5 font-medium">{value}</div>
          </div>
        ))}
      </div>

      <MetadataSection documentId={document.id} />
    </div>
  );
}

function MetadataSection({ documentId }: { documentId: string }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, string> | null>(null);

  const metadata = useQuery({
    queryKey: queryKeys.documents.metadata(documentId),
    queryFn: () => getDocumentMetadata(documentId),
  });

  const save = useMutation({
    mutationFn: () =>
      updateDocumentMetadata(
        documentId,
        buildMetadataValues(metadataColumns(metadata.data?.columns ?? []), draft ?? {}),
      ),
    onSuccess: () => {
      toast.success("Metadata updated");
      setEditing(false);
      setDraft(null);
      queryClient.invalidateQueries({ queryKey: queryKeys.documents.metadata(documentId) });
    },
    onError: () => toast.error("Failed to update metadata"),
  });

  const startEditing = () => {
    const next: Record<string, string> = {};
    for (const column of metadata.data?.columns ?? []) {
      next[column.columnDefinitionId] = column.value ?? column.defaultValue ?? "";
    }
    setDraft(next);
    setEditing(true);
  };

  if (metadata.isLoading || !metadata.data) {
    return null;
  }

  if (metadata.data.columns.length === 0) {
    return (
      <div className="rounded-lg border bg-muted/50 p-3">
        <div className="text-sm font-medium">Metadata</div>
      <div className="mt-1 text-sm text-foreground">No custom metadata fields.</div>
      </div>
    );
  }

  const submit = () => {
    const missing = missingRequiredColumns(metadataColumns(metadata.data.columns), draft ?? {});
    if (missing.length > 0) {
      toast.error(`Missing required metadata: ${missing.join(", ")}`);
      return;
    }
    save.mutate();
  };

  return (
    <div className="rounded-lg border bg-muted/50 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-medium">Metadata</div>
        {!editing && (
          <Button variant="ghost" size="sm" onClick={startEditing}>
            Edit
          </Button>
        )}
      </div>
      {metadata.data.contentTypeName && (
        <div className="mt-0.5 text-xs text-foreground/70">{metadata.data.contentTypeName}</div>
      )}
      {!editing ? (
        <dl className="mt-2 grid grid-cols-2 gap-2 text-sm">
          {metadata.data.columns.map((column) => (
            <div key={column.columnDefinitionId}>
              <dt className="text-xs text-foreground/70">
                {column.name}
                {column.isRequired ? " *" : ""}
              </dt>
              <dd className="mt-0.5 font-medium">{formatMetadataValue(column)}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <div className="mt-2 flex flex-col gap-2">
          <MetadataFields
            columns={metadataColumns(metadata.data.columns)}
            draft={draft ?? {}}
            onChange={(columnId, value) =>
              setDraft((current) => ({ ...(current ?? {}), [columnId]: value }))
            }
          />
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={submit} disabled={save.isPending}>
              {save.isPending && <LoaderCircle className="size-4 animate-spin" />}
              Save metadata
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setEditing(false);
                setDraft(null);
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function metadataColumns(columns: DocumentMetadataColumnDto[]): MetadataFieldColumn[] {
  return columns.map((column) => ({
    id: column.columnDefinitionId,
    name: column.name,
    dataType: column.dataType,
    isRequired: column.isRequired,
    choiceOptions: column.choiceOptions,
  }));
}

function formatMetadataValue(column: DocumentMetadataColumnDto): string {
  if (column.dataType === "Boolean") {
    if (column.value === null) {
      return "—";
    }
    return column.value === "true" ? "Yes" : "No";
  }
  return column.value ?? "—";
}

function VersionsTab({ document }: { document: DocumentDto }) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [checkinComment, setCheckinComment] = useState("");

  const versionsQuery = useQuery({
    queryKey: queryKeys.documents.versions(document.id),
    queryFn: () => listDocumentVersions(document.id),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.documents.versions(document.id) });
    queryClient.invalidateQueries({ queryKey: queryKeys.documents.detail(document.id) });
    queryClient.invalidateQueries({ queryKey: queryKeys.documents.libraryItems(document.libraryId) });
  };

  const checkout = useMutation({
    mutationFn: () => checkOutDocument(document.id),
    onSuccess: () => {
      toast.success("Checked out");
      invalidate();
    },
    onError: () => toast.error("Failed to check out"),
  });

  const checkin = useMutation({
    mutationFn: () => checkInDocument(document.id, checkinComment.trim() === "" ? undefined : checkinComment.trim()),
    onSuccess: () => {
      setCheckinComment("");
      toast.success("Checked in");
      invalidate();
    },
    onError: () => toast.error("Failed to check in"),
  });

  const discard = useMutation({
    mutationFn: () => discardCheckout(document.id),
    onSuccess: () => {
      toast.success("Check-out discarded");
      invalidate();
    },
    onError: () => toast.error("Failed to discard check-out"),
  });

  const restore = useMutation({
    mutationFn: (versionId: string) => restoreVersion(document.id, versionId),
    onSuccess: () => {
      toast.success("Version restored");
      invalidate();
    },
    onError: () => toast.error("Failed to restore version"),
  });

  const checkedOutByMe = document.checkedOutBy !== null && document.checkedOutBy === user?.id;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        {document.checkedOutBy === null && (
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => checkout.mutate()}
              disabled={checkout.isPending}
            >
              <Lock className="size-4" />
              Check out
            </Button>
          </div>
        )}
        {checkedOutByMe && (
          <>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="checkin-comment">Check-in comment</Label>
              <Input
                id="checkin-comment"
                value={checkinComment}
                onChange={(event) => setCheckinComment(event.target.value)}
                placeholder="What changed?"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => checkin.mutate()}
                disabled={checkin.isPending}
              >
                <LockOpen className="size-4" />
                Check in
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => discard.mutate()}
                disabled={discard.isPending}
              >
                Discard check out
              </Button>
            </div>
          </>
        )}
        {document.checkedOutBy !== null && !checkedOutByMe && (
          <Button variant="secondary" size="sm" disabled>
            <Lock className="size-4" />
            Checked out by someone else
          </Button>
        )}
      </div>

      {versionsQuery.isLoading && (
        <div className="text-sm text-muted-foreground">Loading…</div>
      )}
      {versionsQuery.isError && (
        <div className="text-sm text-destructive">Failed to load versions.</div>
      )}
      {versionsQuery.data && versionsQuery.data.length === 0 && (
        <div className="text-sm text-muted-foreground">No versions found.</div>
      )}
      {versionsQuery.data && versionsQuery.data.length > 0 && (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-foreground/70">
              <th className="py-2 pr-2 font-medium">Version</th>
              <th className="py-2 pr-2 font-medium">Size</th>
              <th className="py-2 pr-2 font-medium">Comment</th>
              <th className="py-2 pr-2 font-medium">Date</th>
              <th className="py-2 font-medium" />
            </tr>
          </thead>
          <tbody>
            {versionsQuery.data.map((version, index) => (
              <tr key={version.id} className="border-b last:border-0">
                <td className="py-2 pr-2 font-medium">
                  {version.versionMajor}.{version.versionMinor}
                  {index === 0 && (
                    <Badge variant="outline" className="ml-1.5">Current</Badge>
                  )}
                </td>
                <td className="py-2 pr-2 text-muted-foreground">{formatBytes(version.sizeBytes)}</td>
                <td className="py-2 pr-2 text-muted-foreground">{version.comment ?? "—"}</td>
                <td className="py-2 pr-2 text-muted-foreground">{formatDate(version.createdAt)}</td>
                <td className="py-2 text-right">
                  {index > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => restore.mutate(version.id)}
                      disabled={restore.isPending}
                    >
                      <RotateCcw className="size-4" />
                      Restore
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function PermissionsTab({ documentId }: { documentId: string }) {
  const queryClient = useQueryClient();
  const [showGrant, setShowGrant] = useState(false);

  const permissions = useQuery({
    queryKey: queryKeys.permissions.forObject("Document", documentId),
    queryFn: () => getPermissions("Document", documentId),
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.permissions.forObject("Document", documentId) });

  const revoke = useMutation({
    mutationFn: ({ principalType, principalId }: { principalType: PrincipalType; principalId: string }) =>
      revokePermission("Document", documentId, principalType, principalId),
    onSuccess: () => {
      toast.success("Permission revoked");
      invalidate();
    },
    onError: () => toast.error("Failed to revoke permission"),
  });

  const reset = useMutation({
    mutationFn: () => resetPermissions("Document", documentId),
    onSuccess: () => {
      setShowGrant(false);
      toast.success("Reset to inherited permissions");
      invalidate();
    },
    onError: () => toast.error("Failed to reset permissions"),
  });

  if (permissions.isLoading) {
    return <div className="text-sm text-muted-foreground">Loading…</div>;
  }

  if (permissions.isError) {
    return <div className="text-sm text-destructive">Failed to load permissions.</div>;
  }

  const data = permissions.data as PermissionsStateDto;

  return (
    <div className="flex flex-col gap-3">
      {data.hasUniqueAcl ? (
        <Alert>
          <ShieldCheck className="size-4" />
          <AlertTitle>Unique permissions</AlertTitle>
          <AlertDescription>
            This document has unique permissions. Changes here no longer follow the library.
          </AlertDescription>
        </Alert>
      ) : (
        <Alert>
          <ShieldCheck className="size-4" />
          <AlertTitle>Inherited permissions</AlertTitle>
          <AlertDescription>
            This document inherits permissions from its library. Stop inheriting to set unique access.
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-2">
        {data.entries.length === 0 && (
          <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
            No permissions granted.
          </div>
        )}
        {data.entries.map((entry) => (
          <div
            key={`${entry.principalType}-${entry.principalId}`}
            className="flex items-center gap-3 rounded-lg border p-2"
          >
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted">
              {entry.principalType === "User" ? <UserPlus className="size-4" /> : <Users className="size-4" />}
            </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{entry.principalName}</div>
                <div className="text-xs text-foreground/70">{entry.principalType}</div>
              </div>
            <Badge variant="secondary">{levelLabel(entry.level)}</Badge>
            <Badge variant="outline">{entry.source}</Badge>
            {data.hasUniqueAcl && (
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Revoke ${entry.principalName}`}
                onClick={() => revoke.mutate(entry)}
                disabled={revoke.isPending}
              >
                <X className="size-4" />
              </Button>
            )}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {!showGrant && !data.hasUniqueAcl && (
          <Button variant="outline" size="sm" onClick={() => setShowGrant(true)}>
            <ShieldCheck className="size-4" />
            Stop inheriting permissions
          </Button>
        )}
        {!showGrant && data.hasUniqueAcl && (
          <>
            <Button variant="outline" size="sm" onClick={() => setShowGrant(true)}>
              <UserPlus className="size-4" />
              Grant access
            </Button>
            <Button variant="ghost" size="sm" onClick={() => reset.mutate()} disabled={reset.isPending}>
              <Undo2 className="size-4" />
              Reset to inherited
            </Button>
          </>
        )}
        {showGrant && (
          <GrantPermissionForm
            objectId={documentId}
            onDone={() => setShowGrant(false)}
            onCancel={() => setShowGrant(false)}
          />
        )}
      </div>
    </div>
  );
}

function GrantPermissionForm({
  objectId,
  onDone,
  onCancel,
}: {
  objectId: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const queryClient = useQueryClient();
  const [principalType, setPrincipalType] = useState<PrincipalType>("User");
  const [principalId, setPrincipalId] = useState("");
  const [level, setLevel] = useState<PermissionLevel>("Read");

  const grant = useMutation({
    mutationFn: () =>
      grantPermission("Document", objectId, {
        principalType,
        principalId: principalId.trim(),
        level,
      }),
    onSuccess: () => {
      toast.success("Permission granted");
      queryClient.invalidateQueries({ queryKey: queryKeys.permissions.forObject("Document", objectId) });
      onDone();
    },
    onError: () => toast.error("Failed to grant permission"),
  });

  return (
    <form
      className="flex w-full flex-wrap items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (principalId.trim() !== "") {
          grant.mutate();
        }
      }}
    >
      <Select value={principalType} onValueChange={(value) => setPrincipalType(value as PrincipalType)}>
        <SelectTrigger aria-label="Principal type" className="w-28">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="User">User</SelectItem>
          <SelectItem value="Group">Group</SelectItem>
        </SelectContent>
      </Select>
      <Input
        value={principalId}
        onChange={(event) => setPrincipalId(event.target.value)}
        placeholder="Principal ID"
        aria-label="Principal ID"
        className="min-w-40 flex-1"
      />
      <Select value={level} onValueChange={(value) => setLevel(value as PermissionLevel)}>
        <SelectTrigger aria-label="Permission level" className="w-36">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="Read">Read</SelectItem>
          <SelectItem value="Contribute">Contribute</SelectItem>
          <SelectItem value="FullControl">Full Control</SelectItem>
        </SelectContent>
      </Select>
      <Button type="submit" size="sm" disabled={grant.isPending || principalId.trim() === ""}>
        {grant.isPending && <LoaderCircle className="size-4 animate-spin" />}
        Grant
      </Button>
      <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
        Cancel
      </Button>
    </form>
  );
}

function levelLabel(level: PermissionLevel): string {
  switch (level) {
    case "FullControl":
      return "Full Control";
    case "Contribute":
      return "Contribute";
    case "NoAccess":
      return "No Access";
    default:
      return "Read";
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString();
}
