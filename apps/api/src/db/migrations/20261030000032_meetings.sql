-- Meetings, invitees and RSVPs (#45, decision D-18).
--
--   * times are timestamptz in UTC; the company timezone is applied when shown
--   * a meeting ends after it starts and lasts at most 24 hours (CHECKs)
--   * agenda and minutes are plain text; minutes are capped at 20,000 characters
--   * invitees are rows; the organizer is not an invitee unless invited
--   * a cancelled meeting stays on record and is no longer shown as scheduled

CREATE TABLE meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(200) NOT NULL,
  agenda TEXT,
  minutes TEXT,
  organizer_employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'scheduled',
  reminder_sent_at TIMESTAMPTZ,
  version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT meetings_title_not_blank CHECK (char_length(btrim(title)) > 0),
  CONSTRAINT meetings_times_order CHECK (ends_at > starts_at),
  CONSTRAINT meetings_max_length CHECK (ends_at <= starts_at + INTERVAL '24 hours'),
  CONSTRAINT meetings_minutes_length CHECK (minutes IS NULL OR char_length(minutes) <= 20000),
  CONSTRAINT meetings_status_check CHECK (status IN ('scheduled', 'cancelled'))
);

-- Justification: the calendar query (time range) and the reminder job (meetings starting soon).
CREATE INDEX idx_meetings_starts_at ON meetings (starts_at) WHERE status = 'scheduled';
-- Justification: FK index, and "meetings I organise".
CREATE INDEX idx_meetings_organizer ON meetings (organizer_employee_id, starts_at);

CREATE TABLE meeting_attendees (
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
  rsvp VARCHAR(20) NOT NULL DEFAULT 'pending',
  responded_at TIMESTAMPTZ,
  PRIMARY KEY (meeting_id, employee_id),
  CONSTRAINT meeting_attendees_rsvp_check CHECK (rsvp IN ('pending', 'accepted', 'declined', 'tentative'))
);

-- Justification: "meetings I am invited to" and the overlap check for one employee.
CREATE INDEX idx_meeting_attendees_employee ON meeting_attendees (employee_id, meeting_id);
