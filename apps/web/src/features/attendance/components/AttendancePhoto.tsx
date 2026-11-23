import { useEffect, useState } from 'react';
import { fetchAttendancePhotoLink } from '../api/attendance';

export interface AttendancePhotoProps {
  recordId: string;
  which: 'check-in' | 'check-out';
  alt: string;
  className?: string;
}

/**
 * One check-in or check-out photo. Photos are not part of any list, so it asks for a short-lived
 * link when it appears and shows a plain message if the photo cannot be loaded.
 */
export function AttendancePhoto({ recordId, which, alt, className }: AttendancePhotoProps) {
  const [state, setState] = useState<{ url: string } | { error: string } | null>(null);

  useEffect(() => {
    let current = true;
    setState(null);
    fetchAttendancePhotoLink(recordId, which)
      .then(({ url }) => current && setState({ url }))
      .catch(
        (err: unknown) =>
          current &&
          setState({
            error: err instanceof Error ? err.message : 'The photo could not be loaded.',
          }),
      );
    return () => {
      current = false;
    };
  }, [recordId, which]);

  if (state && 'url' in state) return <img src={state.url} alt={alt} className={className} />;
  return (
    <div
      role={state ? 'alert' : 'status'}
      className={`${className ?? ''} flex items-center justify-center bg-surface text-xs text-text-muted`}
    >
      {state ? state.error : 'Loading photo…'}
    </div>
  );
}
