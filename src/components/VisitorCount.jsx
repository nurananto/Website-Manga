import { useState, useEffect } from 'react';

// Pengunjung hari ini — angka dari Cloudflare Analytics (server-side, tahan ad-blocker)
// via endpoint worker /api/stats. Sembunyi diam-diam kalau data tak tersedia
// (worker belum dikonfigurasi / fetch gagal) supaya footer tetap rapi.
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
    <span className="font-body-sm text-[10px] text-outline/40">
      👁 {visitors.toLocaleString('id-ID')} pengunjung hari ini
    </span>
  );
}
