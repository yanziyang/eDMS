import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { followItem, listSubscriptions, unfollowItem } from "@/features/notifications/api";
import { queryKeys } from "@/lib/queryKeys";
import type { AlertFrequency, FollowableObjectType } from "@/types/api";

interface FollowToggleProps {
  objectType: FollowableObjectType;
  objectId: string;
  itemName?: string;
}

const labels: Record<FollowableObjectType, string> = {
  Site: "site",
  Library: "library",
  Folder: "folder",
  Document: "document",
};

export function FollowToggle({ objectType, objectId, itemName }: FollowToggleProps) {
  const queryClient = useQueryClient();
  const label = labels[objectType];
  const subscriptions = useQuery({
    queryKey: queryKeys.notifications.subscriptions(),
    queryFn: listSubscriptions,
    retry: false,
  });
  const subscription = subscriptions.data?.find(
    (item) => item.objectType === objectType && item.objectId === objectId,
  );
  const follow = useMutation({
    mutationFn: (frequency: AlertFrequency) => followItem(objectType, objectId, frequency),
    onSuccess: () => {
      toast.success(`Following ${label}`);
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.subscriptions() });
    },
    onError: () => toast.error(`Failed to follow ${label}`),
  });
  const unfollow = useMutation({
    mutationFn: () => unfollowItem(objectType, objectId),
    onSuccess: () => {
      toast.success(`Unfollowed ${label}`);
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.subscriptions() });
    },
    onError: () => toast.error(`Failed to unfollow ${label}`),
  });

  if (subscriptions.isLoading) {
    return null;
  }

  if (!subscription) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        title={itemName ? `Follow ${itemName}` : `Follow ${label}`}
        onClick={() => follow.mutate("Immediate")}
        disabled={follow.isPending}
      >
        <Bell data-icon="inline-start" />
        Follow
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <Select
        value={subscription.frequency}
        onValueChange={(value) => follow.mutate(value as AlertFrequency)}
      >
        <SelectTrigger className="w-28" aria-label="Alert frequency">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>Alerts</SelectLabel>
            <SelectItem value="Immediate">Immediate</SelectItem>
            <SelectItem value="Daily">Daily</SelectItem>
            <SelectItem value="Weekly">Weekly</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        title={itemName ? `Unfollow ${itemName}` : `Unfollow ${label}`}
        onClick={() => unfollow.mutate()}
        disabled={unfollow.isPending}
      >
        Unfollow
      </Button>
    </div>
  );
}
