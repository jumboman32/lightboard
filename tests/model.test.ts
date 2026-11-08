import { describe, it, expect } from "vitest";
import { moveTask, type Data, type Task } from "../src/model";
import { authorized, validate } from "../worker";
const task = (id: string, column_id = "todo", position = 0): Task => ({
  id,
  project_id: "p",
  column_id,
  title: id,
  description: "",
  priority: "medium",
  due_date: null,
  start_date: null,
  labels: [],
  checklist: [],
  position,
  archived: 0,
  created_at: "2026-01-01T00:00:00Z",
  completed_at: null,
});
const fixture = (): Data => ({
  projects: [
    {
      id: "p",
      name: "Project",
      color: "#000000",
      icon: "◈",
      favorite: 0,
      archived: 0,
      created_at: "2026-01-01",
    },
  ],
  columns: [
    {
      id: "todo",
      project_id: "p",
      name: "To Do",
      color: "#000000",
      position: 0,
      completed: 0,
    },
    {
      id: "done",
      project_id: "p",
      name: "Completed",
      color: "#000000",
      position: 1,
      completed: 1,
    },
  ],
  tasks: [task("a"), task("b", "todo", 1), task("c", "todo", 2)],
});
describe("persistent task ordering", () => {
  it("reorders without mutating the original", () => {
    const d = fixture(),
      next = moveTask(d, "c", "todo", "a");
    expect(
      next.tasks.sort((a, b) => a.position - b.position).map((t) => t.id),
    ).toEqual(["c", "a", "b"]);
    expect(d.tasks[2].position).toBe(2);
  });
  it("records completion and clears it when reopened", () => {
    const d = moveTask(fixture(), "a", "done");
    expect(d.tasks[0].completed_at).toBeTruthy();
    expect(moveTask(d, "a", "todo").tasks[0].completed_at).toBeNull();
  });
  it("rejects moves to other projects", () => {
    const d = fixture();
    d.columns[1].project_id = "other";
    expect(moveTask(d, "a", "done")).toBe(d);
  });
  it("keeps order across serialization", () => {
    const d = JSON.parse(JSON.stringify(moveTask(fixture(), "c", "todo", "b")));
    expect(
      d.tasks
        .sort((a: Task, b: Task) => a.position - b.position)
        .map((t: Task) => t.id),
    ).toEqual(["a", "c", "b"]);
  });
});
describe("backup validation", () => {
  it("accepts round trips", () =>
    expect(validate(JSON.parse(JSON.stringify(fixture())))).toEqual(fixture()));
  it("rejects dangling relationships", () => {
    const d = fixture();
    d.tasks[0].column_id = "missing";
    expect(() => validate(d)).toThrow();
  });
  it("rejects duplicate IDs", () => {
    const d = fixture();
    d.tasks[1].id = "a";
    expect(() => validate(d)).toThrow();
  });
  it("rejects malformed checklist and unbounded data", () => {
    const d = fixture();
    d.tasks[0].checklist = [{ id: "x", text: "x", done: "yes" as any }];
    expect(() => validate(d)).toThrow();
    d.tasks[0].checklist = [];
    d.tasks[0].title = "x".repeat(301);
    expect(() => validate(d)).toThrow();
  });
});
describe("authorization", () => {
  const env = { DB: {} as D1Database, ASSETS: {} as Fetcher };
  it("fails closed without configuration", async () =>
    expect(
      await authorized(
        new Request("https://example.workers.dev/api/data"),
        env,
      ),
    ).toBe(false));
  it("never accepts local bypass on production host", async () =>
    expect(
      await authorized(new Request("https://example.workers.dev/api/data"), {
        ...env,
        LOCAL_DEV: "true",
      }),
    ).toBe(false));
  it("allows explicit loopback development", async () =>
    expect(
      await authorized(new Request("http://127.0.0.1:8787/api/data"), {
        ...env,
        LOCAL_DEV: "true",
      }),
    ).toBe(true));
  it("rejects forged JWTs", async () =>
    expect(
      await authorized(
        new Request("https://example.workers.dev/api/data", {
          headers: { "Cf-Access-Jwt-Assertion": "fake" },
        }),
        {
          ...env,
          ACCESS_TEAM_DOMAIN: "https://example.cloudflareaccess.com",
          ACCESS_AUD: "test",
        },
      ),
    ).toBe(false));
});
