const MAX_NAME_LENGTH = 120;

/**
 * Makes a user-supplied filename safe to keep and to show: no directories, no control
 * characters, no characters that are special in paths or headers, bounded length.
 * It is metadata only; it is never used to build a storage path.
 */
export function sanitizeFilename(input: string): string {
  const base = input.split(/[\\/]/).pop() ?? '';
  let name = base
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/[<>:"|?*]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+/, '');

  if (name.length > MAX_NAME_LENGTH) {
    const dot = name.lastIndexOf('.');
    const extension = dot > 0 && name.length - dot <= 10 ? name.slice(dot) : '';
    name = name.slice(0, MAX_NAME_LENGTH - extension.length) + extension;
  }
  return name || 'file';
}

/** Lower-case extension without the dot, or '' when there is none. */
export function extensionOf(filename: string): string {
  const dot = filename.lastIndexOf('.');
  return dot > 0 && dot < filename.length - 1 ? filename.slice(dot + 1).toLowerCase() : '';
}

/** `Content-Disposition: attachment` value that is safe against header injection and handles non-ASCII names. */
export function contentDisposition(filename: string): string {
  const clean = sanitizeFilename(filename);
  const fallback = clean.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(clean).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)}`;
}
