import { useMemo, useState } from "react";
import { FileSearch, Search as SearchIcon } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { CheckoutBadge, EmptyState, PageHeader, TagBadges } from "@/components/app/bits";
import { FileIcon } from "@/components/app/file-icon";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Separator } from "@/components/ui/separator";
import { fmtDate } from "@/lib/helpers";
import { SEARCH_INDEX } from "@/lib/mock-data";
import { db, openDocSheet } from "@/lib/store";

export function Search() {
  const [searchParams, setSearchParams] = useSearchParams();
  const q = searchParams.get("q") ?? "";
  const [input, setInput] = useState(q);
  const [siteFilters, setSiteFilters] = useState<Set<string>>(new Set());
  const [typeFilters, setTypeFilters] = useState<Set<string>>(new Set());

  const runSearch = () => {
    const next = new URLSearchParams(searchParams);
    if (input.trim()) next.set("q", input.trim());
    else next.delete("q");
    setSearchParams(next, { replace: true });
  };

  const results = useMemo(() => {
    const query = q.toLowerCase();
    return SEARCH_INDEX.filter((d) => {
      const matchesQ =
        !query || d.name.toLowerCase().includes(query) || (d.tags || []).some((t) => t.toLowerCase().includes(query));
      const matchesSite = siteFilters.size === 0 || siteFilters.has(d.site);
      const matchesType = typeFilters.size === 0 || typeFilters.has(d.ext ?? "");
      return matchesQ && matchesSite && matchesType;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, siteFilters, typeFilters]);

  return (
    <div>
      <PageHeader
        title="Search"
        subtitle="Results are scoped to sites and libraries you have at least Read access to."
      />

      <div className="mb-6 flex max-w-[640px] gap-2">
        <InputGroup className="h-9 flex-1">
          <InputGroupAddon>
            <SearchIcon />
          </InputGroupAddon>
          <InputGroupInput
            placeholder="Search by file name or tag…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && runSearch()}
          />
        </InputGroup>
        <Button onClick={runSearch} size="lg">
          Search
        </Button>
      </div>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[220px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-2 text-xs font-semibold uppercase tracking-[0.04em] text-muted-foreground">
              Site
            </div>
            <div className="mb-4 flex flex-col gap-2">
              {db.sites.map((s) => (
                <FilterCheck
                  key={s.slug}
                  id={`sf-${s.slug}`}
                  label={
                    <>
                      <span className="mr-1 inline-block size-2 rounded-full" style={{ background: s.color }} />
                      {s.name}
                    </>
                  }
                  checked={siteFilters.has(s.slug)}
                  onToggle={() =>
                    setSiteFilters((prev) => {
                      const next = new Set(prev);
                      if (next.has(s.slug)) next.delete(s.slug);
                      else next.add(s.slug);
                      return next;
                    })
                  }
                />
              ))}
            </div>
            <Separator className="my-4" />
            <div className="mb-2 text-xs font-semibold uppercase tracking-[0.04em] text-muted-foreground">
              File type
            </div>
            <div className="flex flex-col gap-2">
              {(
                [
                  ["pdf", "PDF"],
                  ["docx", "Word"],
                  ["xlsx", "Excel"],
                  ["pptx", "PowerPoint"],
                ] as const
              ).map(([value, label]) => (
                <FilterCheck
                  key={value}
                  id={`ft-${value}`}
                  label={label}
                  checked={typeFilters.has(value)}
                  onToggle={() =>
                    setTypeFilters((prev) => {
                      const next = new Set(prev);
                      if (next.has(value)) next.delete(value);
                      else next.add(value);
                      return next;
                    })
                  }
                />
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="min-w-0">
          <div className="mb-3 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{results.length}</span> results for{" "}
            <span className="font-medium text-foreground">{q ? `“${q}”` : "all documents"}</span>
          </div>
          {results.length === 0 ? (
            <Card>
              <EmptyState
                icon={<FileSearch className="size-6" />}
                title="No matching documents"
                description="Try a different search term or clear filters."
              />
            </Card>
          ) : (
            results.map((d) => (
              <button
                key={`${d.site}/${d.lib}/${d.folder}/${d.name}`}
                type="button"
                className="mb-2.5 flex w-full items-center gap-3.5 rounded-[var(--radius)] border bg-card px-4 py-3.5 text-left hover:bg-muted/40"
                onClick={() => openDocSheet({ ...d }, "properties")}
              >
                <FileIcon item={d} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 text-sm font-medium">
                    <span className="truncate">{d.name}</span>
                    <CheckoutBadge checkedOutBy={d.checkedOutBy} />
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {d.siteName} · modified {fmtDate(d.modified)} by {d.modifiedBy}
                  </div>
                  {d.tags?.length ? (
                    <div className="mt-1 flex gap-1">
                      <TagBadges tags={d.tags} />
                    </div>
                  ) : null}
                </div>
                <span className="hidden shrink-0 text-xs text-muted-foreground md:inline">{d.size}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function FilterCheck({
  id,
  label,
  checked,
  onToggle,
}: {
  id: string;
  label: React.ReactNode;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <Checkbox id={id} checked={checked} onCheckedChange={onToggle} />
      <label htmlFor={id} className="cursor-pointer text-[13px]">
        {label}
      </label>
    </div>
  );
}
