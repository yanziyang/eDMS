import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Link2, LoaderCircle, Trash2 } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { listUsers } from "@/features/admin/api";
import { createShareLink, listShareLinks, revokeShareLink } from "@/features/share-links/api";
import { share } from "@/features/permissions/api";
import { queryKeys } from "@/lib/queryKeys";
import type { PermissionLevel, ShareLinkDto } from "@/types/api";

const EXPIRY_OPTIONS = [
  { value: "never", label: "Never" },
  { value: "1", label: "1 day" },
  { value: "7", label: "7 days" },
  { value: "30", label: "30 days" },
] as const;

function expiryToIso(option: string): string | null {
  if (option === "never") return null;
  const date = new Date();
  date.setDate(date.getDate() + Number(option));
  return date.toISOString();
}

async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    if (document.execCommand) {
      document.execCommand("copy");
    }
    document.body.removeChild(textarea);
  }
}

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
  const [expiry, setExpiry] = useState<string>("never");
  const [createdLink, setCreatedLink] = useState<ShareLinkDto | null>(null);
  const [copied, setCopied] = useState(false);

  const users = useQuery({
    queryKey: queryKeys.admin.users(),
    queryFn: () => listUsers(),
    enabled: open,
  });

  const links = useQuery({
    queryKey: queryKeys.shareLinks.forObject("Document", documentId),
    queryFn: () => listShareLinks("Document", documentId),
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

  const createLinkMutation = useMutation({
    mutationFn: () => createShareLink("Document", documentId, "Read", expiryToIso(expiry) ?? undefined),
    onSuccess: (link) => {
      setCreatedLink(link);
      setCopied(false);
      toast.success("Link created");
      queryClient.invalidateQueries({
        queryKey: queryKeys.shareLinks.forObject("Document", documentId),
      });
    },
    onError: () => toast.error("Failed to create link"),
  });

  const revokeMutation = useMutation({
    mutationFn: revokeShareLink,
    onSuccess: () => {
      toast.success("Link revoked");
      queryClient.invalidateQueries({
        queryKey: queryKeys.shareLinks.forObject("Document", documentId),
      });
    },
    onError: () => toast.error("Failed to revoke link"),
  });

  const linkUrl = createdLink ? `${window.location.origin}/share/${createdLink.token}` : "";

  const copyLink = async () => {
    await copyText(linkUrl);
    setCopied(true);
    toast.success("Link copied");
  };

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

        <Separator />

        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-1.5 text-sm font-medium">
            <Link2 className="size-4" />
            Get link
          </div>

          <div className="flex items-end gap-3">
            <div className="flex flex-1 flex-col gap-1.5">
              <Label htmlFor="link-expiry">Expires in</Label>
              <Select value={expiry} onValueChange={setExpiry}>
                <SelectTrigger id="link-expiry" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXPIRY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={() => createLinkMutation.mutate()}
              disabled={createLinkMutation.isPending || revokeMutation.isPending}
            >
              {createLinkMutation.isPending && <LoaderCircle className="size-4 animate-spin" />}
              Create link
            </Button>
          </div>

          {createLinkMutation.isError && (
            <p className="text-sm text-destructive">Failed to create link.</p>
          )}

          {createdLink && (
            <div className="flex items-center gap-2">
              <Input value={linkUrl} readOnly aria-label="Share link URL" />
              <Button variant="outline" size="icon" onClick={copyLink} aria-label="Copy share link">
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              </Button>
            </div>
          )}

          {links.isLoading && <p className="text-sm text-muted-foreground">Loading links…</p>}
          {links.isError && <p className="text-sm text-destructive">Failed to load links.</p>}

          {links.data && links.data.length > 0 && (
            <ul className="flex flex-col gap-1.5">
              {links.data.map((link) => (
                <li key={link.id} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2">
                  <div className="text-sm">
                    <div className="font-medium">{link.level}</div>
                    <div className="text-xs text-muted-foreground">
                      {link.expiresAt ? `Expires ${new Date(link.expiresAt).toLocaleDateString()}` : "Never expires"}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Revoke link ${link.id}`}
                    onClick={() => revokeMutation.mutate(link.id)}
                    disabled={revokeMutation.isPending}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
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
