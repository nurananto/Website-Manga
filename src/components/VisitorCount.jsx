import { useState, useEffect } from 'react';

// "Pengunjung hari ini" — angka dari worker /api/stats (Cloudflare Analytics,
// server-side & tahan ad-blocker). Kotak biru, ditaruh tepat di bawah logo footer.
// Sembunyi diam-diam kalau data tak tersedia (worker belum dikonfigurasi / gagal).
export default function VisitorCount() {
  const [visitors, setVisitors] = useState(null);

  useEffect(() => {
    const workerUrl = import.meta.env.VITE_WORKER_URL;
    if (!workerUrl) return;
    fetch(`${workerUrl}/api/stats`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d && typeof d.visitors === 'number') setVisitors(d.visitors);
      })
      .catch(() => {});
  }, []);

  if (visitors === null) return null;

  return (
    <div className="flex items-center gap-2 px-4 py-2 rounded-xl border border-primary/40 bg-primary/10 shadow-sm">
      <span className="text-base leading-none">👁</span>
      <span className="font-black text-xs sm:text-sm text-primary">
        {visitors.toLocaleString('id-ID')} pengunjung hari ini
      </span>
    </div>
  );
}
