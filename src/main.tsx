import React, { useState, useEffect, useRef, lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDroppable,
  closestCorners,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  LayoutDashboard,
  Columns3,
  List,
  CalendarDays,
  Plus,
  Search,
  Sun,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Download,
  Upload,
  Check,
  GripVertical,
  X,
  Trash2,
  Copy,
  Archive,
  Star,
  Settings2,
} from "lucide-react";
import {
  moveTask,
  today,
  type Data,
  type Task,
  type Column,
  type Project,
} from "./model";
import "./style.css";
import { validate } from "./validation";
const Secondary = lazy(() => import("./views"));
const empty: Data = { projects: [], columns: [], tasks: [] };
const uid = () => crypto.randomUUID();
const now = () => new Date().toISOString();
async function api(init?: RequestInit): Promise<Data> {
  const r = await fetch("/api/data", init);
  const d = (await r.json()) as Data & { error?: string };
  if (!r.ok)
    throw Object.assign(Error(d.error || "Request failed"), {
      status: r.status,
    });
  return d;
}
function download(name: string, text: string, type = "application/json") {
  const u = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = u;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(u), 1000);
}
function Card({ task, onOpen }: { task: Task; onOpen: () => void }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });
  return (
    <article
      ref={setNodeRef}
      className={`task-card ${isDragging ? "dragging" : ""}`}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <div className="card-top">
        <div className="labels">
          {task.labels.map((l) => (
            <span key={l}>{l}</span>
          ))}
        </div>
        <button
          className="drag-handle icon"
          aria-label={`Move ${task.title}`}
          {...attributes}
          {...listeners}
        >
          <GripVertical size={15} />
        </button>
      </div>
      <button className="card-title" onClick={onOpen}>
        {task.title}
      </button>
      {task.description && (
        <p className="card-description">{task.description}</p>
      )}
      <div className="card-bottom">
        <span className={`priority ${task.priority}`}>
          <i />
          {task.priority}
        </span>
        <span>
          {task.checklist.length > 0 &&
            `${task.checklist.filter((i) => i.done).length}/${task.checklist.length} ✓`}
        </span>
        {task.due_date && (
          <span
            className={
              !task.completed_at && task.due_date < today() ? "overdue" : ""
            }
          >
            {new Date(task.due_date + "T12:00:00").toLocaleDateString(
              undefined,
              { month: "short", day: "numeric" },
            )}
          </span>
        )}
      </div>
    </article>
  );
}
function Lane({
  column,
  tasks,
  open,
  add,
  edit,
}: {
  column: Column;
  tasks: Task[];
  open: (t: Task) => void;
  add: (title?: string) => Promise<boolean>;
  edit: () => void;
}) {
  const [inlineTitle, setInlineTitle] = useState<string | null>(null);
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  return (
    <section
      ref={setNodeRef}
      className={`lane ${isOver ? "over" : ""}`}
      style={{ "--column-color": column.color } as React.CSSProperties}
    >
      <header className="lane-header">
        <span className="dot" style={{ background: column.color }} />
        <h3>{column.name}</h3>
        <span className="count">{tasks.length}</span>
        <button
          className="icon"
          aria-label={`Edit ${column.name}`}
          onClick={edit}
        >
          <Settings2 size={14} />
        </button>
        <button
          className="icon"
          aria-label={`Add task to ${column.name}`}
          onClick={() => void add()}
        >
          <Plus size={17} />
        </button>
      </header>
      <SortableContext
        items={tasks.map((t) => t.id)}
        strategy={verticalListSortingStrategy}
      >
        {tasks.map((t) => (
          <Card key={t.id} task={t} onOpen={() => open(t)} />
        ))}
      </SortableContext>
      {inlineTitle === null ? (
        <button className="lane-add" onClick={() => setInlineTitle("")}>
          <Plus size={16} /> Add task
        </button>
      ) : (
        <form
          className="inline-add"
          onSubmit={async (e) => {
            e.preventDefault();
            if (inlineTitle.trim() && (await add(inlineTitle.trim())))
              setInlineTitle(null);
          }}
        >
          <input
            autoFocus
            required
            maxLength={300}
            aria-label={`New task in ${column.name}`}
            placeholder="Task title…"
            value={inlineTitle}
            onChange={(e) => setInlineTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setInlineTitle(null);
            }}
          />
          <div>
            <button className="button primary">Add task</button>
            <button
              type="button"
              className="icon"
              aria-label="Cancel task creation"
              onClick={() => setInlineTitle(null)}
            >
              <X size={15} />
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
function Login() {
  const [key, setKey] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <div className="login-page">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            const r = await fetch("/api/session", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ key }),
            });
            if (!r.ok) {
              const d = (await r.json()) as { error: string };
              throw Error(d.error);
            }
            location.reload();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <span className="brand-mark">
          <Columns3 size={24} />
        </span>
        <h1>Sign in</h1>
        <label>
          Instance access key
          <input
            type="password"
            required
            autoComplete="current-password"
            aria-label="Instance access key"
            value={key}
            onChange={(e) => setKey(e.target.value)}
          />
        </label>
        {error && <p role="alert">{error}</p>}
        <button className="button primary" disabled={busy}>
          {busy ? "Signing in…" : "Open workspace"}
        </button>
      </form>
    </div>
  );
}
function App() {
  const [data, setData] = useState<Data>(empty),
    [loading, setLoading] = useState(true),
    [authRequired, setAuthRequired] = useState(false),
    [saving, setSaving] = useState(false),
    [error, setError] = useState("");
  const live = useRef(data),
    busy = useRef(false);
  const [projectId, setProjectId] = useState(""),
    [view, setView] = useState("board"),
    [query, setQuery] = useState(""),
    [priority, setPriority] = useState("all"),
    [sort, setSort] = useState("manual");
  const [collapsed, setCollapsed] = useState(window.innerWidth < 801),
    [theme, setTheme] = useState(localStorage.getItem("theme") || "light"),
    [accent, setAccent] = useState(localStorage.getItem("accent") || "#7460db");
  const [draft, setDraft] = useState<Task | null>(null),
    [projectDraft, setProjectDraft] = useState<Project | null>(null),
    [columnDraft, setColumnDraft] = useState<Column | null>(null),
    [help, setHelp] = useState(false),
    [showArchived, setShowArchived] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null),
    importRef = useRef<HTMLInputElement>(null),
    dialogRef = useRef<HTMLDialogElement>(null);
  const modal = !!(draft || projectDraft || columnDraft || help);
  useEffect(() => {
    api()
      .then((d) => {
        live.current = d;
        setData(d);
        setProjectId(d.projects.find((p) => !p.archived)?.id || "");
      })
      .catch((e) => {
        if (e.status === 401) setAuthRequired(true);
        else setError(e.message);
      })
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("theme", theme);
  }, [theme]);
  useEffect(() => {
    document.documentElement.style.setProperty("--accent", accent);
    localStorage.setItem("accent", accent);
  }, [accent]);
  useEffect(() => {
    if (modal && !dialogRef.current?.open) dialogRef.current?.showModal();
    if (!modal) dialogRef.current?.close();
  }, [modal]);
  async function save(next: Data) {
    if (busy.current) return false;
    const previous = live.current;
    busy.current = true;
    setSaving(true);
    setError("");
    live.current = next;
    setData(next);
    try {
      const result = await api({
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "If-Match": String(previous.revision ?? 0),
        },
        body: JSON.stringify(next),
      });
      live.current = result;
      setData(result);
      return true;
    } catch (e) {
      live.current = previous;
      setData(previous);
      setError((e as Error).message);
      return false;
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }
  const project = data.projects.find((p) => p.id === projectId);
  const columns = data.columns
    .filter((c) => c.project_id === projectId)
    .sort((a, b) => a.position - b.position);
  let visible = data.tasks.filter(
    (t) =>
      (view === "dashboard" || query || t.project_id === projectId) &&
      !!t.archived === showArchived &&
      (!query ||
        [t.title, t.description, ...t.labels]
          .join(" ")
          .toLowerCase()
          .includes(query.toLowerCase())) &&
      (priority === "all" || t.priority === priority),
  );
  if (sort === "due")
    visible.sort((a, b) =>
      (a.due_date || "9999").localeCompare(b.due_date || "9999"),
    );
  else if (sort === "priority") {
    const p = { urgent: 0, high: 1, medium: 2, low: 3 };
    visible.sort((a, b) => p[a.priority] - p[b.priority]);
  } else visible.sort((a, b) => a.position - b.position);
  async function newTask(columnId = columns[0]?.id, inlineTitle?: string) {
    if (!project || !columnId) return false;
    const task: Task = {
      id: uid(),
      project_id: projectId,
      column_id: columnId,
      title: inlineTitle || "",
      description: "",
      priority: "medium",
      due_date: null,
      start_date: null,
      labels: [],
      checklist: [],
      position:
        Math.max(
          -1,
          ...data.tasks
            .filter((t) => t.column_id === columnId)
            .map((t) => t.position),
        ) + 1,
      archived: 0,
      created_at: now(),
      completed_at: columns.find((c) => c.id === columnId)?.completed
        ? now()
        : null,
    };
    if (inlineTitle) return save({ ...data, tasks: [...data.tasks, task] });
    setDraft(task);
    return true;
  }
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).matches("input,textarea,select") || modal)
        return;
      if (e.key === "n") {
        e.preventDefault();
        newTask();
      }
      if (e.key === "/") {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === "?") setHelp(true);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [projectId, data, modal]);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  function dragEnd(e: DragEndEvent) {
    if (!e.over || busy.current || query || sort !== "manual") return;
    const target = data.tasks.find((t) => t.id === e.over!.id);
    const col = target?.column_id || String(e.over.id);
    if (e.active.id !== e.over.id) {
      const active = data.tasks.find((t) => t.id === e.active.id);
      const siblings = data.tasks
        .filter((t) => t.column_id === col)
        .sort((a, b) => a.position - b.position);
      const movingDown =
        active?.column_id === col &&
        target &&
        active.position < target.position;
      const before = movingDown
        ? siblings[siblings.findIndex((t) => t.id === target.id) + 1]?.id
        : target?.id;
      void save(moveTask(data, String(e.active.id), col, before));
    }
  }
  function toggle(t: Task) {
    const cols = data.columns.filter((c) => c.project_id === t.project_id);
    const col = t.completed_at
      ? cols.find((c) => !c.completed)
      : cols.find((c) => c.completed);
    if (col) void save(moveTask(data, t.id, col.id));
  }
  function close() {
    setDraft(null);
    setProjectDraft(null);
    setColumnDraft(null);
    setHelp(false);
  }
  function exportCSV() {
    const rows = [
      ["Title", "Project", "Status", "Priority", "Due date", "Description"],
      ...data.tasks.map((t) => [
        t.title,
        data.projects.find((p) => p.id === t.project_id)?.name || "",
        data.columns.find((c) => c.id === t.column_id)?.name || "",
        t.priority,
        t.due_date || "",
        t.description,
      ]),
    ];
    download(
      "lightboard.csv",
      rows
        .map((row) =>
          row
            .map(
              (v) =>
                '"' +
                String(/^[=+@\-]/.test(v) ? "'" + v : v).replaceAll('"', '""') +
                '"',
            )
            .join(","),
        )
        .join("\r\n"),
      "text/csv",
    );
  }
  async function importData(file: File) {
    try {
      if (file.size > 2_000_000) throw Error("Backup too large");
      const imported = validate(JSON.parse(await file.text()));
      if (
        !confirm(
          "Replace all current data with this backup? Export a backup first.",
        )
      )
        return;
      if (await save(imported)) {
        setProjectId(
          imported.projects.find((p) => !p.archived)?.id ||
            imported.projects[0]?.id ||
            "",
        );
        setView("board");
      }
    } catch (e) {
      setError((e as Error).message);
    }
  }
  if (authRequired) return <Login />;
  return (
    <div className={`app ${collapsed ? "collapsed" : ""}`}>
      <aside className="sidebar">
        <a className="brand" href="#" onClick={(e) => e.preventDefault()}>
          <span className="brand-mark">
            <Columns3 size={20} />
          </span>
          <strong>lightboard</strong>
        </a>
        <button
          className={`nav-item ${view === "dashboard" ? "active" : ""}`}
          onClick={() => {
            setView("dashboard");
            setQuery("");
          }}
        >
          <LayoutDashboard size={18} /> Overview
        </button>
        <div className="nav-section">
          <span className="nav-label">YOUR PROJECTS</span>
          <button
            className="icon"
            aria-label="Create project"
            onClick={() =>
              setProjectDraft({
                id: uid(),
                name: "",
                color: accent,
                icon: "◈",
                favorite: 0,
                archived: 0,
                created_at: now(),
              })
            }
          >
            <Plus size={16} />
          </button>
        </div>
        <nav>
          {[...data.projects]
            .sort((a, b) => b.favorite - a.favorite)
            .filter((p) => !p.archived || showArchived)
            .map((p) => (
              <button
                key={p.id}
                className={`nav-item ${p.id === projectId && view !== "dashboard" ? "active" : ""}`}
                onClick={() => {
                  setProjectId(p.id);
                  setView("board");
                  setQuery("");
                }}
              >
                <span style={{ color: p.color }}>{p.icon}</span>
                <span className="truncate">{p.name}</span>
                {!!p.favorite && <Star size={12} />}
                <span className="nav-count">
                  {
                    data.tasks.filter(
                      (t) =>
                        t.project_id === p.id && !t.completed_at && !t.archived,
                    ).length
                  }
                </span>
              </button>
            ))}
        </nav>
        <button
          className="nav-item new-project"
          onClick={() =>
            setProjectDraft({
              id: uid(),
              name: "",
              color: accent,
              icon: "◈",
              favorite: 0,
              archived: 0,
              created_at: now(),
            })
          }
        >
          <Plus size={17} /> New project
        </button>
        <div className="sidebar-bottom">
          <button
            className="nav-item"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}{" "}
            {theme === "dark" ? "Light" : "Dark"} appearance
          </button>
          <label className="accent-control">
            Accent color
            <input
              type="color"
              aria-label="Accent color"
              value={accent}
              onChange={(e) => setAccent(e.target.value)}
            />
          </label>
        </div>
      </aside>
      <main>
        <header className="topbar">
          <button
            className="icon"
            aria-label="Toggle sidebar"
            onClick={() => setCollapsed(!collapsed)}
          >
            {collapsed ? (
              <PanelLeftOpen size={18} />
            ) : (
              <PanelLeftClose size={18} />
            )}
          </button>
          <div className="breadcrumb">
            Workspace <span>/</span>{" "}
            <strong>
              {view === "dashboard" ? "Overview" : project?.name || "Projects"}
            </strong>
          </div>
          <div className="search">
            <Search size={16} />
            <input
              ref={searchRef}
              aria-label="Search all tasks"
              placeholder="Search tasks"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <kbd>/</kbd>
          </div>
          <span className="save-status">
            {saving
              ? "Saving…"
              : loading
                ? "Connecting…"
                : error
                  ? "Save needs attention"
                  : "All changes saved"}
          </span>
          <button
            className="icon"
            aria-label="Keyboard shortcuts"
            onClick={() => setHelp(true)}
          >
            ?
          </button>
        </header>
        <div className="content">
          {error && (
            <div className="error" role="alert">
              {error}
              <button onClick={() => location.reload()}>Reload</button>
              <button aria-label="Dismiss error" onClick={() => setError("")}>
                <X size={16} />
              </button>
            </div>
          )}
          <div className="page-heading">
            <div>
              <h1>
                {query
                  ? "Search results"
                  : view === "dashboard"
                    ? "Overview"
                    : project?.name || "Projects"}
                {project && view !== "dashboard" && !query && (
                  <button
                    className="icon favorite"
                    aria-label="Toggle favorite"
                    onClick={() =>
                      void save({
                        ...data,
                        projects: data.projects.map((p) =>
                          p.id === projectId
                            ? { ...p, favorite: p.favorite ? 0 : 1 }
                            : p,
                        ),
                      })
                    }
                  >
                    <Star
                      size={21}
                      fill={project.favorite ? "currentColor" : "none"}
                    />
                  </button>
                )}
              </h1>
            </div>
            <div className="heading-actions">
              {project && (
                <button
                  className="button secondary"
                  onClick={() => setProjectDraft({ ...project })}
                >
                  <Settings2 size={16} /> Project
                </button>
              )}
              <button
                className="button primary"
                disabled={!project || saving}
                onClick={() => newTask()}
              >
                <Plus size={17} /> New task <kbd>N</kbd>
              </button>
            </div>
          </div>
          {loading ? (
            <div className="empty">Connecting to your workspace…</div>
          ) : !data.projects.length ? (
            <div className="welcome">
              <h2>No projects</h2>
              <button
                className="button primary"
                onClick={() =>
                  setProjectDraft({
                    id: uid(),
                    name: "",
                    icon: "◈",
                    color: accent,
                    favorite: 0,
                    archived: 0,
                    created_at: now(),
                  })
                }
              >
                <Plus size={16} /> Create your first project
              </button>
            </div>
          ) : (
            <>
              <div className="view-toolbar">
                <div className="tabs">
                  {[
                    ["board", "Board", Columns3],
                    ["list", "List", List],
                    ["calendar", "Calendar", CalendarDays],
                  ].map(([key, label, Icon]) => (
                    <button
                      key={String(key)}
                      className={view === key ? "selected" : ""}
                      onClick={() => setView(String(key))}
                    >
                      {React.createElement(Icon as typeof Columns3, {
                        size: 16,
                      })}
                      {String(label)}
                    </button>
                  ))}
                </div>
                <div className="filters">
                  <label>
                    Priority{" "}
                    <select
                      aria-label="Filter priority"
                      value={priority}
                      onChange={(e) => setPriority(e.target.value)}
                    >
                      <option value="all">All</option>
                      {["low", "medium", "high", "urgent"].map((p) => (
                        <option key={p}>{p}</option>
                      ))}
                    </select>
                  </label>
                  <select
                    aria-label="Sort tasks"
                    value={sort}
                    onChange={(e) => setSort(e.target.value)}
                  >
                    <option value="manual">Manual order</option>
                    <option value="due">Due date</option>
                    <option value="priority">Priority</option>
                  </select>
                  <button
                    className={`icon ${showArchived ? "selected" : ""}`}
                    title="Show archived tasks and projects"
                    aria-label="Toggle archived"
                    onClick={() => setShowArchived(!showArchived)}
                  >
                    <Archive size={17} />
                  </button>
                </div>
              </div>
              {query ? (
                <Suspense fallback={<p>Loading…</p>}>
                  <Secondary
                    view="list"
                    tasks={visible}
                    data={data}
                    open={setDraft}
                    toggle={toggle}
                  />
                </Suspense>
              ) : view === "board" ? (
                <>
                  {sort !== "manual" && (
                    <p className="board-note">
                      Choose manual order to drag tasks.
                    </p>
                  )}
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCorners}
                    onDragEnd={dragEnd}
                  >
                    <div className="board">
                      {columns.map((c) => (
                        <Lane
                          key={c.id}
                          column={c}
                          tasks={visible.filter((t) => t.column_id === c.id)}
                          open={setDraft}
                          add={(title) => newTask(c.id, title)}
                          edit={() => setColumnDraft({ ...c })}
                        />
                      ))}
                      <button
                        className="add-column"
                        onClick={() =>
                          setColumnDraft({
                            id: uid(),
                            project_id: projectId,
                            name: "",
                            color: "#94a3b8",
                            position: columns.length,
                            completed: 0,
                          })
                        }
                      >
                        <Plus size={17} /> Add column
                      </button>
                    </div>
                  </DndContext>
                </>
              ) : (
                <Suspense fallback={<p>Loading view…</p>}>
                  <Secondary
                    view={view}
                    tasks={visible}
                    data={data}
                    open={setDraft}
                    toggle={toggle}
                  />
                </Suspense>
              )}
            </>
          )}
          <footer>
            <div>
              <button
                onClick={() =>
                  download(
                    "lightboard-backup.json",
                    JSON.stringify(data, null, 2),
                  )
                }
              >
                <Download size={14} /> Backup
              </button>
              <button onClick={() => importRef.current?.click()}>
                <Upload size={14} /> Restore
              </button>
              <button onClick={exportCSV}>Export CSV</button>
            </div>
          </footer>
          <input
            ref={importRef}
            type="file"
            accept="application/json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void importData(f);
              e.target.value = "";
            }}
          />
        </div>
      </main>
      <dialog
        ref={dialogRef}
        onCancel={close}
        onClick={(e) => {
          if (e.target === e.currentTarget) close();
        }}
      >
        <div className="modal">
          <button
            className="modal-close icon"
            aria-label="Close editor"
            onClick={close}
          >
            <X size={20} />
          </button>
          {draft && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const t = {
                  ...draft,
                  completed_at: data.columns.find(
                    (c) => c.id === draft.column_id,
                  )?.completed
                    ? draft.completed_at || now()
                    : null,
                };
                if (
                  await save({
                    ...data,
                    tasks: data.tasks.some((x) => x.id === t.id)
                      ? data.tasks.map((x) => (x.id === t.id ? t : x))
                      : [...data.tasks, t],
                  })
                )
                  close();
              }}
            >
              <div className="eyebrow">TASK DETAILS</div>
              <input
                className="title-input"
                required
                maxLength={300}
                aria-label="Task title"
                placeholder="Task title"
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              />
              <label>
                Description
                <textarea
                  rows={4}
                  maxLength={20000}
                  placeholder="Description"
                  value={draft.description}
                  onChange={(e) =>
                    setDraft({ ...draft, description: e.target.value })
                  }
                />
              </label>
              <div className="form-grid">
                <label>
                  Status
                  <select
                    value={draft.column_id}
                    onChange={(e) =>
                      setDraft({ ...draft, column_id: e.target.value })
                    }
                  >
                    {data.columns
                      .filter((c) => c.project_id === draft.project_id)
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  Priority
                  <select
                    value={draft.priority}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        priority: e.target.value as Task["priority"],
                      })
                    }
                  >
                    {["low", "medium", "high", "urgent"].map((p) => (
                      <option key={p}>{p}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Start date
                  <input
                    type="date"
                    value={draft.start_date || ""}
                    onChange={(e) =>
                      setDraft({ ...draft, start_date: e.target.value || null })
                    }
                  />
                </label>
                <label>
                  Due date
                  <input
                    type="date"
                    value={draft.due_date || ""}
                    onChange={(e) =>
                      setDraft({ ...draft, due_date: e.target.value || null })
                    }
                  />
                </label>
              </div>
              <label>
                Labels <small>Comma separated</small>
                <input
                  value={draft.labels.join(", ")}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      labels: e.target.value
                        .split(",")
                        .map((l) => l.trimStart())
                        .slice(0, 30),
                    })
                  }
                  onBlur={() =>
                    setDraft({
                      ...draft,
                      labels: draft.labels.map((l) => l.trim()).filter(Boolean),
                    })
                  }
                />
              </label>
              <label>Checklist / subtasks</label>
              {draft.checklist.map((i, index) => (
                <div className="checklist-row" key={i.id}>
                  <input
                    type="checkbox"
                    checked={i.done}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        checklist: draft.checklist.map((x) =>
                          x.id === i.id ? { ...x, done: e.target.checked } : x,
                        ),
                      })
                    }
                  />
                  <input
                    aria-label={`Subtask ${index + 1}`}
                    value={i.text}
                    maxLength={500}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        checklist: draft.checklist.map((x) =>
                          x.id === i.id ? { ...x, text: e.target.value } : x,
                        ),
                      })
                    }
                  />
                  <button
                    type="button"
                    className="icon"
                    aria-label="Remove subtask"
                    onClick={() =>
                      setDraft({
                        ...draft,
                        checklist: draft.checklist.filter((x) => x.id !== i.id),
                      })
                    }
                  >
                    <X size={15} />
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="text-button"
                onClick={() =>
                  setDraft({
                    ...draft,
                    checklist: [
                      ...draft.checklist,
                      { id: uid(), text: "", done: false },
                    ],
                  })
                }
              >
                <Plus size={15} /> Add item
              </button>
              <p className="metadata">
                Created {new Date(draft.created_at).toLocaleString()}
                {draft.completed_at &&
                  ` · Completed ${new Date(draft.completed_at).toLocaleDateString()}`}
              </p>
              <div className="modal-actions">
                <button
                  type="button"
                  className="icon"
                  aria-label="Delete task"
                  onClick={async () => {
                    if (
                      confirm("Permanently delete this task?") &&
                      (await save({
                        ...data,
                        tasks: data.tasks.filter((t) => t.id !== draft.id),
                      }))
                    )
                      close();
                  }}
                >
                  <Trash2 size={17} />
                </button>
                <button
                  type="button"
                  className="icon"
                  aria-label="Duplicate task"
                  onClick={() =>
                    setDraft({
                      ...draft,
                      id: uid(),
                      title: draft.title + " (copy)",
                      created_at: now(),
                      position: draft.position + 0.5,
                    })
                  }
                >
                  <Copy size={17} />
                </button>
                <button
                  type="button"
                  className="text-button"
                  onClick={() =>
                    setDraft({ ...draft, archived: draft.archived ? 0 : 1 })
                  }
                >
                  <Archive size={16} />
                  {draft.archived ? "Restore" : "Archive"}
                </button>
                <button className="button primary" disabled={saving}>
                  Save task
                </button>
              </div>
            </form>
          )}
          {projectDraft && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const exists = data.projects.some(
                  (p) => p.id === projectDraft.id,
                );
                const cs = ["Backlog", "To Do", "In Progress", "Completed"].map(
                  (name, i) => ({
                    id: uid(),
                    project_id: projectDraft.id,
                    name,
                    color: ["#9c9aa7", "#809ddd", "#e2ae53", "#6ca88a"][i],
                    position: i,
                    completed: i === 3 ? 1 : 0,
                  }),
                );
                if (
                  await save({
                    ...data,
                    projects: exists
                      ? data.projects.map((p) =>
                          p.id === projectDraft.id ? projectDraft : p,
                        )
                      : [...data.projects, projectDraft],
                    columns: exists ? data.columns : [...data.columns, ...cs],
                  })
                ) {
                  setProjectId(projectDraft.id);
                  setView("board");
                  close();
                }
              }}
            >
              <h2>
                {data.projects.some((p) => p.id === projectDraft.id)
                  ? "Project settings"
                  : "A new beginning"}
              </h2>
              <p>Give your next big idea a place to grow.</p>
              <label>
                Project name
                <input
                  required
                  maxLength={120}
                  value={projectDraft.name}
                  onChange={(e) =>
                    setProjectDraft({ ...projectDraft, name: e.target.value })
                  }
                />
              </label>
              <div className="form-grid">
                <label>
                  Icon
                  <input
                    maxLength={16}
                    value={projectDraft.icon}
                    onChange={(e) =>
                      setProjectDraft({ ...projectDraft, icon: e.target.value })
                    }
                  />
                </label>
                <label>
                  Color
                  <input
                    type="color"
                    value={projectDraft.color}
                    onChange={(e) =>
                      setProjectDraft({
                        ...projectDraft,
                        color: e.target.value,
                      })
                    }
                  />
                </label>
              </div>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={!!projectDraft.archived}
                  onChange={(e) =>
                    setProjectDraft({
                      ...projectDraft,
                      archived: e.target.checked ? 1 : 0,
                    })
                  }
                />{" "}
                Archive project
              </label>
              <div className="modal-actions">
                <button
                  type="button"
                  className="text-button danger"
                  onClick={async () => {
                    if (
                      confirm(
                        "Delete this project and every task in it? Export a backup first.",
                      ) &&
                      (await save({
                        projects: data.projects.filter(
                          (p) => p.id !== projectDraft.id,
                        ),
                        columns: data.columns.filter(
                          (c) => c.project_id !== projectDraft.id,
                        ),
                        tasks: data.tasks.filter(
                          (t) => t.project_id !== projectDraft.id,
                        ),
                      }))
                    ) {
                      setProjectId(
                        data.projects.find((p) => p.id !== projectDraft.id)
                          ?.id || "",
                      );
                      close();
                    }
                  }}
                >
                  Delete project
                </button>
                <button className="button primary" disabled={saving}>
                  Save project
                </button>
              </div>
            </form>
          )}
          {columnDraft && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const exists = data.columns.some(
                  (c) => c.id === columnDraft.id,
                );
                if (
                  await save({
                    ...data,
                    columns: exists
                      ? data.columns.map((c) =>
                          c.id === columnDraft.id ? columnDraft : c,
                        )
                      : [...data.columns, columnDraft],
                    tasks: data.tasks.map((t) =>
                      t.column_id === columnDraft.id
                        ? {
                            ...t,
                            completed_at: columnDraft.completed
                              ? t.completed_at || now()
                              : null,
                          }
                        : t,
                    ),
                  })
                )
                  close();
              }}
            >
              <h2>Column settings</h2>
              <label>
                Name
                <input
                  required
                  maxLength={80}
                  value={columnDraft.name}
                  onChange={(e) =>
                    setColumnDraft({ ...columnDraft, name: e.target.value })
                  }
                />
              </label>
              <label>
                Color
                <input
                  type="color"
                  value={columnDraft.color}
                  onChange={(e) =>
                    setColumnDraft({ ...columnDraft, color: e.target.value })
                  }
                />
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={!!columnDraft.completed}
                  onChange={(e) =>
                    setColumnDraft({
                      ...columnDraft,
                      completed: e.target.checked ? 1 : 0,
                    })
                  }
                />{" "}
                Tasks in this column are completed
              </label>
              <div className="modal-actions">
                <button
                  type="button"
                  className="text-button danger"
                  disabled={columns.length <= 1}
                  onClick={async () => {
                    const target = columns.find((c) => c.id !== columnDraft.id);
                    if (
                      target &&
                      confirm(
                        `Delete column? Tasks will move to ${target.name}.`,
                      ) &&
                      (await save({
                        ...data,
                        columns: data.columns.filter(
                          (c) => c.id !== columnDraft.id,
                        ),
                        tasks: data.tasks.map((t) =>
                          t.column_id === columnDraft.id
                            ? {
                                ...t,
                                column_id: target.id,
                                completed_at: target.completed
                                  ? t.completed_at || now()
                                  : null,
                              }
                            : t,
                        ),
                      }))
                    )
                      close();
                  }}
                >
                  Delete column
                </button>
                <button className="button primary" disabled={saving}>
                  Save column
                </button>
              </div>
            </form>
          )}
          {help && (
            <>
              <h2>Keyboard shortcuts</h2>
              <p>
                <kbd>N</kbd> New task · <kbd>/</kbd> Search · <kbd>?</kbd>{" "}
                Shortcuts · <kbd>Esc</kbd> Close editor
              </p>
              <p>
                Move a card with its grip. For keyboard dragging, focus the
                grip, press Space, use arrow keys, then Space to drop.
              </p>
              <p>
                Back up your workspace as JSON. Restore replaces all data. CSV
                exports work with spreadsheet apps.
              </p>
              <button
                className="text-button"
                onClick={async () => {
                  await fetch("/api/session", { method: "DELETE" });
                  location.reload();
                }}
              >
                Sign out of access-key session
              </button>
            </>
          )}
        </div>
      </dialog>
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
