const IMAGE_BASE = (import.meta.env.VITE_IMAGE_URL || import.meta.env.VITE_WORKER_URL || '').replace(/\/$/, '');

// Convert R2 path ke full URL via image worker
export function imgUrl(path) {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  return `${IMAGE_BASE}/${path}`;
}

// Format tanggal relatif: "2 jam lalu", "3 hari lalu", "1 bln lalu"
export function timeAgo(dateStr) {
  if (!dateStr) return '';
  // Timestamp SQLite/D1 ("YYYY-MM-DD HH:MM:SS") adalah UTC tanpa zona waktu —
  // normalisasi ke ISO UTC agar tidak terbaca sebagai waktu lokal
  let s = dateStr;
  if (typeof s === 'string' && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(s)) {
    s = s.replace(' ', 'T') + 'Z';
  }
  const diff = Date.now() - new Date(s).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  const mo = Math.floor(d / 30);
  const w = Math.floor(d / 7);
  if (mo > 0)  return `${mo} bln lalu`;
  if (w > 0)   return `${w} mgg lalu`;
  if (d > 0)   return `${d} hari lalu`;
  if (h > 0)   return `${h} jam lalu`;
  if (m > 0)   return `${m} mnt lalu`;
  return 'Baru saja';
}
