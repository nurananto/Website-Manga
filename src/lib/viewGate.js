// View-gate chapter/detail GRATIS. Server (handleView) menolak pencatatan view
// tanpa view_gate_token valid → cegah inflasi view bot.
//
// Gate-first: UI Turnstile ditangani di ReaderModal (blocking, seperti locked).
// Modul ini murni token + jaringan:
//   - getCachedViewGate() → token 24 jam tersimpan (atau null)
//   - submitViewGate(turnstileToken) → tukar ke /api/view-gate, simpan, return token
//   - recordView(id) → POST /api/r/<id> pakai token tersimpan (tanpa token → tidak catat)

import { getDeviceId } from './device';

const WORKER = import.meta.env.VITE_WORKER_URL || '';
const KEY = 'mf_vgate1';

export function getCachedViewGate() {
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

// Tukar turnstile_token → view_gate_token (24 jam). Return token, atau null bila
// gagal (secret worker belum terpasang, Turnstile ditolak, atau jaringan error).
export async function submitViewGate(turnstileToken) {
  if (!WORKER || !turnstileToken) return null;
  try {
    const res = await fetch(`${WORKER}/api/view-gate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ turnstile_token: turnstileToken, device_id: getDeviceId() }),
    });
    const d = await res.json().catch(() => ({}));
    if (d && d.view_gate_token) {
      storeGate(d.view_gate_token, d.expires_in);
      return d.view_gate_token;
    }
  } catch {}
  return null;
}

// Catat 1 view. Perlu view_gate_token tersimpan (gate dilewati di UI reader).
// Tanpa token → tidak mencatat (return false); caller yang menampilkan gate.
export async function recordView(id) {
  if (!WORKER || !id) return false;
  const token = getCachedViewGate();
  if (!token) return false;
  try {
    const res = await fetch(`${WORKER}/api/r/${encodeURIComponent(id)}`, {
      method: 'POST',
      headers: { 'X-Device-Id': getDeviceId(), 'X-View-Gate': token },
    });
    if (res.status === 403) {
      const d = await res.json().catch(() => ({}));
      if (d && d.code === 'turnstile_required') clearViewGate(); // token basi → minta gate lagi
      return false;
    }
    return res.ok;
  } catch {
    return false;
  }
}
