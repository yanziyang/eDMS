import { Building2, Bell, ChevronRight, Database, FileText, TrendingUp, UploadCloud } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { FileIcon } from "@/components/app/file-icon";
import { PageHeader, StatCard } from "@/components/app/bits";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SiteIcon } from "@/components/app/icon-map";
import { actionVerb, initialsOf } from "@/lib/helpers";
import { AUDIT_LOG, CURRENT_USER, NOTIFICATIONS, QUICK_ACCESS, SEARCH_INDEX, findSite } from "@/lib/mock-data";
import { db } from "@/lib/store";

export function Home() {
  const navigate = useNavigate();
  const [openCreateSite, setOpenCreateSite] = useState(false);

  const totalStorage = db.sites.reduce((s, x) => s + x.storageUsedGB, 0);
  const totalQuota = db.sites.reduce((s, x) => s + x.storageQuotaGB, 0);

  return (
    <div>
      <PageHeader
        title={
          <>
            Welcome back, <span>{CURRENT_USER.name.split(" ")[0]}</span>
          </>
        }
        subtitle="Here's what's happening across your organization today."
        actions={
          <>
            <Button variant="outline" onClick={() => setOpenCreateSite(true)}>
              <Building2 data-icon="inline-start" />
              New site
            </Button>
            <Button onClick={() => navigate("/sites/finance/documents/root?action=upload")}>
              <UploadCloud data-icon="inline-start" />
              Upload
            </Button>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Sites you access"
          value={db.sites.length}
          delta={
            <>
              <TrendingUp className="size-3.5" />
              Across 5 departments
            </>
          }
          up
          icon={<Building2 className="size-3.5" />}
        />
        <StatCard
          label="Storage used"
          value={totalStorage.toFixed(1) + " GB"}
          delta={<>of {totalQuota} GB provisioned</>}
          icon={<Database className="size-3.5" />}
        />
        <StatCard
          label="Documents"
          value={SEARCH_INDEX.length + "+"}
          delta={
            <>
              <TrendingUp className="size-3.5" />
              12 uploaded this week
            </>
          }
          up
          icon={<FileText className="size-3.5" />}
        />
        <StatCard
          label="Notifications"
          value={NOTIFICATIONS.filter((n) => n.unread).length}
          delta={<>Unread items</>}
          icon={<Bell className="size-3.5" />}
        />
      </div>

      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Your sites</h2>
        <span className="text-xs text-muted-foreground">Sorted by recent activity</span>
      </div>
      <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {db.sites.map((s) => (
          <Link
            key={s.slug}
            to={`/sites/${s.slug}`}
            className="rounded-[var(--radius)] border bg-card p-[1.15rem] transition-transform hover:-translate-y-px hover:shadow-[0_10px_30px_-12px_rgba(15,23,42,0.18)]"
          >
            <div
              className="flex size-[42px] items-center justify-center rounded-[10px] text-white"
              style={{ background: s.color }}
            >
              <SiteIcon icon={s.icon} className="size-5" />
            </div>
            <div className="mt-3 text-[14.5px] font-semibold">{s.name}</div>
            <div className="mt-1 min-h-[2.6em] text-xs text-muted-foreground">{s.description}</div>
            <div className="mt-3.5 flex items-center justify-between border-t pt-3 text-[11.5px] text-muted-foreground">
              <span>
                {s.libraries.length} librar{s.libraries.length === 1 ? "y" : "ies"}
              </span>
              <span>{s.members} members</span>
            </div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Recent activity</CardTitle>
              <CardDescription>Latest actions across every site you can access</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate("/admin/audit-log")}>
              View log
            </Button>
          </CardHeader>
          <CardContent>
            {AUDIT_LOG.slice(0, 6).map((a, i) => (
              <div key={i} className="flex items-center gap-3 border-b py-2 last:border-b-0">
                <span className="flex size-[26px] shrink-0 items-center justify-center rounded-full bg-primary/15 text-[10.5px] font-semibold text-primary">
                  {initialsOf(a.user)}
                </span>
                <div className="min-w-0 flex-1 text-sm">
                  <span className="font-medium">{a.user}</span>{" "}
                  <span className="text-muted-foreground">{actionVerb(a.action)}</span>{" "}
                  {a.object !== "—" && <span className="font-medium">{a.object}</span>}
                </div>
                <div className="shrink-0 text-xs text-muted-foreground">{a.time.split(" ")[1]}</div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Quick access</CardTitle>
              <CardDescription>Files you open often</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="px-2.5 py-1.5">
            {QUICK_ACCESS.map((q) => (
              <Link
                key={q.name}
                to={`/sites/${q.site}/${q.lib}/${q.folder}`}
                className="flex items-center gap-3 rounded-[calc(var(--radius)-4px)] px-2 py-2.5 hover:bg-muted/50"
              >
                <FileIcon item={{ type: "file", ext: q.ext }} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{q.name}</div>
                  <div className="text-xs text-muted-foreground">{findSite(q.site).name}</div>
                </div>
                <ChevronRight className="size-4 text-muted-foreground" />
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>

      <CreateSiteDialog open={openCreateSite} onOpenChange={setOpenCreateSite} />
    </div>
  );
}

export function CreateSiteDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Create a new site</DialogTitle>
          <DialogDescription>
            Sites are top-level workspaces for a team, department, or project.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onOpenChange(false);
            setName("");
            setDesc("");
            toast.success("Site created", {
              description: "New sites start with a default Documents library.",
            });
          }}
        >
          <div className="flex flex-col gap-4">
            <div>
              <Label className="text-[13px]">
                Site name <span className="text-destructive">*</span>
              </Label>
              <Input
                className="mt-1.5"
                placeholder="e.g. Customer Success"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div>
              <Label className="text-[13px]">Description</Label>
              <Textarea
                className="mt-1.5"
                rows={3}
                placeholder="What is this site for?"
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">Create site</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
