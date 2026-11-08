import { validate } from "../src/validation";
export { validate } from "../src/validation";
import { createRemoteJWKSet, jwtVerify, SignJWT } from "jose";
import type { Data } from "../src/model";
interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  LOCAL_DEV?: string;
  ACCESS_TEAM_DOMAIN?: string;
  ACCESS_AUD?: string;
  SINGLE_USER_KEY?: string;
}
const json = (body: unknown, status = 200) =>
  Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
const keys = new Map<string, ReturnType<typeof createRemoteJWKSet>>();
export async function authorized(r: Request, e: Env) {
  if (
    e.LOCAL_DEV === "true" &&
    ["localhost", "127.0.0.1", "[::1]"].includes(new URL(r.url).hostname)
  )
    return true;
  if (e.SINGLE_USER_KEY && e.SINGLE_USER_KEY.length >= 32) {
    const token = r.headers
      .get("Cookie")
      ?.split(";")
      .map((c) => c.trim())
      .find((c) => c.startsWith("lightboard_session="))
      ?.slice("lightboard_session=".length);
    if (token)
      try {
        await jwtVerify(token, new TextEncoder().encode(e.SINGLE_USER_KEY), {
          algorithms: ["HS256"],
          issuer: "lightboard",
          audience: "single-user",
        });
        return true;
      } catch {}
  }
  if (!e.ACCESS_TEAM_DOMAIN || !e.ACCESS_AUD) return false;
  try {
    const issuer = e.ACCESS_TEAM_DOMAIN.replace(/\/$/, "");
    if (!/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(issuer))
      return false;
    let key = keys.get(issuer);
    if (!key) {
      key = createRemoteJWKSet(new URL(issuer + "/cdn-cgi/access/certs"));
      keys.set(issuer, key);
    }
    await jwtVerify(r.headers.get("Cf-Access-Jwt-Assertion") || "", key, {
      issuer,
      audience: e.ACCESS_AUD,
    });
    return true;
  } catch {
    return false;
  }
}
async function load(db: D1Database): Promise<Data> {
  const r = await db.batch([
    db.prepare("SELECT * FROM projects ORDER BY created_at"),
    db.prepare("SELECT * FROM columns ORDER BY position"),
    db.prepare("SELECT * FROM tasks ORDER BY position"),
    db.prepare("SELECT version FROM revisions WHERE id=1"),
  ]);
  return {
    revision: Number((r[3].results[0] as { version: number }).version),
    projects: r[0].results,
    columns: r[1].results,
    tasks: r[2].results.map((t: any) => ({
      ...t,
      labels: JSON.parse(t.labels),
      checklist: JSON.parse(t.checklist),
    })),
  } as Data;
}
export default {
  async fetch(r: Request, e: Env) {
    const url = new URL(r.url);
    if (!url.pathname.startsWith("/api/")) return e.ASSETS.fetch(r);
    if (url.pathname === "/api/session") {
      if (r.headers.get("Origin") !== url.origin)
        return json({ error: "Invalid origin" }, 403);
      const secure = url.protocol === "https:" ? "; Secure" : "";
      if (r.method === "DELETE")
        return new Response(null, {
          status: 204,
          headers: {
            "Set-Cookie": `lightboard_session=; HttpOnly; SameSite=Strict; Path=/api; Max-Age=0${secure}`,
            "Cache-Control": "no-store",
          },
        });
      if (r.method !== "POST")
        return json({ error: "Method not allowed" }, 405);
      if (!e.SINGLE_USER_KEY || e.SINGLE_USER_KEY.length < 32)
        return json(
          {
            error: "Access-key login is not configured. Use Cloudflare Access.",
          },
          401,
        );
      const raw = await r.text();
      if (raw.length > 1024) return json({ error: "Invalid access key" }, 401);
      let key = "";
      try {
        key = (JSON.parse(raw) as { key: string }).key;
      } catch {
        return json({ error: "Invalid access key" }, 401);
      }
      if (typeof key !== "string" || key.length > 512)
        return json({ error: "Invalid access key" }, 401);
      const digest = async (v: string) =>
        new Uint8Array(
          await crypto.subtle.digest("SHA-256", new TextEncoder().encode(v)),
        );
      const [a, b] = await Promise.all([
        digest(key),
        digest(e.SINGLE_USER_KEY),
      ]);
      let difference = 0;
      for (let i = 0; i < a.length; i++) difference |= a[i] ^ b[i];
      if (difference) return json({ error: "Invalid access key" }, 401);
      const token = await new SignJWT({})
        .setProtectedHeader({ alg: "HS256" })
        .setIssuer("lightboard")
        .setAudience("single-user")
        .setIssuedAt()
        .setExpirationTime("7d")
        .sign(new TextEncoder().encode(e.SINGLE_USER_KEY));
      return new Response(JSON.stringify({ ok: true }), {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
          "Set-Cookie": `lightboard_session=${token}; HttpOnly; SameSite=Strict; Path=/api; Max-Age=604800${secure}`,
        },
      });
    }
    if (!(await authorized(r, e)))
      return json(
        {
          error:
            "Authentication required. Sign in through Cloudflare Access; locally, configure .dev.vars.",
        },
        401,
      );
    if (r.method !== "GET" && r.headers.get("Origin") !== url.origin)
      return json({ error: "Invalid origin" }, 403);
    try {
      if (url.pathname !== "/api/data")
        return json({ error: "Not found" }, 404);
      if (r.method === "GET") return json(await load(e.DB));
      if (r.method !== "PUT") return json({ error: "Method not allowed" }, 405);
      const raw = await r.text();
      if (raw.length > 2_000_000)
        return json({ error: "Backup too large" }, 413);
      let d: Data;
      try {
        d = validate(JSON.parse(raw));
      } catch (err) {
        return json(
          { error: err instanceof Error ? err.message : "Invalid data" },
          400,
        );
      }
      const old = await load(e.DB),
        s: D1PreparedStatement[] = [];
      const oldProjects = new Map(old.projects.map((p) => [p.id, p]));
      const oldColumns = new Map(old.columns.map((c) => [c.id, c]));
      const oldTasks = new Map(old.tasks.map((t) => [t.id, t]));
      const newProjects = new Set(d.projects.map((p) => p.id));
      const newColumns = new Set(d.columns.map((c) => c.id));
      const newTasks = new Set(d.tasks.map((t) => t.id));
      // A failed revision guard rolls back the entire batch, including simultaneous writes.
      const expected = Number(r.headers.get("If-Match"));
      if (!Number.isSafeInteger(expected) || expected !== old.revision)
        return json(
          { error: "Data changed in another tab. Reload before saving." },
          409,
        );
      s.push(
        e.DB.prepare(
          "UPDATE revisions SET version=CASE WHEN version=? THEN version+1 ELSE NULL END WHERE id=1",
        ).bind(expected),
      );
      for (const t of old.tasks)
        if (!newTasks.has(t.id))
          s.push(e.DB.prepare("DELETE FROM tasks WHERE id=?").bind(t.id));
      for (const p of d.projects)
        if (JSON.stringify(p) !== JSON.stringify(oldProjects.get(p.id)))
          s.push(
            e.DB.prepare(
              "INSERT INTO projects VALUES (?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,color=excluded.color,icon=excluded.icon,favorite=excluded.favorite,archived=excluded.archived,created_at=excluded.created_at",
            ).bind(
              p.id,
              p.name,
              p.color,
              p.icon,
              p.favorite,
              p.archived,
              p.created_at,
            ),
          );
      for (const c of d.columns)
        if (JSON.stringify(c) !== JSON.stringify(oldColumns.get(c.id)))
          s.push(
            e.DB.prepare(
              "INSERT INTO columns VALUES (?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET project_id=excluded.project_id,name=excluded.name,color=excluded.color,position=excluded.position,completed=excluded.completed",
            ).bind(
              c.id,
              c.project_id,
              c.name,
              c.color,
              c.position,
              c.completed,
            ),
          );
      for (const t of d.tasks)
        if (JSON.stringify(t) !== JSON.stringify(oldTasks.get(t.id)))
          s.push(
            e.DB.prepare(
              "INSERT INTO tasks VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET project_id=excluded.project_id,column_id=excluded.column_id,title=excluded.title,description=excluded.description,priority=excluded.priority,due_date=excluded.due_date,start_date=excluded.start_date,labels=excluded.labels,checklist=excluded.checklist,position=excluded.position,archived=excluded.archived,completed_at=excluded.completed_at,created_at=excluded.created_at",
            ).bind(
              t.id,
              t.project_id,
              t.column_id,
              t.title,
              t.description,
              t.priority,
              t.due_date,
              t.start_date,
              JSON.stringify(t.labels),
              JSON.stringify(t.checklist),
              t.position,
              t.archived,
              t.created_at,
              t.completed_at,
            ),
          );
      for (const c of old.columns)
        if (!newColumns.has(c.id))
          s.push(e.DB.prepare("DELETE FROM columns WHERE id=?").bind(c.id));
      for (const p of old.projects)
        if (!newProjects.has(p.id))
          s.push(e.DB.prepare("DELETE FROM projects WHERE id=?").bind(p.id));
      if (s.length) await e.DB.batch(s);
      return json(await load(e.DB));
    } catch (err) {
      console.error(err);
      return json(
        {
          error:
            "Database operation failed. Reload to confirm the latest saved data.",
        },
        503,
      );
    }
  },
};
