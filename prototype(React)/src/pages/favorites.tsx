import { Building2, FileText, Folder, LibraryBig, Star, X } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { EmptyState, PageHeader } from "@/components/app/bits";
import { FileIcon } from "@/components/app/file-icon";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { db, toggleFavorite, useDb } from "@/lib/store";
import type { FavoriteEntry, FavoriteType } from "@/types";
import { cn } from "@/lib/utils";

const filters: Array<{ id: "all" | FavoriteType; label: string }> = [
  { id: "all", label: "All" },
  { id: "site", label: "Sites" },
  { id: "library", label: "Libraries" },
  { id: "folder", label: "Folders" },
  { id: "document", label: "Documents" },
];

export function Favorites() {
  useDb();
  const [filter, setFilter] = useState<(typeof filters)[number]["id"]>("all");
  const entries = db.favorites
    .map((key) => db.favoriteEntries[key])
    .filter((entry): entry is FavoriteEntry => !!entry)
    .filter((entry) => filter === "all" || entry.type === filter);

  return (
    <div>
      <PageHeader
        title="Favorites"
        subtitle="Quick access to the sites, libraries, folders, and documents you pin."
      />

      <div className="mb-4 flex flex-wrap gap-1 rounded-[var(--radius)] border bg-card p-1" role="tablist" aria-label="Favorite type">
        {filters.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={filter === item.id}
            onClick={() => setFilter(item.id)}
            className={cn(
              "rounded-[calc(var(--radius)-3px)] px-3 py-1.5 text-[13px] font-medium text-muted-foreground hover:text-foreground",
              filter === item.id && "bg-accent text-accent-foreground"
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {entries.length === 0 ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={<Star className="size-6" />}
              title="No favorites yet"
              description="Use the star action on a site, library, folder, or document to keep it close at hand."
            />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-2">
            {entries.map((entry) => (
              <FavoriteRow key={entry.key} entry={entry} />
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function FavoriteRow({ entry }: { entry: FavoriteEntry }) {
  const icon =
    entry.type === "site" ? <Building2 className="size-4" /> :
    entry.type === "library" ? <LibraryBig className="size-4" /> :
    entry.type === "folder" ? <Folder className="size-4" /> :
    <FileText className="size-4" />;

  return (
    <div className="flex items-center gap-3 rounded-[calc(var(--radius)-4px)] px-3 py-3 hover:bg-muted/45">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-[9px] bg-accent text-accent-foreground">
        {entry.type === "document" ? <FileIcon item={{ type: "file", ext: entry.ext }} size={36} className="size-9" iconClassName="size-4" /> : icon}
      </span>
      <Link to={entry.href} className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{entry.name}</div>
        <div className="mt-0.5 truncate text-xs text-muted-foreground">{entry.detail}</div>
      </Link>
      <Button
        variant="ghost"
        size="icon-sm"
        className="shrink-0 text-amber-500 hover:text-amber-600"
        aria-label={`Remove ${entry.name} from favorites`}
        onClick={() => toggleFavorite(entry)}
      >
        <Star className="fill-current" />
      </Button>
      <X className="hidden size-3.5 text-muted-foreground sm:block" aria-hidden="true" />
    </div>
  );
}
