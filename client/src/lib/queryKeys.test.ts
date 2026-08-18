import { describe, expect, it } from "vitest";
import { queryKeys } from "./queryKeys";

describe("queryKeys", () => {
  it("builds nested site, library, folder and document keys", () => {
    expect(queryKeys.sites.list()).toEqual(["sites", "list"]);
    expect(queryKeys.sites.detail("site-a")).toEqual(["sites", "detail", "site-a"]);
    expect(queryKeys.libraries.list("s1")).toEqual(["libraries", "list", "s1"]);
    expect(queryKeys.groups.list()).toEqual(["groups", "list"]);
    expect(queryKeys.groups.list("s1")).toEqual(["groups", "list", "s1"]);
    expect(queryKeys.folders.items("f1")).toEqual(["folders", "items", "f1"]);
    expect(queryKeys.documents.libraryItems("l1")).toEqual(["documents", "library-items", "l1"]);
    expect(queryKeys.documents.detail("d1")).toEqual(["documents", "detail", "d1"]);
    expect(queryKeys.documents.versions("d1")).toEqual(["documents", "versions", "d1"]);
    expect(queryKeys.documents.metadata("d1")).toEqual(["documents", "metadata", "d1"]);
    expect(queryKeys.contentTypes.list()).toEqual(["content-types", "list"]);
    expect(queryKeys.contentTypes.list("l1")).toEqual(["content-types", "list", "l1"]);
    expect(queryKeys.contentTypes.detail("ct1")).toEqual(["content-types", "detail", "ct1"]);
  });

  it("builds permission, recycle-bin, search, admin and me keys", () => {
    expect(queryKeys.permissions.forObject("document", "d1")).toEqual(["permissions", "document", "d1"]);
    expect(queryKeys.recycleBin.list("s1")).toEqual(["recycle-bin", "list", "s1"]);
    expect(queryKeys.search.results("q", undefined, undefined)).toEqual(["search", "results", "q", null, null]);
    expect(queryKeys.search.results("q", "s1", "l1")).toEqual(["search", "results", "q", "s1", "l1"]);
    expect(queryKeys.admin.users()).toEqual(["admin", "users"]);
    expect(queryKeys.admin.users("bob")).toEqual(["admin", "users", "bob"]);
    expect(queryKeys.admin.settings()).toEqual(["admin", "settings"]);
    expect(queryKeys.admin.storage()).toEqual(["admin", "storage"]);
    expect(queryKeys.admin.auditLog("s1")).toEqual(["admin", "audit-log", "s1"]);
    expect(queryKeys.me.current()).toEqual(["me", "current"]);
    expect(queryKeys.me.favorites()).toEqual(["me", "favorites"]);
    expect(queryKeys.me.recent()).toEqual(["me", "recent"]);
    expect(queryKeys.notifications.list()).toEqual(["notifications", "list", false]);
    expect(queryKeys.notifications.list(true)).toEqual(["notifications", "list", true]);
    expect(queryKeys.notifications.subscriptions()).toEqual(["notifications", "subscriptions"]);
    expect(queryKeys.auth.ssoProviders()).toEqual(["auth", "sso-providers"]);
  });
});
