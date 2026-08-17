// Runtime smoke test for the eDMS React prototype.
// Run: node scripts/smoke.mjs   (expects `npm run preview` running on :4173)
import { chromium } from "playwright-core";

const BASE = "http://localhost:4173/";
let failures = 0;

const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});

async function ok(name, fn) {
  try {
    await fn();
    console.log(`  ok  ${name}`);
  } catch (e) {
    failures++;
    console.log(`FAIL  ${name}\n     ${String(e).split("\n")[0]}`);
    console.log("     url:", page.url());
  }
}

// Poll-based visibility wait (more reliable than locator.waitFor here).
async function waitVisible(locator, timeout = 8000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    const n = await locator.count();
    for (let i = 0; i < n; i++) {
      if (await locator.nth(i).isVisible()) return;
    }
    await page.waitForTimeout(200);
  }
  throw new Error(`not visible within ${timeout}ms`);
}

async function reloadAt(hashPath) {
  await page.goto(BASE + "#" + hashPath, { waitUntil: "networkidle" });
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(300);
}

await page.goto(BASE, { waitUntil: "networkidle" });
await ok("root redirects to login", async () => {
  await page.waitForURL(/#\/login/, { timeout: 8000 });
});
await ok("login page visible", () => waitVisible(page.locator("text=Welcome back")));
await ok("brand panel visible", () => waitVisible(page.locator("text=Version history & check-in / check-out")));
await ok("login validation", async () => {
  await page.locator('input[type="email"]').fill("");
  await page.locator('input[type="password"]').fill("");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await waitVisible(page.locator("text=Enter your email address"));
  await page.locator('input[type="email"]').fill("jordan.reyes@edms-demo.local");
  await page.locator('input[type="password"]').fill("demo-password");
});

await ok("sign in navigates to home", async () => {
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL(/#\/home/, { timeout: 8000 });
});
await ok("home greeting", () => waitVisible(page.locator("text=Welcome back, Jordan")));
await ok("site cards", () => waitVisible(page.locator('a[href="#/sites/finance"]')));
await ok("home recent documents", async () => {
  await waitVisible(page.getByText("Recent documents"));
  await waitVisible(page.getByText("Requirements Spec v2.docx"));
});

await ok("site home", async () => {
  await page.click('a[href="#/sites/phoenix"]');
  await page.waitForURL(/#\/sites\/phoenix$/, { timeout: 8000 });
  await waitVisible(page.locator("text=Document libraries"));
  await waitVisible(page.locator("text=21.5 GB of 50 GB used"));
});

await ok("site permissions dialog", async () => {
  await page.getByRole("button", { name: "Manage access" }).first().click();
  await waitVisible(page.locator("text=Site Owners"));
  await page.getByRole("button", { name: "Save changes" }).click();
  await waitVisible(page.locator("text=Site permissions updated"));
  await page.waitForTimeout(500);
});

await ok("site favorite and follow controls", async () => {
  await page.getByRole("button", { name: "Follow", exact: true }).click();
  await waitVisible(page.getByRole("button", { name: "Following", exact: true }));
  await page.getByRole("button", { name: "Add site to favorites" }).click();
  await waitVisible(page.getByRole("button", { name: "Remove site from favorites" }));
});

await ok("library page", async () => {
  await page.click('a[href="#/sites/phoenix/documents/root"]');
  await page.waitForURL(/#\/sites\/phoenix\/documents\/root/, { timeout: 8000 });
  await waitVisible(page.locator("text=Upload, organize, and manage documents"));
  await waitVisible(page.locator("tbody tr").first());
});

await ok("library follow", async () => {
  await page.getByRole("button", { name: "Follow", exact: true }).click();
  await waitVisible(page.getByRole("button", { name: "Following", exact: true }));
});

await ok("library filter", async () => {
  await page.getByRole("textbox", { name: "Filter this library" }).fill("requirements");
  await waitVisible(page.getByText("Requirements Spec v2.docx"));
});

await ok("saved library view", async () => {
  await page.getByRole("textbox", { name: "Filter this library" }).fill("");
  await page.getByRole("combobox", { name: "Saved library view" }).click();
  await page.getByRole("option", { name: "Roadmap and specs" }).click();
  await waitVisible(page.getByText("Project Phoenix Roadmap.pptx"));
});

await ok("context menu favorite action", async () => {
  const row = page.locator("tbody tr", { hasText: "Project Phoenix Roadmap.pptx" });
  await row.click({ button: "right" });
  const favoriteAction = page.getByRole("menuitem", { name: /favorites/ }).first();
  await waitVisible(favoriteAction);
  await favoriteAction.click();
});

await ok("bulk metadata edit", async () => {
  await reloadAt("/sites/phoenix/documents/root");
  await waitVisible(page.locator("tbody tr").first());
  await page.locator("tbody tr", { hasText: "Meeting Notes - Aug 2026.docx" }).getByRole("checkbox").click();
  await page.locator("tbody tr", { hasText: "Sprint Planning Board.xlsx" }).getByRole("checkbox").click();
  await waitVisible(page.getByRole("button", { name: "Edit properties", exact: true }));
  const selectedCount = await page.locator('tbody [role="checkbox"][aria-checked="true"]').count();
  if (selectedCount !== 2) throw new Error(`expected 2 selected rows, got ${selectedCount}`);
  await page.getByRole("button", { name: "Edit properties", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Tags").fill("Smoke, Phase 4");
  await dialog.getByRole("button", { name: "Apply changes" }).click();
  await waitVisible(page.getByText("Updated metadata on 2 items"));
});

await ok("save library view", async () => {
  await page.getByRole("button", { name: "Save view", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("View name").fill("Smoke view");
  await dialog.getByRole("button", { name: "Save view", exact: true }).click();
  await waitVisible(page.getByText('Saved view "Smoke view"'));
});

await ok("favorites page", async () => {
  await page.getByRole("link", { name: "Favorites" }).first().click();
  await page.waitForURL(/#\/favorites/, { timeout: 8000 });
  await waitVisible(page.getByText("Favorites", { exact: true }));
  await waitVisible(page.getByText("Finance", { exact: true }));
  await reloadAt("/sites/phoenix/documents/root");
});

await ok("sorting works", async () => {
  await page.getByText("Modified by").first().click();
  await waitVisible(page.locator("tbody tr").first());
});

await ok("doc sheet opens with versions", async () => {
  await page
    .locator("tbody tr", { hasText: "Requirements Spec v2.docx" })
    .getByRole("button", { name: "More actions" })
    .click();
  await page.getByRole("menuitem", { name: "Version history" }).click();
  await waitVisible(page.getByText("Checked out", { exact: false }));
  await waitVisible(page.locator("text=Current"));
  await waitVisible(page.getByRole("button", { name: /Checked out by Liam/ }));
  await page.getByRole("button", { name: "Done" }).click();
  await page.waitForTimeout(500);
});

await ok("doc sheet permissions + break inheritance", async () => {
  await page
    .locator("tbody tr", { hasText: "Meeting Notes - Aug 2026.docx" })
    .getByRole("button", { name: "More actions" })
    .click();
  await page.getByRole("menuitem", { name: "Manage access" }).click();
  await waitVisible(page.locator("text=inherits permissions from its library"));
  await page.getByRole("button", { name: "Stop inheriting permissions" }).click();
  await waitVisible(page.locator("text=unique permissions"));
  await page.getByRole("button", { name: "Reset to inherited" }).click();
  await waitVisible(page.locator("text=inherits permissions from its library"));
  await page.getByRole("button", { name: "Done" }).click();
  await page.waitForTimeout(500);
});

await ok("check-out / check-in from sheet", async () => {
  await page
    .locator("tbody tr", { hasText: "Meeting Notes - Aug 2026.docx" })
    .getByRole("button", { name: "More actions" })
    .click();
  await page.getByRole("menuitem", { name: "Version history" }).click();
  await waitVisible(page.getByRole("button", { name: "Check out", exact: true }));
  await page.getByRole("button", { name: "Check out", exact: true }).click();
  await waitVisible(page.getByText("Only you can upload a new version until you check in."));
  await page.getByRole("button", { name: "Check in", exact: true }).click();
  await waitVisible(page.getByText("New version 2.0 created"));
  await page.getByRole("button", { name: "Done" }).click();
  await page.waitForTimeout(500);
});

await ok("upload via topbar New menu", async () => {
  await page.getByRole("button", { name: "New", exact: true }).click();
  await page.getByRole("menuitem", { name: "Upload file" }).click();
  await page.waitForURL(/#\/sites\/finance\/documents\/root\?action=upload/, { timeout: 8000 });
  await waitVisible(page.locator("text=Click to browse"));
  await page.locator('[role="dialog"] input[type="file"]').setInputFiles({
    name: "Smoke Upload.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("smoke test file content"),
  });
  await waitVisible(page.locator("text=Done").last(), 15000);
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await waitVisible(page.locator("text=Smoke Upload.txt"));
});

await ok("grid view + new folder + bulk delete", async () => {
  await page.getByRole("button", { name: "Grid view" }).click();
  await waitVisible(page.locator(".tile-name").first());
  await page.getByRole("button", { name: "New folder", exact: true }).click();
  await page.locator('[role="dialog"] input').fill("Smoke Folder");
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await waitVisible(page.locator("text=Smoke Folder"));
  await page.getByRole("checkbox", { name: "Select Smoke Folder" }).click();
  await waitVisible(page.locator("text=1 item selected"));
  await page.getByRole("button", { name: "Delete", exact: true }).first().click();
  await waitVisible(page.locator("text=1 item(s) moved to Recycle Bin"));
});

await ok("recycle bin", async () => {
  await page.keyboard.press("Escape");
  await page.getByRole("link", { name: "Recycle Bin" }).first().click();
  await page.waitForURL(/#\/recycle-bin/, { timeout: 8000 });
  await waitVisible(page.locator("tbody tr").first());
});

await ok("search by query param", async () => {
  await reloadAt("/search?q=invoice");
  await waitVisible(page.locator("text=Invoice_2026_0417.pdf"));
});

await ok("admin users search", async () => {
  await reloadAt("/admin/users");
  await waitVisible(page.locator("tbody tr").first());
  await page.locator('input[placeholder="Search users…"]').fill("nina");
  await waitVisible(page.locator("text=Nina Volkov"));
});

await ok("admin storage charts", async () => {
  await reloadAt("/admin/storage");
  await waitVisible(page.locator(".chart-svg").first());
  await waitVisible(page.locator("text=118.0 GB"));
});

await ok("theme quick toggle", async () => {
  await page.getByRole("button", { name: "Toggle dark mode" }).click();
  await page.waitForFunction(
    () => document.documentElement.getAttribute("data-theme") === "midnight",
    { timeout: 8000 }
  );
});

await ok("profile theme swatches", async () => {
  await reloadAt("/profile");
  await waitVisible(page.locator("text=Light · Green accent"));
});

await ok("forgot password flow", async () => {
  await reloadAt("/login");
  await page.getByText("Forgot password?").click();
  await page.waitForURL(/#\/forgot-password/, { timeout: 8000 });
  await waitVisible(page.locator("text=Send reset link"));
});

await ok("command palette", async () => {
  await reloadAt("/home");
  await page.keyboard.press("Control+k");
  await waitVisible(page.locator("text=Admin: Storage Report"));
  await page.keyboard.type("audit");
  await waitVisible(page.locator("text=Admin: Audit Log"));
  await page.keyboard.press("Escape");
});

await ok("mobile drawer", async () => {
  await page.setViewportSize({ width: 480, height: 900 });
  await reloadAt("/home");
  await page.getByRole("button", { name: "Open menu" }).click();
  await waitVisible(page.locator("text=Admin Center"));
  await page.getByRole("link", { name: "Home" }).last().click();
  await page.setViewportSize({ width: 1440, height: 900 });
});

await ok("no console/page errors", async () => {
  if (errors.length) throw new Error(errors.slice(0, 5).join(" | "));
});

await browser.close();
console.log(failures === 0 ? "\nSMOKE TEST PASSED" : `\nSMOKE TEST FAILED (${failures} failures)`);
process.exit(failures === 0 ? 0 : 1);
