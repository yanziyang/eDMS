import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, Building2, FileText, Folder, Star } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { EmptyState, PageHeader, Surface } from "@/components/app/page-frame";
import { ItemContextMenu } from "@/components/common/ItemContextMenu";
import { FavoriteToggle } from "@/features/favorites/components/FavoriteToggle";
import { listFavorites, removeFavorite } from "@/features/favorites/api";
import { queryKeys } from "@/lib/queryKeys";
import type { FavoriteItemDto, FavoriteObjectType } from "@/types/api";

const favoriteGroups: Array<{
  type: FavoriteObjectType;
  label: string;
  icon: typeof Building2;
}> = [
  { type: "Site", label: "Sites", icon: Building2 },
  { type: "Library", label: "Libraries", icon: BookOpen },
  { type: "Folder", label: "Folders", icon: Folder },
  { type: "Document", label: "Documents", icon: FileText },
];

export function Favorites() {
  const queryClient = useQueryClient();
  const favorites = useQuery({
    queryKey: queryKeys.me.favorites(),
    queryFn: listFavorites,
  });
  const remove = useMutation({
    mutationFn: (item: FavoriteItemDto) => removeFavorite(item.objectType, item.objectId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.me.favorites() }),
  });

  if (favorites.isLoading) {
    return <div className="text-sm text-muted-foreground">Loading favorites…</div>;
  }

  if (favorites.isError) {
    return <div className="text-sm text-destructive">Failed to load favorites.</div>;
  }

  const items = favorites.data ?? [];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={<span className="flex items-center gap-2"><Star className="size-5 text-primary" />Favorites</span>}
        description="Your pinned sites, libraries, folders, and documents."
      />

      {items.length === 0 ? (
        <EmptyState
          icon={<Star />}
          title="You have no favorites yet."
          description="Favorite a site, library, folder, or document to keep it close at hand."
        />
      ) : (
        <div className="flex flex-col gap-6">
          {favoriteGroups.map((group) => {
            const groupItems = items.filter((item) => item.objectType === group.type);
            if (groupItems.length === 0) {
              return null;
            }

            return (
              <Surface key={group.type} className="overflow-hidden">
                <div className="flex items-center gap-2 border-b px-5 py-4">
                  <group.icon className="size-4 text-primary" />
                  <h2 id={`favorites-${group.type}`} className="font-semibold">{group.label}</h2>
                  <span className="text-xs text-muted-foreground">{groupItems.length}</span>
                </div>
                <div className="flex flex-col gap-2 p-3 sm:p-4">
                  {groupItems.map((item) => (
                    <FavoriteRow
                      key={`${item.objectType}-${item.objectId}`}
                      item={item}
                      onUnfavorite={() => remove.mutate(item)}
                    />
                  ))}
                </div>
              </Surface>
            );
          })}
        </div>
      )}
    </div>
  );
}

function FavoriteRow({ item, onUnfavorite }: { item: FavoriteItemDto; onUnfavorite: () => void }) {
  const navigate = useNavigate();
  const contextItem = favoriteContextItem(item);
  if (contextItem === null) {
    return <FavoriteRowContent item={item} />;
  }

  return (
    <ItemContextMenu
      item={contextItem}
      permissionLevel="Read"
      actions={["open", "unfavorite"]}
      isFavorite
      onAction={(action) => {
        if (action === "open") navigate(favoriteHref(item));
        if (action === "unfavorite") onUnfavorite();
      }}
    >
      <FavoriteRowContent item={item} />
    </ItemContextMenu>
  );
}

function FavoriteRowContent({ item }: { item: FavoriteItemDto }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3 transition-colors hover:bg-muted/30">
      <Link
        to={favoriteHref(item)}
        className="flex min-w-0 flex-1 items-center gap-3 hover:underline"
      >
        <div className="min-w-0">
          <div className="truncate font-medium">{item.name}</div>
          <div className="truncate text-xs text-muted-foreground">{item.location}</div>
        </div>
      </Link>
      <FavoriteToggle objectType={item.objectType} objectId={item.objectId} itemName={item.name} />
    </div>
  );
}

function favoriteContextItem(item: FavoriteItemDto) {
  if (item.objectType !== "Document" && item.objectType !== "Folder") {
    return null;
  }

  return {
    kind: item.objectType === "Document" ? "document" : "folder",
    id: item.objectId,
    name: item.name,
    sizeBytes: 0,
    modifiedAt: new Date(0).toISOString(),
    folderId: item.objectType === "Folder" ? item.objectId : item.folderId,
    documentId: item.objectType === "Document" ? item.objectId : null,
    checkedOutBy: null,
  } as const;
}

function favoriteHref(item: FavoriteItemDto): string {
  switch (item.objectType) {
    case "Site":
      return `/sites/${item.siteSlug}`;
    case "Library":
      return `/sites/${item.siteSlug}/libraries/${item.libraryId}`;
    case "Folder":
      return `/sites/${item.siteSlug}/libraries/${item.libraryId}?folderId=${encodeURIComponent(item.objectId)}`;
    case "Document":
      return `/sites/${item.siteSlug}/libraries/${item.libraryId}?documentId=${encodeURIComponent(item.objectId)}`;
  }
}
