import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { AuthShell, BrandHeader } from "./auth-shell";

describe("AuthShell", () => {
  it("renders children, quote and features", () => {
    render(
      <AuthShell quote="A quote" features={["Feature one", "Feature two"]}>
        <div>form content</div>
      </AuthShell>,
    );

    expect(screen.getByText("form content")).toBeInTheDocument();
    expect(screen.getByText("A quote")).toBeInTheDocument();
    expect(screen.getByText("Feature one")).toBeInTheDocument();
    expect(screen.getByText("Feature two")).toBeInTheDocument();
    expect(screen.getByText("© 2026 eDMS — Internal enterprise prototype")).toBeInTheDocument();
  });

  it("renders no feature list when empty", () => {
    render(
      <AuthShell quote="Only a quote" features={[]}>
        <div>content</div>
      </AuthShell>,
    );

    expect(screen.getByText("Only a quote")).toBeInTheDocument();
  });
});

describe("BrandHeader", () => {
  it("links to /login by default", () => {
    render(
      <MemoryRouter>
        <BrandHeader />
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: /eDMS/ })).toHaveAttribute("href", "/login");
    expect(screen.getByText("Enterprise Document Management")).toBeInTheDocument();
  });

  it("links to a custom destination", () => {
    render(
      <MemoryRouter>
        <BrandHeader to="/custom" />
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: /eDMS/ })).toHaveAttribute("href", "/custom");
  });
});
