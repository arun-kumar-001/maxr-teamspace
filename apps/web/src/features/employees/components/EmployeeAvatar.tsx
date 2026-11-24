import { useEffect, useState } from 'react';
import { useAuth } from '../../../auth/AuthContext';

// An id alone carries no photo version, so every page load asks for a fresh copy: a photo that was
// replaced never sits in the browser cache for the day the photo route allows.
const PAGE_LOAD_EPOCH = Date.now();

// Ids the server has no readable photo for. One list of many rows then asks only once per id.
const withoutPhoto = new Set<string>();

export function employeePhotoSrc(employeeId: string): string {
  return `/api/v1/employees/${encodeURIComponent(employeeId)}/photo?v=${PAGE_LOAD_EPOCH}`;
}

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1] ?? '') : '';
  return `${first[0] ?? ''}${last[0] ?? ''}`.toUpperCase();
}

// Same permission the photo route checks. Outside an auth provider (a bare component) it is false.
function useCanReadEmployees(): boolean {
  try {
    return useAuth().user?.permissions?.includes('employees.read') ?? false;
  } catch {
    return false;
  }
}

interface EmployeeAvatarProps {
  name: string;
  /** Versioned photo URL when the list already carries one. */
  photoUrl?: string | null;
  /** When there is no URL, the photo is asked from the photo endpoint by id. */
  employeeId?: string | null;
  /** Overrides the initials shown when there is no photo. */
  initials?: string;
  /** Size, text and background of the circle. The shape and the photo fit are added here. */
  className?: string;
  /** Hover text for avatar stacks where the name is not written next to the circle. */
  title?: string;
  /** True when the person's name is written right next to the circle, so screen readers skip it. */
  decorative?: boolean;
}

/**
 * Round employee avatar: the employee's photo when there is one, otherwise their initials.
 * Looking a photo up by id needs the `employees.read` permission, the same one the photo route
 * checks, so people without it get initials and no failing requests.
 */
export function EmployeeAvatar({
  name,
  photoUrl,
  employeeId,
  initials,
  className = 'h-8 w-8 bg-primary-soft text-xs font-bold text-primary-ink',
  title,
  decorative = false,
}: EmployeeAvatarProps) {
  const canLookUpById = useCanReadEmployees();

  const src =
    photoUrl ||
    (employeeId && canLookUpById && !withoutPhoto.has(employeeId)
      ? employeePhotoSrc(employeeId)
      : undefined);

  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  // A new photo (or a different employee) gets a fresh chance to load.
  useEffect(() => {
    setFailedSrc(null);
    setLoadedSrc(null);
  }, [src]);

  const showPhoto = Boolean(src) && failedSrc !== src;
  // Initials stay visible until the photo has really loaded, so there is never an empty circle.
  const photoVisible = showPhoto && loadedSrc === src;

  return (
    <span
      title={title}
      aria-hidden={decorative || undefined}
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full ${className}`}
    >
      <span className={photoVisible ? 'sr-only' : undefined}>{initials ?? initialsOf(name)}</span>
      {showPhoto && (
        <img
          src={src}
          alt={decorative ? '' : name}
          loading="lazy"
          onLoad={() => setLoadedSrc(src ?? null)}
          onError={() => {
            if (!photoUrl && employeeId) withoutPhoto.add(employeeId);
            setFailedSrc(src ?? null);
          }}
          className={`absolute inset-0 h-full w-full object-cover ${photoVisible ? '' : 'opacity-0'}`}
        />
      )}
    </span>
  );
}
