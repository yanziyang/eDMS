import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { Admin } from "./admin";

function renderAdmin(initialPath = "/admin/users") {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/admin" element={<Admin />}>
          <Route path="users" element={<div>USERS_PANEL</div>} />
          <Route path="groups" element={<div>GROUPS_PANEL</div>} />
          <Route path="sites" element={<div>SITES_PANEL</div>} />
          <Route path="storage" element={<div>STORAGE_PANEL</div>} />
          <Route path="audit-log" element={<div>AUDIT_LOG_PANEL</div>} />
          <Route path="settings" element={<div>SETTINGS_PANEL</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe("Admin", () => {
  it("renders the tabs and the active child", () => {
    renderAdmin();

    expect(screen.getByRole("heading", { name: "Admin Center" })).toBeInTheDocument();
    expect(screen.getByText("USERS_PANEL")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Users" })).toHaveAttribute("href", "/admin/users");
    expect(screen.getByRole("link", { name: "Groups" })).toHaveAttribute("href", "/admin/groups");
    expect(screen.getByRole("link", { name: "Sites" })).toHaveAttribute("href", "/admin/sites");
    expect(screen.getByRole("link", { name: "Storage" })).toHaveAttribute("href", "/admin/storage");
    expect(screen.getByRole("link", { name: "Audit Log" })).toHaveAttribute("href", "/admin/audit-log");
    expect(screen.getByRole("link", { name: "Settings" })).toHaveAttribute("href", "/admin/settings");
  });

  it("renders the storage, audit log, and settings tab content", async () => {
    const user = userEvent.setup();
    renderAdmin();

    await user.click(screen.getByRole("link", { name: "Storage" }));
    expect(screen.getByText("STORAGE_PANEL")).toBeInTheDocument();

    await user.click(screen.getByRole("link", { name: "Audit Log" }));
    expect(screen.getByText("AUDIT_LOG_PANEL")).toBeInTheDocument();

    await user.click(screen.getByRole("link", { name: "Settings" }));
    expect(screen.getByText("SETTINGS_PANEL")).toBeInTheDocument();
  });

  it("marks the active tab and switches content", async () => {
    const user = userEvent.setup();
    renderAdmin();

    expect(screen.getByRole("link", { name: "Users" }).className).toContain("border-primary");
    expect(screen.getByRole("link", { name: "Groups" }).className).not.toContain("border-primary");

    await user.click(screen.getByRole("link", { name: "Groups" }));

    expect(screen.getByText("GROUPS_PANEL")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Groups" }).className).toContain("border-primary");
  });

  it("renders sites tab content", async () => {
    const user = userEvent.setup();
    renderAdmin();

    await user.click(screen.getByRole("link", { name: "Sites" }));

    expect(screen.getByText("SITES_PANEL")).toBeInTheDocument();
  });
});
