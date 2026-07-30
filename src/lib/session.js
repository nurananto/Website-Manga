// Turnstile: loader script yang dipakai bersama oleh widget CoinModals & ReaderModal.
// Token sesi gambar chapter kini ditangani viewGate.js; modul ini hanya menyisakan
// pembersihan cache sesi lama (mf_sess2) saat logout.
const SITEKEY = import.meta.env.VITE_TURNSTILE_SITEKEY || '';
const KEY     = 'mf_sess2';

export const TURNSTILE_SITEKEY = SITEKEY;

export function loadTurnstile() {
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

export function clearCachedSession() {
  try { localStorage.removeItem(KEY); } catch {}
}
