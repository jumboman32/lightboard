import { test, expect } from "@playwright/test";
test("500 tasks persist, render and remain editable", async ({
  page,
  request,
}) => {
  const initial = await (await request.get("/api/data")).json();
  expect(initial.projects).toHaveLength(0);
  const origin = "http://127.0.0.1:8788";
  const date = new Date().toISOString();
  const d = {
    projects: [
      {
        id: "volume-project",
        name: "Volume test",
        icon: "◈",
        color: "#7460db",
        favorite: 0,
        archived: 0,
        created_at: date,
      },
    ],
    columns: [
      {
        id: "volume-column",
        project_id: "volume-project",
        name: "Backlog",
        color: "#7460db",
        position: 0,
        completed: 0,
      },
    ],
    tasks: Array.from({ length: 500 }, (_, i) => ({
      id: `task-${i}`,
      project_id: "volume-project",
      column_id: "volume-column",
      title: `Task ${i}`,
      description: "",
      priority: "medium",
      due_date: null,
      start_date: null,
      labels: [],
      checklist: [],
      position: i,
      archived: 0,
      created_at: date,
      completed_at: null,
    })),
  };
  try {
    expect(
      (
        await request.put("/api/data", {
          headers: { Origin: origin, "If-Match": String(initial.revision) },
          data: d,
        })
      ).ok(),
    ).toBe(true);
    await page.goto("/");
    await expect(page.locator(".task-card")).toHaveCount(500);
    await page.getByLabel("Search all tasks").fill("Task 499");
    await page.getByRole("button", { name: "Task 499", exact: true }).click();
    await page.getByLabel("Task title").fill("Updated final task");
    await page.getByRole("button", { name: "Save task", exact: true }).click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
    const saved = await (await request.get("/api/data")).json();
    expect(saved.tasks.find((t: any) => t.id === "task-499").title).toBe(
      "Updated final task",
    );
  } finally {
    const saved = await (await request.get("/api/data")).json();
    expect(
      (
        await request.put("/api/data", {
          headers: { Origin: origin, "If-Match": String(saved.revision) },
          data: initial,
        })
      ).ok(),
    ).toBe(true);
  }
});
