// Turns an uploaded image into a small data URL so it can live in localStorage.
const MAX_SIDE = 960;
const MAX_BYTES = 8 * 1024 * 1024;

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Could not read the image'));
    reader.readAsDataURL(file);
  });
}

export async function fileToDataUrl(file) {
  if (!file.type.startsWith('image/')) throw new Error('Please choose an image file');
  if (file.size > MAX_BYTES) throw new Error('Image is larger than 8 MB');
  const original = await readAsDataUrl(file);
  if (file.type === 'image/svg+xml' || file.type === 'image/gif') return file.size < 150000 ? original : '';
  try {
    const img = await new Promise((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = original;
    });
    const scale = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.78);
  } catch {
    return original.length < 400000 ? original : '';
  }
}
