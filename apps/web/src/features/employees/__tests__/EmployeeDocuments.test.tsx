// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { DocumentTypeBadge } from '../components/DocumentTypeBadge';
import { UploadDocumentModal } from '../components/UploadDocumentModal';
import { DeleteDocumentModal } from '../components/DeleteDocumentModal';
import { EmployeeDocumentsTab } from '../components/EmployeeDocumentsTab';
import { EmployeeDocumentsPage } from '../pages/EmployeeDocumentsPage';
import * as documentsApi from '../api/documents';
import * as authContext from '../../../auth/AuthContext';
import type { EmployeeDocumentSummary } from '../types/documents';

afterEach(cleanup);

const MOCK_DOCUMENTS: EmployeeDocumentSummary[] = [
  {
    id: 'doc-001',
    employeeId: 'emp-101',
    title: 'Aadhaar Card Copy',
    documentType: 'id_proof',
    originalName: 'aadhaar_card.pdf',
    contentType: 'application/pdf',
    sizeBytes: 1024 * 500, // 500 KB
    isSensitive: true,
    uploadedByEmployeeId: 'emp-admin',
    createdAt: '2026-11-01T10:00:00Z',
    updatedAt: '2026-11-01T10:00:00Z',
  },
  {
    id: 'doc-002',
    employeeId: 'emp-101',
    title: 'Degree Certificate',
    documentType: 'education_certificate',
    originalName: 'btech_degree.png',
    contentType: 'image/png',
    sizeBytes: 1024 * 1200, // 1.2 MB
    isSensitive: false,
    uploadedByEmployeeId: 'emp-101',
    createdAt: '2026-11-01T11:00:00Z',
    updatedAt: '2026-11-01T11:00:00Z',
  },
  {
    id: 'doc-003',
    employeeId: 'emp-101',
    title: 'Employment Offer Letter',
    documentType: 'contract',
    originalName: 'offer_signed.pdf',
    contentType: 'application/pdf',
    sizeBytes: 1024 * 800,
    isSensitive: true,
    uploadedByEmployeeId: 'emp-admin',
    createdAt: '2026-11-01T12:00:00Z',
    updatedAt: '2026-11-01T12:00:00Z',
  },
];

