import { useState } from "react";
import { UserPlus, Users, X } from "lucide-react";
import { toast } from "sonner";
import { AdminPage } from "@/components/app/admin-page";
import { GroupBadge, PageHeader } from "@/components/app/bits";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { initialsOf } from "@/lib/helpers";
import { SAMPLE_USERS } from "@/lib/mock-data";
import { db, emit, useDb } from "@/lib/store";

export function AdminGroups() {
  useDb();
  const [createOpen, setCreateOpen] = useState(false);
  const [manageGroup, setManageGroup] = useState<string | null>(null);

  return (
    <AdminPage title="Groups">
      <PageHeader
        title="Groups"
        subtitle="Site-managed groups and organization-wide custom groups."
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <UserPlus data-icon="inline-start" />
            Create group
          </Button>
        }
      />

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table className="text-[13.3px]">
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead>Group</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Scope</TableHead>
                  <TableHead>Members</TableHead>
                  <TableHead className="w-24 text-right" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {db.groups.map((g) => (
                  <TableRow key={g.name}>
                    <TableCell>
                      <div className="flex items-center gap-2.5 font-medium">
                        <Users className="size-4 text-muted-foreground" />
                        <span className="truncate">{g.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <GroupBadge type={g.type} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">{g.site}</TableCell>
                    <TableCell className="text-muted-foreground">{g.members} members</TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" onClick={() => setManageGroup(g.name)}>
                        Manage
                      </Button>
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
            <DialogTitle>Create group</DialogTitle>
            <DialogDescription>
              Custom groups can be granted access to any site, library, folder, or document.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const name = String(fd.get("name") || "").trim();
              if (!name) return;
              db.groups.unshift({ name, type: "Custom group", members: 1, site: "Cross-site (Read)" });
              emit();
              setCreateOpen(false);
              e.currentTarget.reset();
              toast.success(`Group "${name}" created`);
            }}
          >
            <div className="flex flex-col gap-4">
              <div>
                <Label className="text-[13px]">
                  Group name <span className="text-destructive">*</span>
                </Label>
                <Input name="name" className="mt-1.5" required />
              </div>
              <div>
                <Label className="text-[13px]">Description</Label>
                <Textarea name="desc" className="mt-1.5" rows={2} />
              </div>
            </div>
            <DialogFooter className="mt-4">
              <Button type="button" variant="secondary" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Create</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {manageGroup && (
        <Dialog open onOpenChange={(o) => !o && setManageGroup(null)}>
          <DialogContent className="max-w-[480px]">
            <DialogHeader>
              <DialogTitle>{manageGroup}</DialogTitle>
              <DialogDescription>Members of this group</DialogDescription>
            </DialogHeader>
            <div>
              {SAMPLE_USERS.slice(0, 5).map((u) => (
                <div key={u.email} className="flex items-center gap-2 border-b py-2 last:border-b-0">
                  <span className="flex size-[26px] items-center justify-center rounded-full bg-primary/15 text-[10.5px] font-semibold text-primary">
                    {initialsOf(u.name)}
                  </span>
                  <div className="flex-1 text-sm">{u.name}</div>
                  <Button variant="ghost" size="icon-sm" aria-label={`Remove ${u.name}`}>
                    <X />
                  </Button>
                </div>
              ))}
              <div className="mt-3">
                <Label className="text-[13px]">Add member</Label>
                <InputGroup className="mt-1.5">
                  <InputGroupAddon>
                    <UserPlus />
                  </InputGroupAddon>
                  <InputGroupInput placeholder="Search by name or email…" />
                </InputGroup>
              </div>
            </div>
            <DialogFooter>
              <Button variant="secondary" onClick={() => setManageGroup(null)}>
                Close
              </Button>
              <Button
                onClick={() => {
                  setManageGroup(null);
                  toast.success("Group membership updated");
                }}
              >
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </AdminPage>
  );
}
