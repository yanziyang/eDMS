import { request } from "@/lib/api-client";
import type { FavoriteItemDto, FavoriteObjectType } from "@/types/api";

export function listFavorites(): Promise<FavoriteItemDto[]> {
  return request<FavoriteItemDto[]>("/me/favorites");
}

export function addFavorite(objectType: FavoriteObjectType, objectId: string): Promise<void> {
  return request<void>(`/${objectType}/objects/${objectId}/favorite`, { method: "POST" });
}

export function removeFavorite(objectType: FavoriteObjectType, objectId: string): Promise<void> {
  return request<void>(`/${objectType}/objects/${objectId}/favorite`, { method: "DELETE" });
}
