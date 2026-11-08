import type { Data } from "./model";
export function validate(d: Data) {
  if (
    !d ||
    !Array.isArray(d.projects) ||
    !Array.isArray(d.columns) ||
    !Array.isArray(d.tasks)
  )
    throw Error("Invalid backup");
  if (
    d.projects.length > 100 ||
    d.columns.length > 500 ||
    d.tasks.length > 5000
  )
    throw Error("Instance limit exceeded");
  const ids = new Set<string>();
  const id = (s: unknown) => {
    if (typeof s !== "string" || !s || s.length > 100 || ids.has(s))
      throw Error("Invalid or duplicate ID");
    ids.add(s);
  };
  const str = (s: unknown, n: number) => {
    if (typeof s !== "string" || s.length > n) throw Error("Invalid text");
  };
  const date = (s: unknown) => {
    if (s !== null && (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)))
      throw Error("Invalid date");
  };
  d.projects.forEach((p) => {
    id(p.id);
    str(p.name, 120);
    if (!p.name.trim()) throw Error("Name required");
    str(p.icon, 16);
    str(p.color, 30);
    str(p.created_at, 40);
    if (![0, 1].includes(p.favorite) || ![0, 1].includes(p.archived))
      throw Error("Invalid flags");
  });
  d.columns.forEach((c) => {
    id(c.id);
    str(c.name, 80);
    str(c.color, 30);
    if (
      !d.projects.some((p) => p.id === c.project_id) ||
      !Number.isFinite(c.position) ||
      ![0, 1].includes(c.completed)
    )
      throw Error("Invalid column");
  });
  d.tasks.forEach((t) => {
    id(t.id);
    str(t.title, 300);
    str(t.description, 20000);
    if (
      !t.title.trim() ||
      !d.columns.some(
        (c) => c.id === t.column_id && c.project_id === t.project_id,
      ) ||
      !Number.isFinite(t.position) ||
      !["low", "medium", "high", "urgent"].includes(t.priority) ||
      ![0, 1].includes(t.archived)
    )
      throw Error("Invalid task");
    date(t.due_date);
    date(t.start_date);
    str(t.created_at, 40);
    if (t.completed_at !== null) str(t.completed_at, 40);
    if (
      !Array.isArray(t.labels) ||
      t.labels.length > 30 ||
      !Array.isArray(t.checklist) ||
      t.checklist.length > 100
    )
      throw Error("Invalid details");
    t.labels.forEach((l) => str(l, 60));
    t.checklist.forEach((i) => {
      str(i.id, 100);
      str(i.text, 500);
      if (typeof i.done !== "boolean") throw Error("Invalid checklist");
    });
  });
  return d;
}
