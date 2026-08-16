import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { toast } from "sonner";
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
import { listAuditLog } from "@/features/admin/api";
import { listSites } from "@/features/sites/api";
import { queryKeys } from "@/lib/queryKeys";

const CSV_HEADERS = ["Time", "User ID", "Action", "Object type", "Object name", "IP address"];

function csvCell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function exportCsv(rows: ReturnType<typeof buildCsvRows>): void {
  const blob = new Blob([rows.map((row) => row.join(",")).join("\n")], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "edms-audit-log.csv";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

function buildCsvRows(
  entries: { timestamp: string; userId: string; action: string; objectType: string; objectName: string; ipAddress: string }[],
): string[][] {
  return [
    CSV_HEADERS,
    ...entries.map((entry) => [
      new Date(entry.timestamp).toLocaleString(),
      entry.userId,
      entry.action,
      entry.objectType,
      entry.objectName,
      entry.ipAddress,
    ]).map((cells) => cells.map(csvCell)),
  ];
}

export function AdminAuditLog() {
  const [siteId, setSiteId] = useState("");
  const [actionFilter, setActionFilter] = useState("");

  const sites = useQuery({
    queryKey: queryKeys.sites.list(),
    queryFn: listSites,
  });

  const auditLog = useQuery({
    queryKey: queryKeys.admin.auditLog(siteId),
    queryFn: () => listAuditLog(siteId),
    enabled: siteId !== "",
  });

  const filtered = (auditLog.data ?? []).filter(
    (entry) =>
      actionFilter === "" ||
      entry.action.toLowerCase().includes(actionFilter.trim().toLowerCase()),
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="audit-site">Site</Label>
          {sites.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {sites.isError && <p className="text-sm text-destructive">Failed to load sites.</p>}
          {sites.data && (
            <Select value={siteId} onValueChange={setSiteId}>
              <SelectTrigger id="audit-site" className="w-64">
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

        <div className="flex items-center gap-2">
          <Input
            value={actionFilter}
            onChange={(event) => setActionFilter(event.target.value)}
            placeholder="Filter by action…"
            aria-label="Filter by action"
            className="w-56"
          />
          <Button
            variant="outline"
            onClick={() => {
              exportCsv(buildCsvRows(filtered));
              toast.success("Audit log exported");
            }}
            disabled={filtered.length === 0}
          >
            <Download className="size-4" />
            Export CSV
          </Button>
        </div>
      </div>

      {sites.data && sites.data.length === 0 && (
        <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
          No sites are available.
        </div>
      )}
      {sites.data && sites.data.length > 0 && siteId === "" && (
        <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
          Select a site to view its audit log.
        </div>
      )}

      {siteId !== "" && auditLog.isLoading && (
        <div className="text-sm text-muted-foreground">Loading…</div>
      )}
      {siteId !== "" && auditLog.isError && (
        <div className="text-sm text-destructive">Failed to load audit log.</div>
      )}

      {siteId !== "" && auditLog.data && filtered.length === 0 && (
        <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
          No audit events found.
        </div>
      )}

      {siteId !== "" && auditLog.data && filtered.length > 0 && (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-left">
                <th className="px-4 py-2 font-medium">Time</th>
                <th className="px-4 py-2 font-medium">User ID</th>
                <th className="px-4 py-2 font-medium">Action</th>
                <th className="px-4 py-2 font-medium">Object type</th>
                <th className="px-4 py-2 font-medium">Object name</th>
                <th className="px-4 py-2 font-medium">IP address</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((entry) => (
                <tr key={entry.id} className="border-b last:border-0">
                  <td className="px-4 py-2 text-muted-foreground">
                    {new Date(entry.timestamp).toLocaleString()}
                  </td>
                  <td className="px-4 py-2">{entry.userId}</td>
                  <td className="px-4 py-2">{entry.action}</td>
                  <td className="px-4 py-2 text-muted-foreground">{entry.objectType}</td>
                  <td className="px-4 py-2">{entry.objectName}</td>
                  <td className="px-4 py-2 text-muted-foreground">{entry.ipAddress}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {siteId !== "" && auditLog.data && (
        <p className="text-xs text-muted-foreground">
          {filtered.length} of {auditLog.data.length} events
        </p>
      )}
    </div>
  );
}
