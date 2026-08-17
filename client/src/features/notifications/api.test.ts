import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { server } from "@/test/server";
import {
  followItem,
  listNotifications,
  listSubscriptions,
  markAllNotificationsRead,
  markNotificationRead,
  unfollowItem,
} from "./api";

const base = "http://localhost:5080/api/v1";

describe("notifications api", () => {
  it("lists notifications and subscriptions", async () => {
    server.use(
      http.get(`${base}/me/notifications`, ({ request }) => {
        expect(new URL(request.url).searchParams.get("unreadOnly")).toBe("true");
        return HttpResponse.json([]);
      }),
      http.get(`${base}/me/notifications/subscriptions`, () => HttpResponse.json([])),
    );

    await expect(listNotifications(true)).resolves.toEqual([]);
    await expect(listSubscriptions()).resolves.toEqual([]);
  });

  it("follows, unfollows, and marks notifications read", async () => {
    const requestSpy = vi.fn();
    server.use(
      http.post(`${base}/Document/objects/doc-1/follow`, async ({ request }) => {
        requestSpy(await request.json());
        return HttpResponse.json({
          id: "sub-1",
          objectType: "Document",
          objectId: "doc-1",
          objectName: "Budget.docx",
          frequency: "Daily",
          createdAt: "2026-08-17T00:00:00Z",
        });
      }),
      http.delete(`${base}/Document/objects/doc-1/follow`, () => new HttpResponse(null, { status: 204 })),
      http.post(`${base}/me/notifications/n-1/read`, () => new HttpResponse(null, { status: 204 })),
      http.post(`${base}/me/notifications/read-all`, () => new HttpResponse(null, { status: 204 })),
    );

    await expect(followItem("Document", "doc-1", "Daily")).resolves.toMatchObject({
      frequency: "Daily",
    });
    expect(requestSpy).toHaveBeenCalledWith({ frequency: "Daily" });
    await expect(unfollowItem("Document", "doc-1")).resolves.toBeUndefined();
    await expect(markNotificationRead("n-1")).resolves.toBeUndefined();
    await expect(markAllNotificationsRead()).resolves.toBeUndefined();
  });
});
