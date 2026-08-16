import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RecycleBin } from "./recycle-bin";

describe("RecycleBin", () => {
  it("renders the page title", () => {
    render(<RecycleBin />);

    expect(screen.getByRole("heading", { name: "Recycle Bin" })).toBeInTheDocument();
  });
});
