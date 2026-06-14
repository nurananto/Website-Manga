// Token sesi Turnstile untuk gambar chapter gratis.
// Diminta sekali di latar (prefetch saat app load), berlaku ~6 jam, cache di localStorage.
const SITEKEY = import.meta.env.VITE_TURNSTILE_SITEKEY || '';
const WORKER  = import.meta.env.VITE_WORKER_URL || '';
const KEY     = 'mf_sess2'; // v2: token kini terikat prefix IP /64 (lihat worker ipKey)
let inflight  = null;

function cached() {
  try {
    const r = JSON.parse(localStorage.getItem(KEY));
    if (r && r.token && r.exp > Date.now() + 60_000) return r.token;
  } catch {}
  return null;
}

function loadTurnstile() {
  return new Promise((resolve) => {
    if (window.turnstile) return resolve(window.turnstile);
    const id = 'cf-turnstile-script';
    let s = document.getElementById(id);
    if (s) { s.addEventListener('load', () => resolve(window.turnstile || null)); return; }
    s = document.createElement('script');
    s.id = id;
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    s.async = true; s.defer = true;
    s.onload  = () => resolve(window.turnstile || null);
    s.onerror = () => resolve(null);
    document.head.appendChild(s);
  });
}

function getTurnstileToken() {
  return new Promise((resolve) => {
    let done = false;
    // Bersihkan widget total — cegah widget "stuck" tidak hilang setelah selesai
    const cleanup = () => {
      const box = document.getElementById('cf-turnstile-box');
      if (box) box.remove();
    };
    const finish = (v) => {
      if (done) return;
      done = true;
      cleanup();
      resolve(v);
    };
    setTimeout(() => finish(null), 20_000); // safety timeout
    loadTurnstile().then((ts) => {
      if (!ts || !SITEKEY) return finish(null);
      let box = document.getElementById('cf-turnstile-box');
      if (box) box.remove();
      box = document.createElement('div');
      box.id = 'cf-turnstile-box';
      // Posisi tengah layar. Container transparan & tidak memblokir klik saat
      // verifikasi senyap; hanya widget (inner) yang interaktif kalau muncul.
      box.style.cssText = 'position:fixed;inset:0;z-index:9998;display:flex;align-items:center;justify-content:center;pointer-events:none;';
      const inner = document.createElement('div');
      inner.style.pointerEvents = 'auto';
      box.appendChild(inner);
      document.body.appendChild(box);
      try {
        ts.render(inner, {
          sitekey: SITEKEY,
          appearance: 'interaction-only', // hanya tampil kalau perlu interaksi
          callback: (token) => finish(token),
          'error-callback': () => finish(null),
          'timeout-callback': () => finish(null),
        });
      } catch { finish(null); }
    });
  });
}

// Pastikan ada token sesi. Aman dipanggil berkali-kali (dedup + cache).
export async function ensureSession() {
  const c = cached();
  if (c) return c;
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const tsToken = await getTurnstileToken();
      if (!WORKER) return null;
      const res = await fetch(`${WORKER}/api/session-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ turnstile_token: tsToken || '' }),
      });
      const d = await res.json();
      if (d.token) {
        localStorage.setItem(KEY, JSON.stringify({
          token: d.token,
          exp: Date.now() + (d.expires_in || 21600) * 1000,
        }));
        return d.token;
      }
    } catch {}
    return null;
  })();
  const r = await inflight;
  inflight = null;
  return r;
}

export function getCachedSession() { return cached(); }

export function clearCachedSession() {
  try { localStorage.removeItem(KEY); } catch {}
}
