import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { me } from "@/features/auth/api";
import { queryKeys } from "@/lib/queryKeys";

export function Profile() {
  const meQuery = useQuery({
    queryKey: queryKeys.me.current(),
    queryFn: me,
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold">My Profile</h1>
      {meQuery.isLoading && <p className="mt-4 text-sm text-muted-foreground">Loading…</p>}
      {meQuery.isError && (
        <p className="mt-4 text-sm text-destructive">Failed to load profile.</p>
      )}
      {meQuery.data && (
        <div className="mt-4 max-w-md rounded-lg border bg-card p-4">
          <div className="font-medium">{meQuery.data.displayName}</div>
          <div className="mt-1 text-sm text-muted-foreground">{meQuery.data.email}</div>
          {meQuery.data.isSystemAdmin && (
            <Badge className="mt-3">System admin</Badge>
          )}
        </div>
      )}
    </div>
  );
}
