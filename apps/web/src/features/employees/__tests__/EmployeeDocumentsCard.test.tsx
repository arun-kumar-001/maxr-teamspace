// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EmployeeDocumentsCard } from '../components/EmployeeDocumentsCard';

const doc = (id: string, title: string, documentType: string) => ({
  id,
  employeeId: 'emp-1',
  uploadedByEmployeeId: 'emp-hr',
  documentType,
  title,
  isSensitive: false,
  originalName: `${title}.pdf`,
  contentType: 'application/pdf',
  sizeBytes: 250 * 1024,
  createdAt: '2026-11-10T09:00:00Z',
  updatedAt: '2026-11-10T09:00:00Z',
});

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('EmployeeDocumentsCard', () => {
  const originalFetch = globalThis.fetch;
  let fetchMock: ReturnType<typeof vi.fn>;

  const renderCard = () =>
    render(
      <MemoryRouter>
        <EmployeeDocumentsCard employeeId="emp-1" />
      </MemoryRouter>,
    );

  beforeEach(() => {
    fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });
  afterEach(() => {
    cleanup();
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('lists the documents with their type, size and upload date', async () => {
    fetchMock.mockResolvedValue(
      json(200, {
        data: [doc('d1', 'Passport', 'identity'), doc('d2', 'B.Tech certificate', 'education')],
      }),
    );
    renderCard();

    expect(await screen.findByText('Passport')).toBeInTheDocument();
    expect(screen.getByText('B.Tech certificate')).toBeInTheDocument();
    expect(screen.getAllByText(/250 KB/).length).toBe(2);
    expect(screen.getByTestId('manage-documents-link')).toHaveAttribute(
      'href',
      '/employees/emp-1/documents',
    );
  });

  it('opens a document through a short-lived link from the API', async () => {
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);
    fetchMock.mockImplementation(async (input: RequestInfo | URL) =>
      String(input).includes('/download-link')
        ? json(200, {
            data: {
              url: 'https://files.example/signed?token=abc',
              expiresAt: '2026-11-10T09:05:00Z',
            },
          })
        : json(200, { data: [doc('d1', 'Passport', 'identity')] }),
    );
    renderCard();

    fireEvent.click(await screen.findByRole('button', { name: 'View Passport' }));

    await waitFor(() => expect(click).toHaveBeenCalled());
    expect(
      fetchMock.mock.calls.some(([url]) =>
        String(url).includes('/api/v1/employees/emp-1/documents/d1/download-link'),
      ),
    ).toBe(true);
  });

  it('says so when there are no documents', async () => {
    fetchMock.mockResolvedValue(json(200, { data: [] }));
    renderCard();
    expect(await screen.findByTestId('employee-documents-empty')).toBeInTheDocument();
  });

  it('says why when the viewer may not see documents, instead of showing an empty list', async () => {
    fetchMock.mockResolvedValue(
      json(403, { error: { code: 'FORBIDDEN', message: 'Not allowed' } }),
    );
    renderCard();
    expect(await screen.findByTestId('employee-documents-forbidden')).toBeInTheDocument();
    expect(screen.queryByTestId('employee-documents-empty')).toBeNull();
  });
});
