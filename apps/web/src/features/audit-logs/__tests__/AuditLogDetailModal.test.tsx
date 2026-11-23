// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { AuditLogDetailModal } from '../components/AuditLogDetailModal';
import type { AuditLogItem } from '../types';

afterEach(cleanup);

describe('AuditLogDetailModal Component (Issue #28)', () => {
  const mockLog: AuditLogItem = {
    id: 'log-12345678-abcd-1234-abcd-1234567890ab',
    occurredAt: '2026-10-30T10:15:30Z',
    action: 'leave.approve',
    outcome: 'success',
    actor: {
      id: 'actor-1',
      name: 'Eleanor Vance',
      role: 'admin',
    },
    entityType: 'leave_request',
    entityId: 'leave-999',
    requestId: 'req-abc-123',
    changes: {
      status: { old: 'pending', new: 'approved' },
      balance: { old: 10, new: 8 },
    },
    metadata: {
      ip: '192.168.1.1',
      userAgent: 'Mozilla/5.0 Chrome/130',
    },
  };

  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <AuditLogDetailModal log={mockLog} isOpen={false} onClose={vi.fn()} timezone="UTC" />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders all audit log details, formatted JSON, and read-only indicator', () => {
    render(<AuditLogDetailModal log={mockLog} isOpen={true} onClose={vi.fn()} timezone="UTC" />);

    expect(screen.getByTestId('audit-log-detail-modal')).toBeInTheDocument();
    expect(screen.getByText('Audit Trail Entry')).toBeInTheDocument();
    expect(screen.getByText(/ID: log-12345678-abcd-1234-abcd-1234567890ab/)).toBeInTheDocument();
    expect(screen.getByText('leave.approve')).toBeInTheDocument();
    expect(screen.getByText('Eleanor Vance')).toBeInTheDocument();
    expect(screen.getByText('leave_request')).toBeInTheDocument();
    expect(screen.getByText('leave-999')).toBeInTheDocument();

    // Verify changes JSON is present
    expect(screen.getByText(/"old": "pending"/)).toBeInTheDocument();
    expect(screen.getByText(/"new": "approved"/)).toBeInTheDocument();

    // Verify metadata JSON is present
    expect(screen.getByText(/"ip": "192.168.1.1"/)).toBeInTheDocument();

    // Verify strictly read-only notice exists
    expect(screen.getByText(/Append-only immutable record \(read-only\)/)).toBeInTheDocument();

    // Crucial requirement: No edit or delete button exists
    expect(screen.queryByText(/edit/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/delete/i)).not.toBeInTheDocument();
  });

  it('calls onClose when clicking close button', () => {
    const onClose = vi.fn();
    render(<AuditLogDetailModal log={mockLog} isOpen={true} onClose={onClose} timezone="UTC" />);

    const closeBtn = screen.getByTestId('close-modal-btn');
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('copies changes to clipboard', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextMock },
      configurable: true,
      writable: true,
    });

    render(<AuditLogDetailModal log={mockLog} isOpen={true} onClose={vi.fn()} timezone="UTC" />);

    const copyBtn = screen.getByText('Copy Changes JSON');
    fireEvent.click(copyBtn);

    expect(writeTextMock).toHaveBeenCalledWith(JSON.stringify(mockLog.changes, null, 2));
  });
});
