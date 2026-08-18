import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ItemContextMenu, itemObjectId, itemObjectType } from "./ItemContextMenu";
import type { ItemDto, PermissionLevel } from "@/types/api";

const documentItem: ItemDto = {
  kind: "document",
  id: "i1",
  name: "contract.pdf",
  sizeBytes: 100,
  modifiedAt: "2026-08-01T00:00:00Z",
  folderId: null,
  documentId: "d1",
  checkedOutBy: null,
};

const folderItem: ItemDto = {
  kind: "folder",
  id: "f1",
  name: "Contracts",
  sizeBytes: 0,
  modifiedAt: "2026-08-01T00:00:00Z",
  folderId: "f1",
  documentId: null,
  checkedOutBy: null,
};

function openMenu(permissionLevel: PermissionLevel) {
  const onAction = vi.fn();
  render(
    <ItemContextMenu item={documentItem} permissionLevel={permissionLevel} onAction={onAction}>
      <button type="button" data-testid="target">Contract</button>
    </ItemContextMenu>,
  );
  fireEvent.contextMenu(screen.getByTestId("target"));
  return onAction;
}

describe("ItemContextMenu", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("shows only read actions for a read-only item", () => {
    openMenu("Read");

    expect(screen.getByRole("menuitem", { name: "Open" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Download" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Rename" })).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Move / Copy" })).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Delete" })).not.toBeInTheDocument();
  });

  it("adds contribute actions while retaining read actions", () => {
    openMenu("Contribute");

    expect(screen.getByRole("menuitem", { name: "Open" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Download" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Rename" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Move / Copy" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Delete" })).toBeInTheDocument();
  });

  it("reports the selected action", () => {
    const onAction = openMenu("Contribute");

    fireEvent.click(screen.getByRole("menuitem", { name: "Rename" }));

    expect(onAction).toHaveBeenCalledWith("rename");
  });

  it("switches follow and favorite labels to their removal actions", () => {
    const onAction = vi.fn();
    render(
      <ItemContextMenu
        item={documentItem}
        permissionLevel="Read"
        actions={["follow", "favorite"]}
        isFollowed
        isFavorite
        onAction={onAction}
      >
        <button type="button" data-testid="target">Contract</button>
      </ItemContextMenu>,
    );
    fireEvent.contextMenu(screen.getByTestId("target"));

    fireEvent.click(screen.getByRole("menuitem", { name: "Unfollow" }));
    expect(onAction).toHaveBeenCalledWith("unfollow");
  });

  it("handles folder-specific and empty action sets", () => {
    const onAction = vi.fn();
    render(
      <ItemContextMenu
        item={folderItem}
        permissionLevel="Read"
        actions={["open", "download"]}
        onAction={onAction}
      >
        <button type="button" data-testid="folder-target">Contracts</button>
      </ItemContextMenu>,
    );
    fireEvent.contextMenu(screen.getByTestId("folder-target"));

    expect(screen.getByRole("menuitem", { name: "Open" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Download" })).not.toBeInTheDocument();

    cleanup();
    render(
      <ItemContextMenu item={folderItem} permissionLevel="NoAccess" actions={["open"]}>
        <button type="button" data-testid="empty-target">Contracts</button>
      </ItemContextMenu>,
    );
    fireEvent.contextMenu(screen.getByTestId("empty-target"));
    expect(screen.getByRole("menuitem", { name: "No actions available" })).toBeInTheDocument();
  });

  it("shows check-in for a document checked out by the current user", () => {
    const onAction = vi.fn();
    render(
      <ItemContextMenu
        item={{ ...documentItem, checkedOutBy: "u1" }}
        permissionLevel="Contribute"
        checkedOutByMe
        onAction={onAction}
      >
        <button type="button" data-testid="checked-out-target">Contract</button>
      </ItemContextMenu>,
    );
    fireEvent.contextMenu(screen.getByTestId("checked-out-target"));

    expect(screen.getByRole("menuitem", { name: "Check in" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Check out" })).not.toBeInTheDocument();
  });

  it("maps item IDs and types for API actions", () => {
    expect(itemObjectId(documentItem)).toBe("d1");
    expect(itemObjectType(documentItem)).toBe("Document");
    expect(itemObjectId({ ...documentItem, documentId: null })).toBe("i1");
    expect(itemObjectId(folderItem)).toBe("f1");
    expect(itemObjectType(folderItem)).toBe("Folder");
  });
});
