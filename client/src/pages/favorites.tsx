import { useQuery } from "@tanstack/react-query";
import { BookOpen, Building2, FileText, Folder, Star } from "lucide-react";
import { Link } from "react-router-dom";
import { FavoriteToggle } from "@/features/favorites/components/FavoriteToggle";
import { listFavorites } from "@/features/favorites/api";
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
  const favorites = useQuery({
    queryKey: queryKeys.me.favorites(),
    queryFn: listFavorites,
  });

  if (favorites.isLoading) {
    return <div className="text-sm text-muted-foreground">Loading favorites…</div>;
  }

  if (favorites.isError) {
    return <div className="text-sm text-destructive">Failed to load favorites.</div>;
  }

  const items = favorites.data ?? [];

  return (
    <div>
      <div className="mb-6 flex items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <Star className="size-5 text-primary" />
            Favorites
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your pinned sites, libraries, folders, and documents.
          </p>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
          You have no favorites yet.
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {favoriteGroups.map((group) => {
            const groupItems = items.filter((item) => item.objectType === group.type);
            if (groupItems.length === 0) {
              return null;
            }

            return (
              <section key={group.type} aria-labelledby={`favorites-${group.type}`}>
                <h2
                  id={`favorites-${group.type}`}
                  className="mb-2 flex items-center gap-2 text-sm font-semibold"
                >
                  <group.icon className="size-4 text-muted-foreground" />
                  {group.label}
                </h2>
                <div className="flex flex-col gap-2">
                  {groupItems.map((item) => (
                    <FavoriteRow key={`${item.objectType}-${item.objectId}`} item={item} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function FavoriteRow({ item }: { item: FavoriteItemDto }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3">
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
