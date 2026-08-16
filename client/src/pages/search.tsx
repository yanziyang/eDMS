import { useState } from "react";
import { Search as SearchIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { search, type SearchResultItem } from "@/features/search/api";

export function Search() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setError(false);
    try {
      setResults(await search(query.trim()));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-semibold">Search</h1>
      <form onSubmit={submit} className="mt-4 flex gap-2">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search documents…"
          className="max-w-md"
        />
        <Button type="submit" disabled={loading}>
          <SearchIcon className="size-4" />
          {loading ? "Searching…" : "Search"}
        </Button>
      </form>

      <div className="mt-6 flex flex-col gap-2">
        {error && (
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
