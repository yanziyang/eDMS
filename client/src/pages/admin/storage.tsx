import { useQuery } from "@tanstack/react-query";
import { getStorageReport } from "@/features/admin/api";
import { queryKeys } from "@/lib/queryKeys";

export function AdminStorage() {
  const report = useQuery({
    queryKey: queryKeys.admin.storage(),
    queryFn: getStorageReport,
  });

  if (report.isLoading) {
    return <div className="text-sm text-muted-foreground">Loading.</div>;
  }

  if (report.isError) {
    return <div className="text-sm text-destructive">Failed to load storage report.</div>;
  }

  if (!report.data || report.data.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
        No storage data available.
      </div>
    );
  }

  const sites = report.data;
  const total = sites.reduce((sum, site) => sum + site.usedBytes, 0);
  const maxUsed = Math.max(...sites.map((site) => site.usedBytes));

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border bg-card p-4">
        <div className="text-sm text-muted-foreground">Total storage used</div>
        <div className="mt-1 text-2xl font-semibold">{formatBytes(total)}</div>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50 text-left">
              <th className="px-4 py-2 font-medium">Site</th>
              <th className="px-4 py-2 font-medium">Usage</th>
            </tr>
          </thead>
          <tbody>
            {sites.map((site) => (
              <tr key={site.siteId} className="border-b last:border-0">
                <td className="px-4 py-2">{site.siteName}</td>
                <td className="px-4 py-2">
                  <div className="flex items-center gap-3">
                    <div
                      role="progressbar"
                      aria-label={`${site.siteName} usage`}
                      aria-valuenow={Math.round((site.usedBytes / maxUsed) * 100)}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      className="h-2 w-40 overflow-hidden rounded-full bg-muted"
                    >
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${Math.round((site.usedBytes / maxUsed) * 100)}%` }}
                      />
                    </div>
                    <span className="text-muted-foreground">{formatBytes(site.usedBytes)}</span>
                  </div>
                </td>
              </tr>
            ))}
            <tr className="border-b bg-muted/50 last:border-0">
              <td className="px-4 py-2 font-medium">Total</td>
              <td className="px-4 py-2 font-medium">{formatBytes(total)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}
