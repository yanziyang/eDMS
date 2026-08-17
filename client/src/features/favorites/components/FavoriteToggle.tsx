import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Star } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { addFavorite, listFavorites, removeFavorite } from "@/features/favorites/api";
import { queryKeys } from "@/lib/queryKeys";
import type { FavoriteObjectType } from "@/types/api";

interface FavoriteToggleProps {
  objectType: FavoriteObjectType;
  objectId: string;
  itemName?: string;
}

export function FavoriteToggle({ objectType, objectId, itemName }: FavoriteToggleProps) {
  const queryClient = useQueryClient();
  const favorites = useQuery({
    queryKey: queryKeys.me.favorites(),
    queryFn: listFavorites,
  });
  const isFavorite = favorites.data?.some(
    (item) => item.objectType === objectType && item.objectId === objectId,
  ) ?? false;

  const toggle = useMutation({
    mutationFn: () =>
      isFavorite ? removeFavorite(objectType, objectId) : addFavorite(objectType, objectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.me.favorites() });
      toast.success(isFavorite ? "Removed from favorites" : "Added to favorites");
    },
    onError: () => toast.error("Failed to update favorites"),
  });

  const action = isFavorite ? "Remove from favorites" : "Add to favorites";
  const label = itemName ? `${action}: ${itemName}` : action;

  return (
    <Button
      type="button"
      variant={isFavorite ? "secondary" : "outline"}
      size="sm"
      aria-label={label}
      aria-pressed={isFavorite}
      title={label}
      onClick={() => toggle.mutate()}
      disabled={favorites.isLoading || toggle.isPending}
    >
      <Star className={isFavorite ? "size-4 fill-current" : "size-4"} />
      {isFavorite ? "Favorited" : "Favorite"}
    </Button>
  );
}
