import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { me } from "@/features/auth/api";
import { followItem, listSubscriptions, unfollowItem } from "@/features/notifications/api";
import { queryKeys } from "@/lib/queryKeys";
import { toast } from "sonner";
import type { AlertFrequency } from "@/types/api";

export function Profile() {
  const queryClient = useQueryClient();
  const meQuery = useQuery({
    queryKey: queryKeys.me.current(),
    queryFn: me,
  });
  const subscriptions = useQuery({
    queryKey: queryKeys.notifications.subscriptions(),
    queryFn: listSubscriptions,
  });
  const updateSubscription = useMutation({
    mutationFn: ({
      objectType,
      objectId,
      frequency,
    }: {
      objectType: "Document" | "Folder";
      objectId: string;
      frequency: AlertFrequency;
    }) => followItem(objectType, objectId, frequency),
    onSuccess: () => {
      toast.success("Alert frequency updated");
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.subscriptions() });
    },
    onError: () => toast.error("Failed to update alert frequency"),
  });
  const removeSubscription = useMutation({
    mutationFn: ({ objectType, objectId }: { objectType: "Document" | "Folder"; objectId: string }) =>
      unfollowItem(objectType, objectId),
    onSuccess: () => {
      toast.success("Unfollowed");
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.subscriptions() });
    },
    onError: () => toast.error("Failed to unfollow item"),
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold">My Profile</h1>
      {meQuery.isLoading && <p className="mt-4 text-sm text-muted-foreground">Loading…</p>}
      {meQuery.isError && (
        <p className="mt-4 text-sm text-destructive">Failed to load profile.</p>
      )}
      {meQuery.data && (
        <Card className="mt-4 max-w-md">
          <CardHeader>
            <CardTitle>{meQuery.data.displayName}</CardTitle>
            <CardDescription>{meQuery.data.email}</CardDescription>
          </CardHeader>
          <CardContent>
            {meQuery.data.isSystemAdmin && <Badge>System admin</Badge>}
          </CardContent>
        </Card>
      )}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Alert preferences</CardTitle>
          <CardDescription>Choose how often followed documents and folders notify you.</CardDescription>
        </CardHeader>
        <CardContent>
          {subscriptions.isLoading && (
            <p className="text-sm text-muted-foreground">Loading followed items…</p>
          )}
          {subscriptions.isError && (
            <p className="text-sm text-destructive">Failed to load alert preferences.</p>
          )}
          {!subscriptions.isLoading && !subscriptions.isError && subscriptions.data?.length === 0 && (
            <p className="text-sm text-muted-foreground">You are not following any items yet.</p>
          )}
          <div className="flex flex-col gap-3">
            {subscriptions.data?.map((subscription) => (
              <div key={subscription.id} className="flex flex-wrap items-center gap-3 rounded-lg border p-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{subscription.objectName}</div>
                  <div className="text-xs text-muted-foreground">{subscription.objectType}</div>
                </div>
                <Select
                  value={subscription.frequency}
                  onValueChange={(value) =>
                    updateSubscription.mutate({
                      objectType: subscription.objectType,
                      objectId: subscription.objectId,
                      frequency: value as AlertFrequency,
                    })
                  }
                >
                  <SelectTrigger className="w-36" aria-label={`Frequency for ${subscription.objectName}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectLabel>Frequency</SelectLabel>
                      <SelectItem value="Immediate">Immediate</SelectItem>
                      <SelectItem value="Daily">Daily</SelectItem>
                      <SelectItem value="Weekly">Weekly</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    removeSubscription.mutate({
                      objectType: subscription.objectType,
                      objectId: subscription.objectId,
                    })
                  }
                  disabled={removeSubscription.isPending}
                >
                  Unfollow
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
