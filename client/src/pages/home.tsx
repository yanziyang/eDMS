import { useQuery } from "@tanstack/react-query";
import {
  ArrowUpRight,
  Bell,
  Building2,
  Database,
  FileText,
  Folder,
  HardDrive,
  Upload,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Surface, EmptyState, PageHeader, SectionHeader } from "@/components/app/page-frame";
import { listNotifications } from "@/features/notifications/api";
import { listRecent } from "@/features/recent/api";
import { listSites } from "@/features/sites/api";
import { queryKeys } from "@/lib/queryKeys";
import type { NotificationDto, RecentDocumentDto, SiteDto } from "@/types/api";

export function Home() {
  const sitesQuery = useQuery({
    queryKey: queryKeys.sites.list(),
    queryFn: listSites,
  });
  const recent = useQuery({
    queryKey: queryKeys.me.recent(),
    queryFn: listRecent,
  });
  const notifications = useQuery({
    queryKey: queryKeys.notifications.list(),
    queryFn: () => listNotifications(),
  });

  if (sitesQuery.isLoading) {
    return <div className="text-sm text-muted-foreground">Loading.</div>;
  }

  const sites = sitesQuery.data ?? [];
  const recentItems = recent.data ?? [];
  const unreadNotifications = (notifications.data ?? []).filter((entry) => !entry.isRead).length;
  const totalUsed = sites.reduce((sum, site) => sum + site.storageUsedBytes, 0);
  const totalQuota = sites.reduce(
    (sum, site) => sum + (site.storageQuotaBytes ?? 0),
    0,
  );

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Welcome back"
        description="Here’s what’s happening across your organization today."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={<Building2 />} label="Sites you access" value={String(sites.length)} detail="Across your organization" />
        <StatCard
          icon={<Database />}
          label="Storage used"
          value={formatBytes(totalUsed)}
          detail={totalQuota > 0 ? `of ${formatBytes(totalQuota)} provisioned` : "Across accessible sites"}
        />
        <StatCard icon={<FileText />} label="Recent documents" value={String(recentItems.length)} detail="Documents you touched recently" />
        <StatCard icon={<Bell />} label="Notifications" value={String(unreadNotifications)} detail="Unread items" />
      </div>

      <section aria-labelledby="sites-heading">
        <SectionHeader
          title="Your sites"
          description="Workspace cards are sorted by the sites you can access."
          className="mb-3"
          action={<span className="text-xs text-muted-foreground">{sites.length} available</span>}
        />
        {sites.length === 0 ? (
          <EmptyState
            icon={<Building2 />}
            title="You do not have access to any sites yet."
            description="A Site Owner or System Administrator can grant you access to a workspace."
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {sites.map((site) => (
              <SiteCard key={site.id} site={site} />
            ))}
          </div>
        )}
      </section>

      <Surface>
        <div className="flex flex-wrap items-start justify-between gap-3 border-b px-5 py-4">
          <div>
            <h2 className="font-semibold">Recent</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Documents you recently viewed, uploaded, or modified across all accessible Sites.
            </p>
          </div>
          <Badge variant="secondary">Personal view</Badge>
        </div>
        <div className="p-4 sm:p-5">
          <RecentSection recent={recentItems} isLoading={recent.isLoading} isError={recent.isError} compact />
        </div>
      </Surface>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Surface>
          <div className="flex flex-wrap items-start justify-between gap-3 border-b px-5 py-4">
            <div>
              <h2 className="font-semibold">Recent activity</h2>
              <p className="mt-1 text-sm text-muted-foreground">Latest notifications across the workspace.</p>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link to="/search">Open search <ArrowUpRight data-icon="inline-end" /></Link>
            </Button>
          </div>
          <div className="flex flex-col gap-2 p-4 sm:p-5">
            {notifications.isLoading && <p className="text-sm text-muted-foreground">Loading activity…</p>}
            {notifications.isError && <p className="text-sm text-destructive">Failed to load activity.</p>}
            {!notifications.isLoading && !notifications.isError && (notifications.data ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">No recent activity yet.</p>
            )}
            {(notifications.data ?? []).slice(0, 5).map((entry) => (
              <ActivityRow key={entry.id} entry={entry} />
            ))}
          </div>
        </Surface>

        <Surface>
          <div className="border-b px-5 py-4">
            <h2 className="font-semibold">Quick access</h2>
            <p className="mt-1 text-sm text-muted-foreground">Files you open often.</p>
          </div>
          <div className="flex flex-col gap-1 p-3">
            {recentItems.slice(0, 4).map((document) => (
              <Link
                key={document.documentId}
                to={`/sites/${document.siteSlug}/libraries/${document.libraryId}?documentId=${encodeURIComponent(document.documentId)}`}
                aria-label={`Open again: ${document.name}`}
                className="flex items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-muted/60"
              >
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <FileText />
                </div>
                <span aria-hidden="true" className="min-w-0 flex-1 truncate text-sm font-medium">Open {document.name}</span>
                <ArrowUpRight className="shrink-0 text-muted-foreground" />
              </Link>
            ))}
            {recentItems.length === 0 && (
              <div className="flex flex-col items-center gap-2 px-3 py-8 text-center text-sm text-muted-foreground">
                <Upload />
                Open or upload a document to build your quick access list.
              </div>
            )}
          </div>
        </Surface>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  detail,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <Surface className="p-4">
      <div className="flex items-center justify-between gap-2 text-xs font-medium text-muted-foreground">
        <span>{label}</span>
        <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">{icon}</span>
      </div>
      <div className="mt-4 text-2xl font-semibold tracking-tight">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{detail}</div>
    </Surface>
  );
}

