import { Copy, Download, Eye, FileSearch, History, Lock, Move, Pencil, Share2, ShieldCheck, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import type { LibraryItem } from "@/types";

export function ItemContextMenu({
  item,
  favorite,
  children,
  onOpen,
  onPreview,
  onFavorite,
  onRename,
  onMove,
  onCopy,
  onVersions,
  onCheckout,
  onPermissions,
  onShare,
  onDelete,
}: {
  item: LibraryItem;
  favorite: boolean;
  children: React.ReactNode;
  onOpen: () => void;
  onPreview: () => void;
  onFavorite: () => void;
  onRename: () => void;
  onMove: () => void;
  onCopy: () => void;
  onVersions: () => void;
  onCheckout: () => void;
  onPermissions: () => void;
  onShare: () => void;
  onDelete: () => void;
}) {
  const isFolder = item.type === "folder";
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-[220px]">
        <ContextMenuItem onSelect={onOpen}>
          <Eye data-icon="inline-start" />
          Open
        </ContextMenuItem>
        {!isFolder && (
          <ContextMenuItem onSelect={onPreview}>
            <FileSearch data-icon="inline-start" />
            Preview
          </ContextMenuItem>
        )}
        {!isFolder && (
          <ContextMenuItem onSelect={() => toast.info(`Downloading ${item.name}…`)}>
            <Download data-icon="inline-start" />
            Download
          </ContextMenuItem>
        )}
        <ContextMenuItem onSelect={onFavorite}>
          <Star data-icon="inline-start" className={favorite ? "fill-current text-amber-500" : undefined} />
          {favorite ? "Remove from favorites" : "Add to favorites"}
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onSelect={onRename}>
          <Pencil data-icon="inline-start" />
          Rename
        </ContextMenuItem>
        <ContextMenuItem onSelect={onMove}>
          <Move data-icon="inline-start" />
          Move to
        </ContextMenuItem>
        {!isFolder && (
          <ContextMenuItem onSelect={onCopy}>
            <Copy data-icon="inline-start" />
            Copy to
          </ContextMenuItem>
        )}
        <ContextMenuSeparator />
        {!isFolder && (
          <>
            <ContextMenuItem onSelect={onVersions}>
              <History data-icon="inline-start" />
              Version history
            </ContextMenuItem>
            <ContextMenuItem onSelect={onCheckout}>
              <Lock data-icon="inline-start" />
              Check out / in
            </ContextMenuItem>
          </>
        )}
        <ContextMenuItem onSelect={onPermissions}>
          <ShieldCheck data-icon="inline-start" />
          Manage access
        </ContextMenuItem>
        <ContextMenuItem onSelect={onShare}>
          <Share2 data-icon="inline-start" />
          Share
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem variant="destructive" onSelect={onDelete}>
          <Trash2 data-icon="inline-start" />
          Delete
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
