import { useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Check,
  Clock,
  ArrowUpRight,
} from "lucide-react";
import { today, type Data, type Task } from "./model";
export default function Views({
  view,
  tasks,
  data,
  open,
  toggle,
}: {
  view: string;
  tasks: Task[];
  data: Data;
  open: (t: Task) => void;
  toggle: (t: Task) => void;
}) {
  const [month, setMonth] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  );
  const row = (t: Task) => (
    <div className="list-row" key={t.id}>
      <button
        className={`task-check ${t.completed_at ? "done" : ""}`}
        aria-label={`${t.completed_at ? "Reopen" : "Complete"} ${t.title}`}
        onClick={() => toggle(t)}
      >
        {t.completed_at && <Check size={13} />}
      </button>
      <button className="list-title" onClick={() => open(t)}>
        {t.title}
        <small>{data.projects.find((p) => p.id === t.project_id)?.name}</small>
      </button>
      <span className={`priority ${t.priority}`}>
        <i />
        {t.priority}
      </span>
      <span className="status-pill">
        {data.columns.find((c) => c.id === t.column_id)?.name}
      </span>
      <span
        className={
          t.due_date && t.due_date < today() && !t.completed_at ? "overdue" : ""
        }
      >
        {t.due_date || "No due date"}
      </span>
    </div>
  );
  if (view === "dashboard") {
    const day = today(),
      week = new Date();
    week.setDate(week.getDate() + 7);
    const groups = [
      {
        title: "Due today",
        icon: Clock,
        tasks: tasks.filter((t) => !t.completed_at && t.due_date === day),
      },
      {
        title: "Overdue",
        icon: Clock,
        tasks: tasks.filter(
          (t) => !t.completed_at && t.due_date && t.due_date < day,
        ),
      },
      {
        title: "Coming up",
        icon: ArrowUpRight,
        tasks: tasks.filter(
          (t) =>
            !t.completed_at &&
            t.due_date &&
            t.due_date > day &&
            new Date(t.due_date) <= week,
        ),
      },
      {
        title: "In progress",
        icon: ArrowUpRight,
        tasks: tasks.filter(
          (t) =>
            !t.completed_at &&
            data.columns.find((c) => c.id === t.column_id)?.name ===
              "In Progress",
        ),
      },
      {
        title: "Recently completed",
        icon: Check,
        tasks: tasks
          .filter((t) => t.completed_at)
          .sort((a, b) => b.completed_at!.localeCompare(a.completed_at!))
          .slice(0, 10),
      },
    ];
    return (
      <>
        <div className="dashboard-grid">
          {groups.map((g) => (
            <section className="dashboard-panel" key={g.title}>
              <h3>
                <g.icon size={17} />
                {g.title}
                <span className="count">{g.tasks.length}</span>
              </h3>
              {g.tasks.length ? (
                g.tasks.map(row)
              ) : (
                <p className="empty-small">
                  All clear here. A little breathing room.
                </p>
              )}
            </section>
          ))}
        </div>
        <section className="dashboard-panel">
          <h3>Project progress</h3>
          {data.projects
            .filter((p) => !p.archived)
            .map((p) => {
              const ts = data.tasks.filter(
                  (t) => t.project_id === p.id && !t.archived,
                ),
                done = ts.filter((t) => t.completed_at).length;
              return (
                <div className="project-progress" key={p.id}>
                  <span>
                    {p.icon} {p.name}
                  </span>
                  <div className="progress-track">
                    <i
                      style={{
                        width: (ts.length ? (done / ts.length) * 100 : 0) + "%",
                        background: p.color,
                      }}
                    />
                  </div>
                  <small>
                    {done} / {ts.length}
                  </small>
                </div>
              );
            })}
        </section>
      </>
    );
  }
  if (view === "calendar") {
    const start = new Date(month.getFullYear(), month.getMonth(), 1).getDay(),
      days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const cells = Math.ceil((start + days) / 7) * 7;
    return (
      <section className="calendar">
        <header>
          <h2>
            {month.toLocaleDateString(undefined, {
              month: "long",
              year: "numeric",
            })}
          </h2>
          <div>
            <button
              className="icon"
              aria-label="Previous month"
              onClick={() =>
                setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))
              }
            >
              <ChevronLeft size={18} />
            </button>
            <button
              className="text-button"
              onClick={() =>
                setMonth(
                  new Date(new Date().getFullYear(), new Date().getMonth(), 1),
                )
              }
            >
              Today
            </button>
            <button
              className="icon"
              aria-label="Next month"
              onClick={() =>
                setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))
              }
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </header>
        <div className="calendar-grid">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div className="weekday" key={d}>
              {d}
            </div>
          ))}
          {Array.from({ length: cells }, (_, i) => {
            const n = i - start + 1,
              date = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}-${String(n).padStart(2, "0")}`;
            return (
              <div
                key={i}
                className={`calendar-day ${date === today() ? "today" : ""}`}
              >
                <span>{n > 0 && n <= days ? n : ""}</span>
                {n > 0 &&
                  n <= days &&
                  tasks
                    .filter((t) => t.due_date === date)
                    .map((t) => (
                      <button
                        key={t.id}
                        className={`calendar-task ${t.completed_at ? "complete" : ""}`}
                        onClick={() => open(t)}
                      >
                        {t.title}
                      </button>
                    ))}
              </div>
            );
          })}
        </div>
        <p className="metadata">
          Tasks appear on their due date. Undated tasks are available in Board
          and List.
        </p>
      </section>
    );
  }
  return (
    <section className="task-list">
      <div className="list-heading">
        <span>Task</span>
        <span>Priority</span>
        <span>Status</span>
        <span>Due date</span>
      </div>
      {tasks.length ? (
        tasks.map(row)
      ) : (
        <div className="empty">
          No tasks here yet. Make space for something good.
        </div>
      )}
    </section>
  );
}
