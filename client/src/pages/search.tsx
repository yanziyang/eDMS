import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search as SearchIcon } from "lucide-react";
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
    <div>
      <h1 className="text-2xl font-semibold">Search</h1>
      <form onSubmit={submit} className="mt-4 flex gap-2">
        <Input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Search documents…"
          className="max-w-md"
        />
        <Button type="submit" disabled={loading}>
          <SearchIcon className="size-4" />
          {loading ? "Searching…" : "Search"}
        </Button>
      </form>

      <div className="mt-6 flex flex-col gap-2">
        {searchQuery.isError && (
          <p className="text-sm text-destructive">Search failed. Please try again.</p>
        )}
        {results.map((result) => (
          <div key={result.documentId} className="rounded-lg border bg-card p-4">
            <div className="font-medium">{result.name}</div>
            <div className="mt-1 text-xs text-muted-foreground">
              {result.folderPath} · {new Date(result.modifiedAt).toLocaleDateString()}
            </div>
          </div>
        ))}
        {results.length === 0 && !loading && (
          <p className="text-sm text-muted-foreground">No results.</p>
        )}
      </div>
    </div>
  );
}
