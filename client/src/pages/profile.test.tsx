import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Profile } from "./profile";

describe("Profile", () => {
  it("renders the page title", () => {
    render(<Profile />);

    expect(screen.getByRole("heading", { name: "My Profile" })).toBeInTheDocument();
  });
});
