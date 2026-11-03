// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TaskCommentsThread } from '../components/TaskCommentsThread';
import { TaskAttachmentsList } from '../components/TaskAttachmentsList';
import { TaskDetailModal } from '../components/TaskDetailModal';
import * as tasksApi from '../api/tasksApi';
import type { Task, TaskAttachment, TaskComment } from '../types';

vi.mock('../api/tasksApi', async () => {
  const actual = await vi.importActual<typeof tasksApi>('../api/tasksApi');
  return {
    ...actual,
    fetchTaskComments: vi.fn(),
    createTaskComment: vi.fn(),
    fetchTaskAttachments: vi.fn(),
    uploadTaskAttachment: vi.fn(),
    fetchAttachmentDownloadLink: vi.fn(),
    deleteTaskAttachment: vi.fn(),
  };
});

describe('Task Collaboration (Issue #44 - Comments and Attachments)', () => {
  const mockTaskId = '11111111-1111-1111-1111-111111111111';
  const mockEmployeeId = '22222222-2222-2222-2222-222222222222';
  const mockAssignerId = '33333333-3333-3333-3333-333333333333';

  const mockComments: TaskComment[] = [
    {
      id: 'c1',
      taskId: mockTaskId,
      authorEmployeeId: mockAssignerId,
      authorName: 'Bob Lead',
      body: 'Please verify the Redis cache eviction policy before deploying.',
      createdAt: '2026-03-01T10:00:00Z',
    },
    {
      id: 'c2',
      taskId: mockTaskId,
      authorEmployeeId: mockEmployeeId,
      authorName: 'Alice Walker',
      body: 'Verified LRU policy with 256MB max memory. Ready for review.',
      createdAt: '2026-03-01T11:30:00Z',
    },
  ];

  const mockAttachments: TaskAttachment[] = [
    {
      id: 'att-1',
      taskId: mockTaskId,
      uploadedByEmployeeId: mockEmployeeId,
      uploadedByName: 'Alice Walker',
      originalName: 'redis-benchmark-report.pdf',
      contentType: 'application/pdf',
      size: 1048576, // 1 MB
      createdAt: '2026-03-01T11:35:00Z',
    },
    {
      id: 'att-2',
      taskId: mockTaskId,
      uploadedByEmployeeId: mockAssignerId,
      uploadedByName: 'Bob Lead',
      originalName: 'architecture-diagram.png',
      contentType: 'image/png',
      size: 512000, // 500 KB
      createdAt: '2026-03-01T10:05:00Z',
    },
  ];

  const mockTask: Task = {
    id: mockTaskId,
    title: 'Setup Redis Caching Gateway',
    description: 'Add Redis layer for sessions.',
    projectId: 'p1',
    projectName: 'Data Export Suite',
    assigneeEmployeeId: mockEmployeeId,
    assigneeName: 'Alice Walker',
    assignerEmployeeId: mockAssignerId,
    assignerName: 'Bob Lead',
    status: 'in_progress',
    priority: 'high',
    dueDate: '2026-04-15',
    isOverdue: false,
    completedAt: null,
    version: 1,
    createdAt: '2026-03-01T00:00:00Z',
    updatedAt: '2026-03-01T00:00:00Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(tasksApi.fetchTaskComments).mockResolvedValue({
      data: mockComments,
      meta: { page: 1, pageSize: 100, total: 2 },
    });
    vi.mocked(tasksApi.fetchTaskAttachments).mockResolvedValue(mockAttachments);
  });

  describe('TaskCommentsThread', () => {
    it('renders comments list with authors, timestamps, and "(You)" indicator', async () => {
      render(<TaskCommentsThread taskId={mockTaskId} currentEmployeeId={mockEmployeeId} />);

      await waitFor(() => {
        expect(screen.getByText('Bob Lead')).toBeInTheDocument();
        expect(
          screen.getByText('Please verify the Redis cache eviction policy before deploying.'),
        ).toBeInTheDocument();
        expect(screen.getByText('Alice Walker')).toBeInTheDocument();
        expect(
          screen.getByText('Verified LRU policy with 256MB max memory. Ready for review.'),
        ).toBeInTheDocument();
        expect(screen.getByText('(You)')).toBeInTheDocument();
      });
    });

    it('renders empty state when there are no comments', async () => {
      vi.mocked(tasksApi.fetchTaskComments).mockResolvedValue({
        data: [],
        meta: { page: 1, pageSize: 100, total: 0 },
      });

      render(<TaskCommentsThread taskId={mockTaskId} currentEmployeeId={mockEmployeeId} />);

      await waitFor(() => {
        expect(screen.getByTestId('no-comments-message')).toBeInTheDocument();
        expect(screen.getByText('No comments yet')).toBeInTheDocument();
      });
    });

    it('submits a new comment and appends it to thread', async () => {
      const newComment: TaskComment = {
        id: 'c3',
        taskId: mockTaskId,
        authorEmployeeId: mockEmployeeId,
        authorName: 'Alice Walker',
        body: 'Approved for staging deploy.',
        createdAt: '2026-03-01T12:00:00Z',
      };

      vi.mocked(tasksApi.createTaskComment).mockResolvedValue(newComment);

      render(<TaskCommentsThread taskId={mockTaskId} currentEmployeeId={mockEmployeeId} />);

      await waitFor(() => {
        expect(screen.getByTestId('new-comment-textarea')).toBeInTheDocument();
      });

      const textarea = screen.getByTestId('new-comment-textarea');
      fireEvent.change(textarea, { target: { value: 'Approved for staging deploy.' } });

      const postBtn = screen.getByTestId('post-comment-btn');
      fireEvent.click(postBtn);

      await waitFor(() => {
        expect(tasksApi.createTaskComment).toHaveBeenCalledWith(
          mockTaskId,
          'Approved for staging deploy.',
        );
        expect(screen.getByText('Approved for staging deploy.')).toBeInTheDocument();
      });
    });

    it('validates empty comment before submission', async () => {
      render(<TaskCommentsThread taskId={mockTaskId} currentEmployeeId={mockEmployeeId} />);

      await waitFor(() => {
        expect(screen.getByTestId('new-comment-textarea')).toBeInTheDocument();
      });

      const postBtn = screen.getByTestId('post-comment-btn');
      // Button is disabled when input is empty
      expect(postBtn).toBeDisabled();
      expect(tasksApi.createTaskComment).not.toHaveBeenCalled();
    });
  });

  describe('TaskAttachmentsList', () => {
    it('renders attachments list with filename, formatted size, and uploader', async () => {
      render(
        <TaskAttachmentsList
          taskId={mockTaskId}
          currentEmployeeId={mockEmployeeId}
          assignerEmployeeId={mockAssignerId}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText('redis-benchmark-report.pdf')).toBeInTheDocument();
        expect(screen.getByText('architecture-diagram.png')).toBeInTheDocument();
        expect(screen.getByText(/1.0 MB/)).toBeInTheDocument();
        expect(screen.getByText(/500.0 KB/)).toBeInTheDocument();
      });
    });

    it('downloads an attachment by requesting signed link', async () => {
      const windowOpenSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

      vi.mocked(tasksApi.fetchAttachmentDownloadLink).mockResolvedValue({
        url: 'https://storage.local/files/download?token=signed123',
        expiresAt: '2026-03-01T12:00:00Z',
      });

      render(
        <TaskAttachmentsList
          taskId={mockTaskId}
          currentEmployeeId={mockEmployeeId}
          assignerEmployeeId={mockAssignerId}
        />,
      );

      await waitFor(() => {
        expect(screen.getByTestId('download-attachment-att-1')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('download-attachment-att-1'));

      await waitFor(() => {
        expect(tasksApi.fetchAttachmentDownloadLink).toHaveBeenCalledWith(mockTaskId, 'att-1');
        expect(windowOpenSpy).toHaveBeenCalledWith(
          'https://storage.local/files/download?token=signed123',
          '_blank',
          'noopener,noreferrer',
        );
      });

      windowOpenSpy.mockRestore();
    });

    it('uploads a valid PDF file and prepends it to list', async () => {
      const newAttachment: TaskAttachment = {
        id: 'att-3',
        taskId: mockTaskId,
        uploadedByEmployeeId: mockEmployeeId,
        uploadedByName: 'Alice Walker',
        originalName: 'test-coverage.pdf',
        contentType: 'application/pdf',
        size: 204800,
        createdAt: '2026-03-01T13:00:00Z',
      };

      vi.mocked(tasksApi.uploadTaskAttachment).mockResolvedValue(newAttachment);

      render(
        <TaskAttachmentsList
          taskId={mockTaskId}
          currentEmployeeId={mockEmployeeId}
          assignerEmployeeId={mockAssignerId}
        />,
      );

      await waitFor(() => {
        expect(screen.getByTestId('task-attachment-input')).toBeInTheDocument();
      });

      const file = new File(['fake pdf content'], 'test-coverage.pdf', {
        type: 'application/pdf',
      });

      const fileInput = screen.getByTestId('task-attachment-input');
      fireEvent.change(fileInput, { target: { files: [file] } });

      await waitFor(() => {
        expect(tasksApi.uploadTaskAttachment).toHaveBeenCalledWith(mockTaskId, file);
        expect(screen.getByText('test-coverage.pdf')).toBeInTheDocument();
      });
    });

    it('rejects files larger than 10 MB', async () => {
      render(
        <TaskAttachmentsList
          taskId={mockTaskId}
          currentEmployeeId={mockEmployeeId}
          assignerEmployeeId={mockAssignerId}
        />,
      );

      await waitFor(() => {
        expect(screen.getByTestId('task-attachment-input')).toBeInTheDocument();
      });

      // 11 MB file
      const bigFile = new File(['a'], 'huge-dump.pdf', { type: 'application/pdf' });
      Object.defineProperty(bigFile, 'size', { value: 11 * 1024 * 1024 });

      const fileInput = screen.getByTestId('task-attachment-input');
      fireEvent.change(fileInput, { target: { files: [bigFile] } });

      await waitFor(() => {
        expect(screen.getByTestId('attachment-upload-error')).toHaveTextContent(
          'File exceeds maximum allowed size of 10 MB',
        );
      });
      expect(tasksApi.uploadTaskAttachment).not.toHaveBeenCalled();
    });

    it('rejects unsupported file formats', async () => {
      render(
        <TaskAttachmentsList
          taskId={mockTaskId}
          currentEmployeeId={mockEmployeeId}
          assignerEmployeeId={mockAssignerId}
        />,
      );

      await waitFor(() => {
        expect(screen.getByTestId('task-attachment-input')).toBeInTheDocument();
      });

      const exeFile = new File(['bad'], 'payload.exe', { type: 'application/x-msdownload' });

      const fileInput = screen.getByTestId('task-attachment-input');
      fireEvent.change(fileInput, { target: { files: [exeFile] } });

      await waitFor(() => {
        expect(screen.getByTestId('attachment-upload-error')).toHaveTextContent(
          'Only PDF, PNG, or JPEG files are supported',
        );
      });
      expect(tasksApi.uploadTaskAttachment).not.toHaveBeenCalled();
    });

    it('enforces deletion permission: uploader and assigner can delete, other members cannot', async () => {
      vi.mocked(tasksApi.deleteTaskAttachment).mockResolvedValue({ removed: true });

      // Render as Alice (uploader of att-1, but not att-2)
      // Bob is assigner of task, so he can delete both
      const { rerender } = render(
        <TaskAttachmentsList
          taskId={mockTaskId}
          currentEmployeeId={mockEmployeeId}
          assignerEmployeeId={mockAssignerId}
          isAdmin={false}
        />,
      );

      await waitFor(() => {
        // Alice uploaded att-1 -> can delete
        expect(screen.getByTestId('delete-attachment-att-1')).toBeInTheDocument();
        // Alice is NOT assigner and did NOT upload att-2 -> CANNOT delete att-2
        expect(screen.queryByTestId('delete-attachment-att-2')).toBeNull();
      });

      // Click delete on att-1
      fireEvent.click(screen.getByTestId('delete-attachment-att-1'));
      await waitFor(() => {
        expect(tasksApi.deleteTaskAttachment).toHaveBeenCalledWith(mockTaskId, 'att-1');
        expect(screen.queryByText('redis-benchmark-report.pdf')).toBeNull();
      });

      // Rerender as third-party staff member (not uploader, not assigner, not admin)
      rerender(
        <TaskAttachmentsList
          taskId={mockTaskId}
          currentEmployeeId="99999999-9999-9999-9999-999999999999"
          assignerEmployeeId={mockAssignerId}
          isAdmin={false}
        />,
      );

      await waitFor(() => {
        expect(screen.queryByTestId('delete-attachment-att-2')).toBeNull();
      });

      // Rerender as Admin -> can delete any
      rerender(
        <TaskAttachmentsList
          taskId={mockTaskId}
          currentEmployeeId="99999999-9999-9999-9999-999999999999"
          assignerEmployeeId={mockAssignerId}
          isAdmin={true}
        />,
      );

      await waitFor(() => {
        expect(screen.getByTestId('delete-attachment-att-2')).toBeInTheDocument();
      });
    });
  });

  describe('TaskDetailModal with Collaboration Tabs', () => {
    it('switches between Overview, Comments, and Attachments tabs seamlessly', async () => {
      render(
        <TaskDetailModal
          isOpen={true}
          onClose={vi.fn()}
          task={mockTask}
          currentEmployeeId={mockEmployeeId}
        />,
      );

      // Default is overview
      expect(screen.getByTestId('task-tab-overview')).toBeInTheDocument();
      expect(screen.getByText('Add Redis layer for sessions.')).toBeInTheDocument();

      // Click Comments tab
      const commentsRadio = screen.getByRole('radio', { name: 'Comments' });
      fireEvent.click(commentsRadio);

      await waitFor(() => {
        expect(screen.getByTestId('task-tab-comments')).toBeInTheDocument();
        expect(screen.getByTestId('task-comments-thread')).toBeInTheDocument();
      });

      // Click Attachments tab
      const attachmentsRadio = screen.getByRole('radio', { name: 'Attachments' });
      fireEvent.click(attachmentsRadio);

      await waitFor(() => {
        expect(screen.getByTestId('task-tab-attachments')).toBeInTheDocument();
        expect(screen.getByTestId('task-attachments-list')).toBeInTheDocument();
      });

      // Click back to Overview
      const overviewRadio = screen.getByRole('radio', { name: 'Overview' });
      fireEvent.click(overviewRadio);

      await waitFor(() => {
        expect(screen.getByTestId('task-tab-overview')).toBeInTheDocument();
      });
    });
  });
});
