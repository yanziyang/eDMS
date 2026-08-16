import { http, HttpResponse } from "msw";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { server } from "@/test/server";
import { AdminUsers } from "./users";

const base = "http://localhost:5080/api/v1";

function userDto(overrides: Record<string, unknown> = {}) {
  return {
    id: "u1",
    email: "a@b.c",
    displayName: "Alice",
    isActive: true,
    isSystemAdmin: false,
    createdAt: "2026-01-01T00:00:00Z",
    lastLoginAt: null,
    ...overrides,
  };
}

describe("AdminUsers", () => {
  it("lists users with status and role", async () => {
    server.use(
      http.get(`${base}/users`, () =>
        HttpResponse.json([
          userDto(),
          userDto({ id: "u2", email: "b@c.d", displayName: "Bob", isActive: false, isSystemAdmin: true }),
        ]),
      ),
    );

    render(<AdminUsers />);

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
    render(<AdminUsers />);
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
    render(<AdminUsers />);

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
    render(<AdminUsers />);

    await user.click(await screen.findByRole("button", { name: "Reactivate" }));

    await waitFor(() => expect(urls).toHaveLength(1));
    expect(await screen.findByText("Active")).toBeInTheDocument();
  });
});
