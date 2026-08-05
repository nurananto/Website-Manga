// Chapter yang sudah dibaca (fade di daftar chapter) — disimpan di localStorage
// (guest & instan, tanpa nunggu network) + disinkron ke D1 kalau login (lintas
// device). Beda dari `history` (D1) yang cuma nyimpen 1 chapter TERAKHIR per
// manga — ini nyimpen SEMUA chapter yang pernah dibuka.
const KEY = 'mf_read_chapters';

export function getReadChapters() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '[]');
    return new Set(Array.isArray(raw) ? raw : []);
  } catch { return new Set(); }
}

function persist(set) {
  try { localStorage.setItem(KEY, JSON.stringify([...set])); } catch { /* private mode */ }
}

// Tandai 1 chapter sudah dibaca (localStorage). Return Set baru (immutable).
export function markChapterRead(chapterId, current) {
  const next = new Set(current);
  next.add(chapterId);
  persist(next);
  return next;
}

// Gabungkan beberapa id ke Set localStorage (dipakai saat merge dgn hasil D1).
export function mergeReadChapters(ids, current) {
  const next = new Set(current);
  for (const id of ids) next.add(id);
  persist(next);
  return next;
}
