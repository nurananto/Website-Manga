// ID device stabil per-browser (anti-abuse koin gratis). Disimpan di localStorage.
// Bisa dihapus user → dianggap device baru; worker memakai IP sebagai cadangan
// bila header ini tidak ada, jadi penghapusan tetap terdeteksi lewat IP.
const KEY = 'mf_device';

export function getDeviceId() {
  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = (crypto.randomUUID && crypto.randomUUID()) ||
        (Date.now().toString(36) + Math.random().toString(16).slice(2));
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return '';
  }
}
