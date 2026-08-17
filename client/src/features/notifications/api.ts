import { request } from "@/lib/api-client";
import type { AlertFrequency, AlertSubscriptionDto, NotificationDto } from "@/types/api";

export function listNotifications(unreadOnly = false): Promise<NotificationDto[]> {
  return request<NotificationDto[]>(`/me/notifications?unreadOnly=${unreadOnly}`);
}

export function markNotificationRead(notificationId: string): Promise<void> {
  return request<void>(`/me/notifications/${notificationId}/read`, { method: "POST" });
}

export function markAllNotificationsRead(): Promise<void> {
  return request<void>("/me/notifications/read-all", { method: "POST" });
}

export function listSubscriptions(): Promise<AlertSubscriptionDto[]> {
  return request<AlertSubscriptionDto[]>("/me/notifications/subscriptions");
}

export function followItem(
  objectType: "Document" | "Folder",
  objectId: string,
  frequency: AlertFrequency,
): Promise<AlertSubscriptionDto> {
  return request<AlertSubscriptionDto>(`/${objectType}/objects/${objectId}/follow`, {
    method: "POST",
    body: JSON.stringify({ frequency }),
  });
}

export function unfollowItem(objectType: "Document" | "Folder", objectId: string): Promise<void> {
  return request<void>(`/${objectType}/objects/${objectId}/follow`, { method: "DELETE" });
}
