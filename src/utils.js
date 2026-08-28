const IMAGE_BASE = (import.meta.env.VITE_IMAGE_URL || import.meta.env.VITE_WORKER_URL || '').replace(/\/$/, '');

// Ambil satu snapshot waktu per render/callback. Dibungkus agar komponen tidak
// memanggil API impure berkali-kali di tengah perhitungan render.
export function nowTimestamp() {
  return Date.now();
}

// Nilai urut buat chapter_number yang BUKAN angka biasa — dipakai bareng
// scripts/build-catalog.js (sumber kebenaran urutan chapter dari server) biar
// konsisten kalau frontend perlu urutkan sendiri (mis. cari chapter tertua).
// Selain angka biasa, dukung chapter_number berupa label "Prolog"/"Prolog 1"/
// "Prolog-1" (sebelum Ch. 1, urut sesama Prolog naik sesuai angkanya) dan
// "Epilog"/"Epilog 1" (SESUDAH chapter terakhir, urut sesama Epilog naik).
// "Oneshot" & label lain yang tak dikenali tetap fallback -Infinity (perilaku
// lama, aman krn biasanya cuma 1 chapter jadi gak ada konflik urutan).
export function chapterSortValue(value) {
  const n = Number(value);
  if (Number.isFinite(n)) return n;
  const s = String(value ?? '').trim().toLowerCase();
  const prolog = s.match(/^prolog[\s-]?(\d+(?:\.\d+)?)?$/);
  if (prolog) return -1e9 + (prolog[1] ? Number(prolog[1]) : 0);
  const epilog = s.match(/^epilog[\s-]?(\d+(?:\.\d+)?)?$/);
  if (epilog) return 1e9 + (epilog[1] ? Number(epilog[1]) : 0);
  return Number.NEGATIVE_INFINITY;
}

// Convert R2 path ke full URL via image worker
export function imgUrl(path) {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  return `${IMAGE_BASE}/${path}`;
}

export function coverUrlForWidth(manga, width) {
  const covers = manga?.coverUrls;
  if (width < 640) return imgUrl(covers?.mobile || manga?.coverUrl);
  if (width < 1024) return imgUrl(covers?.tablet || covers?.desktop || manga?.coverUrl);
  return imgUrl(covers?.desktop || manga?.coverUrl);
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
  const date = new Date(s);
  const diff = Date.now() - date.getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  const mo = Math.floor(d / 30);
  const w = Math.floor(d / 7);
  // >12 bulan: "N bln lalu" jadi janggal dibaca (mis. "31 bln lalu") — ganti
  // ke "Bulan Tahun" (mis. "Jan 2024"), lebih gampang dicerna utk chapter lama.
  if (mo >= 12) return date.toLocaleDateString('id-ID', { month: 'short', year: 'numeric' });
  if (mo > 0)  return `${mo} bln lalu`;
  if (w > 0)   return `${w} mgg lalu`;
  if (d > 0)   return `${d} hari lalu`;
  if (h > 0)   return `${h} jam lalu`;
  if (m > 0)   return `${m} mnt lalu`;
  return 'Baru saja';
}

// Label tanggal chapter di halaman detail: relatif ("2 hari lalu") selama
// masih ≤3 hari, lewat itu tanggal lengkap ("16 Agustus 2026") — beda dari
// timeAgo() biasa yang tetap relatif sampai 12 bulan (dipakai di History,
// konteksnya beda: "kapan aku terakhir baca" tetap masuk akal relatif lama-
// lama, sementara "kapan chapter rilis" lebih berguna sebagai tanggal pasti
// begitu lewat beberapa hari).
export function chapterDateLabel(dateStr) {
  if (!dateStr) return '';
  let s = dateStr;
  if (typeof s === 'string' && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(s)) {
    s = s.replace(' ', 'T') + 'Z';
  }
  const date = new Date(s);
  const days = Math.floor((Date.now() - date.getTime()) / 86400000);
  if (days > 3) return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  return timeAgo(dateStr);
}

// Versi ringkas tanpa "lalu" — untuk ruang sempit (manga card)
export function timeAgoShort(dateStr) {
  const full = timeAgo(dateStr);
  return full === 'Baru saja' ? 'Baru' : full.replace(' lalu', '');
}
