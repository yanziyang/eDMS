import { http, HttpResponse } from "msw";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { server } from "@/test/server";
import { AdminGroups } from "./groups";

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

describe("AdminGroups", () => {
  it("shows only organization-wide groups with member counts", async () => {
    server.use(
      http.get(`${base}/groups`, () =>
        HttpResponse.json([
          groupDto(),
          groupDto({ id: "g2", name: "Site Editors", siteId: "s1", memberIds: ["u3"] }),
        ]),
      ),
    );

    render(<AdminGroups />);

    expect(await screen.findByText("Managers")).toBeInTheDocument();
    expect(screen.getByText("Organization")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.queryByText("Site Editors")).not.toBeInTheDocument();
  });

  it("shows the empty message when there are no org groups", async () => {
    server.use(
      http.get(`${base}/groups`, () => HttpResponse.json([])),
    );

    render(<AdminGroups />);

    expect(
      await screen.findByText("No organization-wide groups yet."),
    ).toBeInTheDocument();
  });

  it("shows the empty message when only site groups exist", async () => {
    server.use(
      http.get(`${base}/groups`, () =>
        HttpResponse.json([groupDto({ siteId: "s1" })]),
      ),
    );

    render(<AdminGroups />);

    expect(
      await screen.findByText("No organization-wide groups yet."),
    ).toBeInTheDocument();
  });
});
