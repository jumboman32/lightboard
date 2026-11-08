PRAGMA foreign_keys = ON;
CREATE TABLE projects (id TEXT PRIMARY KEY, name TEXT NOT NULL, color TEXT NOT NULL, icon TEXT NOT NULL, favorite INTEGER NOT NULL DEFAULT 0, archived INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL);
CREATE TABLE columns (id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE, name TEXT NOT NULL, color TEXT NOT NULL, position INTEGER NOT NULL, completed INTEGER NOT NULL DEFAULT 0);
CREATE INDEX columns_project ON columns(project_id,position);
CREATE TABLE tasks (id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE, column_id TEXT NOT NULL REFERENCES columns(id), title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', priority TEXT NOT NULL, due_date TEXT, start_date TEXT, labels TEXT NOT NULL DEFAULT '[]', checklist TEXT NOT NULL DEFAULT '[]', position REAL NOT NULL, archived INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, completed_at TEXT);
CREATE INDEX tasks_project_order ON tasks(project_id,column_id,position);
CREATE INDEX tasks_due ON tasks(due_date) WHERE archived=0;

CREATE TABLE revisions (id INTEGER PRIMARY KEY CHECK(id=1), version INTEGER NOT NULL);
INSERT INTO revisions VALUES (1,0);
