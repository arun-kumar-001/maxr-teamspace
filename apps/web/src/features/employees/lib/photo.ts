/** What the API accepts for a profile photo: PNG or JPEG, up to 2 MB. */
export const PHOTO_TYPES = ['image/png', 'image/jpeg'] as const;
export const PHOTO_MAX_BYTES = 2 * 1024 * 1024;

/** The problem with a chosen photo, or null when the API will take it. */
export function photoProblem(file: { type: string; size: number }): string | null {
  if (!(PHOTO_TYPES as readonly string[]).includes(file.type)) {
    return 'Please choose a PNG or JPEG image.';
  }
  if (file.size > PHOTO_MAX_BYTES) return 'The photo must be 2 MB or smaller.';
  return null;
}

/** A `data:image/png;base64,...` URL (what the form keeps for its preview) as a file to upload. */
export function dataUrlToFile(dataUrl: string, baseName: string): File | null {
  const match = /^data:(image\/(?:png|jpeg));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!match) return null;
  const type = match[1] as string;
  const binary = atob(match[2] as string);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], `${baseName}.${type === 'image/png' ? 'png' : 'jpg'}`, { type });
}
