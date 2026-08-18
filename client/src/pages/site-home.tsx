import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, Building2, Folder, FolderPlus, HardDrive, LoaderCircle, Settings, ShieldCheck, Undo2, UserPlus, Users, X } from "lucide-react";
import { toast } from "sonner";
import { Link, useParams } from "react-router-dom";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { listUsers } from "@/features/admin/api";
import { createLibrary, listLibraries } from "@/features/documents/api";
import { FavoriteToggle } from "@/features/favorites/components/FavoriteToggle";
import { FollowToggle } from "@/features/notifications/components/FollowToggle";
import { listGroups } from "@/features/groups/api";
import {
  getPermissions,
  grantPermission,
  resetPermissions,
  revokePermission,
} from "@/features/permissions/api";
import { getSite, listSites, updateSite } from "@/features/sites/api";
import { queryKeys } from "@/lib/queryKeys";
import { Breadcrumbs, EmptyState, SectionHeader, Surface } from "@/components/app/page-frame";
import type { PermissionLevel, PermissionsStateDto, PrincipalType } from "@/types/api";

export function SiteHome() {
  const { siteSlug } = useParams();
  const [accessOpen, setAccessOpen] = useState(false);
  const [createLibraryOpen, setCreateLibraryOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

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
  const members = new Set((groups.data ?? []).flatMap((group) => group.memberIds)).size;
  const quotaPercent = displaySite.storageQuotaBytes
    ? Math.min(100, Math.round((displaySite.storageUsedBytes / displaySite.storageQuotaBytes) * 100))
    : null;

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumbs items={[{ label: "Home", to: "/" }, { label: displaySite.name }]} />

      <Surface>
        <div className="flex flex-wrap items-start gap-5 p-5 sm:p-6">
          <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
            <Building2 />
          </div>
          <div className="min-w-[220px] flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">{displaySite.name}</h1>
              <Badge variant="secondary">{members || "No"} total members</Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{displaySite.description || "No description"}</p>
            <div className="mt-4 flex max-w-sm items-center justify-between gap-3 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5"><HardDrive /> {formatBytes(displaySite.storageUsedBytes)} used</span>
              <span>{quotaPercent === null ? "Unlimited quota" : `${quotaPercent}% of ${formatBytes(displaySite.storageQuotaBytes!)}`}</span>
            </div>
            {quotaPercent !== null && (
              <div className="mt-2 h-2 max-w-sm overflow-hidden rounded-full bg-muted" role="progressbar" aria-label={`${displaySite.name} storage usage`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={quotaPercent}>
                <div className="h-full rounded-full bg-primary" style={{ width: `${quotaPercent}%` }} />
              </div>
            )}
            <p className="mt-2 text-xs text-muted-foreground">Uploads and new versions stop when this quota would be exceeded.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <FavoriteToggle objectType="Site" objectId={displaySite.id} itemName={displaySite.name} />
            <FollowToggle objectType="Site" objectId={displaySite.id} itemName={displaySite.name} />
            <Button variant="outline" size="sm" onClick={() => setAccessOpen(true)}>
              <ShieldCheck data-icon="inline-start" />
              Manage access
            </Button>
            <Button variant="outline" size="sm" onClick={() => setSettingsOpen(true)}>
              <Settings data-icon="inline-start" />
              Site settings
            </Button>
          </div>
        </div>
      </Surface>

      <section aria-labelledby="libraries-heading">
        <SectionHeader
          title="Document libraries"
          description="Libraries keep documents, version history, and metadata organized."
          className="mb-3"
          action={
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{libraries.data?.length ?? 0} libraries</Badge>
              <Button size="sm" onClick={() => setCreateLibraryOpen(true)}>
                <FolderPlus data-icon="inline-start" />
                New library
              </Button>
            </div>
          }
        />
        {libraries.isLoading && <div className="text-sm text-muted-foreground">Loading…</div>}
        {libraries.isError && <div className="text-sm text-destructive">Failed to load libraries.</div>}
        {libraries.data && libraries.data.length === 0 && (
          <EmptyState icon={<Folder />} title="No libraries in this site yet." description="A Site Owner can create a document library for this workspace." />
        )}
        {libraries.data && libraries.data.length > 0 && (
          <div className="grid gap-4 md:grid-cols-2">
            {libraries.data.map((library) => (
              <Link
                key={library.id}
                to={`/sites/${displaySite.urlSlug}/libraries/${library.id}`}
                aria-label={library.name}
                className="group rounded-xl border bg-card p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex size-11 items-center justify-center rounded-xl bg-amber-500/15 text-amber-700 dark:text-amber-300">
                    <Folder />
                  </div>
                  <ArrowUpRight className="text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </div>
                <div className="mt-4 font-semibold">{library.name}</div>
                <p className="mt-1 min-h-10 text-sm text-muted-foreground">{library.description || "Upload, organize, and manage documents with version history."}</p>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {library.enableVersioning && <Badge variant="secondary">Versioning</Badge>}
                  {library.requireCheckout && <Badge variant="outline">Check-out required</Badge>}
                  {library.enableMinorVersions && <Badge variant="outline">Minor versions</Badge>}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Surface>
          <div className="border-b px-5 py-4">
            <h2 className="font-semibold">Site activity</h2>
            <p className="mt-1 text-sm text-muted-foreground">Recent actions within this site.</p>
          </div>
          <div className="p-5">
            <EmptyState icon={<ArrowUpRight />} title="Activity is ready when your team starts working." description="Uploads, edits, and permission changes will be visible here as the site is used." className="min-h-36" />
          </div>
        </Surface>

        <Surface>
          <div className="flex items-start justify-between gap-3 border-b px-5 py-4">
            <div>
              <h2 className="font-semibold">Permission groups</h2>
              <p className="mt-1 text-sm text-muted-foreground">Default groups control access to this site.</p>
            </div>
            <Users className="text-muted-foreground" />
          </div>
          <div className="flex flex-col gap-2 p-4">
            {groups.isLoading && <div className="text-sm text-muted-foreground">Loading…</div>}
            {groups.isError && <div className="text-sm text-destructive">Failed to load groups.</div>}
            {groups.data && groups.data.length === 0 && (
              <EmptyState icon={<Users />} title="No groups in this site yet." className="min-h-32" />
            )}
            {groups.data?.map((group) => (
              <div key={group.id} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-3">
                <div className="flex min-w-0 items-center gap-2 text-sm">
                  <Users className="shrink-0 text-muted-foreground" />
                  <span className="truncate font-medium">{group.name}</span>
                </div>
                <Badge variant={group.isSystem ? "secondary" : "outline"}>{group.memberIds.length} members</Badge>
              </div>
            ))}
          </div>
          <div className="border-t p-4">
            <Button variant="outline" size="sm" className="w-full" onClick={() => setAccessOpen(true)}>
              <UserPlus data-icon="inline-start" />
              Manage members
            </Button>
          </div>
        </Surface>
      </div>

      <SiteAccessDialog
        siteId={displaySite.id}
        siteName={displaySite.name}
        open={accessOpen}
        onOpenChange={setAccessOpen}
      />
      <CreateLibraryDialog
        siteId={displaySite.id}
        siteName={displaySite.name}
        open={createLibraryOpen}
        onOpenChange={setCreateLibraryOpen}
      />
      <SiteSettingsDialog
        site={displaySite}
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
      />
    </div>
  );
}

interface CreateLibraryDialogProps {
  siteId: string;
  siteName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function CreateLibraryDialog({ siteId, siteName, open, onOpenChange }: CreateLibraryDialogProps) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [enableVersioning, setEnableVersioning] = useState(true);
  const [enableMinorVersions, setEnableMinorVersions] = useState(false);
  const [requireCheckout, setRequireCheckout] = useState(false);
  const [minorVersionsRetained, setMinorVersionsRetained] = useState("");

  useEffect(() => {
    if (open) {
      setName("");
      setDescription("");
      setEnableVersioning(true);
      setEnableMinorVersions(false);
      setRequireCheckout(false);
      setMinorVersionsRetained("");
    }
  }, [open]);

  const retentionInput = minorVersionsRetained.trim();
  const retention = retentionInput === "" ? null : Number(retentionInput);
  const invalidRetention = retention !== null && (!Number.isInteger(retention) || retention < 1);

  const create = useMutation({
    mutationFn: () =>
      createLibrary(siteId, {
        name: name.trim(),
        description: description.trim() || null,
        enableVersioning,
        enableMinorVersions,
        requireCheckout,
        minorVersionsRetained: retention,
      }),
    onSuccess: () => {
      toast.success("Library created");
      queryClient.invalidateQueries({ queryKey: queryKeys.libraries.list(siteId) });
      onOpenChange(false);
    },
    onError: () => toast.error("Failed to create library"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New library</DialogTitle>
          <DialogDescription>
            Create a document library in &quot;{siteName}&quot; and choose its versioning settings.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="create-library-name">Name</Label>
            <Input
              id="create-library-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoFocus
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="create-library-description">Description</Label>
            <Textarea
              id="create-library-description"
              rows={3}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="What belongs in this library?"
            />
          </div>
          <div className="flex flex-col gap-3 rounded-lg border p-3">
            <p className="text-sm font-medium">Library settings</p>
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
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="create-library-retention">Retained minor versions</Label>
              <Input
                id="create-library-retention"
                type="number"
                min={1}
                step={1}
                value={minorVersionsRetained}
                onChange={(event) => setMinorVersionsRetained(event.target.value)}
                placeholder="Blank for unlimited"
                aria-invalid={invalidRetention}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => create.mutate()}
            disabled={create.isPending || name.trim() === "" || invalidRetention}
          >
            {create.isPending && <LoaderCircle data-icon="inline-start" className="animate-spin" />}
            Create library
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SiteSettingsDialog({
  site,
  open,
  onOpenChange,
}: {
  site: { id: string; name: string; description: string | null; storageQuotaBytes: number | null };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(site.name);
  const [description, setDescription] = useState(site.description ?? "");
  const [quota, setQuota] = useState(site.storageQuotaBytes === null ? "" : String(site.storageQuotaBytes / (1024 * 1024 * 1024)));

  useEffect(() => {
    if (open) {
      setName(site.name);
      setDescription(site.description ?? "");
      setQuota(site.storageQuotaBytes === null ? "" : String(site.storageQuotaBytes / (1024 * 1024 * 1024)));
    }
  }, [open, site]);

  const save = useMutation({
    mutationFn: () => updateSite(site.id, {
      name: name.trim(),
      description: description.trim(),
      storageQuotaBytes: quota.trim() === "" ? null : Math.round(Number(quota) * 1024 * 1024 * 1024),
    }),
    onSuccess: () => {
      toast.success("Site settings saved");
      queryClient.invalidateQueries({ queryKey: queryKeys.sites.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.sites.detail(site.id) });
      onOpenChange(false);
    },
    onError: () => toast.error("Failed to save site settings"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Site settings</DialogTitle>
          <DialogDescription>Update the workspace description and storage quota.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="site-settings-name">Name</Label>
            <Input id="site-settings-name" value={name} onChange={(event) => setName(event.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="site-settings-description">Description</Label>
            <Textarea id="site-settings-description" rows={3} value={description} onChange={(event) => setDescription(event.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="site-settings-quota">Storage quota (GB)</Label>
            <Input id="site-settings-quota" type="number" min={0} step="0.1" placeholder="Blank for unlimited" value={quota} onChange={(event) => setQuota(event.target.value)} />
            <p className="text-xs text-muted-foreground">Leave blank to allow unlimited storage.</p>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending || name.trim() === ""}>
            {save.isPending && <LoaderCircle data-icon="inline-start" className="animate-spin" />}
            Save
          </Button>
        </div>
      </DialogContent>
    </Dialog>
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

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}
