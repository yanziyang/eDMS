import { http, HttpResponse } from "msw";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { server } from "@/test/server";
import { toast } from "sonner";
import { AdminUsers } from "./users";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const mockedToast = vi.mocked(toast);
const base = "http://localhost:5080/api/v1";

function userDto(overrides: Record<string, unknown> = {}) {
  return {
    id: "u1",
    email: "a@b.c",
    displayName: "Alice",
    isActive: true,
    isSystemAdmin: false,
    localLoginDisabled: false,
    ssoExempt: false,
    createdAt: "2026-01-01T00:00:00Z",
    lastLoginAt: null,
    ...overrides,
  };
}

function renderUsers() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return {
    queryClient,
    ...render(
      <QueryClientProvider client={queryClient}>
        <AdminUsers />
      </QueryClientProvider>,
    ),
  };
}

describe("AdminUsers", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it("lists users with status and role", async () => {
    server.use(
      http.get(`${base}/users`, () =>
        HttpResponse.json([
          userDto(),
          userDto({ id: "u2", email: "b@c.d", displayName: "Bob", isActive: false, isSystemAdmin: true }),
        ]),
      ),
    );

    renderUsers();

    expect(await screen.findByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("a@b.c")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("User")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
    expect(screen.getByText("Inactive")).toBeInTheDocument();
    expect(screen.getByText("Admin")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Deactivate" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reactivate" })).toBeInTheDocument();
  });

  it("creates a user and resets the form", async () => {
    const users = [userDto()];
    const requests: Request[] = [];
    server.use(
      http.get(`${base}/users`, () => HttpResponse.json(users)),
      http.post(`${base}/users`, async ({ request }) => {
        requests.push(request);
        users.push(userDto({ id: "u9", email: "new@x.c", displayName: "New" }));
        return HttpResponse.json("u9", { status: 201 });
      }),
    );

    const user = userEvent.setup();
    renderUsers();
    await screen.findByText("Alice");

    const textInputs = screen.getAllByRole("textbox");
    await user.type(textInputs[0], "new@x.c");
    await user.type(textInputs[1], "New");
    await user.type(textInputs[2], "temp-pass");
    await user.click(screen.getByRole("checkbox", { name: "System admin" }));
    await user.click(screen.getByRole("button", { name: "Create user" }));

    expect(await screen.findByText("New")).toBeInTheDocument();
    expect(textInputs[0]).toHaveValue("");
    expect(textInputs[1]).toHaveValue("");
    expect(textInputs[2]).toHaveValue("");
    expect(screen.getByRole("checkbox", { name: "System admin" })).not.toBeChecked();
    await expect(requests[0].json()).resolves.toEqual({
      email: "new@x.c",
      displayName: "New",
      tempPassword: "temp-pass",
      isSystemAdmin: true,
    });
  });

  it("reports a failed user creation", async () => {
    server.use(
      http.get(`${base}/users`, () => HttpResponse.json([userDto()])),
      http.post(`${base}/users`, () => new HttpResponse(null, { status: 500 })),
    );

    const user = userEvent.setup();
    renderUsers();
    await screen.findByText("Alice");

    await user.type(screen.getAllByRole("textbox")[0], "new@x.c");
    await user.type(screen.getAllByRole("textbox")[1], "New");
    await user.type(screen.getAllByRole("textbox")[2], "temp-pass");
    await user.click(screen.getByRole("button", { name: "Create user" }));

    await waitFor(() => expect(mockedToast.error).toHaveBeenCalledWith("Failed to create user"));
  });

  it("deactivates an active user", async () => {
    const users = [userDto()];
    const urls: string[] = [];
    server.use(
      http.get(`${base}/users`, () => HttpResponse.json(users)),
      http.post(`${base}/users/u1/deactivate`, ({ request }) => {
        urls.push(request.url);
        users[0] = userDto({ isActive: false });
        return new HttpResponse(null, { status: 204 });
      }),
    );

    const user = userEvent.setup();
    renderUsers();

    await user.click(await screen.findByRole("button", { name: "Deactivate" }));

    await waitFor(() => expect(urls).toHaveLength(1));
    expect(await screen.findByText("Inactive")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reactivate" })).toBeInTheDocument();
  });

  it("reactivates an inactive user", async () => {
    const users = [userDto({ isActive: false })];
    const urls: string[] = [];
    server.use(
      http.get(`${base}/users`, () => HttpResponse.json(users)),
      http.post(`${base}/users/u1/reactivate`, ({ request }) => {
        urls.push(request.url);
        users[0] = userDto({ isActive: true });
        return new HttpResponse(null, { status: 204 });
      }),
    );

    const user = userEvent.setup();
    renderUsers();

    await user.click(await screen.findByRole("button", { name: "Reactivate" }));

    await waitFor(() => expect(urls).toHaveLength(1));
    expect(await screen.findByText("Active")).toBeInTheDocument();
  });

  it("updates the per-user local-login policy", async () => {
    const users = [userDto({ isSystemAdmin: true })];
    const requests: Request[] = [];
    server.use(
      http.get(`${base}/users`, () => HttpResponse.json(users)),
      http.put(`${base}/users/u1`, async ({ request }) => {
        requests.push(request);
        users[0] = userDto({ isSystemAdmin: true, localLoginDisabled: true });
        return new HttpResponse(null, { status: 204 });
      }),
    );

    const user = userEvent.setup();
    renderUsers();
    await user.click(
      await screen.findByRole("switch", { name: "Disable local login for a@b.c" }),
    );

    await waitFor(() => expect(requests).toHaveLength(1));
    await expect(requests[0].json()).resolves.toEqual({
      displayName: "Alice",
      isSystemAdmin: true,
      localLoginDisabled: true,
      ssoExempt: false,
    });
    expect(mockedToast.success).toHaveBeenCalledWith("Login policy updated");
  });

  it("allows the break-glass switch only for system administrators", async () => {
    server.use(
      http.get(`${base}/users`, () =>
        HttpResponse.json([
          userDto(),
          userDto({ id: "u2", email: "admin@edms.test", isSystemAdmin: true }),
        ])),
    );

    renderUsers();

    expect(
      await screen.findByRole("switch", { name: "Allow local login exemption for a@b.c" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("switch", { name: "Allow local login exemption for admin@edms.test" }),
    ).toBeEnabled();
  });

  it("reports a failed deactivation", async () => {
    server.use(
      http.get(`${base}/users`, () => HttpResponse.json([userDto()])),
      http.post(`${base}/users/u1/deactivate`, () => new HttpResponse(null, { status: 500 })),
    );

    const user = userEvent.setup();
    renderUsers();

    await user.click(await screen.findByRole("button", { name: "Deactivate" }));

    await waitFor(() => expect(mockedToast.error).toHaveBeenCalledWith("Failed to update user"));
  });
});
