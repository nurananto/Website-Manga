const WORKER = import.meta.env.VITE_WORKER_URL || '';

// Convert R2 path ke full URL via Worker
export function imgUrl(path) {
  if (!path) return null;
  if (path.startsWith('http')) return path; // sudah full URL (cover_dev / unsplash)
  return `${WORKER}/images/${path}`;
}
