-- Leave requests (#39, #40, decisions D-12 and D-30).
--
--   * a request lies inside one calendar year, so it draws on one balance row
--   * `days` is the working-day count worked out when the request was made (weekend and holidays
--     excluded) and is what approval deducts; it is in half-day steps
--   * a half day is a single date
--   * an employee has at most one live (applied, pending or approved) request on any date: an
--     exclusion constraint, so two requests at once cannot both succeed
--   * the decision itself lives in the approvals engine (subject type 'leave_request')

CREATE TABLE leave_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
  leave_type_id UUID NOT NULL REFERENCES leave_types(id) ON DELETE RESTRICT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  half_day BOOLEAN NOT NULL DEFAULT FALSE,
  days NUMERIC(5,1) NOT NULL,
  reason VARCHAR(500),
  status VARCHAR(20) NOT NULL DEFAULT 'applied',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT leave_requests_status_check
    CHECK (status IN ('applied', 'pending', 'approved', 'rejected', 'cancelled')),
  CONSTRAINT leave_requests_dates_check CHECK (end_date >= start_date),
  CONSTRAINT leave_requests_one_year_check
    CHECK (EXTRACT(YEAR FROM start_date) = EXTRACT(YEAR FROM end_date)),
  CONSTRAINT leave_requests_days_check
    CHECK (days > 0 AND days <= 366 AND days * 2 = trunc(days * 2)),
  CONSTRAINT leave_requests_half_day_check
    CHECK (NOT half_day OR (start_date = end_date AND days = 0.5)),
  CONSTRAINT leave_requests_reason_check
    CHECK (reason IS NULL OR char_length(btrim(reason)) > 0),
  CONSTRAINT leave_requests_no_overlap
    EXCLUDE USING gist (employee_id WITH =, daterange(start_date, end_date, '[]') WITH &&)
    WHERE (status IN ('applied', 'pending', 'approved'))
);

-- Justification: the requester's own list (newest first) and the team join.
CREATE INDEX idx_leave_requests_employee ON leave_requests (employee_id, start_date DESC);
-- Justification: FK index.
CREATE INDEX idx_leave_requests_leave_type ON leave_requests (leave_type_id);
-- Justification: the HR list filters by status.
CREATE INDEX idx_leave_requests_status ON leave_requests (status, start_date);
