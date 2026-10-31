-- Tasks (#43, decision D-14).
--
--   * a task has one assignee and the assigner who created it; the assigner can be the assignee
--   * `status` follows the transition table in modules/tasks/task-rules.ts; the database keeps the
--     set of values and that completed_at is set exactly when the task is completed
--   * `project_id` is optional: tasks can exist without a project
--   * nothing is deleted: a task that is no longer needed is completed or reassigned

CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(200) NOT NULL,
  description VARCHAR(2000),
  project_id UUID REFERENCES projects(id) ON DELETE RESTRICT,
  assignee_employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
  assigner_employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
  status VARCHAR(20) NOT NULL DEFAULT 'todo',
  priority VARCHAR(10) NOT NULL DEFAULT 'medium',
  due_date DATE,
  completed_at TIMESTAMPTZ,
  version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT tasks_title_not_blank CHECK (char_length(btrim(title)) > 0),
  CONSTRAINT tasks_status_check
    CHECK (status IN ('todo', 'in_progress', 'in_review', 'completed', 'blocked')),
  CONSTRAINT tasks_priority_check CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  CONSTRAINT tasks_completed_at_matches_status CHECK ((status = 'completed') = (completed_at IS NOT NULL))
);

-- Justification: "my tasks" (the assignee's board) filtered by status.
CREATE INDEX idx_tasks_assignee ON tasks (assignee_employee_id, status);
-- Justification: FK index, and the Team Lead's "tasks I assigned".
CREATE INDEX idx_tasks_assigner ON tasks (assigner_employee_id);
-- Justification: FK index, and a project's task list.
CREATE INDEX idx_tasks_project ON tasks (project_id) WHERE project_id IS NOT NULL;
-- Justification: the due-soon reminder and overdue filters only look at tasks still open.
CREATE INDEX idx_tasks_due_open ON tasks (due_date) WHERE due_date IS NOT NULL AND status <> 'completed';
