import { describe, expect, it } from 'vitest';
import { TEMPLATE_VERSION, TemplateType, renderEmail, renderNotification } from './templates';

const TYPES: TemplateType[] = [
  'approval.requested',
  'approval.advanced',
  'approval.approved',
  'approval.rejected',
  'approval.reminder',
  'leave.cancelled',
  'task.assigned',
  'task.in_review',
  'task.blocked',
  'task.completed',
  'task.reopened',
];

describe('notification templates (D-15)', () => {
  it('is on version 1; bump it when a wording changes so the change is reviewed', () => {
    expect(TEMPLATE_VERSION).toBe(1);
  });

  it.each(TYPES)('%s has a title and body and nothing that could be sensitive', (type) => {
    const rendered = renderNotification(type, { subjectType: 'leave_request' });
    expect(rendered.title.length).toBeGreaterThan(0);
    expect(rendered.body.length).toBeGreaterThan(0);
    // No dates, amounts or addresses: the text names the event and nothing about it.
    expect(`${rendered.title} ${rendered.body}`).not.toMatch(/\d{4}|[$\u20ac\u00a3\u20b9@]/);
  });

  it.each([
    ['leave_request', 'Leave request'],
    ['attendance_correction', 'Attendance correction'],
    ['expense_claim', 'Expense claim'],
    ['something_new', 'Request'],
  ])('names a %s as "%s"', (subjectType, label) => {
    expect(renderNotification('approval.approved', { subjectType }).title).toBe(
      `${label} approved`,
    );
  });

  it('builds an email from the title and a pointer to the app', () => {
    const rendered = renderNotification('approval.requested', { subjectType: 'leave_request' });
    const withLink = renderEmail(rendered, 'https://t.example.com', '/approvals/1');
    expect(withLink.subject).toBe('Leave request waiting for your decision');
    expect(withLink.text).toContain('https://t.example.com/approvals/1');
    const without = renderEmail(rendered, undefined, '/approvals/1');
    expect(without.text).toContain('Open MAXR Teamspace to see it.');
    expect(without.text).not.toContain('/approvals/1');
  });
});
