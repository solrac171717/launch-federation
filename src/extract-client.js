// Browser side of document autofill: get a PDF or photo ready (photos are shrunk so they upload fast), send it, return the answer.
export const EXTRACT_ACCEPT = '.pdf,.png,.jpg,.jpeg,.webp,.gif,application/pdf,image/*';
export const EXTRACT_MAX_BYTES = 3 * 1024 * 1024;
const MIMES = { pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif' };

export const mimeOf = file => { const ext = String(file?.name || '').split('.').pop().toLowerCase(); return MIMES[ext] || (Object.values(MIMES).includes(file?.type) ? file.type : ''); };

export function checkExtractFile(file) {
  if (!file || !file.size) return 'That file is empty.';
  if (!mimeOf(file)) return 'Use a PDF or a photo (PNG, JPG, WebP).';
  if (mimeOf(file) === 'application/pdf' && file.size > EXTRACT_MAX_BYTES) return 'That PDF is over 3 MB. Use a smaller one, or a photo of the document.';
  if (file.size > 25 * 1024 * 1024) return 'That image is too large.';
  return null;
}

const toBase64 = blob => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1] || ''); r.onerror = () => rej(r.error); r.readAsDataURL(blob); });

/** Photos: scale the long side to 1800 px and re-encode as JPEG so phone pictures stay well under the upload limit. */
async function shrink(file) {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, 1800 / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.85));
  if (!blob) throw new Error('Could not read that image.');
  return blob;
}

export async function extractFromFile(cloud, file) {
  const bad = checkExtractFile(file); if (bad) throw new Error(bad);
  let mime = mimeOf(file), blob = file;
  if (mime !== 'application/pdf' && (file.size > 1.5 * 1024 * 1024 || mime === 'image/gif')) {
    try { blob = await shrink(file); mime = 'image/jpeg'; } catch { if (file.size > EXTRACT_MAX_BYTES) throw new Error('That image is too large to read. Try a smaller photo.'); }
  }
  return cloud.extract({ mime, data: await toBase64(blob) });
}
