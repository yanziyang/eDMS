import { useState } from "react";
import { Bell, ChevronRight, Folder, Settings, ShieldCheck, Star, UserPlus, Users } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SiteIcon } from "@/components/app/icon-map";
import { actionVerb, initialsOf } from "@/lib/helpers";
import { AUDIT_LOG, findSite, getLibraryContents } from "@/lib/mock-data";
import {
  db,
  isFavorite,
  isFollowing,
  libraryFavoriteEntry,
  siteFavoriteEntry,
  toggleFavorite,
  toggleFollow,
  useDb,
} from "@/lib/store";

export function SiteHome() {
  useDb();
  const { slug = "finance" } = useParams();
  const site = findSite(slug);
  const [permsOpen, setPermsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const siteActivity = AUDIT_LOG.filter((a) => a.site === site.name).slice(0, 8);
  const activity = siteActivity.length ? siteActivity : AUDIT_LOG.slice(0, 5);
  const storagePct = Math.min(100, (site.storageUsedGB / site.storageQuotaGB) * 100);
  const siteEntry = siteFavoriteEntry(site);
  const following = isFollowing("site", site.slug);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-1 text-[13px] text-muted-foreground">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/home" className="hover:text-foreground">Home</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage className="font-medium text-foreground">{site.name}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      <Card className="mb-6">
        <CardContent className="flex flex-wrap items-start gap-[1.1rem] p-5">
          <div
            className="flex size-14 shrink-0 items-center justify-center rounded-[10px] text-white"
            style={{ background: site.color }}
          >
            <SiteIcon icon={site.icon} className="size-6" />
          </div>
          <div className="min-w-[220px] flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold">{site.name}</h1>
              <span className="inline-flex h-5 items-center rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-secondary-foreground">
                {site.members} members
              </span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{site.description}</p>
            <div className="mt-3 max-w-[320px] text-xs text-muted-foreground">
              {site.storageUsedGB.toFixed(1)} GB of {site.storageQuotaGB} GB used
            </div>
            <div className="mt-1 h-[7px] max-w-[320px] overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary" style={{ width: storagePct + "%" }} />
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button
              variant={following ? "secondary" : "outline"}
              size="sm"
              onClick={() => toggleFollow("site", site.slug)}
            >
              <Bell data-icon="inline-start" />
              {following ? "Following" : "Follow"}
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              className={isFavorite(siteEntry.key) ? "text-amber-500 hover:text-amber-600" : undefined}
              aria-label={isFavorite(siteEntry.key) ? "Remove site from favorites" : "Add site to favorites"}
              onClick={() => toggleFavorite(siteEntry)}
            >
              <Star className={isFavorite(siteEntry.key) ? "fill-current" : undefined} />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPermsOpen(true)}>
              <ShieldCheck data-icon="inline-start" />
              Manage access
            </Button>
            <Button variant="outline" size="sm" onClick={() => setSettingsOpen(true)}>
              <Settings data-icon="inline-start" />
              Site settings
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Document libraries</h2>
      </div>
      <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2">
        {site.libraries.map((l) => {
          const data = getLibraryContents(site.slug, l.id, "root");
          return (
            <div
              key={l.id}
              className="flex items-center gap-3.5 rounded-[var(--radius)] border bg-card p-[1.1rem] hover:bg-muted/40"
            >
              <Link to={`/sites/${site.slug}/${l.id}/root`} className="flex min-w-0 flex-1 items-center gap-3.5">
                <div className="file-ico folder size-11">
                  <Folder className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">{l.name}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{data.items.length} items</div>
                </div>
                <ChevronRight className="size-4 text-muted-foreground" />
              </Link>
              <Button
                variant="ghost"
                size="icon-sm"
                className={isFavorite(libraryFavoriteEntry(site, l).key) ? "text-amber-500 hover:text-amber-600" : undefined}
                aria-label={isFavorite(libraryFavoriteEntry(site, l).key) ? `Remove ${l.name} from favorites` : `Add ${l.name} to favorites`}
                onClick={() => toggleFavorite(libraryFavoriteEntry(site, l))}
              >
                <Star className={isFavorite(libraryFavoriteEntry(site, l).key) ? "fill-current" : undefined} />
              </Button>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Site activity</CardTitle>
              <CardDescription>Recent actions within this site</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {activity.map((a, i) => (
              <div key={i} className="flex items-center gap-3 border-b py-2 last:border-b-0">
                <span className="flex size-[26px] shrink-0 items-center justify-center rounded-full bg-primary/15 text-[10.5px] font-semibold text-primary">
                  {initialsOf(a.user)}
                </span>
                <div className="min-w-0 flex-1 text-sm">
                  <span className="font-medium">{a.user}</span>{" "}
                  <span className="text-muted-foreground">{actionVerb(a.action)}</span>{" "}
                  {a.object !== "—" && <span className="font-medium">{a.object}</span>}
                </div>
                <div className="shrink-0 text-xs text-muted-foreground">{a.time.split(" ")[0].slice(5)}</div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Permission groups</CardTitle>
          </CardHeader>
          <CardContent className="py-2">
            {["Owners", "Members", "Visitors"].map((role, i) => {
              const count = [2, Math.max(2, site.members - 4), 2][i];
              return (
                <div key={role} className="flex items-center justify-between border-b py-2 last:border-b-0">
                  <div className="flex items-center gap-2 text-sm">
                    <Users className="size-3.5 text-muted-foreground" />
                    <span className="font-medium">
                      {site.name} {role}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">{count} members</span>
                </div>
              );
            })}
          </CardContent>
          <div className="flex justify-end gap-2.5 border-t px-5 py-4">
            <Button variant="outline" size="sm" className="w-full" onClick={() => setPermsOpen(true)}>
              <UserPlus data-icon="inline-start" />
              Manage members
            </Button>
          </div>
        </Card>
      </div>

      <SitePermissionsDialog key={site.slug} open={permsOpen} onOpenChange={setPermsOpen} siteName={site.name} />
      <SiteSettingsDialog
        key={site.slug}
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        site={site}
      />
    </div>
  );
}

export function SitePermissionsDialog({
  open,
  onOpenChange,
  siteName,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  siteName: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[640px]">
        <DialogHeader>
          <DialogTitle>Manage access</DialogTitle>
          <DialogDescription>
            Default groups control access to every library in {siteName} unless a folder or document
            breaks inheritance.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          {(
            [
              ["Site Owners", "Full Control — manage site, libraries, and permissions", "2 members", "bg-warning-soft text-warning"],
              ["Site Members", "Contribute — upload, edit, and delete content", "8 members", "bg-secondary text-secondary-foreground"],
              ["Site Visitors", "Read — view and download only", "6 members", "bg-secondary text-secondary-foreground"],
            ] as const
          ).map(([name, desc, count, cls]) => (
            <div key={name} className="flex items-center gap-3 rounded-[var(--radius)] border p-3">
              <span className="flex size-[26px] items-center justify-center rounded-full bg-primary/15 text-primary">
                <Users className="size-3.5" />
              </span>
              <div className="flex-1">
                <div className="text-sm font-medium">{name}</div>
                <div className="text-xs text-muted-foreground">{desc}</div>
              </div>
              <span className={cnBadge(cls)}>{count}</span>
            </div>
          ))}
        </div>
        <div className="mt-4">
          <Label className="text-[13px]">Add people or groups</Label>
          <Input className="mt-1.5" placeholder="Search by name or email…" />
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button
            onClick={() => {
              onOpenChange(false);
              toast.success("Site permissions updated");
            }}
          >
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function cnBadge(cls: string) {
  return `inline-flex h-5 items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${cls}`;
}

export function SiteSettingsDialog({
  open,
  onOpenChange,
  site,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  site: (typeof db.sites)[number];
}) {
  const [name, setName] = useState(site.name);
  const [desc, setDesc] = useState(site.description);
  const [quota, setQuota] = useState(String(site.storageQuotaGB));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Site settings</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onOpenChange(false);
            toast.success("Site settings saved");
          }}
        >
          <div className="flex flex-col gap-4">
            <div>
              <Label className="text-[13px]">Site name</Label>
              <Input className="mt-1.5" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <Label className="text-[13px]">Description</Label>
              <Textarea className="mt-1.5" rows={3} value={desc} onChange={(e) => setDesc(e.target.value)} />
            </div>
            <div>
              <Label className="text-[13px]">Storage quota (GB)</Label>
              <Input className="mt-1.5" type="number" value={quota} onChange={(e) => setQuota(e.target.value)} />
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">Save</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
