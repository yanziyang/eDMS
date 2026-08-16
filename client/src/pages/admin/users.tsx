import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createUser, listUsers, setUserActive } from "@/features/admin/api";
import { queryKeys } from "@/lib/queryKeys";
import type { UserDto } from "@/types/api";

export function AdminUsers() {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [tempPassword, setTempPassword] = useState("");
  const [isSystemAdmin, setIsSystemAdmin] = useState(false);

  const usersQuery = useQuery({
    queryKey: queryKeys.admin.users(),
    queryFn: () => listUsers(),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: queryKeys.admin.users() });

  const create = useMutation({
    mutationFn: () => createUser({ email, displayName, tempPassword, isSystemAdmin }),
    onSuccess: () => {
      setEmail("");
      setDisplayName("");
      setTempPassword("");
      setIsSystemAdmin(false);
      toast.success("User created");
      invalidate();
    },
    onError: () => toast.error("Failed to create user"),
  });

  const toggleActive = useMutation({
    mutationFn: (user: UserDto) => setUserActive(user.id, !user.isActive),
    onSuccess: (_data, user) => {
      toast.success(user.isActive ? "User deactivated" : "User reactivated");
      invalidate();
    },
    onError: () => toast.error("Failed to update user"),
  });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    create.mutate();
  };

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={submit} className="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-4">
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Email</span>
          <Input value={email} onChange={(event) => setEmail(event.target.value)} required />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Display name</span>
          <Input value={displayName} onChange={(event) => setDisplayName(event.target.value)} required />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Temporary password</span>
          <Input value={tempPassword} onChange={(event) => setTempPassword(event.target.value)} required />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={isSystemAdmin}
            onChange={(event) => setIsSystemAdmin(event.target.checked)}
          />
          System admin
        </label>
        <Button type="submit" disabled={create.isPending}>Create user</Button>
      </form>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50 text-left">
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium">Email</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium">Role</th>
              <th className="px-4 py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(usersQuery.data ?? []).map((user) => (
              <tr key={user.id} className="border-b last:border-0">
                <td className="px-4 py-2">{user.displayName}</td>
                <td className="px-4 py-2 text-muted-foreground">{user.email}</td>
                <td className="px-4 py-2">
                  <Badge variant={user.isActive ? "secondary" : "outline"}>
                    {user.isActive ? "Active" : "Inactive"}
                  </Badge>
                </td>
                <td className="px-4 py-2">{user.isSystemAdmin ? <Badge>Admin</Badge> : "User"}</td>
                <td className="px-4 py-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toggleActive.mutate(user)}
                    disabled={toggleActive.isPending}
                  >
                    {user.isActive ? "Deactivate" : "Reactivate"}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
