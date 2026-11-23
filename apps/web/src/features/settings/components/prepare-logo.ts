/** Same limits as the API (company_settings.company_logo): small, raster only, never SVG. */
export const LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;
export const MAX_LOGO_DATA_URL_LENGTH = 300_000;
const MAX_LOGO_EDGE_PX = 512;

export class LogoError extends Error {}

function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      typeof reader.result === 'string'
        ? resolve(reader.result)
        : reject(new LogoError('Failed to read the selected file. Please try again.'));
    reader.onerror = () =>
      reject(new LogoError('Failed to read the selected file. Please try again.'));
    reader.readAsDataURL(file);
  });
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new LogoError('That image could not be opened.'));
    image.src = url;
  });
}

/**
 * Turns the chosen file into a data URL the server will accept. A file that already fits is used
 * as it is; a bigger one is scaled down to 512 px on its longest side and re-encoded as PNG.
 */
export async function prepareLogo(file: File): Promise<string> {
  if (!(LOGO_TYPES as readonly string[]).includes(file.type)) {
    throw new LogoError('Please choose a PNG, JPG or WEBP image. SVG is not accepted.');
  }

  const original = await readAsDataUrl(file);
  if (original.length <= MAX_LOGO_DATA_URL_LENGTH) return original;

  const image = await loadImage(original);
  const scale = Math.min(1, MAX_LOGO_EDGE_PX / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext('2d');
  if (!context) throw new LogoError('This browser cannot resize the image. Choose a smaller one.');
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  const resized = canvas.toDataURL('image/png');
  if (resized.length > MAX_LOGO_DATA_URL_LENGTH) {
    throw new LogoError('The logo is too large. Choose a simpler or smaller image.');
  }
  return resized;
}
