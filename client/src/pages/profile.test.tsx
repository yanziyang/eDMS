import { http, HttpResponse } from "msw";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { server } from "@/test/server";
import { Profile } from "./profile";

const base = "http://localhost:5080/api/v1";

function renderProfile() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <Profile />
    </QueryClientProvider>,
  );
}

describe("Profile", () => {
  it("renders the page title", () => {
    renderProfile();

    expect(screen.getByRole("heading", { name: "My Profile" })).toBeInTheDocument();
  });

  it("shows the current user's details", async () => {
    server.use(
      http.get(`${base}/auth/me`, () =>
        HttpResponse.json({
          id: "u1",
          email: "alice@example.com",
          displayName: "Alice",
          isSystemAdmin: true,
          siteMemberships: [],
        }),
      ),
    );

    renderProfile();

    expect(await screen.findByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("alice@example.com")).toBeInTheDocument();
    expect(screen.getByText("System admin")).toBeInTheDocument();
  });

  it("omits the admin badge for regular users", async () => {
    server.use(
      http.get(`${base}/auth/me`, () =>
        HttpResponse.json({
          id: "u2",
          email: "bob@example.com",
          displayName: "Bob",
          isSystemAdmin: false,
          siteMemberships: [],
        }),
      ),
    );

    renderProfile();

    expect(await screen.findByText("Bob")).toBeInTheDocument();
    expect(screen.queryByText("System admin")).not.toBeInTheDocument();
  });

  it("shows an error when the profile fails to load", async () => {
    server.use(
      http.get(`${base}/auth/me`, () => new HttpResponse(null, { status: 500 })),
    );

    renderProfile();

    expect(await screen.findByText("Failed to load profile.")).toBeInTheDocument();
  });
});
