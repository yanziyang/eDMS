import { useEffect, useMemo, useState } from "react";
import { Folder, Users } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { listLibraries } from "@/features/documents/api";
import { listGroups } from "@/features/groups/api";
import { listSites } from "@/features/sites/api";
import type { GroupDto, LibraryDto, SiteDto } from "@/types/api";

export function SiteHome() {
  const { siteSlug } = useParams();
  const [sites, setSites] = useState<SiteDto[]>([]);
  const [groups, setGroups] = useState<GroupDto[]>([]);
  const [libraries, setLibraries] = useState<LibraryDto[]>([]);
  const [loading, setLoading] = useState(true);

  const site = useMemo(() => sites.find((item) => item.urlSlug === siteSlug), [sites, siteSlug]);

  useEffect(() => {
    (async () => {
      try {
        const result = await listSites();
        setSites(result);
        const match = result.find((item) => item.urlSlug === siteSlug);
        if (match) {
          const [groupResult, libraryResult] = await Promise.all([
            listGroups(match.id),
            listLibraries(match.id),
          ]);
          setGroups(groupResult);
          setLibraries(libraryResult);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [siteSlug]);

  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading…</div>;
  }

  if (!site) {
    return <div className="text-sm text-muted-foreground">Site not found.</div>;
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">{site.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{site.description || "No description"}</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold">Libraries</h2>
          <div className="flex flex-col gap-2">
            {libraries.map((library) => (
              <Link
                key={library.id}
                to={`/sites/${site.urlSlug}/libraries/${library.id}`}
                className="flex items-center gap-2 rounded-lg border bg-card p-5 font-medium hover:bg-muted/50"
              >
                <Folder className="size-4 text-primary" />
                {library.name}
              </Link>
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold">Permission groups</h2>
          <div className="flex flex-col gap-2">
            {groups.map((group) => (
              <div
                key={group.id}
                className="flex items-center justify-between rounded-lg border bg-card px-4 py-3"
              >
                <div className="flex items-center gap-2 text-sm">
                  <Users className="size-4 text-muted-foreground" />
                  {group.name}
                </div>
                <span className="text-xs text-muted-foreground">
                  {group.memberIds.length} members
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
