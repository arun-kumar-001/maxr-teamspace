/**
 * Notification texts (D-15). They live in code and carry a version so a wording change is
 * visible in review. An email names the event and points at the app; it never carries a leave
 * reason, dates, amounts, names or comments: those are read after signing in.
 */
export const TEMPLATE_VERSION = 1;

export type TemplateType =
  | 'approval.requested'
  | 'approval.advanced'
  | 'approval.approved'
  | 'approval.rejected'
  | 'approval.reminder'
  | 'leave.cancelled'
  | 'task.assigned'
  | 'task.in_review'
  | 'task.blocked'
  | 'task.completed'
  | 'task.reopened'
  | 'task.commented';

const SUBJECT_LABELS: Record<string, string> = {
  leave_request: 'Leave request',
  attendance_correction: 'Attendance correction',
  expense_claim: 'Expense claim',
};

export const subjectLabel = (subjectType: string): string =>
  SUBJECT_LABELS[subjectType] ?? 'Request';

export interface RenderedNotification {
  title: string;
  body: string;
}

export function renderNotification(
  type: TemplateType,
  vars: { subjectType?: string } = {},
): RenderedNotification {
  const label = subjectLabel(vars.subjectType ?? '');
  switch (type) {
    case 'approval.requested':
    case 'approval.advanced':
      return {
        title: `${label} waiting for your decision`,
        body: 'Open the approvals inbox to review it.',
      };
    case 'approval.approved':
      return { title: `${label} approved`, body: 'Open it to see the details.' };
    case 'approval.rejected':
      return { title: `${label} rejected`, body: 'Open it to read the comment.' };
    case 'approval.reminder':
      return {
        title: `${label} still waiting for your decision`,
        body: 'It has been waiting for more than 24 hours.',
      };
    case 'task.assigned':
      return { title: 'New task assigned to you', body: 'Open your tasks to see it.' };
    case 'task.in_review':
      return { title: 'A task is ready for your review', body: 'Open the task to review it.' };
    case 'task.blocked':
      return {
        title: 'A task you assigned is blocked',
        body: 'Open the task to see what is needed.',
      };
    case 'task.completed':
      return { title: 'Your task was marked completed', body: 'Open it to see the details.' };
    case 'task.commented':
      return { title: 'New comment on a task', body: 'Open the task to read it.' };
    case 'task.reopened':
      return { title: 'Your task was reopened', body: 'Open it to see what is needed.' };
    case 'leave.cancelled':
      return {
        title: 'Your approved leave was cancelled by HR',
        body: 'Open your leave requests to see the details.',
      };
  }
}

/** The email for a notification: the title as the subject and a pointer to the app, nothing more. */
export function renderEmail(
  notification: RenderedNotification,
  appUrl: string | undefined,
  link: string | null,
): { subject: string; text: string } {
  const where = appUrl
    ? `Open MAXR Teamspace: ${appUrl}${link ?? ''}`
    : 'Open MAXR Teamspace to see it.';
  return {
    subject: notification.title,
    text: `Hello,\n\n${notification.title}.\n${where}\n\nThis is an automated message.`,
  };
}
