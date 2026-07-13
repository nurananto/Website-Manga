import { useEffect, useState } from 'react';

export default function VisitorCount() {
  const workerUrl = import.meta.env.VITE_WORKER_URL;
  const [visitors, setVisitors] = useState(null);

  useEffect(() => {
    if (!workerUrl) return;

    const controller = new AbortController();
    let idleId;
    let timerId;

    const load = () => {
      fetch(`${workerUrl}/api/stats`, { signal: controller.signal })
        .then((response) => (response.ok ? response.json() : null))
        .then((data) => {
          if (typeof data?.visitors === 'number') setVisitors(data.visitors);
        })
        .catch(() => {});
    };

    if ('requestIdleCallback' in window) {
      idleId = window.requestIdleCallback(load, { timeout: 3000 });
    } else {
      timerId = window.setTimeout(load, 1500);
    }

    return () => {
      controller.abort();
      if (idleId !== undefined) window.cancelIdleCallback(idleId);
      if (timerId !== undefined) window.clearTimeout(timerId);
    };
  }, [workerUrl]);

  if (!workerUrl) return null;

  return (
    <div className="flex items-center gap-2 px-4 py-2 rounded-xl border border-primary/40 bg-primary/10 shadow-sm">
      <span className="text-base leading-none" aria-hidden="true">👁</span>
      <span className="font-black text-xs sm:text-sm text-primary">
        {visitors === null
          ? 'Memuat pengunjung...'
          : `${visitors.toLocaleString('id-ID')} pengunjung bulan ini`}
      </span>
    </div>
  );
}
