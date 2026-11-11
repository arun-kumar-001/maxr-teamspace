-- Personal To-Do List for Staff / Employees (First Version Scope)
-- Each employee owns their personal to-dos. Private to the employee.

CREATE TABLE IF NOT EXISTS personal_todos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  due_date DATE,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Fast lookup of employee's to-dos filtered/sorted by completion and recency
CREATE INDEX IF NOT EXISTS idx_personal_todos_employee ON personal_todos (employee_id, is_completed, created_at DESC);

-- Index for optional due dates
CREATE INDEX IF NOT EXISTS idx_personal_todos_due_date ON personal_todos (employee_id, due_date) WHERE due_date IS NOT NULL;

