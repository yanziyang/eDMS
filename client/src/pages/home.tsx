import { useQuery } from "@tanstack/react-query";
import { FileText, Folder, HardDrive } from "lucide-react";
import { Link } from "react-router-dom";
import { listRecent } from "@/features/recent/api";
import { listSites } from "@/features/sites/api";
import { queryKeys } from "@/lib/queryKeys";
import type { RecentDocumentDto, SiteDto } from "@/types/api";

export function Home() {
  const {
    data: sites = [],
    isLoading,
  } = useQuery({
    queryKey: queryKeys.sites.list(),
    queryFn: listSites,
  });

  const recent = useQuery({
    queryKey: queryKeys.me.recent(),
    queryFn: listRecent,
  });

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading.</div>;
  }

  return (
    <div>
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold">My Sites</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Sites you have access to across the organization.
          </p>
        </div>
      </div>

      {sites.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
          You do not have access to any sites yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sites.map((site) => (
            <Link
              key={site.id}
              to={`/sites/${site.urlSlug}`}
              className="rounded-lg border bg-card p-5 transition-colors hover:bg-muted/50"
            >
              <div className="mb-4 flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Folder className="size-5" />
              </div>
              <div className="font-medium">{site.name}</div>
              <div className="mt-1 text-sm text-muted-foreground">
                {site.description || "No description"}
              </div>
              <div className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
                <HardDrive className="size-3.5" />
                {formatBytes(site.storageUsedBytes)} used
              </div>
            </Link>
          ))}
        </div>
      )}

      <RecentSection recent={recent.data ?? []} isLoading={recent.isLoading} isError={recent.isError} />
    </div>
  );
}

function RecentSection({
  recent,
  isLoading,
  isError,
}: {
  recent: RecentDocumentDto[];
  isLoading: boolean;
  isError: boolean;
}) {
  return (
    <section className="mt-8" aria-labelledby="recent-heading">
      <div className="mb-3">
        <h2 id="recent-heading" className="text-lg font-semibold">Recent</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Documents you recently viewed, uploaded, or modified.
        </p>
      </div>
      {isLoading && <div className="text-sm text-muted-foreground">Loading recent documents…</div>}
      {isError && <div className="text-sm text-destructive">Failed to load recent documents.</div>}
      {!isLoading && !isError && recent.length === 0 && (
        <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          No recent documents yet.
        </div>
      )}
      {!isLoading && !isError && recent.length > 0 && (
        <div className="flex flex-col gap-2">
          {recent.map((document) => (
            <RecentRow key={document.documentId} document={document} />
          ))}
        </div>
      )}
    </section>
  );
}

function RecentRow({ document }: { document: RecentDocumentDto }) {
  const location = document.folderPath && document.folderPath !== "/"
    ? `${document.siteName} / ${document.libraryName} / ${document.folderPath.trim().replace(/^\/+|\/+$/g, "")}`
    : `${document.siteName} / ${document.libraryName}`;

  return (
    <Link
      to={`/sites/${document.siteSlug}/libraries/${document.libraryId}?documentId=${encodeURIComponent(document.documentId)}`}
      className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3 hover:bg-muted/50"
    >
      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <FileText className="size-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">{document.name}</div>
        <div className="truncate text-xs text-muted-foreground">{location}</div>
      </div>
      <time
        dateTime={document.lastTouchedAt}
        className="shrink-0 text-xs text-muted-foreground max-sm:hidden"
      >
        {formatRecentTime(document.lastTouchedAt)}
      </time>
    </Link>
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
