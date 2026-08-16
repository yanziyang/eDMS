import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LoaderCircle, Trash2, UserPlus, Users, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { listUsers } from "@/features/admin/api";
import {
  addGroupMember,
  createGroup,
  deleteGroup,
  listGroups,
  removeGroupMember,
} from "@/features/groups/api";
import { queryKeys } from "@/lib/queryKeys";
import type { GroupDto } from "@/types/api";

export function AdminGroups() {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [membersFor, setMembersFor] = useState<GroupDto | null>(null);
  const [deleteFor, setDeleteFor] = useState<GroupDto | null>(null);

  const groupsQuery = useQuery({
    queryKey: queryKeys.groups.list(),
    queryFn: () => listGroups(),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: queryKeys.groups.list() });

  const remove = useMutation({
    mutationFn: (group: GroupDto) => deleteGroup(group.id),
    onSuccess: (_data, group) => {
      toast.success(`Deleted ${group.name}`);
      setDeleteFor(null);
      invalidate();
    },
    onError: () => toast.error("Failed to delete group"),
  });

  const orgGroups = (groupsQuery.data ?? []).filter((group) => group.siteId === null);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Organization-wide groups that can be granted access to any site, library, folder, or
          document.
        </p>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <UserPlus className="size-4" />
          Create group
        </Button>
      </div>

      {groupsQuery.isLoading && <div className="text-sm text-muted-foreground">Loading…</div>}
      {groupsQuery.isError && (
        <div className="text-sm text-destructive">Failed to load groups.</div>
      )}

      {groupsQuery.data && (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-left">
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Scope</th>
                <th className="px-4 py-2 font-medium">Members</th>
                <th className="px-4 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {orgGroups.map((group) => (
                <tr key={group.id} className="border-b last:border-0">
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      {group.name}
                      {group.isSystem && <Badge variant="outline">System</Badge>}
                    </div>
                    {group.description && (
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {group.description}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">Organization</td>
                  <td className="px-4 py-2 text-muted-foreground">{group.memberIds.length}</td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setMembersFor(group)}
                      >
                        <Users className="size-4" />
                        Members
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Delete ${group.name}`}
                        disabled={group.isSystem}
                        onClick={() => setDeleteFor(group)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {groupsQuery.data && orgGroups.length === 0 && (
        <p className="mt-4 text-sm text-muted-foreground">No organization-wide groups yet.</p>
      )}

      <CreateGroupDialog open={createOpen} onOpenChange={setCreateOpen} />
      <MembersDialog
        group={membersFor}
        onOpenChange={(open) => {
          if (!open) setMembersFor(null);
        }}
      />
      <DeleteGroupDialog
        group={deleteFor}
        pending={remove.isPending}
        onConfirm={() => {
          if (deleteFor) remove.mutate(deleteFor);
        }}
        onOpenChange={(open) => {
          if (!open) setDeleteFor(null);
        }}
      />
    </div>
  );
}

interface CreateGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function CreateGroupDialog({ open, onOpenChange }: CreateGroupDialogProps) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const create = useMutation({
    mutationFn: () =>
      createGroup({
        name: name.trim(),
        description: description.trim() === "" ? null : description.trim(),
        siteId: null,
      }),
    onSuccess: () => {
      toast.success("Group created");
      setName("");
      setDescription("");
      onOpenChange(false);
      queryClient.invalidateQueries({ queryKey: queryKeys.groups.list() });
    },
    onError: () => toast.error("Failed to create group"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create group</DialogTitle>
          <DialogDescription>
            Organization-wide groups can be granted access to any site, library, folder, or
            document.
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (name.trim() !== "") {
              create.mutate();
            }
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="group-name">Group name</Label>
            <Input
              id="group-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Finance reviewers"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="group-description">Description</Label>
            <Textarea
              id="group-description"
              rows={2}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={create.isPending || name.trim() === ""}>
              {create.isPending && <LoaderCircle className="size-4 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface MembersDialogProps {
  group: GroupDto | null;
  onOpenChange: (open: boolean) => void;
}

function MembersDialog({ group, onOpenChange }: MembersDialogProps) {
  const queryClient = useQueryClient();
  const [newMemberId, setNewMemberId] = useState("");

  const users = useQuery({
    queryKey: queryKeys.admin.users(),
    queryFn: () => listUsers(),
    enabled: group !== null,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: queryKeys.groups.list() });

  const add = useMutation({
    mutationFn: (userId: string) => addGroupMember(group!.id, userId),
    onSuccess: () => {
      setNewMemberId("");
      toast.success("Member added");
      invalidate();
    },
    onError: () => toast.error("Failed to add member"),
  });

  const remove = useMutation({
    mutationFn: (userId: string) => removeGroupMember(group!.id, userId),
    onSuccess: () => {
      toast.success("Member removed");
      invalidate();
    },
    onError: () => toast.error("Failed to remove member"),
  });

  const memberIds = group ? new Set(group.memberIds) : new Set<string>();
  const members = (users.data ?? []).filter((user) => memberIds.has(user.id));
  const candidates = (users.data ?? []).filter((user) => !memberIds.has(user.id));

  return (
    <Dialog
      open={group !== null}
      onOpenChange={(open) => {
        setNewMemberId("");
        onOpenChange(open);
      }}
    >
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{group ? `Members of ${group.name}` : ""}</DialogTitle>
          <DialogDescription>
            Users in this group inherit every permission granted to the group.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          {users.isLoading && <div className="text-sm text-muted-foreground">Loading…</div>}
          {users.isError && <div className="text-sm text-destructive">Failed to load users.</div>}
          {users.data && members.length === 0 && (
            <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
              This group has no members yet.
            </div>
          )}
          {members.map((user) => (
            <div key={user.id} className="flex items-center gap-3 rounded-lg border p-2">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted">
                <Users className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{user.displayName}</div>
                <div className="truncate text-xs text-muted-foreground">{user.email}</div>
              </div>
              {!group?.isSystem && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remove ${user.displayName}`}
                  onClick={() => remove.mutate(user.id)}
                  disabled={remove.isPending}
                >
                  <X className="size-4" />
                </Button>
              )}
            </div>
          ))}

          {group && !group.isSystem && (
            <div className="flex items-end gap-2 border-t pt-3">
              <div className="flex flex-1 flex-col gap-1.5">
                <Label htmlFor="add-member">Add member</Label>
                <Select value={newMemberId} onValueChange={setNewMemberId}>
                  <SelectTrigger id="add-member" className="w-full">
                    <SelectValue placeholder="Select a user" />
                  </SelectTrigger>
                  <SelectContent>
                    {candidates.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.displayName} ({user.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                size="sm"
                disabled={add.isPending || newMemberId === ""}
                onClick={() => add.mutate(newMemberId)}
              >
                {add.isPending && <LoaderCircle className="size-4 animate-spin" />}
                Add
              </Button>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface DeleteGroupDialogProps {
  group: GroupDto | null;
  pending: boolean;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
}

function DeleteGroupDialog({ group, pending, onConfirm, onOpenChange }: DeleteGroupDialogProps) {
  return (
    <Dialog open={group !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete group</DialogTitle>
          <DialogDescription>
            {group
              ? `Delete "${group.name}"? Members will lose every permission granted through this group.`
              : ""}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={pending}>
            {pending && <LoaderCircle className="size-4 animate-spin" />}
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
