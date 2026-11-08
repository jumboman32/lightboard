import { test, expect } from "@playwright/test";
test("projects isolate tasks and deletion cascades safely", async ({
  page,
  request,
}) => {
  const initial = await (await request.get("/api/data")).json();
  expect(initial.projects).toHaveLength(0);
  try {
    await page.goto("/");
    await page
      .getByRole("button", { name: "Create your first project" })
      .click();
    await page.getByLabel("Project name").fill("First project");
    await page.getByRole("button", { name: "Save project" }).click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await page
      .locator(".lane")
      .first()
      .getByRole("button", { name: "Add task", exact: true })
      .click();
    await page.getByLabel("New task in Backlog").fill("Only in first project");
    await page.getByLabel("New task in Backlog").press("Enter");
    await expect(
      page.getByRole("button", { name: "Only in first project", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Create project", exact: true })
      .click();
    await page.getByLabel("Project name").fill("Second project");
    await page.getByRole("button", { name: "Save project" }).click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await expect(
      page.getByRole("heading", { name: /^Second project/ }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Only in first project", exact: true }),
    ).toHaveCount(0);
    await page
      .locator("nav")
      .getByRole("button", { name: /First project/ })
      .click();
    await expect(
      page.getByRole("button", { name: "Only in first project", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Project", exact: true }).click();
    page.once("dialog", (d) => d.accept());
    await page
      .getByRole("button", { name: "Delete project", exact: true })
      .click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
    const d = await (await request.get("/api/data")).json();
    expect(d.projects.map((p: any) => p.name)).toEqual(["Second project"]);
    expect(d.tasks).toHaveLength(0);
    expect(d.columns).toHaveLength(4);
  } finally {
    const d = await (await request.get("/api/data")).json();
    expect(
      (
        await request.put("/api/data", {
          headers: {
            Origin: "http://127.0.0.1:8788",
            "If-Match": String(d.revision),
          },
          data: initial,
        })
      ).ok(),
    ).toBe(true);
  }
});
