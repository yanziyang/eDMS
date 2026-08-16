import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { listUsers } from "@/features/admin/api";
import { share } from "@/features/permissions/api";
import { queryKeys } from "@/lib/queryKeys";
import type { PermissionLevel } from "@/types/api";

interface ShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentId: string;
  documentName: string;
}

export function ShareDialog({ open, onOpenChange, documentId, documentName }: ShareDialogProps) {
  const queryClient = useQueryClient();
  const [principalId, setPrincipalId] = useState("");
  const [level, setLevel] = useState<PermissionLevel>("Read");

  const users = useQuery({
    queryKey: queryKeys.admin.users(),
    queryFn: () => listUsers(),
    enabled: open,
  });

  const shareMutation = useMutation({
    mutationFn: () => share("Document", documentId, { principalId, level }),
    onSuccess: () => {
      toast.success("Document shared");
      queryClient.invalidateQueries({
        queryKey: queryKeys.permissions.forObject("Document", documentId),
      });
      onOpenChange(false);
    },
    onError: () => toast.error("Failed to share document"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Share &quot;{documentName}&quot;</DialogTitle>
          <DialogDescription>
            Choose a person and a permission level. They will be able to access this document.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="share-user">Person</Label>
            {users.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
            {users.isError && <p className="text-sm text-destructive">Failed to load users.</p>}
            {users.data && (
              <Select value={principalId} onValueChange={setPrincipalId}>
                <SelectTrigger id="share-user" className="w-full">
                  <SelectValue placeholder="Select a user" />
                </SelectTrigger>
                <SelectContent>
                  {users.data.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.displayName} ({user.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="share-level">Permission level</Label>
            <Select value={level} onValueChange={(value) => setLevel(value as PermissionLevel)}>
              <SelectTrigger id="share-level" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Read">Read</SelectItem>
                <SelectItem value="Contribute">Contribute</SelectItem>
                <SelectItem value="FullControl">Full Control</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => shareMutation.mutate()}
            disabled={!principalId || users.isLoading || shareMutation.isPending}
          >
            {shareMutation.isPending && <LoaderCircle className="size-4 animate-spin" />}
            Share
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
