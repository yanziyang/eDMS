import { useEffect, useState } from "react";
import { Folder, HardDrive } from "lucide-react";
import { Link } from "react-router-dom";
import { listSites } from "@/features/sites/api";
import type { SiteDto } from "@/types/api";

export function Home() {
  const [sites, setSites] = useState<SiteDto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listSites()
      .then(setSites)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading…</div>;
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
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}
