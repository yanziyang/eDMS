import { Building2, Database, Download, FileText, TrendingUp, Users } from "lucide-react";
import { toast } from "sonner";
import { AdminPage } from "@/components/app/admin-page";
import { PageHeader, StatCard } from "@/components/app/bits";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  FILE_TYPE_BREAKDOWN,
  SAMPLE_USERS,
  SEARCH_INDEX,
  STORAGE_TREND,
  STORAGE_TREND_LABELS,
} from "@/lib/mock-data";
import { db, useDb } from "@/lib/store";

export function AdminStorage() {
  useDb();
  const totalUsed = db.sites.reduce((s, x) => s + x.storageUsedGB, 0);
  const totalQuota = db.sites.reduce((s, x) => s + x.storageQuotaGB, 0);
  const activeUsers = SAMPLE_USERS.filter((u) => u.status === "Active").length;
  const top = db.sites.slice().sort((a, b) => b.storageUsedGB - a.storageUsedGB);

  return (
    <AdminPage title="Storage Report">
      <PageHeader
        title="Storage report"
        subtitle="Usage across every site, updated in real time as documents are added or removed."
        actions={
          <Button
            variant="outline"
            onClick={() => toast.success("Report exported", { description: "edms-storage-report.pdf" })}
          >
            <Download data-icon="inline-start" />
            Export PDF
          </Button>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Total storage used"
          value={totalUsed.toFixed(1) + " GB"}
          delta={<>of {totalQuota} GB provisioned</>}
          icon={<Database className="size-3.5" />}
        />
        <StatCard
          label="Total documents"
          value={SEARCH_INDEX.length.toLocaleString() + "+"}
          delta={
            <>
              <TrendingUp className="size-3.5" />
              Across all libraries
            </>
          }
          up
          icon={<FileText className="size-3.5" />}
        />
        <StatCard
          label="Active sites"
          value={db.sites.length}
          delta={<>Workspaces provisioned</>}
          icon={<Building2 className="size-3.5" />}
        />
        <StatCard
          label="Active users"
          value={activeUsers}
          delta={<>Of 19 total accounts</>}
          icon={<Users className="size-3.5" />}
        />
      </div>

      <div className="mb-6 grid grid-cols-1 items-start gap-5 lg:grid-cols-[1.5fr_1fr]">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Storage by site</CardTitle>
              <CardDescription>Used vs. provisioned quota, in GB</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <SiteStorageChart sites={db.sites} />
            <ChartLegend
              items={[
                ["hsl(var(--muted-foreground) / 0.4)", "Quota"],
                ["hsl(var(--primary))", "Used (colored per site)"],
              ]}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Storage by file type</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center">
            <FileTypeDonut />
            <ChartLegend
              center
              items={FILE_TYPE_BREAKDOWN.map((d) => [d.color, `${d.label} · ${d.value}%`])}
            />
          </CardContent>
        </Card>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <div>
            <CardTitle>Storage growth</CardTitle>
            <CardDescription>Total organization-wide usage, last 7 months</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <StorageTrendChart />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sites by storage usage</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table className="text-[13.3px]">
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead>Site</TableHead>
                  <TableHead>Libraries</TableHead>
                  <TableHead className="min-w-[140px]">Usage</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {top.map((s) => (
                  <TableRow key={s.slug}>
                    <TableCell>
                      <div className="flex items-center gap-2.5 font-medium">
                        <span className="size-2 rounded-full" style={{ background: s.color }} />
                        <span className="truncate">{s.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{s.libraries.length}</TableCell>
                    <TableCell className="min-w-[140px]">
                      <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                        <span>{s.storageUsedGB.toFixed(1)} GB</span>
                        <span>{Math.round((s.storageUsedGB / s.storageQuotaGB) * 100)}%</span>
                      </div>
                      <div className="h-[7px] overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: Math.min(100, (s.storageUsedGB / s.storageQuotaGB) * 100) + "%" }}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </AdminPage>
  );
}

function ChartLegend({ items, center }: { items: [string, string][]; center?: boolean }) {
  return (
    <div className={`mt-3.5 flex flex-wrap gap-3.5 text-xs text-muted-foreground ${center ? "justify-center" : ""}`}>
      {items.map(([color, label]) => (
        <div key={label} className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-[3px]" style={{ background: color }} />
          {label}
        </div>
      ))}
    </div>
  );
}

function SiteStorageChart({ sites }: { sites: typeof db.sites }) {
  const max = Math.max(...sites.map((s) => s.storageQuotaGB));
  const w = 640,
    h = 240,
    padL = 36,
    padB = 28,
    padT = 14,
    padR = 12;
  const chartW = w - padL - padR,
    chartH = h - padB - padT;
  const gap = chartW / sites.length,
    barW = gap * 0.5;

  return (
    <svg className="chart-svg w-full" viewBox={`0 0 ${w} ${h}`} xmlns="http://www.w3.org/2000/svg">
      {[0, 1, 2, 3, 4].map((g) => {
        const gy = padT + chartH - (g / 4) * chartH;
        return (
          <g key={g}>
            <line className="grid-line" x1={padL} x2={w - padR} y1={gy} y2={gy} />
            <text x={padL - 8} y={gy + 3} textAnchor="end">
              {Math.round((max * g) / 4)}
            </text>
          </g>
        );
      })}
      {sites.map((s, i) => {
        const x = padL + i * gap + (gap - barW) / 2;
        const usedH = (s.storageUsedGB / max) * chartH;
        const quotaH = (s.storageQuotaGB / max) * chartH;
        return (
          <g key={s.slug}>
            <rect x={x} y={padT + chartH - quotaH} width={barW} height={quotaH} rx="4" fill="hsl(var(--muted))">
              <title>Quota: {s.storageQuotaGB} GB</title>
            </rect>
            <rect x={x} y={padT + chartH - usedH} width={barW} height={usedH} rx="4" fill={s.color}>
              <title>{`${s.name}: ${s.storageUsedGB} GB`}</title>
            </rect>
            <text x={x + barW / 2} y={h - 8} textAnchor="middle">
              {s.name.split(" ")[0]}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function FileTypeDonut() {
  const total = FILE_TYPE_BREAKDOWN.reduce((s, d) => s + d.value, 0);
  const cx = 90,
    cy = 90,
    r = 62,
    sw = 24;
  let angle = -90;
  const paths = FILE_TYPE_BREAKDOWN.map((d) => {
    const frac = d.value / total;
    const sweep = frac * 360;
    const large = sweep > 180 ? 1 : 0;
    const a0 = (angle * Math.PI) / 180;
    const a1 = ((angle + sweep - 0.5) * Math.PI) / 180;
    const x0 = cx + r * Math.cos(a0);
    const y0 = cy + r * Math.sin(a0);
    const x1 = cx + r * Math.cos(a1);
    const y1 = cy + r * Math.sin(a1);
    angle += sweep;
    return (
      <path
        key={d.label}
        d={`M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`}
        fill="none"
        stroke={d.color}
        strokeWidth={sw}
        strokeLinecap="round"
      >
        <title>{`${d.label}: ${d.value}%`}</title>
      </path>
    );
  });
  return (
    <svg className="chart-svg w-[180px]" viewBox="0 0 180 180" xmlns="http://www.w3.org/2000/svg">
      {paths}
      <text x="90" y="86" textAnchor="middle" style={{ fontSize: 20, fontWeight: 700, fill: "hsl(var(--foreground))" }}>
        {total.toFixed(0)}%
      </text>
      <text x="90" y="102" textAnchor="middle" style={{ fontSize: 10 }}>
        of storage
      </text>
    </svg>
  );
}

function StorageTrendChart() {
  const w = 640,
    h = 200,
    padL = 36,
    padB = 26,
    padT = 14,
    padR = 16;
  const chartW = w - padL - padR,
    chartH = h - padB - padT;
  const max = Math.max(...STORAGE_TREND) * 1.15;
  const stepX = chartW / (STORAGE_TREND.length - 1);
  const pts = STORAGE_TREND.map((v, i) => [padL + i * stepX, padT + chartH - (v / max) * chartH] as const);
  const linePath = "M " + pts.map((p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" L ");
  const areaPath = `${linePath} L ${pts[pts.length - 1][0]} ${padT + chartH} L ${pts[0][0]} ${padT + chartH} Z`;

  return (
    <svg className="chart-svg w-full" viewBox={`0 0 ${w} ${h}`} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="hsl(var(--chart-1))" stopOpacity="0.28" />
          <stop offset="100%" stopColor="hsl(var(--chart-1))" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0, 1, 2, 3].map((g) => {
        const gy = padT + chartH - (g / 3) * chartH;
        return (
          <g key={g}>
            <line className="grid-line" x1={padL} x2={w - padR} y1={gy} y2={gy} />
            <text x={padL - 8} y={gy + 3} textAnchor="end">
              {Math.round((max * g) / 3)}
            </text>
          </g>
        );
      })}
      <path d={areaPath} fill="url(#trendFill)" stroke="none" />
      <path
        d={linePath}
        fill="none"
        stroke="hsl(var(--chart-1))"
        strokeWidth="2.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {pts.map((p, i) => (
        <circle key={i} cx={p[0]} cy={p[1]} r="3.5" fill="hsl(var(--chart-1))" stroke="hsl(var(--card))" strokeWidth="2" />
      ))}
      {STORAGE_TREND_LABELS.map((l, i) => (
        <text key={l} x={pts[i][0]} y={h - 6} textAnchor="middle">
          {l}
        </text>
      ))}
    </svg>
  );
}
