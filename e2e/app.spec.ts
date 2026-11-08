import { test, expect } from "@playwright/test";
test("D1 persists CRUD, order, backup, views and protects stale writes", async ({
  page,
  request,
}) => {
  const initial = await (await request.get("/api/data")).json();
  const origin = "http://127.0.0.1:8788";
  // Test requires an empty, disposable local database.
  expect(initial.projects).toEqual([]);
  try {
    await page.goto("/");
    await page
      .getByRole("button", { name: "Create your first project" })
      .click();
    await page.getByLabel("Project name").fill("Release planning");
    await page.getByRole("button", { name: "Save project" }).click();
    await expect(
      page.getByRole("heading", { name: /^Release planning/ }),
    ).toBeVisible();
    for (const title of [
      "Design a calmer workflow",
      "Ship the first version",
    ]) {
      await page.getByRole("button", { name: "New task" }).click();
      await page.getByLabel("Task title").fill(title);
      await page.getByLabel("Due date", { exact: true }).fill("2026-11-08");
      await page.getByLabel("Labels").fill("Planning, Release");
      await page
        .getByLabel("Description")
        .fill("Small, thoughtful improvements make a difference.");
      await page
        .getByRole("button", { name: "Save task", exact: true })
        .click();
      await expect(
        page.getByRole("button", { name: title, exact: true }),
      ).toBeVisible();
    }
    await page.reload();
    await expect(
      page.getByRole("button", {
        name: "Design a calmer workflow",
        exact: true,
      }),
    ).toBeVisible();
    const stale = await (await request.get("/api/data")).json();
    // Pointer drag across columns uses actual dnd-kit handlers and persists to D1.
    const handle = page.getByRole("button", {
      name: "Move Design a calmer workflow",
    });
    const from = await handle.boundingBox();
    const target = await page.locator(".lane").nth(2).boundingBox();
    await page.mouse.move(from!.x + 8, from!.y + 8);
    await page.mouse.down();
    await page.mouse.move(from!.x + 30, from!.y + 20, { steps: 5 });
    await page.mouse.move(target!.x + target!.width / 2, target!.y + 100, {
      steps: 20,
    });
    await page.waitForTimeout(300);
    await page.mouse.up();
    await expect
      .poll(async () => {
        const d = await (await request.get("/api/data")).json();
        return d.columns.find(
          (c: any) =>
            c.id ===
            d.tasks.find((t: any) => t.title === "Design a calmer workflow")
              .column_id,
        ).name;
      })
      .toBe("In Progress");
    await page.reload();
    await expect(
      page
        .locator(".lane")
        .nth(2)
        .getByRole("button", { name: "Design a calmer workflow", exact: true }),
    ).toBeVisible();
    const staleResult = await request.put("/api/data", {
      headers: { Origin: origin, "If-Match": String(stale.revision) },
      data: stale,
    });
    expect(staleResult.status()).toBe(409);
    await page.getByRole("button", { name: "List", exact: true }).click();
    await page
      .getByRole("button", {
        name: "Complete Design a calmer workflow",
        exact: true,
      })
      .click();
    await expect(
      page.getByRole("button", {
        name: "Reopen Design a calmer workflow",
        exact: true,
      }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Calendar", exact: true }).click();
    await expect(page.locator(".calendar-grid")).toBeVisible();
    await page.getByRole("button", { name: "Overview", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Recently completed" }),
    ).toBeVisible();
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Backup", exact: true }).click();
    expect((await download).suggestedFilename()).toBe("lightboard-backup.json");
    await page.getByRole("button", { name: "Board", exact: true }).click();
    await page
      .getByRole("button", { name: "Ship the first version", exact: true })
      .click();
    await page.getByLabel("Task title").fill("Ship with confidence");
    await page.route("**/api/data", async (route) => {
      if (route.request().method() === "PUT")
        await route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({ error: "Test database outage" }),
        });
      else await route.continue();
    });
    await page.getByRole("button", { name: "Save task", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText("Test database outage");
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.unroute("**/api/data");
    await page.getByRole("button", { name: "Save task", exact: true }).click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
    // Inline creation and confirmed deletion are exercised through the UI.
    await page
      .locator(".lane")
      .first()
      .getByRole("button", { name: "Add task", exact: true })
      .click();
    await page.getByLabel("New task in Backlog").fill("Temporary task");
    await page.getByLabel("New task in Backlog").press("Enter");
    await page
      .getByRole("button", { name: "Temporary task", exact: true })
      .click();
    page.once("dialog", (d) => d.accept());
    await page
      .getByRole("button", { name: "Delete task", exact: true })
      .click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await expect(
      page.getByRole("button", { name: "Temporary task", exact: true }),
    ).toHaveCount(0);
    // Restore the downloaded JSON and verify that it actually replaces edits.
    const backupPath = await (await download).path();
    page.once("dialog", (d) => d.accept());
    await page.locator("input[type=file]").setInputFiles(backupPath!);
    await expect(
      page.getByRole("button", { name: "Ship the first version", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Ship with confidence", exact: true }),
    ).toHaveCount(0);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    await expect(
      page.getByRole("heading", { name: /^Release planning/ }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({ path: "test-results/mobile.png", fullPage: true });
    await page.setViewportSize({ width: 1440, height: 960 });
    await page.getByRole("button", { name: "Toggle sidebar" }).click();
    await page.screenshot({ path: "test-results/board.png", fullPage: true });
  } finally {
    const final = await (await request.get("/api/data")).json();
    // Restore original empty data; no real user data is ever seeded.
    expect(
      (
        await request.put("/api/data", {
          headers: { Origin: origin, "If-Match": String(final.revision) },
          data: initial,
        })
      ).ok(),
    ).toBe(true);
  }
});