function SiteCard({ site }: { site: SiteDto }) {
  const quotaPercent = site.storageQuotaBytes
    ? Math.min(100, Math.round((site.storageUsedBytes / site.storageQuotaBytes) * 100))
    : null;

  return (
    <Link
      to={`/sites/${site.urlSlug}`}
      className="group rounded-xl border bg-card p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
          <Folder />
        </div>
        <ArrowUpRight className="text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
      </div>
      <div className="mt-4 font-semibold">{site.name}</div>
      <div className="mt-1 min-h-10 text-sm text-muted-foreground">
        {site.description || "No description"}
      </div>
      <div className="mt-4 border-t pt-3 text-xs text-muted-foreground">
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5"><HardDrive /> {formatBytes(site.storageUsedBytes)} used</span>
          <span>{quotaPercent === null ? "Unlimited" : `${quotaPercent}% used`}</span>
        </div>
        {quotaPercent !== null && (
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label={`${site.name} storage usage`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={quotaPercent}>
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${quotaPercent}%` }} />
          </div>
        )}
      </div>
    </Link>
  );
}

function RecentSection({
  recent,
  isLoading,
  isError,
  compact = false,
}: {
  recent: RecentDocumentDto[];
  isLoading: boolean;
  isError: boolean;
  compact?: boolean;
}) {
  if (isLoading) return <div className="text-sm text-muted-foreground">Loading recent documents…</div>;
  if (isError) return <div className="text-sm text-destructive">Failed to load recent documents.</div>;
  if (recent.length === 0) {
    return <EmptyState icon={<FileText />} title="No recent documents yet." description="Your recently viewed, uploaded, or modified documents will appear here." className={compact ? "min-h-36" : undefined} />;
  }

  return (
    <div className="grid gap-2 md:grid-cols-2">
      {recent.map((document) => <RecentRow key={document.documentId} document={document} />)}
    </div>
  );
}

function RecentRow({ document }: { document: RecentDocumentDto }) {
  const location = document.folderPath && document.folderPath !== "/"
    ? `${document.siteName} / ${document.libraryName} / ${document.folderPath.trim().replace(/^\/+|\/+$/g, "")}`
    : `${document.siteName} / ${document.libraryName}`;

  return (
    <Link
      to={`/sites/${document.siteSlug}/libraries/${document.libraryId}?documentId=${encodeURIComponent(document.documentId)}`}
      className="flex min-w-0 items-center gap-3 rounded-lg border px-3 py-3 transition-colors hover:bg-muted/50"
    >
      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <FileText />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{document.name}</div>
        <div className="truncate text-xs text-muted-foreground">{location}</div>
      </div>
      <time dateTime={document.lastTouchedAt} className="hidden shrink-0 text-xs text-muted-foreground lg:block">
        {formatRecentTime(document.lastTouchedAt)}
      </time>
    </Link>
  );
}

function ActivityRow({ entry }: { entry: NotificationDto }) {
  return (
    <div className="flex items-start gap-3 rounded-lg px-2 py-2 hover:bg-muted/50">
      <span className={entry.isRead ? "mt-2 size-1.5 shrink-0 rounded-full bg-muted-foreground/40" : "mt-2 size-1.5 shrink-0 rounded-full bg-primary"} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm">{entry.message}</div>
        <div className="truncate text-xs text-muted-foreground">{entry.objectName} · {formatRecentTime(entry.occurredAt)}</div>
      </div>
    </div>
  );
}

function formatRecentTime(value: string): string {
  return new Date(value).toLocaleString();
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

export type { SiteDto };
