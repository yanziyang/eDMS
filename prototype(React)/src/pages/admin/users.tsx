import { useState } from "react";
import { Search, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { AdminPage } from "@/components/app/admin-page";
import { NameWithAvatar, PageHeader, RoleBadge } from "@/components/app/bits";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { db, emit, useDb } from "@/lib/store";
import type { User } from "@/types";

export function AdminUsers() {
  useDb();
  const [query, setQuery] = useState("");
  const [addOpen, setAddOpen] = useState(false);

  const q = query.toLowerCase();
  const filtered = db.users.filter(
    (u) =>
      !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || u.dept.toLowerCase().includes(q)
  );

  return (
    <AdminPage title="Users">
      <PageHeader
        title="Users"
        subtitle="Manage accounts, roles, and access across the organization."
        actions={
          <Button onClick={() => setAddOpen(true)}>
            <UserPlus data-icon="inline-start" />
            Add user
          </Button>
        }
      />

      <Card>
        <CardHeader className="flex-wrap gap-3">
          <InputGroup className="h-8 w-full max-w-[280px]">
            <InputGroupAddon>
              <Search />
            </InputGroupAddon>
            <InputGroupInput placeholder="Search users…" value={query} onChange={(e) => setQuery(e.target.value)} />
          </InputGroup>
          <span className="text-xs text-muted-foreground">
            {filtered.length} of {db.users.length} users
          </span>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto border-t">
            <Table className="text-[13.3px]">
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead>Name</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Last active</TableHead>
                  <TableHead>Active</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((u) => (
                  <UserRow key={u.email} user={u} />
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <AddUserDialog open={addOpen} onOpenChange={setAddOpen} />
    </AdminPage>
  );
}

function UserRow({ user }: { user: User }) {
  const toggle = (checked: boolean) => {
    user.status = checked ? "Active" : "Inactive";
    emit();
    toast.success(`${user.name} ${checked ? "reactivated" : "deactivated"}`, {
      description: checked ? "Account access restored." : "All active sessions revoked.",
    });
  };
  return (
    <TableRow>
      <TableCell>
        <NameWithAvatar
          name={
            <>
              {user.name}{" "}
              {user.name === "Jordan Reyes" && (
                <span className="inline-flex h-5 items-center rounded-full border px-2 text-[11px] font-medium">
                  You
                </span>
              )}
            </>
          }
          sub={user.email}
        />
      </TableCell>
      <TableCell className="text-muted-foreground">{user.title}</TableCell>
      <TableCell className="text-muted-foreground">{user.dept}</TableCell>
      <TableCell>
        <RoleBadge role={user.role} />
      </TableCell>
      <TableCell className="text-muted-foreground">{user.lastActive}</TableCell>
      <TableCell>
        <Switch checked={user.status === "Active"} onCheckedChange={toggle} aria-label={`Toggle ${user.name}`} />
      </TableCell>
    </TableRow>
  );
}

function AddUserDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Add user</DialogTitle>
          <DialogDescription>
            An invitation email is sent with a link to set a password.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const name = String(fd.get("name") || "").trim();
            if (!name) return;
            db.users.unshift({
              name,
              email: String(fd.get("email") || "").trim() || "new.user@edms-demo.local",
              title: String(fd.get("title") || "").trim() || "—",
              dept: String(fd.get("dept") || "IT Operations"),
              role: "Member",
              status: "Active",
              lastActive: "Just invited",
            });
            emit();
            onOpenChange(false);
            e.currentTarget.reset();
            toast.success(`Invitation sent to ${name}`);
          }}
        >
          <div className="flex flex-col gap-4">
            <div>
              <Label className="text-[13px]">
                Full name <span className="text-destructive">*</span>
              </Label>
              <Input name="name" className="mt-1.5" required />
            </div>
            <div>
              <Label className="text-[13px]">
                Email address <span className="text-destructive">*</span>
              </Label>
              <Input name="email" type="email" className="mt-1.5" required />
            </div>
            <div>
              <Label className="text-[13px]">Job title</Label>
              <Input name="title" className="mt-1.5" />
            </div>
            <div>
              <Label className="text-[13px]">Department</Label>
              <Select name="dept" defaultValue="Finance">
                <SelectTrigger className="mt-1.5 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {["Finance", "Human Resources", "Project Phoenix", "IT Operations", "Marketing"].map((d) => (
                      <SelectItem key={d} value={d}>
                        {d}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">Send invitation</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
