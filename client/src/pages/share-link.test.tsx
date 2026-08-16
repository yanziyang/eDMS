import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { getShareToken, setShareToken } from "@/features/share-links/token";
import { ShareLink } from "./share-link";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const mockedToast = vi.mocked(toast);

function renderShareLink(route: string) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route path="/share/:token" element={<ShareLink />} />
        <Route path="/share" element={<ShareLink />} />
        <Route path="/" element={<div>HOME_PLACEHOLDER</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ShareLink", () => {
  beforeEach(() => {
    setShareToken(null);
  });

  afterEach(() => {
    setShareToken(null);
    vi.clearAllMocks();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("stores the token and redirects to home with a toast", async () => {
    renderShareLink("/share/tok-123");

    expect(await screen.findByText("HOME_PLACEHOLDER")).toBeInTheDocument();
    expect(getShareToken()).toBe("tok-123");
    expect(mockedToast.success).toHaveBeenCalledWith(
      "Share link applied — open the document from search or your libraries",
    );
  });

  it("shows an error toast and still redirects when the token is missing", async () => {
    renderShareLink("/share");

    expect(await screen.findByText("HOME_PLACEHOLDER")).toBeInTheDocument();
    expect(getShareToken()).toBeNull();
    expect(mockedToast.error).toHaveBeenCalledWith("Invalid share link");
  });
});
