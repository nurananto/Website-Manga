import { Component } from 'react';

// Batas error global. Menangkap kegagalan render — terutama gagal memuat chunk
// lazy (mis. hash bundle berubah setelah deploy baru, sehingga chunk lama 404).
// Tanpa ini, error seperti "Cannot read properties of undefined (reading 'default')"
// dari React.lazy membuat seluruh app white-screen.
//
// Strategi: untuk error pemuatan chunk yang khas transien → muat ulang sekali
// otomatis (ambil bundle terbaru). Error lain → tampilkan pesan ramah + tombol
// muat ulang manual, bukan layar kosong.
const CHUNK_RE = /Loading chunk|Loading CSS chunk|dynamically imported module|importing a module script|ChunkLoadError|reading 'default'/i;
const RELOAD_KEY = 'lazy_boundary_reloaded_at';

export default class LazyBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error) {
    const msg = String(error?.message || error || '');
    if (!CHUNK_RE.test(msg)) return;
    let last = 0;
    try { last = Number(sessionStorage.getItem(RELOAD_KEY) || 0); } catch {}
    // Cegah loop reload: hanya auto-reload kalau belum reload dalam 10 detik terakhir.
    if (Date.now() - last > 10_000) {
      try { sessionStorage.setItem(RELOAD_KEY, String(Date.now())); } catch {}
      window.location.reload();
    }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-4 bg-surface/95 px-6 text-center backdrop-blur-xl">
          <p className="text-sm font-bold text-on-surface">Gagal memuat halaman.</p>
          <p className="max-w-xs text-xs text-outline/70">Mungkin ada pembaruan situs. Coba muat ulang.</p>
          <button
            type="button"
            onClick={() => { try { sessionStorage.removeItem(RELOAD_KEY); } catch {} window.location.reload(); }}
            className="rounded-xl bg-primary px-5 py-2.5 text-sm font-black text-on-primary active:scale-95 transition-transform cursor-pointer"
          >
            Muat ulang
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
