import { useState } from "react";
import { Building2, Eye, MoreHorizontal, ShieldCheck, Trash2 } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { AdminPage } from "@/components/app/admin-page";
import { PageHeader, StatusBadge } from "@/components/app/bits";
import { SiteIcon } from "@/components/app/icon-map";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { db, emit, useDb } from "@/lib/store";

export function AdminSites() {
  useDb();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [createOpen, setCreateOpen] = useState(searchParams.get("action") === "newsite");

  return (
    <AdminPage title="Sites">
      <PageHeader
        title="Sites"
        subtitle="Every workspace provisioned in this organization."
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Building2 data-icon="inline-start" />
            New site
          </Button>
        }
      />

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table className="text-[13.3px]">
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead>Site</TableHead>
                  <TableHead>Libraries</TableHead>
                  <TableHead>Members</TableHead>
                  <TableHead className="min-w-[160px]">Storage</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-10 text-right" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {db.sites.map((s) => (
                  <TableRow key={s.slug}>
                    <TableCell>
                      <div className="flex items-center gap-2.5 font-medium">
                        <span
                          className="flex size-[30px] items-center justify-center rounded-[8px] text-white"
                          style={{ background: s.color }}
                        >
                          <SiteIcon icon={s.icon} className="size-3.5" />
                        </span>
                        <span className="truncate">{s.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{s.libraries.length}</TableCell>
                    <TableCell className="text-muted-foreground">{s.members}</TableCell>
                    <TableCell className="min-w-[160px]">
                      <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                        <span>{s.storageUsedGB.toFixed(1)} GB</span>
                        <span>{s.storageQuotaGB} GB</span>
                      </div>
                      <div className="h-[7px] overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: Math.min(100, (s.storageUsedGB / s.storageQuotaGB) * 100) + "%" }}
                        />
                      </div>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={s.status ?? "Active"} />
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon-sm" aria-label="More actions">
                            <MoreHorizontal />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-[210px]">
                          <DropdownMenuItem onSelect={() => navigate(`/sites/${s.slug}`)}>
                            <Eye data-icon="inline-start" />
                            Open site
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onSelect={() => toast.info("Opening site permissions…")}
                          >
                            <ShieldCheck data-icon="inline-start" />
                            Permissions
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            variant="destructive"
                            className="text-destructive"
                            onSelect={() => {
                              s.status = s.status === "Archived" ? "Active" : "Archived";
                              emit();
                              if (s.status === "Archived") {
                                toast.success(`${s.name} archived`, {
                                  description: "Members retain read access to existing content.",
                                });
                              } else {
                                toast.success(`${s.name} reactivated`);
                              }
                            }}
                          >
                            <Trash2 data-icon="inline-start" />
                            {s.status === "Archived" ? "Reactivate site" : "Archive site"}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Create a new site</DialogTitle>
            <DialogDescription>
              A default "Documents" library and Owners/Members/Visitors groups are created automatically.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const name = String(fd.get("name") || "Untitled").trim();
              setCreateOpen(false);
              e.currentTarget.reset();
              toast.success(`Site "${name}" created`);
            }}
          >
            <div className="flex flex-col gap-4">
              <div>
                <Label className="text-[13px]">
                  Site name <span className="text-destructive">*</span>
                </Label>
                <Input name="name" className="mt-1.5" placeholder="e.g. Customer Success" required />
              </div>
              <div>
                <Label className="text-[13px]">URL slug</Label>
                <Input name="slug" className="mt-1.5" placeholder="customer-success" />
              </div>
              <div>
                <Label className="text-[13px]">Description</Label>
                <Textarea name="desc" className="mt-1.5" rows={2} />
              </div>
              <div>
                <Label className="text-[13px]">Storage quota (GB)</Label>
                <Input name="quota" className="mt-1.5" type="number" defaultValue={50} />
              </div>
              <div>
                <Label className="text-[13px]">Initial owner</Label>
                <Input className="mt-1.5" value="Jordan Reyes" disabled />
              </div>
            </div>
            <DialogFooter className="mt-4">
              <Button type="button" variant="secondary" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Create site</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AdminPage>
  );
}
