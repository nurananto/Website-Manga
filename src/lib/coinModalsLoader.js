// Loader chunk CoinModals dipakai bersama: App.jsx (lazy + prefetch idle) dan
// tombol pemicu (prefetch saat hover) → satu promise, chunk diunduh sekali.
// Tidak meng-cache promise yang GAGAL supaya bisa retry (mis. chunk basi/jaringan).
let promise;

export function loadCoinModals() {
  if (!promise) {
    promise = import('../components/CoinModals').catch((err) => {
      promise = undefined;
      throw err;
    });
  }
  return promise;
}
