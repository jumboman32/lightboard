export interface Project {
  id: string;
  name: string;
  color: string;
  icon: string;
  favorite: number;
  archived: number;
  created_at: string;
}
export interface Column {
  id: string;
  project_id: string;
  name: string;
  color: string;
  position: number;
  completed: number;
}
export interface Task {
  id: string;
  project_id: string;
  column_id: string;
  title: string;
  description: string;
  priority: "low" | "medium" | "high" | "urgent";
  due_date: string | null;
  start_date: string | null;
  labels: string[];
  checklist: { id: string; text: string; done: boolean }[];
  position: number;
  archived: number;
  created_at: string;
  completed_at: string | null;
}
export interface Data {
  revision?: number;
  projects: Project[];
  columns: Column[];
  tasks: Task[];
}
export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
export function moveTask(
  data: Data,
  id: string,
  columnId: string,
  beforeId?: string,
): Data {
  const column = data.columns.find((c) => c.id === columnId),
    task = data.tasks.find((t) => t.id === id);
  if (!column || !task || column.project_id !== task.project_id) return data;
  const siblings = data.tasks
    .filter((t) => t.column_id === columnId && t.id !== id)
    .sort((a, b) => a.position - b.position);
  const index = beforeId ? siblings.findIndex((t) => t.id === beforeId) : -1;
  siblings.splice(index < 0 ? siblings.length : index, 0, {
    ...task,
    column_id: columnId,
    completed_at: column.completed ? new Date().toISOString() : null,
  });
  const positions = new Map(
    siblings.map((t, i) => [t.id, { ...t, position: i }]),
  );
  return { ...data, tasks: data.tasks.map((t) => positions.get(t.id) ?? t) };
}