describe('Employee Documents Feature Suite (Issue #25)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('DocumentTypeBadge', () => {
    it('renders correct labels and icons for each document type', () => {
      const { rerender } = render(<DocumentTypeBadge type="id_proof" />);
      expect(screen.getByText('ID Proof')).toBeDefined();

      rerender(<DocumentTypeBadge type="education_certificate" />);
      expect(screen.getByText('Education Certificate')).toBeDefined();

      rerender(<DocumentTypeBadge type="contract" />);
      expect(screen.getByText('Contract')).toBeDefined();

      rerender(<DocumentTypeBadge type="experience_letter" />);
      expect(screen.getByText('Experience Letter')).toBeDefined();

      rerender(<DocumentTypeBadge type="other" />);
      expect(screen.getByText('Other')).toBeDefined();
    });

    it('renders sensitive badge when isSensitive is true', () => {
      render(<DocumentTypeBadge type="id_proof" isSensitive={true} />);
      expect(screen.getByText('ID Proof')).toBeDefined();
      expect(screen.getByText('Sensitive')).toBeDefined();
    });
  });

  describe('UploadDocumentModal', () => {
    it('does not render when isOpen is false', () => {
      render(<UploadDocumentModal isOpen={false} onClose={() => {}} onUpload={async () => {}} />);
      expect(screen.queryByTestId('upload-document-modal')).toBeNull();
    });

    it('renders upload form with all required inputs and handles upload submission', async () => {
      const handleUpload = vi.fn().mockResolvedValue(undefined);
      const handleClose = vi.fn();

      render(
        <UploadDocumentModal
          isOpen={true}
          onClose={handleClose}
          onUpload={handleUpload}
          canSetSensitive={true}
        />,
      );

      expect(screen.getByTestId('upload-document-modal')).toBeDefined();
      const titleInput = screen.getByPlaceholderText(/Passport Copy/i);
      const fileInput = document.getElementById('document-file') as HTMLInputElement;

      // Select File
      const file = new File(['%PDF-1.4 dummy content'], 'passport.pdf', {
        type: 'application/pdf',
      });
      fireEvent.change(fileInput, { target: { files: [file] } });

      // Enter Title
      fireEvent.change(titleInput, {
        target: { value: 'Passport Front & Back' },
      });

      // Click upload submit
      const submitButton = screen.getByTestId('upload-document-submit');
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(handleUpload).toHaveBeenCalledWith(file, {
          title: 'Passport Front & Back',
          documentType: 'id_proof',
          isSensitive: false,
        });
      });
    });

    it('shows validation error when file exceeds 10MB limit', async () => {
      const handleUpload = vi.fn();

      render(<UploadDocumentModal isOpen={true} onClose={() => {}} onUpload={handleUpload} />);

      const oversizedFile = new File(['x'.repeat(100)], 'huge.pdf', {
        type: 'application/pdf',
      });
      Object.defineProperty(oversizedFile, 'size', { value: 11 * 1024 * 1024 });

      const fileInput = document.getElementById('document-file') as HTMLInputElement;
      fireEvent.change(fileInput, { target: { files: [oversizedFile] } });

      expect(screen.getByText(/File size must not exceed 10 MB/i)).toBeDefined();
    });
  });

  describe('DeleteDocumentModal', () => {
    it('renders document title and confirms deletion', async () => {
      const handleConfirmDelete = vi.fn().mockResolvedValue(undefined);
      const handleClose = vi.fn();

      render(
        <DeleteDocumentModal
          isOpen={true}
          document={MOCK_DOCUMENTS[0]!}
          onClose={handleClose}
          onConfirmDelete={handleConfirmDelete}
        />,
      );

      expect(screen.getByTestId('delete-document-modal')).toBeDefined();
      expect(screen.getByText('Aadhaar Card Copy')).toBeDefined();

      const deleteBtn = screen.getByTestId('confirm-delete-document-btn');
      fireEvent.click(deleteBtn);

      await waitFor(() => {
        expect(handleConfirmDelete).toHaveBeenCalledWith('doc-001');
      });
    });
  });

  describe('EmployeeDocumentsTab', () => {
    it('renders loading state initially and then displays document list', async () => {
      vi.spyOn(documentsApi, 'fetchEmployeeDocuments').mockResolvedValue(MOCK_DOCUMENTS);

      render(
        <EmployeeDocumentsTab
          employeeId="emp-101"
          canUpload={true}
          canDelete={true}
          canSetSensitive={true}
        />,
      );

      expect(screen.getByTestId('documents-loading')).toBeDefined();

      await waitFor(() => {
        expect(screen.getByTestId('employee-documents-tab')).toBeDefined();
      });

      expect(screen.getAllByText('Aadhaar Card Copy').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Degree Certificate').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Employment Offer Letter').length).toBeGreaterThan(0);
    });

    it('filters documents by category type', async () => {
      vi.spyOn(documentsApi, 'fetchEmployeeDocuments').mockImplementation(async (_id, filter) => {
        if (filter?.documentType) {
          return MOCK_DOCUMENTS.filter((d) => d.documentType === filter.documentType);
        }
        return MOCK_DOCUMENTS;
      });

      render(<EmployeeDocumentsTab employeeId="emp-101" canUpload={true} canDelete={true} />);

      await waitFor(() => {
        expect(screen.getAllByText('Aadhaar Card Copy').length).toBeGreaterThan(0);
      });

      const select = screen.getByLabelText('Filter documents by type');
      fireEvent.change(select, { target: { value: 'education_certificate' } });

      await waitFor(() => {
        expect(screen.queryByText('Aadhaar Card Copy')).toBeNull();
        expect(screen.getAllByText('Degree Certificate').length).toBeGreaterThan(0);
      });
    });

    it('triggers secure signed link generation on download click', async () => {
      vi.spyOn(documentsApi, 'fetchEmployeeDocuments').mockResolvedValue(MOCK_DOCUMENTS);
      const downloadSpy = vi.spyOn(documentsApi, 'fetchDocumentDownloadLink').mockResolvedValue({
        url: '/api/v1/files/download?token=xyz123',
        expiresAt: '2026-11-01T10:15:00Z',
      });

      render(<EmployeeDocumentsTab employeeId="emp-101" canUpload={false} canDelete={false} />);

      await waitFor(() => {
        expect(screen.getByTestId('download-doc-doc-001')).toBeDefined();
      });

      fireEvent.click(screen.getByTestId('download-doc-doc-001'));

      await waitFor(() => {
        expect(downloadSpy).toHaveBeenCalledWith('emp-101', 'doc-001');
      });
    });

    it('shows empty state when no documents are uploaded', async () => {
      vi.spyOn(documentsApi, 'fetchEmployeeDocuments').mockResolvedValue([]);

      render(<EmployeeDocumentsTab employeeId="emp-101" canUpload={true} canDelete={false} />);

      await waitFor(() => {
        expect(screen.getByTestId('documents-empty-state')).toBeDefined();
      });

      expect(screen.getByText('No Documents Uploaded')).toBeDefined();
    });
  });

  describe('EmployeeDocumentsPage Routing & Permission Isolation', () => {
    it('denies access to Team Lead role', () => {
      vi.spyOn(authContext, 'useAuth').mockReturnValue({
        role: 'team_lead',
        user: {
          id: 'u-lead',
          employeeId: 'emp-lead',
          role: 'team_lead',
          roles: ['team_lead'],
          permissions: [],
          email: 'lead@maxr.internal',
          name: 'Lead',
          avatarInitials: 'TL',
        },
        isAuthenticated: true,
        isLoading: false,
        login: vi.fn(),
        logout: vi.fn(),
        switchRole: vi.fn(),
      });

      render(
        <MemoryRouter initialEntries={['/employees/emp-101/documents']}>
          <Routes>
            <Route path="/employees/:id/documents" element={<EmployeeDocumentsPage />} />
          </Routes>
        </MemoryRouter>,
      );

      expect(screen.getByTestId('documents-page-forbidden')).toBeDefined();
      expect(screen.getByText('Access Restricted')).toBeDefined();
    });

    it('denies staff role from viewing another employee documents', () => {
      vi.spyOn(authContext, 'useAuth').mockReturnValue({
        role: 'staff',
        user: {
          id: 'u-staff',
          employeeId: 'emp-staff-own',
          role: 'staff',
          roles: ['staff'],
          permissions: [],
          email: 'staff@maxr.internal',
          name: 'Staff',
          avatarInitials: 'SM',
        },
        isAuthenticated: true,
        isLoading: false,
        login: vi.fn(),
        logout: vi.fn(),
        switchRole: vi.fn(),
      });

      render(
        <MemoryRouter initialEntries={['/employees/emp-someone-else/documents']}>
          <Routes>
            <Route path="/employees/:id/documents" element={<EmployeeDocumentsPage />} />
          </Routes>
        </MemoryRouter>,
      );

      expect(screen.getByTestId('documents-page-forbidden')).toBeDefined();
    });

    it('allows staff role to view their own documents at /staff/documents', async () => {
      vi.spyOn(authContext, 'useAuth').mockReturnValue({
        role: 'staff',
        user: {
          id: 'u-staff',
          employeeId: 'emp-101',
          role: 'staff',
          roles: ['staff'],
          permissions: [],
          email: 'staff@maxr.internal',
          name: 'Staff',
          avatarInitials: 'SM',
        },
        isAuthenticated: true,
        isLoading: false,
        login: vi.fn(),
        logout: vi.fn(),
        switchRole: vi.fn(),
      });
      vi.spyOn(documentsApi, 'fetchEmployeeDocuments').mockResolvedValue(MOCK_DOCUMENTS);

      render(
        <MemoryRouter initialEntries={['/staff/documents']}>
          <Routes>
            <Route path="/staff/documents" element={<EmployeeDocumentsPage />} />
          </Routes>
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(screen.getByTestId('employee-documents-page')).toBeDefined();
      });

      expect(screen.getByText('My Documents')).toBeDefined();
    });

    it('allows admin role to view any employee documents with delete permission', async () => {
      vi.spyOn(authContext, 'useAuth').mockReturnValue({
        role: 'admin',
        user: {
          id: 'u-admin',
          employeeId: 'emp-admin',
          role: 'admin',
          roles: ['admin'],
          permissions: [],
          email: 'admin@maxr.internal',
          name: 'Admin',
          avatarInitials: 'AD',
        },
        isAuthenticated: true,
        isLoading: false,
        login: vi.fn(),
        logout: vi.fn(),
        switchRole: vi.fn(),
      });
      vi.spyOn(documentsApi, 'fetchEmployeeDocuments').mockResolvedValue(MOCK_DOCUMENTS);

      render(
        <MemoryRouter initialEntries={['/employees/emp-101/documents']}>
          <Routes>
            <Route path="/employees/:id/documents" element={<EmployeeDocumentsPage />} />
          </Routes>
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(screen.getByTestId('employee-documents-page')).toBeDefined();
      });

      // Admin has delete buttons
      expect(screen.getByTestId('delete-doc-doc-001')).toBeDefined();
    });
  });
});
