// Pencatat view chapter/detail. Gate Turnstile DIHAPUS (2026-07): mode Managed
// meloloskan semua orang sehingga tidak menyaring apa pun, sementara jalur
// gagalnya justru membuat view pembaca asli tidak tercatat (D1 jauh di bawah
// traffic overview). Anti-inflasi kini sepenuhnya di server: rate limit,
// blokir bad-UA/negara, dan dedup ip/device+chapter+hari.
//
// Endpoint SAME-ORIGIN (2026-07): dibuktikan lewat DevTools bahwa ekstensi
// privasi tertentu mem-patch fetch() dan menjatuhkan POST cross-origin ber-
// header custom SEBELUM sampai jaringan (tak muncul di Network tab sama
// sekali) — profil normal nihil, Incognito (ekstensi nonaktif) 200 OK. Path
// relatif "/n/r/<id>" diproxy oleh functions/n/r/[id].js (Cloudflare Pages
// Function, satu origin dengan halaman) ke worker sesungguhnya di
// api.nuranantoscans.my.id, menghilangkan sinyal "POST cross-origin" yang
// jadi pemicu heuristik itu.
//
// PENTING: path SENGAJA "/n/r/", BUKAN "/api/r/" — zona ini punya Custom Rules
// WAF yang menyasar /api/* secara path-based (dibuat untuk api.nuranantoscans.
// my.id, tapi ikut memblokir path apa pun berawalan /api/ di domain manapun di
// zona ini). Dibuktikan langsung: POST ke nuranantoscans.my.id/api/r/<id> kena
// 403 "Sorry, you have been blocked" dari WAF, sebelum sampai ke Function.

import { getDeviceId } from './device';

const LEGACY_KEY = 'mf_vgate1'; // token gate lama — bersihkan sisa localStorage

try { localStorage.removeItem(LEGACY_KEY); } catch { /* private mode */ }

// Catat 1 view. keepalive: tetap terkirim walau tab langsung ditutup — pembaca
// yang buka chapter lalu menutupnya cepat dulunya sering tidak terhitung.
export async function recordView(id) {
  if (!id) return false;
  try {
    const res = await fetch(`/n/r/${encodeURIComponent(id)}`, {
      method: 'POST',
      headers: { 'X-Device-Id': getDeviceId() },
      keepalive: true,
    });
    return res.ok;
  } catch {
    return false;
  }
}
