import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { server } from "@/test/server";
import { toast } from "sonner";
import { AdminGroups } from "./groups";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const mockedToast = vi.mocked(toast);
const base = "http://localhost:5080/api/v1";

function groupDto(overrides: Record<string, unknown> = {}) {
  return {
    id: "g1",
    name: "Managers",
    description: null,
    isSystem: false,
    siteId: null,
    memberIds: ["u1", "u2"],
    ...overrides,
  };
}

function userDto(overrides: Record<string, unknown> = {}) {
  return {
    id: "u1",
    email: "alice@example.com",
    displayName: "Alice",
    isActive: true,
    isSystemAdmin: false,
    createdAt: "2026-01-01T00:00:00Z",
    lastLoginAt: null,
    ...overrides,
  };
}

function renderGroups() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return {
    queryClient,
    ...render(
      <QueryClientProvider client={queryClient}>
        <AdminGroups />
      </QueryClientProvider>,
    ),
  };
}

describe("AdminGroups", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it("shows only organization-wide groups with member counts", async () => {
    server.use(
      http.get(`${base}/groups`, () =>
        HttpResponse.json([
          groupDto(),
          groupDto({ id: "g2", name: "Site Editors", siteId: "s1", memberIds: ["u3"] }),
        ]),
      ),
    );

    renderGroups();

    expect(await screen.findByText("Managers")).toBeInTheDocument();
    expect(screen.getByText("Organization")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.queryByText("Site Editors")).not.toBeInTheDocument();
  });

  it("shows the description and system badge", async () => {
    server.use(
      http.get(`${base}/groups`, () =>
        HttpResponse.json([
          groupDto({ id: "g9", name: "Owners", description: "Full control", isSystem: true }),
        ]),
      ),
    );

    renderGroups();

    expect(await screen.findByText("Owners")).toBeInTheDocument();
    expect(screen.getByText("Full control")).toBeInTheDocument();
    expect(screen.getByText("System")).toBeInTheDocument();
  });

  it("shows the empty message when there are no org groups", async () => {
    server.use(
      http.get(`${base}/groups`, () => HttpResponse.json([])),
    );

    renderGroups();

    expect(await screen.findByText("No organization-wide groups yet.")).toBeInTheDocument();
  });

  it("shows an error when groups fail to load", async () => {
    server.use(
      http.get(`${base}/groups`, () => new HttpResponse(null, { status: 500 })),
    );

    renderGroups();

    expect(await screen.findByText("Failed to load groups.")).toBeInTheDocument();
  });

  it("creates a group from the dialog", async () => {
    const groups: unknown[] = [];
    const requests: Request[] = [];
    server.use(
      http.get(`${base}/groups`, () => HttpResponse.json(groups)),
      http.post(`${base}/groups`, async ({ request }) => {
        requests.push(request);
        groups.push(groupDto({ id: "g3", name: "Finance" }));
        return HttpResponse.json("g3", { status: 201 });
      }),
    );

    const user = userEvent.setup();
    renderGroups();
    await screen.findByText("No organization-wide groups yet.");

    await user.click(screen.getByRole("button", { name: "Create group" }));
    await user.type(screen.getByLabelText("Group name"), "Finance");
    await user.type(screen.getByLabelText("Description"), "Money team");
    await user.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => expect(requests).toHaveLength(1));
    await expect(requests[0].json()).resolves.toEqual({
      name: "Finance",
      description: "Money team",
      siteId: null,
    });
    expect(await screen.findByText("Finance")).toBeInTheDocument();
    expect(mockedToast.success).toHaveBeenCalledWith("Group created");
  });

  it("trims the name and sends a null description when blank", async () => {
    const requests: Request[] = [];
    server.use(
      http.get(`${base}/groups`, () => HttpResponse.json([])),
      http.post(`${base}/groups`, async ({ request }) => {
        requests.push(request);
        return HttpResponse.json("g3", { status: 201 });
      }),
    );

    const user = userEvent.setup();
    renderGroups();
    await screen.findByText("No organization-wide groups yet.");

    await user.click(screen.getByRole("button", { name: "Create group" }));
    await user.type(screen.getByLabelText("Group name"), "  Finance  ");
    await user.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => expect(requests).toHaveLength(1));
    await expect(requests[0].json()).resolves.toEqual({
      name: "Finance",
      description: null,
      siteId: null,
    });
  });

  it("reports a failed group creation", async () => {
    server.use(
      http.get(`${base}/groups`, () => HttpResponse.json([])),
      http.post(`${base}/groups`, () => new HttpResponse(null, { status: 500 })),
    );

    const user = userEvent.setup();
    renderGroups();
    await screen.findByText("No organization-wide groups yet.");

    await user.click(screen.getByRole("button", { name: "Create group" }));
    await user.type(screen.getByLabelText("Group name"), "Finance");
    await user.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => expect(mockedToast.error).toHaveBeenCalledWith("Failed to create group"));
  });

  it("does not submit an empty group name", async () => {
    let posts = 0;
    server.use(
      http.get(`${base}/groups`, () => HttpResponse.json([])),
      http.post(`${base}/groups`, () => {
        posts += 1;
        return HttpResponse.json("g3", { status: 201 });
      }),
    );

    const user = userEvent.setup();
    renderGroups();
    await screen.findByText("No organization-wide groups yet.");

    await user.click(screen.getByRole("button", { name: "Create group" }));
    const createButton = await screen.findByRole("button", { name: "Create" });
    expect(createButton).toBeDisabled();
    fireEvent.click(createButton);

    await waitFor(() => expect(posts).toBe(0));
  });

  it("cancels the create dialog", async () => {
    let posts = 0;
    server.use(
      http.get(`${base}/groups`, () => HttpResponse.json([])),
      http.post(`${base}/groups`, () => {
        posts += 1;
        return HttpResponse.json("g3", { status: 201 });
      }),
    );

    const user = userEvent.setup();
    renderGroups();
    await screen.findByText("No organization-wide groups yet.");

    await user.click(screen.getByRole("button", { name: "Create group" }));
    await user.click(await screen.findByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("button", { name: "Create" })).not.toBeInTheDocument();
    await waitFor(() => expect(posts).toBe(0));
  });

  it("shows a pending state while deleting a group", async () => {
    let resolveDelete!: (response: Response) => void;
    server.use(
      http.get(`${base}/groups`, () => HttpResponse.json([groupDto()])),
      http.delete(`${base}/groups/g1`, () => new Promise<Response>((resolve) => {
        resolveDelete = resolve;
      })),
    );

    const user = userEvent.setup();
    renderGroups();
    await screen.findByText("Managers");

    await user.click(screen.getByRole("button", { name: "Delete Managers" }));
    await user.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Delete" }).querySelector(".animate-spin"),
      ).toBeInTheDocument(),
    );
    resolveDelete(new HttpResponse(null, { status: 204 }));
  });

  it("deletes a group after confirmation", async () => {
    const groups: unknown[] = [groupDto()];
    const deletes: string[] = [];
    server.use(
      http.get(`${base}/groups`, () => HttpResponse.json(groups)),
      http.delete(`${base}/groups/g1`, ({ request }) => {
        deletes.push(request.url);
        groups.length = 0;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    const user = userEvent.setup();
    renderGroups();
    await screen.findByText("Managers");

    await user.click(screen.getByRole("button", { name: "Delete Managers" }));
    expect(screen.getByText(/Delete "Managers"/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(deletes).toHaveLength(1));
    expect(mockedToast.success).toHaveBeenCalledWith("Deleted Managers");
    expect(await screen.findByText("No organization-wide groups yet.")).toBeInTheDocument();
  });

  it("cancels a delete without calling the API", async () => {
    let deletes = 0;
    server.use(
      http.get(`${base}/groups`, () => HttpResponse.json([groupDto()])),
      http.delete(`${base}/groups/g1`, () => {
        deletes += 1;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    const user = userEvent.setup();
    renderGroups();
    await screen.findByText("Managers");

    await user.click(screen.getByRole("button", { name: "Delete Managers" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByText(/Delete "Managers"/)).not.toBeInTheDocument();
    await waitFor(() => expect(deletes).toBe(0));
  });

  it("reports a failed delete", async () => {
    server.use(
      http.get(`${base}/groups`, () => HttpResponse.json([groupDto()])),
      http.delete(`${base}/groups/g1`, () => new HttpResponse(null, { status: 500 })),
    );

    const user = userEvent.setup();
    renderGroups();
    await screen.findByText("Managers");

    await user.click(screen.getByRole("button", { name: "Delete Managers" }));
    await user.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(mockedToast.error).toHaveBeenCalledWith("Failed to delete group"));
  });

  it("disables deletion for system groups", async () => {
    server.use(
      http.get(`${base}/groups`, () =>
        HttpResponse.json([groupDto({ id: "g9", name: "Owners", isSystem: true })]),
      ),
    );

    renderGroups();

    await screen.findByText("Owners");
    expect(screen.getByRole("button", { name: "Delete Owners" })).toBeDisabled();
  });

  it("lists members and adds a new one", async () => {
    const groups: unknown[] = [groupDto()];
    const posts: string[] = [];
    server.use(
      http.get(`${base}/groups`, () => HttpResponse.json(groups)),
      http.get(`${base}/users`, () =>
        HttpResponse.json([
          userDto(),
          userDto({ id: "u2", displayName: "Bob", email: "bob@example.com" }),
          userDto({ id: "u3", displayName: "Carol", email: "carol@example.com" }),
        ]),
      ),
      http.post(`${base}/groups/g1/members/u3`, ({ request }) => {
        posts.push(request.url);
        (groups[0] as { memberIds: string[] }).memberIds = ["u1", "u2", "u3"];
        return new HttpResponse(null, { status: 204 });
      }),
    );

    const user = userEvent.setup();
    renderGroups();
    await screen.findByText("Managers");

    await user.click(screen.getByRole("button", { name: "Members" }));

    expect(await screen.findByText("Members of Managers")).toBeInTheDocument();
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
    expect(screen.queryByText("Carol")).not.toBeInTheDocument();

    await user.click(screen.getByRole("combobox", { name: "Add member" }));
    await user.click(await screen.findByRole("option", { name: "Carol (carol@example.com)" }));
    await user.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => expect(posts).toHaveLength(1));
    expect(posts[0]).toContain("/groups/g1/members/u3");
    expect(mockedToast.success).toHaveBeenCalledWith("Member added");
    expect(await screen.findByText("3")).toBeInTheDocument();
  });

  it("removes a member", async () => {
    const groups: unknown[] = [groupDto()];
    const deletes: string[] = [];
    server.use(
      http.get(`${base}/groups`, () => HttpResponse.json(groups)),
      http.get(`${base}/users`, () =>
        HttpResponse.json([userDto(), userDto({ id: "u2", displayName: "Bob", email: "bob@example.com" })]),
      ),
      http.delete(`${base}/groups/g1/members/u2`, ({ request }) => {
        deletes.push(request.url);
        (groups[0] as { memberIds: string[] }).memberIds = ["u1"];
        return new HttpResponse(null, { status: 204 });
      }),
    );

    const user = userEvent.setup();
    renderGroups();
    await screen.findByText("Managers");

    await user.click(screen.getByRole("button", { name: "Members" }));
    await screen.findByText("Members of Managers");

    await user.click(screen.getByRole("button", { name: "Remove Bob" }));

    await waitFor(() => expect(deletes).toHaveLength(1));
    expect(mockedToast.success).toHaveBeenCalledWith("Member removed");
    expect(await screen.findByText("1")).toBeInTheDocument();
  });

  it("reports failed member add and remove", async () => {
    server.use(
      http.get(`${base}/groups`, () => HttpResponse.json([groupDto()])),
      http.get(`${base}/users`, () =>
        HttpResponse.json([
          userDto(),
          userDto({ id: "u2", displayName: "Bob", email: "bob@example.com" }),
          userDto({ id: "u3", displayName: "Carol", email: "carol@example.com" }),
        ]),
      ),
      http.post(`${base}/groups/g1/members/u3`, () => new HttpResponse(null, { status: 500 })),
      http.delete(`${base}/groups/g1/members/u2`, () => new HttpResponse(null, { status: 500 })),
    );

    const user = userEvent.setup();
    renderGroups();
    await screen.findByText("Managers");

    await user.click(screen.getByRole("button", { name: "Members" }));
    await screen.findByText("Members of Managers");

    await user.click(screen.getByRole("button", { name: "Remove Bob" }));
    await waitFor(() => expect(mockedToast.error).toHaveBeenCalledWith("Failed to remove member"));

    await user.click(screen.getByRole("combobox", { name: "Add member" }));
    await user.click(await screen.findByRole("option", { name: "Carol (carol@example.com)" }));
    await user.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => expect(mockedToast.error).toHaveBeenCalledWith("Failed to add member"));
  });

  it("shows an empty members state", async () => {
    server.use(
      http.get(`${base}/groups`, () =>
        HttpResponse.json([groupDto({ id: "g4", name: "Empty", memberIds: [] })]),
      ),
      http.get(`${base}/users`, () => HttpResponse.json([])),
    );

    const user = userEvent.setup();
    renderGroups();
    await screen.findByText("Empty");

    await user.click(screen.getByRole("button", { name: "Members" }));

    expect(await screen.findByText("This group has no members yet.")).toBeInTheDocument();
  });

  it("shows an error when users fail to load in the members dialog", async () => {
    server.use(
      http.get(`${base}/groups`, () => HttpResponse.json([groupDto()])),
      http.get(`${base}/users`, () => new HttpResponse(null, { status: 500 })),
    );

    const user = userEvent.setup();
    renderGroups();
    await screen.findByText("Managers");

    await user.click(screen.getByRole("button", { name: "Members" }));

    expect(await screen.findByText("Failed to load users.")).toBeInTheDocument();
  });

  it("shows a read-only members list for system groups", async () => {
    server.use(
      http.get(`${base}/groups`, () =>
        HttpResponse.json([groupDto({ id: "g9", name: "Owners", isSystem: true })]),
      ),
      http.get(`${base}/users`, () =>
        HttpResponse.json([userDto(), userDto({ id: "u2", displayName: "Bob", email: "bob@example.com" })]),
      ),
    );

    const user = userEvent.setup();
    renderGroups();
    await screen.findByText("Owners");

    await user.click(screen.getByRole("button", { name: "Members" }));

    expect(await screen.findByText("Alice")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remove Alice" })).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Add member" })).not.toBeInTheDocument();
  });

  it("closes the members dialog with Close and X", async () => {
    server.use(
      http.get(`${base}/groups`, () => HttpResponse.json([groupDto()])),
      http.get(`${base}/users`, () => HttpResponse.json([userDto()])),
    );

    const user = userEvent.setup();
    renderGroups();
    await screen.findByText("Managers");

    await user.click(screen.getByRole("button", { name: "Members" }));
    await screen.findByText("Members of Managers");

    const closeButtons = screen.getAllByRole("button", { name: "Close" });
    await user.click(closeButtons[closeButtons.length - 1]);

    expect(screen.queryByText("Members of Managers")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Members" }));
    await screen.findByText("Members of Managers");
    await user.click(screen.getAllByRole("button", { name: "Close" })[0]);

    await waitFor(() =>
      expect(screen.queryByText("Members of Managers")).not.toBeInTheDocument(),
    );
  });
});
