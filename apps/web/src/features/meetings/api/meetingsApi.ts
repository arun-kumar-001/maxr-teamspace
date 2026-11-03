import { apiFetch } from '../../../api/client';
import type {
  ListMeetingsQuery,
  ListMeetingsResponse,
  Meeting,
  MeetingWithOverlaps,
  Rsvp,
  ScheduleMeetingInput,
  UpdateMeetingInput,
} from '../types';

export class MeetingsApiError extends Error {
  constructor(
    message: string,
    public status?: number,
    public code?: string,
  ) {
    super(message);
    this.name = 'MeetingsApiError';
  }
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let errorMsg = `API request failed with status ${res.status}`;
    let code: string | undefined;
    try {
      const errorData = await res.json();
      if (errorData?.error?.message) {
        errorMsg = errorData.error.message;
        code = errorData.error.code;
      }
    } catch {
      // response not JSON
    }
    throw new MeetingsApiError(errorMsg, res.status, code);
  }
  return res.json() as Promise<T>;
}

export async function fetchMeetings(
  query: ListMeetingsQuery,
  signal?: AbortSignal,
): Promise<ListMeetingsResponse> {
  const searchParams = new URLSearchParams();
  searchParams.set('from', query.from);
  searchParams.set('to', query.to);
  if (query.page) searchParams.set('page', String(query.page));
  if (query.pageSize) searchParams.set('pageSize', String(query.pageSize));

  const url = `/api/v1/meetings?${searchParams.toString()}`;
  const res = await apiFetch(url, signal ? { signal } : undefined);
  return handleResponse<ListMeetingsResponse>(res);
}

export async function fetchMeetingById(id: string, signal?: AbortSignal): Promise<Meeting> {
  const res = await apiFetch(
    `/api/v1/meetings/${encodeURIComponent(id)}`,
    signal ? { signal } : undefined,
  );
  const data = await handleResponse<{ data: Meeting }>(res);
  return data.data;
}

export async function scheduleMeeting(input: ScheduleMeetingInput): Promise<MeetingWithOverlaps> {
  const res = await apiFetch('/api/v1/meetings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const data = await handleResponse<{ data: MeetingWithOverlaps }>(res);
  return data.data;
}

export async function updateMeeting(
  id: string,
  input: UpdateMeetingInput,
): Promise<MeetingWithOverlaps> {
  const res = await apiFetch(`/api/v1/meetings/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const data = await handleResponse<{ data: MeetingWithOverlaps }>(res);
  return data.data;
}

export async function cancelMeeting(id: string): Promise<Meeting> {
  const res = await apiFetch(`/api/v1/meetings/${encodeURIComponent(id)}/cancel`, {
    method: 'POST',
  });
  const data = await handleResponse<{ data: Meeting }>(res);
  return data.data;
}

export async function respondMeetingRsvp(
  id: string,
  response: 'accepted' | 'declined' | 'tentative',
): Promise<{ rsvp: Rsvp }> {
  const res = await apiFetch(`/api/v1/meetings/${encodeURIComponent(id)}/rsvp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ response }),
  });
  const data = await handleResponse<{ data: { rsvp: Rsvp } }>(res);
  return data.data;
}
