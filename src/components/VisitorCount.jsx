import { useState, useEffect } from 'react';

// "Pengunjung bulan ini" — angka dari worker /api/stats (Cloudflare Analytics,
// server-side & tahan ad-blocker). Kotak biru, ditaruh tepat di bawah logo footer.
// Sembunyi diam-diam kalau worker tak dikonfigurasi (VITE_WORKER_URL kosong) — itu
// keputusan yang sudah pasti sejak awal render, jadi tidak menyebabkan layout shift.
// Selama menunggu fetch, ukuran box tetap sama (teks "Memuat...") agar tidak CLS
// saat angka asli muncul.
export default function VisitorCount() {
  const workerUrl = import.meta.env.VITE_WORKER_URL;
  const [visitors, setVisitors] = useState(null);

  useEffect(() => {
    if (!workerUrl) return;
    fetch(`${workerUrl}/api/stats`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d && typeof d.visitors === 'number') setVisitors(d.visitors);
      })
      .catch(() => {});
  }, [workerUrl]);

  if (!workerUrl) return null;

  return (
    <div className="flex items-center gap-2 px-4 py-2 rounded-xl border border-primary/40 bg-primary/10 shadow-sm">
      <span className="text-base leading-none">👁</span>
      <span className="font-black text-xs sm:text-sm text-primary">
        {visitors !== null ? `${visitors.toLocaleString('id-ID')} pengunjung bulan ini` : 'Memuat pengunjung...'}
      </span>
    </div>
  );
}
