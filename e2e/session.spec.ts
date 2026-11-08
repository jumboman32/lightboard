import { test, expect } from "@playwright/test";
test("unauthorized workspace shows sign-in and recovers after login", async ({
  page,
}) => {
  let signedIn = false;
  await page.route("**/api/data", async (route) => {
    if (!signedIn)
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ error: "Authentication required" }),
      });
    else await route.continue();
  });
  await page.route("**/api/session", async (route) => {
    const { key } = route.request().postDataJSON();
    signedIn = key === "test-key";
    await route.fulfill({
      status: signedIn ? 200 : 401,
      contentType: "application/json",
      body: JSON.stringify(
        signedIn ? { ok: true } : { error: "Invalid access key" },
      ),
    });
  });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await page.getByLabel("Instance access key").fill("wrong");
  await page.getByRole("button", { name: "Open workspace" }).click();
  await expect(page.getByRole("alert")).toContainText("Invalid access key");
  await page.getByLabel("Instance access key").fill("test-key");
  await page.getByRole("button", { name: "Open workspace" }).click();
  await expect(
    page.getByRole("button", { name: "Create your first project" }),
  ).toBeVisible();
});
