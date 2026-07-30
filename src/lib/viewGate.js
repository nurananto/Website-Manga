// Pencatat view chapter/detail. Gate Turnstile DIHAPUS (2026-07): mode Managed
// meloloskan semua orang sehingga tidak menyaring apa pun, sementara jalur
// gagalnya justru membuat view pembaca asli tidak tercatat (D1 jauh di bawah
// traffic overview). Anti-inflasi kini sepenuhnya di server: rate limit,
// blokir bad-UA/negara, dan dedup ip/device+chapter+hari.

import { getDeviceId } from './device';

const WORKER = import.meta.env.VITE_WORKER_URL || '';
const LEGACY_KEY = 'mf_vgate1'; // token gate lama — bersihkan sisa localStorage

try { localStorage.removeItem(LEGACY_KEY); } catch { /* private mode */ }

// Catat 1 view. keepalive: tetap terkirim walau tab langsung ditutup — pembaca
// yang buka chapter lalu menutupnya cepat dulunya sering tidak terhitung.
export async function recordView(id) {
  if (!WORKER || !id) return false;
  try {
    const res = await fetch(`${WORKER}/api/r/${encodeURIComponent(id)}`, {
      method: 'POST',
      headers: { 'X-Device-Id': getDeviceId() },
      keepalive: true,
    });
    return res.ok;
  } catch {
    return false;
  }
}
