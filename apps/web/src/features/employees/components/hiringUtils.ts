const AVATAR_TONES = [
  'bg-sky-100 text-sky-800',
  'bg-emerald-100 text-emerald-800',
  'bg-amber-100 text-amber-800',
  'bg-purple-100 text-purple-800',
  'bg-rose-100 text-rose-800',
  'bg-primary-soft text-primary-deep',
] as const;

export function getInitials(firstName: string, lastName?: string): string {
  const parts = lastName ? [firstName, lastName] : firstName.trim().split(/\s+/);
  const first = parts[0]?.charAt(0) ?? '';
  const second = parts[1]?.charAt(0) ?? parts[0]?.charAt(1) ?? '';
  return `${first}${second}`.toUpperCase() || '?';
}

export function getAvatarTone(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return AVATAR_TONES[Math.abs(hash) % AVATAR_TONES.length] ?? AVATAR_TONES[0];
}
