import { test, expect } from "@playwright/test";
test("API validates mutations, blocks cross-origin writes and serializes simultaneous saves", async ({
  request,
}) => {
  const d = await (await request.get("/api/data")).json();
  const headers = {
    Origin: "http://127.0.0.1:8788",
    "If-Match": String(d.revision),
  };
  expect((await request.put("/api/data", { data: d })).status()).toBe(403);
  expect(
    (
      await request.put("/api/data", { headers, data: { projects: [] } })
    ).status(),
  ).toBe(400);
  const results = await Promise.all([
    request.put("/api/data", { headers, data: d }),
    request.put("/api/data", { headers, data: d }),
  ]);
  expect(results.filter((r) => r.ok())).toHaveLength(1);
  expect(results.filter((r) => !r.ok())).toHaveLength(1);
  const next = await (await request.get("/api/data")).json();
  expect(next.revision).toBe(d.revision + 1);
  expect(next.tasks).toEqual(d.tasks);
});
