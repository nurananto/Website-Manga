// View-gate untuk chapter/detail GRATIS. Server (handleView) kini menolak
// pencatatan view tanpa view_gate_token valid → cegah inflasi view bot.
//
// Alur:
//   1) recordView(id) dipanggil saat chapter/detail dibuka.
//   2) Kalau belum ada token 24 jam di cache → tampilkan Turnstile VISIBLE
//      (bukan invisible, biar user paham ini verifikasi — bukan loading nyangkut),
//      lalu tukar ke /api/view-gate untuk view_gate_token 24 jam.
//   3) POST /api/r/<id> dgn header X-Device-Id + X-View-Gate.
//
// Prinsip UX: TIDAK memblokir baca. Kartu verifikasi non-blocking & bisa ditutup;
// kalau ditutup/gagal, konten tetap kebaca — hanya view yang tak terhitung.
// Fallback: kalau widget gagal dimuat (ad-blocker / in-app browser) → tombol
// "Coba lagi", bukan spinner ngambang.

import { loadTurnstile, TURNSTILE_SITEKEY as SITEKEY } from './session';
import { getDeviceId } from './device';

const WORKER = import.meta.env.VITE_WORKER_URL || '';
const KEY = 'mf_vgate1';
const CARD_ID = 'mf-viewgate-card';
const LOAD_TIMEOUT = 8000;   // widget tak muncul dalam 8 dtk → anggap keblok
const HARD_TIMEOUT = 60_000; // batas total menunggu 1 verifikasi

let inflight = null;

function cachedGate() {
  try {
    const r = JSON.parse(localStorage.getItem(KEY));
    if (r && r.token && r.exp > Date.now() + 60_000) return r.token;
  } catch {}
  return null;
}

function storeGate(token, expiresInSec) {
  try {
    localStorage.setItem(KEY, JSON.stringify({
      token,
      exp: Date.now() + (Number(expiresInSec) || 86400) * 1000,
    }));
  } catch {}
}

export function clearViewGate() {
  try { localStorage.removeItem(KEY); } catch {}
}

// ── Kartu Turnstile visible + fallback ────────────────────────────────
function buildCard() {
  const card = document.createElement('div');
  card.id = CARD_ID;
  card.style.cssText = [
    'position:fixed', 'left:50%', 'bottom:20px', 'transform:translateX(-50%)',
    'z-index:9997', 'width:calc(100% - 32px)', 'max-width:340px', 'box-sizing:border-box',
    'background:#111827', 'color:#e5e7eb', 'border:1px solid #374151', 'border-radius:14px',
    'padding:16px', 'box-shadow:0 12px 32px rgba(0,0,0,.45)',
    'font-family:inherit', 'font-size:14px', 'line-height:1.45',
  ].join(';');
  card.innerHTML = `
    <button data-close aria-label="Tutup" style="position:absolute;top:6px;right:10px;background:none;border:none;color:#9ca3af;font-size:20px;line-height:1;cursor:pointer">×</button>
    <div style="font-weight:600;margin-bottom:4px">Verifikasi cepat</div>
    <div style="color:#9ca3af;margin-bottom:12px">Sekali sehari untuk memastikan kamu bukan bot. Kamu tetap bisa membaca — ini tidak menghalangi.</div>
    <div data-slot></div>
    <div data-hint style="color:#9ca3af;margin-top:8px;font-size:13px">Memuat verifikasi…</div>
    <div data-fallback style="display:none;margin-top:10px">
      <div style="color:#fca5a5;margin-bottom:8px;font-size:13px">Verifikasi gagal dimuat (mungkin diblokir ad-blocker atau jaringan). Kamu tetap bisa membaca.</div>
      <button data-retry style="background:#2563eb;color:#fff;border:none;border-radius:8px;padding:8px 14px;cursor:pointer;font-size:13px">Coba lagi</button>
    </div>`;
  return card;
}

