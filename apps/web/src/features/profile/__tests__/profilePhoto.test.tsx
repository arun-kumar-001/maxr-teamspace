// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as client from '../../../api/client';
import { buildUserFromApi } from '../../../auth/AuthContext';
import { EmployeeCard } from '../../employees/components/EmployeeCard';
import type { EmployeeDirectoryItem } from '../../employees/types';
import { checkPhotoFile, deleteMyPhoto, uploadMyPhoto } from '../api/profileApi';
import { ProfileHeader } from '../components/ProfileHeader';
import type { EmployeeProfile } from '../types';

const file = (type: string, size = 100, name = 'me') =>
  new File([new Uint8Array(size)], name, { type });
const reply = (status: number, body?: unknown) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }) as unknown as Response;

describe('profile photos are the server’s, not this browser’s', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });
  afterEach(() => cleanup());

  describe('the API client', () => {
    it('sends the image as the raw body with its real type, and returns the stable URL', async () => {
      const apiFetch = vi
        .spyOn(client, 'apiFetch')
        .mockResolvedValue(reply(200, { data: { photoUrl: '/api/v1/employees/e1/photo?v=5' } }));
      const png = file('image/png', 1000, 'holiday.photo.PNG');

      expect(await uploadMyPhoto(png)).toBe('/api/v1/employees/e1/photo?v=5');

      const [url, init] = apiFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('/api/v1/employees/me/photo');
      expect(init.method).toBe('PUT');
      expect(init.body).toBe(png);
      expect(init.headers).toMatchObject({
        'Content-Type': 'image/png',
        'X-Filename': 'profile.png',
      });
    });

    it.each([
      ['an SVG', file('image/svg+xml')],
      ['a GIF', file('image/gif')],
      ['a WebP', file('image/webp')],
      ['a photo over 2 MB', file('image/jpeg', 2 * 1024 * 1024 + 1)],
    ])('refuses %s before sending anything', async (_n, bad) => {
      const apiFetch = vi.spyOn(client, 'apiFetch');
      expect(checkPhotoFile(bad)).not.toBeNull();
      await expect(uploadMyPhoto(bad)).rejects.toThrow();
      expect(apiFetch).not.toHaveBeenCalled();
    });

    it('passes on the server’s reason when it refuses the photo', async () => {
      vi.spyOn(client, 'apiFetch').mockResolvedValue(
        reply(400, {
          error: { code: 'VALIDATION_ERROR', message: 'The file was rejected by the virus scan' },
        }),
      );
      await expect(uploadMyPhoto(file('image/png'))).rejects.toThrow('rejected by the virus scan');
    });

    it('removes the photo with DELETE', async () => {
      const apiFetch = vi.spyOn(client, 'apiFetch').mockResolvedValue(reply(204));
      await deleteMyPhoto();
      expect(apiFetch).toHaveBeenCalledWith('/api/v1/employees/me/photo', { method: 'DELETE' });
    });
  });

  describe('the signed-in user', () => {
    it('shows the server photo, or initials: never a stock image or another person’s browser copy', () => {
      localStorage.setItem('maxr_avatar_staff', 'data:image/png;base64,SOMEONEELSE');
      localStorage.setItem('maxr_avatar_u1', 'data:image/png;base64,SOMEONEELSE');

      expect(
        buildUserFromApi({ id: 'u1', role: 'staff', photoUrl: '/api/v1/employees/e1/photo?v=2' })
          .avatarUrl,
      ).toBe('/api/v1/employees/e1/photo?v=2');
      expect(buildUserFromApi({ id: 'u1', role: 'staff' }).avatarUrl).toBeUndefined();
    });
  });

  describe('the profile header', () => {
    const profile: EmployeeProfile = {
      id: 'emp-100',
      employeeCode: 'EMP-001',
      firstName: 'Asha',
      lastName: 'Rao',
      email: 'asha@maxr.test',
      phone: null,
      department: { id: 'dept-1', name: 'Engineering', code: 'ENG' },
      designation: { id: 'desig-1', title: 'Engineer' },
      manager: null,
      status: 'active',
      joiningDate: '2025-01-15',
      createdAt: '2025-01-15T00:00:00.000Z',
      updatedAt: '2025-01-15T00:00:00.000Z',
      version: 1,
      photoUrl: '/api/v1/employees/emp-100/photo?v=1',
    };

    it('hands the chosen file to the upload it was given', async () => {
      const onUpload = vi.fn(async () => undefined);
      render(<ProfileHeader profile={profile} photo={{ onUpload, onRemove: vi.fn() }} />);

      const chosen = file('image/png');
      fireEvent.change(screen.getByTestId('profile-photo-file-input'), {
        target: { files: [chosen] },
      });

      await waitFor(() => expect(onUpload).toHaveBeenCalledWith(chosen));
    });

    it('says why when the upload fails, and does not pretend it worked', async () => {
      const onUpload = vi.fn(async () => {
        throw new Error('The photo could not be checked');
      });
      render(<ProfileHeader profile={profile} photo={{ onUpload, onRemove: vi.fn() }} />);

      fireEvent.change(screen.getByTestId('profile-photo-file-input'), {
        target: { files: [file('image/png')] },
      });

      expect(await screen.findByText(/could not be checked/)).toBeInTheDocument();
    });

    it('removes the photo through the remove it was given, and shows why when that fails', async () => {
      const onRemove = vi.fn(async () => {
        throw new Error('Photo storage is down');
      });
      render(<ProfileHeader profile={profile} photo={{ onUpload: vi.fn(), onRemove }} />);

      fireEvent.click(screen.getByRole('button', { name: 'Remove Photo' }));

      expect(await screen.findByText(/Photo storage is down/)).toBeInTheDocument();
      expect(onRemove).toHaveBeenCalledTimes(1);
    });

    it('has no camera, file input or Remove Photo when the viewer may not change the photo', () => {
      render(<ProfileHeader profile={profile} />);
      expect(screen.queryByTestId('upload-avatar-btn')).toBeNull();
      expect(screen.queryByTestId('profile-photo-file-input')).toBeNull();
      expect(screen.queryByRole('button', { name: 'Remove Photo' })).toBeNull();
    });

    it('shows initials, and no Remove Photo, when there is no photo', () => {
      render(
        <ProfileHeader
          profile={{ ...profile, photoUrl: null }}
          photo={{ onUpload: vi.fn(), onRemove: vi.fn() }}
        />,
      );
      expect(screen.getByText('AR')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Remove Photo' })).toBeNull();
    });
  });

  describe('the employee card', () => {
    const employee = {
      id: 'emp-7',
      employeeCode: 'E-7',
      firstName: 'Mina',
      lastName: 'Das',
      email: 'mina@maxr.test',
      phone: null,
      status: 'active',
      department: { id: 'd', name: 'Eng', code: 'ENG' },
      designation: { id: 'g', title: 'Engineer' },
      manager: null,
      joiningDate: '2026-01-01',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    } as EmployeeDirectoryItem;

    it('shows the photo the server gave for that employee', () => {
      render(
        <EmployeeCard employee={{ ...employee, photoUrl: '/api/v1/employees/emp-7/photo?v=1' }} />,
      );
      expect(screen.getByAltText('Mina Das')).toHaveAttribute(
        'src',
        '/api/v1/employees/emp-7/photo?v=1',
      );
    });

    it('ignores a picture that happens to be stored in this browser under that person', () => {
      localStorage.setItem('maxr_avatar_emp-7', 'data:image/png;base64,LOCAL');
      localStorage.setItem('maxr_avatar_mina@maxr.test', 'data:image/png;base64,LOCAL');
      render(<EmployeeCard employee={employee} />);
      expect(screen.queryByAltText('Mina Das')).not.toBeInTheDocument();
    });
  });
});
