import { describe, it, expect } from "vitest";
import worker, { authorized } from "../worker";
const env = {
  DB: {} as D1Database,
  ASSETS: {} as Fetcher,
  SINGLE_USER_KEY: crypto.randomUUID(),
};
const login = (key: string, origin = "https://private.workers.dev") =>
  worker.fetch(
    new Request("https://private.workers.dev/api/session", {
      method: "POST",
      headers: { Origin: origin, "Content-Type": "application/json" },
      body: JSON.stringify({ key }),
    }),
    env,
  );
describe("single-user access-key sessions", () => {
  it("issues a secure HttpOnly cookie that authorizes API access", async () => {
    const r = await login(env.SINGLE_USER_KEY);
    expect(r.status).toBe(200);
    const cookie = r.headers.get("set-cookie")!;
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("SameSite=Strict");
    expect(
      await authorized(
        new Request("https://private.workers.dev/api/data", {
          headers: { Cookie: cookie.split(";")[0] },
        }),
        env,
      ),
    ).toBe(true);
  });
  it("rejects invalid keys and foreign origins", async () => {
    expect((await login("wrong")).status).toBe(401);
    expect(
      (await login(env.SINGLE_USER_KEY, "https://evil.example")).status,
    ).toBe(403);
  });
  it("rejects forged sessions and revokes them when the key rotates", async () => {
    expect(
      await authorized(
        new Request("https://private.workers.dev/api/data", {
          headers: { Cookie: "lightboard_session=forged" },
        }),
        env,
      ),
    ).toBe(false);
    const r = await login(env.SINGLE_USER_KEY);
    expect(
      await authorized(
        new Request("https://private.workers.dev/api/data", {
          headers: { Cookie: r.headers.get("set-cookie")!.split(";")[0] },
        }),
        { ...env, SINGLE_USER_KEY: "new-key-".repeat(10) },
      ),
    ).toBe(false);
  });
  it("sign out expires the cookie", async () => {
    const r = await worker.fetch(
      new Request("https://private.workers.dev/api/session", {
        method: "DELETE",
        headers: { Origin: "https://private.workers.dev" },
      }),
      env,
    );
    expect(r.status).toBe(204);
    expect(r.headers.get("set-cookie")).toContain("Max-Age=0");
  });
});