// Resolve dengan token Turnstile, atau null bila ditutup/gagal/timeout.
function getVisibleTurnstileToken() {
  return new Promise((resolve) => {
    let done = false;
    let widgetId = null;
    let loadTimer = null;
    let hardTimer = null;

    const finish = (v) => {
      if (done) return;
      done = true;
      clearTimeout(loadTimer);
      clearTimeout(hardTimer);
      const el = document.getElementById(CARD_ID);
      if (el) el.remove();
      resolve(v);
    };

    // Cegah dua kartu sekaligus.
    const existing = document.getElementById(CARD_ID);
    if (existing) existing.remove();

    const card = buildCard();
    document.body.appendChild(card);
    const slot = card.querySelector('[data-slot]');
    const hint = card.querySelector('[data-hint]');
    const fallback = card.querySelector('[data-fallback]');

    card.querySelector('[data-close]').onclick = () => finish(null);

    const showFallback = () => {
      if (done) return;
      clearTimeout(loadTimer);
      hint.style.display = 'none';
      slot.innerHTML = '';
      fallback.style.display = 'block';
    };

    const render = () => {
      fallback.style.display = 'none';
      hint.style.display = 'block';
      slot.innerHTML = '';
      clearTimeout(loadTimer);
      loadTimer = setTimeout(showFallback, LOAD_TIMEOUT);
      loadTurnstile().then((ts) => {
        if (done) return;
        if (!ts || !SITEKEY) return showFallback();
        try {
          widgetId = ts.render(slot, {
            sitekey: SITEKEY,
            appearance: 'always',   // VISIBLE — user tahu ini verifikasi
            theme: 'auto',
            callback: (token) => finish(token),
            'error-callback': showFallback,
            'timeout-callback': showFallback,
            'expired-callback': () => { try { ts.reset(widgetId); } catch {} },
          });
          // Widget sudah dirender → sembunyikan hint "memuat".
          clearTimeout(loadTimer);
          loadTimer = setTimeout(() => { if (!done) hint.style.display = 'none'; }, 1200);
        } catch { showFallback(); }
      });
    };

    card.querySelector('[data-retry]').onclick = render;
    render();
    hardTimer = setTimeout(() => finish(null), HARD_TIMEOUT);
  });
}

// Pastikan ada view_gate_token. Aman dipanggil paralel (dedup inflight + cache).
async function ensureViewGate() {
  const c = cachedGate();
  if (c) return c;
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const tsToken = await getVisibleTurnstileToken();
      if (!tsToken || !WORKER) return null;
      const res = await fetch(`${WORKER}/api/view-gate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ turnstile_token: tsToken, device_id: getDeviceId() }),
      });
      const d = await res.json().catch(() => ({}));
      if (d && d.view_gate_token) {
        storeGate(d.view_gate_token, d.expires_in);
        return d.view_gate_token;
      }
    } catch {}
    return null;
  })();
  const r = await inflight;
  inflight = null;
  return r;
}

// Catat 1 view chapter/detail GRATIS. Return true kalau tercatat server.
// Caller sebaiknya baru set penanda dedup-harian localStorage bila return true,
// supaya percobaan yang gagal (gate belum lolos) bisa dicoba lagi nanti.
export async function recordView(id) {
  if (!WORKER || !id) return false;
  const send = (token) => fetch(`${WORKER}/api/r/${encodeURIComponent(id)}`, {
    method: 'POST',
    headers: { 'X-Device-Id': getDeviceId(), 'X-View-Gate': token },
  });
  try {
    let token = await ensureViewGate();
    if (!token) return false;
    let res = await send(token);
    if (res.status === 403) {
      const d = await res.json().catch(() => ({}));
      if (d && d.code === 'turnstile_required') {
        clearViewGate();               // token basi/ditolak server
        token = await ensureViewGate(); // minta gate baru (bisa munculkan widget)
        if (!token) return false;
        res = await send(token);
      }
    }
    return res.ok;
  } catch {
    return false;
  }
}
