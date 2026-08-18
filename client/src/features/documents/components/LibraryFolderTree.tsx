import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Folder, FolderOpen, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { listFolderItems, listItems } from "@/features/documents/api";
import { queryKeys } from "@/lib/queryKeys";
import { cn } from "@/lib/utils";
import type { ItemDto } from "@/types/api";

interface LibraryFolderTreeProps {
  libraryId: string;
  selectedFolderId: string | null;
  onSelectFolder: (folderId: string | null, folderName: string) => void;
}

export function LibraryFolderTree({
  libraryId,
  selectedFolderId,
  onSelectFolder,
}: LibraryFolderTreeProps) {
  const rootItems = useQuery({
    queryKey: queryKeys.documents.libraryItems(libraryId),
    queryFn: () => listItems(libraryId),
    retry: false,
  });
  const rootFolders = (rootItems.data ?? []).filter((item) => item.kind === "folder");

  return (
    <div className="flex min-w-0 flex-col gap-1" role="tree" aria-label="Library folders">
      <div role="treeitem" aria-level={1} aria-selected={selectedFolderId === null}>
        <Button
          variant={selectedFolderId === null ? "secondary" : "ghost"}
          size="sm"
          className="w-full justify-start gap-2 px-2"
          aria-current={selectedFolderId === null ? "page" : undefined}
          onClick={() => onSelectFolder(null, "All documents")}
        >
          <FolderOpen data-icon="inline-start" />
          <span className="truncate">All documents</span>
        </Button>
      </div>

      {rootItems.isLoading && (
        <div className="flex items-center gap-2 px-2 py-2 text-xs text-muted-foreground" role="status">
          <LoaderCircle className="animate-spin" />
          Loading folders…
        </div>
      )}
      {rootItems.isError && (
        <p className="px-2 py-2 text-xs text-destructive" role="alert">
          Failed to load folders.
        </p>
      )}
      {rootItems.data && rootFolders.length === 0 && (
        <p className="px-2 py-2 text-xs text-muted-foreground">No folders yet.</p>
      )}
      {rootFolders.map((folder) => (
        <FolderTreeNode
          key={folder.folderId ?? folder.id}
          folder={folder}
          level={1}
          selectedFolderId={selectedFolderId}
          onSelectFolder={onSelectFolder}
        />
      ))}
    </div>
  );
}

function FolderTreeNode({
  folder,
  level,
  selectedFolderId,
  onSelectFolder,
}: {
  folder: ItemDto;
  level: number;
  selectedFolderId: string | null;
  onSelectFolder: (folderId: string | null, folderName: string) => void;
}) {
  const folderId = folder.folderId ?? folder.id;
  const [expanded, setExpanded] = useState(false);
  const children = useQuery({
    queryKey: queryKeys.folders.items(folderId),
    queryFn: () => listFolderItems(folderId),
    enabled: expanded,
    retry: false,
  });
  const childFolders = (children.data ?? []).filter((item) => item.kind === "folder");
  const isSelected = selectedFolderId === folderId;

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "ArrowRight" && !expanded) {
      event.preventDefault();
      setExpanded(true);
    }
    if (event.key === "ArrowLeft" && expanded) {
      event.preventDefault();
      setExpanded(false);
    }
  };

  return (
    <div
      role="treeitem"
      aria-level={level + 1}
      aria-selected={isSelected}
      className="flex min-w-0 flex-col gap-1"
    >
      <div className={cn("flex min-w-0 items-center gap-1", level > 0 && "ml-3 border-l pl-2")}>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={`${expanded ? "Collapse" : "Expand"} ${folder.name}`}
          aria-expanded={expanded}
          onClick={() => setExpanded((current) => !current)}
        >
          {expanded ? <ChevronDown data-icon="inline-start" /> : <ChevronRight data-icon="inline-start" />}
        </Button>
        <Button
          variant={isSelected ? "secondary" : "ghost"}
          size="sm"
          className="min-w-0 flex-1 justify-start gap-2 px-2"
          aria-label={`Open folder ${folder.name}`}
          aria-current={isSelected ? "page" : undefined}
          onClick={() => onSelectFolder(folderId, folder.name)}
          onKeyDown={handleKeyDown}
        >
          {expanded ? <FolderOpen data-icon="inline-start" /> : <Folder data-icon="inline-start" />}
          <span className="truncate">{folder.name}</span>
        </Button>
      </div>

      {expanded && (
        <div role="group" className="flex min-w-0 flex-col gap-1">
          {children.isLoading && (
            <div className="flex items-center gap-2 py-1 pl-10 text-xs text-muted-foreground" role="status">
              <LoaderCircle className="animate-spin" />
              Loading…
            </div>
          )}
          {children.isError && (
            <p className="py-1 pl-10 text-xs text-destructive" role="alert">
              Failed to load subfolders.
            </p>
          )}
          {children.data && childFolders.length === 0 && (
            <p className="py-1 pl-10 text-xs text-muted-foreground">No subfolders.</p>
          )}
          {childFolders.map((child) => (
            <FolderTreeNode
              key={child.folderId ?? child.id}
              folder={child}
              level={level + 1}
              selectedFolderId={selectedFolderId}
              onSelectFolder={onSelectFolder}
            />
          ))}
        </div>
      )}
    </div>
  );
}
