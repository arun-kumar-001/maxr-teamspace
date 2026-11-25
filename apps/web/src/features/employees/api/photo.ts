import { apiFetch } from '../../../api/client';
import { photoProblem } from '../lib/photo';

/** Sets an employee's profile photo (Admin and HR) and returns its stable URL. */
export async function uploadEmployeePhoto(employeeId: string, file: File): Promise<string> {
  const problem = photoProblem(file);
  if (problem) throw new Error(problem);
  const res = await apiFetch(`/api/v1/employees/${encodeURIComponent(employeeId)}/photo`, {
    method: 'PUT',
    // The server checks the file's real type; the name only needs a matching extension.
    headers: {
      'Content-Type': file.type,
      'X-Filename': file.type === 'image/png' ? 'employee.png' : 'employee.jpg',
    },
    body: file,
  });
  const body = (await res.json().catch(() => null)) as {
    data?: { photoUrl?: string };
    error?: { message?: string };
  } | null;
  if (!res.ok || !body?.data?.photoUrl) {
    throw new Error(body?.error?.message ?? 'The photo could not be saved.');
  }
  return body.data.photoUrl;
}

/** Removes an employee's profile photo (Admin and HR). */
export async function deleteEmployeePhoto(employeeId: string): Promise<void> {
  const res = await apiFetch(`/api/v1/employees/${encodeURIComponent(employeeId)}/photo`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
    throw new Error(body?.error?.message ?? 'The photo could not be removed.');
  }
}
