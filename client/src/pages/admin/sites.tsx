import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createSite, deleteSite, listSites } from "@/features/sites/api";
import type { SiteDto } from "@/types/api";

export function AdminSites() {
  const [sites, setSites] = useState<SiteDto[]>([]);
  const [name, setName] = useState("");
  const [urlSlug, setUrlSlug] = useState("");

  const reload = () => listSites().then(setSites);
  useEffect(() => {
    reload();
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    await createSite({ name, urlSlug });
    setName("");
    setUrlSlug("");
    await reload();
  };

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={submit} className="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-4">
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Name</span>
          <Input value={name} onChange={(event) => setName(event.target.value)} required />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">URL slug</span>
          <Input value={urlSlug} onChange={(event) => setUrlSlug(event.target.value)} required />
        </div>
        <Button type="submit">Create site</Button>
      </form>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50 text-left">
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium">Slug</th>
              <th className="px-4 py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sites.map((site) => (
              <tr key={site.id} className="border-b last:border-0">
                <td className="px-4 py-2">{site.name}</td>
                <td className="px-4 py-2 text-muted-foreground">{site.urlSlug}</td>
                <td className="px-4 py-2">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={async () => {
                      await deleteSite(site.id);
                      await reload();
                    }}
                  >
                    Delete
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
