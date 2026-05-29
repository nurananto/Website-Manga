const WORKER = (import.meta.env.VITE_WORKER_URL || '').replace(/\/$/, ''); // hapus trailing slash

// Convert R2 path ke full URL via Worker
export function imgUrl(path) {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  return `${WORKER}/images/${path}`;
}

// Format tanggal relatif: "2j lalu", "3h lalu", "1m lalu"
export function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  const mo = Math.floor(d / 30);
  if (mo > 0)  return `${mo}bln lalu`;
  if (d > 0)   return `${d}h lalu`;
  if (h > 0)   return `${h}j lalu`;
  if (m > 0)   return `${m}m lalu`;
  return 'Baru saja';
}
