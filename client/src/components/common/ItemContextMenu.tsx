import { Fragment, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Bell,
  BellOff,
  Download,
  FolderOpen,
  Lock,
  LockOpen,
  MoveRight,
  Pencil,
  RotateCcw,
  Share2,
  Star,
  StarOff,
  Trash2,
} from "lucide-react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import type { ItemDto, PermissionLevel } from "@/types/api";

export type ItemContextAction =
  | "open"
  | "download"
  | "rename"
  | "move-copy"
  | "delete"
  | "share"
  | "check-out"
  | "check-in"
  | "follow"
  | "unfollow"
  | "favorite"
  | "unfavorite"
  | "restore"
  | "permanently-delete";

interface ItemContextMenuProps {
  item: ItemDto;
  permissionLevel: PermissionLevel;
  children: ReactNode;
  onAction?: (action: ItemContextAction) => void;
  actions?: readonly ItemContextAction[];
  isFavorite?: boolean;
  isFollowed?: boolean;
  checkedOutByMe?: boolean;
}

const permissionRank: Record<PermissionLevel, number> = {
  FullControl: 0,
  Contribute: 1,
  Read: 2,
  NoAccess: 3,
};

const actionMeta: Record<ItemContextAction, { label: string; icon: LucideIcon; required: PermissionLevel; group: number }> = {
  open: { label: "Open", icon: FolderOpen, required: "Read", group: 0 },
  download: { label: "Download", icon: Download, required: "Read", group: 0 },
  rename: { label: "Rename", icon: Pencil, required: "Contribute", group: 1 },
  "move-copy": { label: "Move / Copy", icon: MoveRight, required: "Contribute", group: 1 },
  delete: { label: "Delete", icon: Trash2, required: "Contribute", group: 1 },
  share: { label: "Share", icon: Share2, required: "Contribute", group: 1 },
  "check-out": { label: "Check out", icon: Lock, required: "Contribute", group: 2 },
  "check-in": { label: "Check in", icon: LockOpen, required: "Contribute", group: 2 },
  follow: { label: "Follow", icon: Bell, required: "Read", group: 2 },
  unfollow: { label: "Unfollow", icon: BellOff, required: "Read", group: 2 },
  favorite: { label: "Favorite", icon: Star, required: "Read", group: 2 },
  unfavorite: { label: "Unfavorite", icon: StarOff, required: "Read", group: 2 },
  restore: { label: "Restore", icon: RotateCcw, required: "Contribute", group: 3 },
  "permanently-delete": { label: "Permanently delete", icon: Trash2, required: "Contribute", group: 3 },
};

function defaultActions(item: ItemDto, checkedOutByMe: boolean): ItemContextAction[] {
  const actions: ItemContextAction[] = ["open"];
  if (item.kind === "document") actions.push("download");
  actions.push("rename");
  if (item.kind === "document") {
    actions.push("move-copy", "share");
    if (item.checkedOutBy === null) actions.push("check-out");
    else if (checkedOutByMe) actions.push("check-in");
  }
  actions.push("delete", "follow", "favorite");
  return actions;
}

function isAllowed(action: ItemContextAction, item: ItemDto, permissionLevel: PermissionLevel): boolean {
  if (permissionRank[permissionLevel] > permissionRank[actionMeta[action].required]) return false;
  if (["download", "move-copy", "share", "check-out", "check-in"].includes(action)) {
    return item.kind === "document";
  }
  return true;
}

function resolvedAction(action: ItemContextAction, isFavorite: boolean, isFollowed: boolean): ItemContextAction {
  if (action === "favorite") return isFavorite ? "unfavorite" : "favorite";
  if (action === "unfavorite") return isFavorite ? "unfavorite" : "favorite";
  if (action === "follow") return isFollowed ? "unfollow" : "follow";
  if (action === "unfollow") return isFollowed ? "unfollow" : "follow";
  return action;
}

function actionLabel(action: ItemContextAction, isFavorite: boolean, isFollowed: boolean): string {
  if (action === "favorite" || action === "unfavorite") return isFavorite ? "Unfavorite" : "Favorite";
  if (action === "follow" || action === "unfollow") return isFollowed ? "Unfollow" : "Follow";
  return actionMeta[action].label;
}

export function ItemContextMenu({
  item,
  permissionLevel,
  children,
  onAction,
  actions,
  isFavorite = false,
  isFollowed = false,
  checkedOutByMe = false,
}: ItemContextMenuProps) {
  const visibleActions = (actions ?? defaultActions(item, checkedOutByMe))
    .map((action) => resolvedAction(action, isFavorite, isFollowed))
    .filter((action, index, all) => all.indexOf(action) === index)
    .filter((action) => isAllowed(action, item, permissionLevel));

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent aria-label={`${item.name} actions`}>
        {visibleActions.length === 0 ? (
          <ContextMenuItem disabled>No actions available</ContextMenuItem>
        ) : (
          visibleActions.map((action, index) => {
            const Icon = actionMeta[action].icon;
            const previous = visibleActions[index - 1];
            const separate = index > 0 && previous !== undefined && actionMeta[action].group !== actionMeta[previous].group;
            return (
              <Fragment key={action}>
                {separate && <ContextMenuSeparator />}
                <ContextMenuItem onSelect={() => onAction?.(action)}>
                  <Icon />
                  {actionLabel(action, isFavorite, isFollowed)}
                </ContextMenuItem>
              </Fragment>
            );
          })
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}

export function itemObjectId(item: ItemDto): string {
  return item.kind === "document" ? item.documentId ?? item.id : item.folderId ?? item.id;
}

export function itemObjectType(item: ItemDto): "Document" | "Folder" {
  return item.kind === "document" ? "Document" : "Folder";
}
