import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Building2 } from "lucide-react";
import { Surface } from "@/components/app/page-frame";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createSite, deleteSite, listSites } from "@/features/sites/api";
import { ApiError } from "@/lib/api-client";
import { queryKeys } from "@/lib/queryKeys";
import type { SiteDto } from "@/types/api";

function toUrlSlug(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 128)
    .replace(/-+$/, "");
}

function siteCreationErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return "Failed to create site";
  }

  const validationMessage = Object.values(error.problem.errors ?? {})
    .flat()
    .find(Boolean);
  return error.problem.detail ?? validationMessage ?? "Failed to create site";
}

export function AdminSites() {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [urlSlug, setUrlSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);

  const sitesQuery = useQuery({
    queryKey: queryKeys.sites.list(),
    queryFn: listSites,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: queryKeys.sites.list() });

  const create = useMutation({
    mutationFn: () => createSite({ name, urlSlug }),
    onSuccess: () => {
      setName("");
      setUrlSlug("");
      setSlugEdited(false);
      toast.success("Site created");
      invalidate();
    },
    onError: (error) => toast.error(siteCreationErrorMessage(error)),
  });

  const remove = useMutation({
    mutationFn: (site: SiteDto) => deleteSite(site.id),
    onSuccess: () => {
      toast.success("Site deleted");
      invalidate();
    },
    onError: () => toast.error("Failed to delete site"),
  });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    create.mutate();
  };

  return (
    <div className="flex flex-col gap-6">
      <Surface>
        <form onSubmit={submit} className="flex flex-wrap items-start gap-4 p-5">
          <div className="min-w-52 flex-1">
            <Label htmlFor="site-name" className="text-xs text-muted-foreground">Name</Label>
            <Input
              id="site-name"
              className="mt-1.5"
              value={name}
              onChange={(event) => {
                const nextName = event.target.value;
                setName(nextName);
                if (!slugEdited) {
                  setUrlSlug(toUrlSlug(nextName));
                }
              }}
              required
            />
          </div>
          <div className="min-w-64 flex-1">
            <Label htmlFor="site-slug" className="text-xs text-muted-foreground">URL slug</Label>
            <Input
              id="site-slug"
              className="mt-1.5"
              value={urlSlug}
              onChange={(event) => {
                setSlugEdited(true);
                setUrlSlug(event.target.value);
              }}
              aria-describedby="site-slug-help"
              required
            />
            <p id="site-slug-help" className="mt-1.5 text-xs text-muted-foreground">
              Lowercase letters, numbers, and single hyphens. Generated from the name unless edited.
            </p>
          </div>
          <Button type="submit" className="mt-6" disabled={create.isPending}>Create site</Button>
        </form>
      </Surface>

      <Surface className="overflow-hidden">
        <div className="flex items-center gap-2 border-b px-5 py-4">
          <Building2 className="size-4 text-primary" />
          <div>
            <h2 className="font-semibold">Available sites</h2>
            <p className="text-sm text-muted-foreground">Workspaces and their URL slugs.</p>
          </div>
        </div>
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-left">
              <th className="px-5 py-3 font-medium">Name</th>
              <th className="px-5 py-3 font-medium">Slug</th>
              <th className="px-5 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(sitesQuery.data ?? []).map((site) => (
              <tr key={site.id} className="border-b transition-colors last:border-0 hover:bg-muted/30">
                <td className="px-5 py-3 font-medium">{site.name}</td>
                <td className="px-5 py-3 text-muted-foreground">{site.urlSlug}</td>
                <td className="px-5 py-3">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => remove.mutate(site)}
                    disabled={remove.isPending}
                  >
                    Delete
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </Surface>
    </div>
  );
}
