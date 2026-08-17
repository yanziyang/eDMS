import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Folder, LoaderCircle, ShieldCheck, Undo2, UserPlus, Users, X } from "lucide-react";
import { toast } from "sonner";
import { Link, useParams } from "react-router-dom";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { listUsers } from "@/features/admin/api";
import { listLibraries } from "@/features/documents/api";
import { FavoriteToggle } from "@/features/favorites/components/FavoriteToggle";
import { listGroups } from "@/features/groups/api";
import {
  getPermissions,
  grantPermission,
  resetPermissions,
  revokePermission,
} from "@/features/permissions/api";
import { getSite, listSites } from "@/features/sites/api";
import { queryKeys } from "@/lib/queryKeys";
import type { PermissionLevel, PermissionsStateDto, PrincipalType } from "@/types/api";

export function SiteHome() {
  const { siteSlug } = useParams();
  const [accessOpen, setAccessOpen] = useState(false);

  const sites = useQuery({
    queryKey: queryKeys.sites.list(),
    queryFn: listSites,
  });

  const siteFromList = sites.data?.find((site) => site.urlSlug === siteSlug);

  const site = useQuery({
    queryKey: queryKeys.sites.detail(siteFromList?.id ?? "unknown"),
    queryFn: () => getSite(siteFromList!.id),
    enabled: siteFromList !== undefined,
  });

  const libraries = useQuery({
    queryKey: queryKeys.libraries.list(siteFromList?.id ?? "unknown"),
    queryFn: () => listLibraries(siteFromList!.id),
    enabled: siteFromList !== undefined,
  });

  const groups = useQuery({
    queryKey: queryKeys.groups.list(siteFromList?.id),
    queryFn: () => listGroups(siteFromList!.id),
    enabled: siteFromList !== undefined,
  });

  if (sites.isLoading) {
    return <div className="text-sm text-muted-foreground">Loading…</div>;
  }

  if (!siteFromList) {
    return <div className="text-sm text-muted-foreground">Site not found.</div>;
  }

  const displaySite = site.data ?? siteFromList;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{displaySite.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {displaySite.description || "No description"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <FavoriteToggle objectType="Site" objectId={displaySite.id} itemName={displaySite.name} />
          <Button variant="outline" size="sm" onClick={() => setAccessOpen(true)}>
            <ShieldCheck className="size-4" />
            Manage access
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold">Libraries</h2>
          <div className="flex flex-col gap-2">
            {libraries.isLoading && (
              <div className="text-sm text-muted-foreground">Loading…</div>
            )}
            {libraries.isError && (
              <div className="text-sm text-destructive">Failed to load libraries.</div>
            )}
            {libraries.data && libraries.data.length === 0 && (
              <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                No libraries in this site yet.
              </div>
            )}
            {libraries.data?.map((library) => (
              <Link
                key={library.id}
                to={`/sites/${displaySite.urlSlug}/libraries/${library.id}`}
                className="flex items-center gap-2 rounded-lg border bg-card p-5 font-medium hover:bg-muted/50"
              >
                <Folder className="size-4 text-primary" />
                {library.name}
              </Link>
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold">Permission groups</h2>
          <div className="flex flex-col gap-2">
            {groups.isLoading && <div className="text-sm text-muted-foreground">Loading…</div>}
            {groups.isError && (
              <div className="text-sm text-destructive">Failed to load groups.</div>
            )}
            {groups.data && groups.data.length === 0 && (
              <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                No groups in this site yet.
              </div>
            )}
            {groups.data?.map((group) => (
              <div
                key={group.id}
                className="flex items-center justify-between rounded-lg border bg-card px-4 py-3"
              >
                <div className="flex items-center gap-2 text-sm">
                  <Users className="size-4 text-muted-foreground" />
                  {group.name}
                </div>
                <span className="text-xs text-muted-foreground">
                  {group.memberIds.length} members
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <SiteAccessDialog
        siteId={displaySite.id}
        siteName={displaySite.name}
        open={accessOpen}
        onOpenChange={setAccessOpen}
      />
    </div>
  );
}

interface SiteAccessDialogProps {
  siteId: string;
  siteName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function SiteAccessDialog({ siteId, siteName, open, onOpenChange }: SiteAccessDialogProps) {
  const queryClient = useQueryClient();
  const [showGrant, setShowGrant] = useState(false);

  const permissions = useQuery({
    queryKey: queryKeys.permissions.forObject("Site", siteId),
    queryFn: () => getPermissions("Site", siteId),
    enabled: open,
  });

  const users = useQuery({
    queryKey: queryKeys.admin.users(),
    queryFn: () => listUsers(),
    enabled: open,
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.permissions.forObject("Site", siteId) });

  const revoke = useMutation({
    mutationFn: ({ principalType, principalId }: { principalType: PrincipalType; principalId: string }) =>
      revokePermission("Site", siteId, principalType, principalId),
    onSuccess: () => {
      toast.success("Permission revoked");
      invalidate();
    },
    onError: () => toast.error("Failed to revoke permission"),
  });

  const reset = useMutation({
    mutationFn: () => resetPermissions("Site", siteId),
    onSuccess: () => {
      setShowGrant(false);
      toast.success("Reset to inherited permissions");
      invalidate();
    },
    onError: () => toast.error("Failed to reset permissions"),
  });

  const grant = useMutation({
    mutationFn: ({ principalId, level }: { principalId: string; level: PermissionLevel }) =>
      grantPermission("Site", siteId, { principalType: "User", principalId, level }),
    onSuccess: () => {
      setShowGrant(false);
      toast.success("Permission granted");
      invalidate();
    },
    onError: () => toast.error("Failed to grant permission"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Manage access &mdash; {siteName}</DialogTitle>
          <DialogDescription>
            These permissions control access to every library in this site unless a folder or
            document breaks inheritance.
          </DialogDescription>
        </DialogHeader>

        {permissions.isLoading && (
          <div className="text-sm text-muted-foreground">Loading…</div>
        )}
        {permissions.isError && (
          <div className="text-sm text-destructive">Failed to load permissions.</div>
        )}
        {permissions.data && (
          <PermissionsBody
            data={permissions.data}
            revokePending={revoke.isPending}
            resetPending={reset.isPending}
            onRevoke={(entry) => revoke.mutate(entry)}
            onReset={() => reset.mutate()}
            showGrant={showGrant}
            onShowGrant={setShowGrant}
            usersLoading={users.isLoading}
            usersError={users.isError}
            users={users.data ?? []}
            grantPending={grant.isPending}
            onGrant={(principalId, level) => grant.mutate({ principalId, level })}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

interface PermissionsBodyProps {
  data: PermissionsStateDto;
  revokePending: boolean;
  resetPending: boolean;
  onRevoke: (entry: { principalType: PrincipalType; principalId: string }) => void;
  onReset: () => void;
  showGrant: boolean;
  onShowGrant: (show: boolean) => void;
  usersLoading: boolean;
  usersError: boolean;
  users: { id: string; displayName: string; email: string }[];
  grantPending: boolean;
  onGrant: (principalId: string, level: PermissionLevel) => void;
}

function PermissionsBody({
  data,
  revokePending,
  resetPending,
  onRevoke,
  onReset,
  showGrant,
  onShowGrant,
  usersLoading,
  usersError,
  users,
  grantPending,
  onGrant,
}: PermissionsBodyProps) {
  const [principalId, setPrincipalId] = useState("");
  const [level, setLevel] = useState<PermissionLevel>("Read");

  return (
    <div className="flex flex-col gap-3">
      {data.hasUniqueAcl ? (
        <Alert>
          <ShieldCheck className="size-4" />
          <AlertTitle>Unique permissions</AlertTitle>
          <AlertDescription>
            This site has unique permissions. Changes here no longer follow the organization
            defaults.
          </AlertDescription>
        </Alert>
      ) : (
        <Alert>
          <ShieldCheck className="size-4" />
          <AlertTitle>Inherited permissions</AlertTitle>
          <AlertDescription>
            This site inherits its permissions. Stop inheriting to set unique access.
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
              {entry.principalType === "User" ? (
                <UserPlus className="size-4" />
              ) : (
                <Users className="size-4" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{entry.principalName}</div>
              <div className="text-xs text-muted-foreground">{entry.principalType}</div>
            </div>
            <Badge variant="secondary">{levelLabel(entry.level)}</Badge>
            <Badge variant="outline">{entry.source}</Badge>
            {data.hasUniqueAcl && (
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Revoke ${entry.principalName}`}
                onClick={() => onRevoke(entry)}
                disabled={revokePending}
              >
                <X className="size-4" />
              </Button>
            )}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {!showGrant && !data.hasUniqueAcl && (
          <Button variant="outline" size="sm" onClick={() => onShowGrant(true)}>
            <ShieldCheck className="size-4" />
            Stop inheriting permissions
          </Button>
        )}
        {!showGrant && data.hasUniqueAcl && (
          <>
            <Button variant="outline" size="sm" onClick={() => onShowGrant(true)}>
              <UserPlus className="size-4" />
              Grant access
            </Button>
            <Button variant="ghost" size="sm" onClick={onReset} disabled={resetPending}>
              <Undo2 className="size-4" />
              Reset to inherited
            </Button>
          </>
        )}
        {showGrant && (
          <div className="flex w-full flex-wrap items-end gap-2">
            <div className="flex min-w-52 flex-1 flex-col gap-1.5">
              <Label htmlFor="grant-user">Person</Label>
              {usersLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
              {usersError && <p className="text-sm text-destructive">Failed to load users.</p>}
              {!usersLoading && !usersError && (
                <Select value={principalId} onValueChange={setPrincipalId}>
                  <SelectTrigger id="grant-user" className="w-full">
                    <SelectValue placeholder="Select a user" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.displayName} ({user.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="grant-level">Permission level</Label>
              <Select
                value={level}
                onValueChange={(value) => setLevel(value as PermissionLevel)}
              >
                <SelectTrigger id="grant-level" className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Read">Read</SelectItem>
                  <SelectItem value="Contribute">Contribute</SelectItem>
                  <SelectItem value="FullControl">Full Control</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              size="sm"
              disabled={grantPending || principalId === ""}
              onClick={() => onGrant(principalId, level)}
            >
              {grantPending && <LoaderCircle className="size-4 animate-spin" />}
              Grant
            </Button>
            <Button variant="ghost" size="sm" onClick={() => onShowGrant(false)}>
              Cancel
            </Button>
          </div>
        )}
      </div>
    </div>
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
