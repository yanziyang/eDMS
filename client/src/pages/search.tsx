import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search as SearchIcon } from "lucide-react";
import { EmptyState, PageHeader, Surface } from "@/components/app/page-frame";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { search } from "@/features/search/api";
import { queryKeys } from "@/lib/queryKeys";

export function Search() {
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");

  const searchQuery = useQuery({
    queryKey: queryKeys.search.results(query),
    queryFn: () => search(query),
    enabled: query.trim() !== "",
  });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;
    setQuery(trimmed);
  };

  const loading = searchQuery.isFetching;
  const results = searchQuery.data ?? [];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Search"
        description="Find documents across the sites and libraries you can access."
      />

      <Surface className="p-4 sm:p-5">
        <form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row">
          <Input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Search documents…"
            aria-label="Search documents"
            className="min-w-0 flex-1"
          />
          <Button type="submit" disabled={loading}>
            <SearchIcon className="size-4" />
            {loading ? "Searching…" : "Search"}
          </Button>
        </form>
      </Surface>

      <Surface className="overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b px-5 py-4">
          <div>
            <h2 className="font-semibold">Results</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {query ? `Matches for “${query}”` : "Enter a term to search your documents."}
            </p>
          </div>
          {query && <span className="text-sm text-muted-foreground">{results.length}</span>}
        </div>
        <div className="flex flex-col gap-2 p-4 sm:p-5">
        {searchQuery.isError && (
          <p className="text-sm text-destructive">Search failed. Please try again.</p>
        )}
        {results.map((result) => (
          <div key={result.documentId} className="rounded-lg border p-4 transition-colors hover:bg-muted/30">
            <div className="font-medium">{result.name}</div>
            <div className="mt-1 text-xs text-muted-foreground">
              {result.folderPath} · {new Date(result.modifiedAt).toLocaleDateString()}
            </div>
          </div>
        ))}
        {results.length === 0 && !loading && (
          <EmptyState
            icon={<SearchIcon />}
            title="No results."
            description={query ? "Try a broader search term or check your spelling." : "Search results will appear here."}
            className="border-0 bg-transparent"
          />
        )}
        </div>
      </Surface>
    </div>
  );
}
