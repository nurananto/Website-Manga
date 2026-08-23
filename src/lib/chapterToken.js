// Cache access token gambar untuk chapter TERKUNCI yang sudah dibeli, supaya
// membuka ulang chapter dalam masa berlaku token (~5 menit) tidak meminta
// Turnstile lagi.
//
// Keamanan (anti-abuse):
// - Token sudah terikat IP /64 + kedaluwarsa 5 menit + path di-hash, dan
//   DIVALIDASI server (image-worker lookup D1). Cache ini hanya menyimpan ulang
//   yang sudah terlihat di URL gambar — tidak membuka permukaan abuse baru.
// - Disimpan PER (userId, chapterId): token user A tak bisa dipakai user B di
//   perangkat yang sama. Dibersihkan saat logout (clearChapterTokens).
// - Expiry diambil dari server (bukan dari klien) + buffer 60 dtk. Memalsukan
//   exp di localStorage tidak berguna: server tetap menolak token kedaluwarsa
//   → pemanggil otomatis minta Turnstile baru.
// - Token bersifat per-chapter, jadi tidak mempercepat scraping massal (tiap
//   chapter tetap butuh Turnstile sendiri).

const PREFIX = 'mf_ctok_';
const BUFFER_MS = 60_000;

function key(userId, chapterId) {
  return `${PREFIX}${userId}::${chapterId}`;
}

export function getCachedChapterToken(userId, chapterId) {
  if (!userId || !chapterId) return null;
  try {
    const storageKey = key(userId, chapterId);
    const raw = localStorage.getItem(storageKey);
    if (!raw) return null;
    const v = JSON.parse(raw);
    const invalid = !v?.token || !v?.h || !v?.exp || !Array.isArray(v.pageSignatures)
      || v.pageSignatures.length < 1
      || !v.pageSignatures.every((signature) => /^[A-Za-z0-9_-]{43}$/.test(signature))
      || !Number.isSafeInteger(v.iat) || !Number.isSafeInteger(v.nbf)
      || !Number.isSafeInteger(v.signatureExp);
    if (invalid) {
      localStorage.removeItem(storageKey);
      return null;
    }
    if (v.exp <= Date.now() + BUFFER_MS) {            // sudah/hampir kedaluwarsa
      localStorage.removeItem(storageKey);
      return null;
    }
    return {
      token: v.token,
      h: v.h,
      pageSignatures: v.pageSignatures,
      iat: v.iat,
      nbf: v.nbf,
      signatureExp: v.signatureExp,
    };
  } catch { return null; }
}

export function setCachedChapterToken(
  userId,
  chapterId,
  token,
  h,
  pageSignatures,
  iat,
  nbf,
  signatureExp,
  expiresInSec,
) {
  if (!userId || !chapterId || !token || !h || !Array.isArray(pageSignatures)) return;
  try {
    const secs = Number(expiresInSec) > 0 ? Number(expiresInSec) : 300;
    const serverExpiry = Number(signatureExp) * 1000;
    const exp = Number.isFinite(serverExpiry) && serverExpiry > 0
      ? serverExpiry
      : Date.now() + secs * 1000;
    localStorage.setItem(key(userId, chapterId), JSON.stringify({
      token,
      h,
      pageSignatures,
      iat,
      nbf,
      signatureExp,
      exp,
    }));
  } catch {}
}

export function invalidateChapterToken(userId, chapterId) {
  if (!userId || !chapterId) return;
  try { localStorage.removeItem(key(userId, chapterId)); } catch {}
}

// ── Cap/backoff untuk kegagalan verifikasi ulang berturut-turut ──────────
// Kasus nyata: signature halaman terikat IP saat diterbitkan (lihat komentar
// generateAccessToken di worker) — kalau IP pembaca berubah di tengah sesi
// (jaringan seluler/CGNAT), SEMUA halaman langsung 401/403 sekaligus, token
// server tetap "granted" tapi gambar tak pernah termuat. Tanpa cap, pembaca
// (atau kode) bisa minta Turnstile ulang tanpa henti. Disimpan di localStorage
// (bukan cuma di memori komponen) supaya bertahan walau ReaderModal di-unmount
// & dibuka lagi (tutup/buka chapter berulang saat frustrasi).
const FAIL_PREFIX = 'mf_cfail_';
const FAIL_WINDOW_MS = 5 * 60_000; // jendela hitung: 5 menit
const FAIL_LIMIT = 3;              // >3 kegagalan dalam jendela → cooldown

function failKey(userId, chapterId) {
  return `${FAIL_PREFIX}${userId}::${chapterId}`;
}

function readFailures(userId, chapterId) {
  try {
    const raw = localStorage.getItem(failKey(userId, chapterId));
    const arr = raw ? JSON.parse(raw) : [];
    const cutoff = Date.now() - FAIL_WINDOW_MS;
    return Array.isArray(arr) ? arr.filter((t) => Number.isFinite(t) && t > cutoff) : [];
  } catch { return []; }
}

// Catat 1 percobaan verifikasi yang gagal (bukan per-gambar — pemanggil wajib
// menggabungkan kegagalan beruntun jadi 1 percobaan, lihat handleLockedImageError).
// Return status cap saat ini supaya UI langsung tahu tanpa query terpisah.
export function registerImageFailure(userId, chapterId) {
  if (!userId || !chapterId) return { blocked: false, retryAt: 0 };
  const kept = readFailures(userId, chapterId);
  kept.push(Date.now());
  try { localStorage.setItem(failKey(userId, chapterId), JSON.stringify(kept)); } catch {}
  const blocked = kept.length > FAIL_LIMIT;
  return { blocked, retryAt: blocked ? kept[0] + FAIL_WINDOW_MS : 0 };
}

export function getImageFailureStatus(userId, chapterId) {
  if (!userId || !chapterId) return { blocked: false, retryAt: 0 };
  const kept = readFailures(userId, chapterId);
  const blocked = kept.length > FAIL_LIMIT;
  return { blocked, retryAt: blocked ? kept[0] + FAIL_WINDOW_MS : 0 };
}

// Panggil saat halaman terkunci benar-benar berhasil dimuat — bukti akses
// sudah pulih, jadi hitungan kegagalan lama tidak perlu terus menghantui sesi
// berikutnya.
export function clearImageFailures(userId, chapterId) {
  if (!userId || !chapterId) return;
  try { localStorage.removeItem(failKey(userId, chapterId)); } catch {}
}

// Hapus semua token chapter (panggil saat logout / ganti akun).
export function clearChapterTokens() {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && k.startsWith(PREFIX)) localStorage.removeItem(k);
    }
  } catch {}
}
