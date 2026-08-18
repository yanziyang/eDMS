import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, Folder, Info, LoaderCircle, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useParams } from "react-router-dom";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ItemContextMenu } from "@/components/common/ItemContextMenu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  listRecycleBin,
  permanentlyDeleteRecycleBinItem,
  restoreRecycleBinItem,
} from "@/features/recycle-bin/api";
import { listSites } from "@/features/sites/api";
import { queryKeys } from "@/lib/queryKeys";
import type { RecycleBinItemDto } from "@/types/api";

export function RecycleBin() {
  const { siteSlug } = useParams();
  const queryClient = useQueryClient();
  const [pickedSiteId, setPickedSiteId] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<RecycleBinItemDto | null>(null);

  const sites = useQuery({
    queryKey: queryKeys.sites.list(),
    queryFn: listSites,
  });

  const siteFromSlug = siteSlug
    ? sites.data?.find((site) => site.urlSlug === siteSlug)
    : undefined;

  const siteId = siteSlug ? siteFromSlug?.id : pickedSiteId || undefined;

  const items = useQuery({
    queryKey: queryKeys.recycleBin.list(siteId ?? "none"),
    queryFn: () => listRecycleBin(siteId!),
    enabled: siteId !== undefined,
  });

  const invalidate = () => {
    if (siteId) {
      queryClient.invalidateQueries({ queryKey: queryKeys.recycleBin.list(siteId) });
    }
  };

  const restore = useMutation({
    mutationFn: (item: RecycleBinItemDto) =>
      restoreRecycleBinItem(item.id, item.kind === "document" ? "Document" : "Folder"),
    onSuccess: () => {
      toast.success("Item restored");
      invalidate();
    },
    onError: () => toast.error("Failed to restore item"),
  });

  const purge = useMutation({
    mutationFn: (item: RecycleBinItemDto) =>
      permanentlyDeleteRecycleBinItem(item.id, item.kind === "document" ? "Document" : "Folder"),
    onSuccess: () => {
      toast.success("Item permanently deleted");
      setConfirmDelete(null);
      invalidate();
    },
    onError: () => toast.error("Failed to delete item"),
  });

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Recycle Bin</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {items.data ? `${items.data.length} items · ` : ""}deleted items are kept for 90 days
            before being permanently purged.
          </p>
        </div>
        {!siteSlug && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="recycle-site">Site</Label>
            {sites.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
            {sites.isError && <p className="text-sm text-destructive">Failed to load sites.</p>}
            {sites.data && (
              <Select value={pickedSiteId} onValueChange={setPickedSiteId}>
                <SelectTrigger id="recycle-site" className="w-64">
                  <SelectValue placeholder="Select a site" />
                </SelectTrigger>
                <SelectContent>
                  {sites.data.map((site) => (
                    <SelectItem key={site.id} value={site.id}>
                      {site.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        )}
      </div>

      <Alert className="mb-4">
        <Info className="size-4" />
        <AlertTitle>About the recycle bin</AlertTitle>
        <AlertDescription>
          As a Site Owner or System Administrator, you can see items deleted by everyone across
          every site. Regular members only see their own deleted items here.
        </AlertDescription>
      </Alert>

      {siteSlug && sites.isLoading && (
        <div className="text-sm text-muted-foreground">Loading…</div>
      )}
      {siteSlug && sites.isError && (
        <div className="text-sm text-destructive">Failed to load sites.</div>
      )}
      {siteSlug && sites.data && !siteFromSlug && (
        <div className="text-sm text-muted-foreground">Site not found.</div>
      )}
      {!siteSlug && sites.data && sites.data.length === 0 && (
        <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
          You do not have access to any sites yet.
        </div>
      )}
      {!siteSlug && sites.data && sites.data.length > 0 && pickedSiteId === "" && (
        <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
          Select a site to see its recycle bin.
        </div>
      )}

      {siteId !== undefined && items.isLoading && (
        <div className="text-sm text-muted-foreground">Loading…</div>
      )}
      {siteId !== undefined && items.isError && (
        <div className="text-sm text-destructive">Failed to load recycle bin.</div>
      )}
      {items.data && items.data.length === 0 && (
        <div className="rounded-lg border border-dashed p-10 text-center">
          <Trash2 className="mx-auto size-10 text-muted-foreground" />
          <h2 className="mt-3 font-medium">Recycle Bin is empty</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Items you delete from any library will appear here for 90 days.
          </p>
        </div>
      )}

      {items.data && items.data.length > 0 && (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-left">
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Type</th>
                <th className="px-4 py-2 font-medium">Deleted by</th>
                <th className="px-4 py-2 font-medium">Deleted</th>
                <th className="px-4 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.data.map((item) => (
                <ItemContextMenu
                  key={item.id}
                  item={recycleContextItem(item)}
                  permissionLevel="Contribute"
                  actions={["restore", "permanently-delete"]}
                  onAction={(action) => {
                    if (action === "restore") {
                      restore.mutate(item);
                    } else if (action === "permanently-delete") {
                      setConfirmDelete(item);
                    }
                  }}
                >
                <tr className="border-b last:border-0">
                  <td className="px-4 py-2">
                    <span className="flex items-center gap-2 font-medium">
                      {item.kind === "folder" ? (
                        <Folder className="size-4 text-amber-500" />
                      ) : (
                        <FileText className="size-4 text-blue-500" />
                      )}
                      {item.name}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <Badge variant={item.kind === "folder" ? "secondary" : "outline"}>
                      {item.kind}
                    </Badge>
                  </td>
                  <td
                    className="px-4 py-2 text-muted-foreground"
                    title={item.deletedBy ? `User ID: ${item.deletedBy}` : undefined}
                  >
                    {item.deletedByDisplayName ?? item.deletedBy ?? "Unknown user"}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {new Date(item.deletedAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => restore.mutate(item)}
                        disabled={restore.isPending}
                      >
                        <RotateCcw className="size-4" />
                        Restore
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Permanently delete ${item.name}`}
                        onClick={() => setConfirmDelete(item)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
                </ItemContextMenu>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog
        open={confirmDelete !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmDelete(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Permanently delete</DialogTitle>
            <DialogDescription>
              {confirmDelete
                ? `"${confirmDelete.name}" will be permanently deleted and cannot be recovered.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={purge.isPending}
              onClick={() => {
                if (confirmDelete) purge.mutate(confirmDelete);
              }}
            >
              {purge.isPending && <LoaderCircle className="size-4 animate-spin" />}
              Delete forever
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function recycleContextItem(item: RecycleBinItemDto) {
  return {
    kind: item.kind,
    id: item.id,
    name: item.name,
    sizeBytes: 0,
    modifiedAt: item.deletedAt,
    folderId: item.kind === "folder" ? item.id : null,
    documentId: item.kind === "document" ? item.id : null,
    checkedOutBy: null,
  } as const;
}
