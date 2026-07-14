import { useState, useEffect } from 'react';
import { Star } from 'lucide-react';
import { coverUrlForWidth } from '../utils';
import ResponsiveCover from './ResponsiveCover';

const STATUS_CFG = {
  'Tamat':   { label: 'END',     textCls: 'text-red-500' },
  'Hiatus':  { label: 'HIATUS',  textCls: 'text-zinc-400' },
  'Oneshot': { label: 'ONESHOT', textCls: 'text-red-500' },
};
const ONGOING_CFG = { label: 'ONGOING', textCls: 'text-emerald-300' };

// Hanya cover aktif yang membesar; cover lain tetap opaque dan digelapkan via overlay.
const SCALES = [1, 0.88];

function getPadV() {
  const w = typeof window !== 'undefined' ? window.innerWidth : 1280;
  if (w < 640)  return 18;
  if (w < 768)  return 16;
  if (w < 1024) return 14;
  return 12;
}

function getCoverMetaGap() {
  const w = typeof window !== 'undefined' ? window.innerWidth : 1280;
  if (w < 768)  return 10;
  if (w < 1024) return 9;
  return 8;
}

function getMetaH() {
  const w = typeof window !== 'undefined' ? window.innerWidth : 1280;
  if (w < 640)  return 52;
  if (w < 768)  return 58;
  if (w < 1024) return 64;
  return 72;
}

// Jarak antar cover per breakpoint (makin kecil = makin rapat)
function getItemGap() {
  const w = typeof window !== 'undefined' ? window.innerWidth : 1280;
  if (w < 640)  return 2;
  if (w < 768)  return 4;
  if (w < 1024) return 6;
  return 8;
}

// Lebar cover per breakpoint (+25% dari 120/150/184/208). coverH & containerH
// turunan dari sini, jadi seluruh cover & tinggi carousel ikut membesar 25%.
function getCoverW() {
  const w = typeof window !== 'undefined' ? window.innerWidth : 1280;
  if (w < 640)  return 150;
  if (w < 768)  return 188;
  if (w < 1024) return 230;
  return 260;
}

// Items shown on each side of active per breakpoint (pinggir boleh kepotong).
// mobile: 2 side → 5 | sm: 3 → 7 | md: 4 → 9 | lg: 5 → 11
// xl: 6 → 13 | 2xl/ultrawide: 7 → 15 (isi layar lebar agar tidak ada ruang kosong)
function getMaxSide() {
  const w = typeof window !== 'undefined' ? window.innerWidth : 1280;
  if (w < 640)  return 2;
  if (w < 768)  return 3;
  if (w < 1024) return 4;
  if (w < 1280) return 5;
  if (w < 1600) return 6;
  return 7;
}

function getMostRecentIdx(list) {
  let best = 0, bestMs = 0;
  list.forEach((manga, i) => {
    const t = (manga.chapters || []).reduce(
      (m, ch) => Math.max(m, ch.release_date ? new Date(ch.release_date).getTime() : 0), 0
    );
    if (t > bestMs) { bestMs = t; best = i; }
  });
  return best;
}

export default function SpotlightCarousel({ mangaList, onViewManga }) {
  const N = mangaList.length;
  const [activeIdx, setActiveIdx] = useState(() => getMostRecentIdx(mangaList));
  const [isPaused, setIsPaused] = useState(false);
  const [pendingDetailIdx, setPendingDetailIdx] = useState(null);
  const [coverW,    setCoverW]    = useState(getCoverW);
  const [maxSide,   setMaxSide]   = useState(getMaxSide);
  const [itemGap,   setItemGap]   = useState(getItemGap);
  const [metaH,     setMetaH]     = useState(getMetaH);
  const [padV,      setPadV]      = useState(getPadV);
  const [metaGap,   setMetaGap]   = useState(getCoverMetaGap);

  const coverH     = Math.round(coverW * 1.5);
  const containerH = padV + coverH + metaGap + metaH + padV;

  // How many items to show on each side: capped by breakpoint and available items
  const side = Math.min(maxSide, Math.floor((N - 1) / 2));

  // Build window: [active-side ... active ... active+side]
  const items = Array.from({ length: 2 * side + 1 }, (_, i) => {
    const offset  = i - side;                           // -side … +side
    const logIdx  = ((activeIdx + offset) % N + N) % N; // circular
    const dist    = Math.abs(offset);
    return { logIdx, offset, dist };
  });

  useEffect(() => {
    const onResize = () => {
      setCoverW(getCoverW());
      setMaxSide(getMaxSide());
      setItemGap(getItemGap());
      setMetaH(getMetaH());
      setPadV(getPadV());
      setMetaGap(getCoverMetaGap());
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (N <= 1 || isPaused) return undefined;
    const timer = setInterval(() => {
      setActiveIdx((idx) => (idx + 1) % N);
      setPendingDetailIdx(null);
    }, 8000);
    return () => clearInterval(timer);
  }, [N, isPaused]);

  // Preload all covers in the current window + 1 step ahead on each side
  useEffect(() => {
    const toLoad = new Set();
    for (let d = -side - 1; d <= side + 1; d++) {
      const idx = ((activeIdx + d) % N + N) % N;
      const m = mangaList[idx];
      const url = coverUrlForWidth(m, window.innerWidth);
      if (url) toLoad.add(url);
    }
    // fetchPriority 'low' agar preload tetangga tidak berebut bandwidth dengan
    // gambar LCP (background blur + cover aktif) yang sedang dimuat.
    toLoad.forEach(url => { const img = new Image(); img.fetchPriority = 'low'; img.src = url; });
  }, [activeIdx]); // eslint-disable-line

  const handleClick = (logIdx) => {
    if (isPaused && pendingDetailIdx === logIdx) {
      onViewManga?.(mangaList[logIdx]);
      return;
    }
    setIsPaused(true);
    setPendingDetailIdx(logIdx);
    setActiveIdx(logIdx);
  };

  const active = mangaList[activeIdx];
  const activeStatusCfg = STATUS_CFG[active?.status] || ONGOING_CFG;
  const activeRating = active?.rating != null ? Number(active.rating).toFixed(1) : null;
  const activeChapterCount = active?.chapter_count ?? active?.chapters?.length ?? 0;

  return (
    <div
      className="relative w-auto -mx-3 sm:-mx-4 md:-mx-5 overflow-hidden"
      style={{ height: containerH }}
    >
      {/* ── Darkened background from active cover ── */}
      <div key={active?.id} className="absolute inset-0 pointer-events-none z-0 animate-[fadeIn_0.4s_ease-out]">
          <ResponsiveCover
            manga={active} alt=""
            loading="eager"
            fetchpriority="high"
            className="absolute inset-0 w-full h-full object-cover object-top brightness-[0.68] saturate-[0.95]"
          />
          <div className="absolute inset-0 bg-black/28" />
          <div className="absolute inset-0 bg-gradient-to-t from-surface/56 via-surface/20 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-surface/72 via-surface/18 to-transparent" />
          <div className="absolute inset-0 shadow-[inset_0_22px_64px_rgba(0,0,0,0.45),inset_0_-58px_90px_rgba(0,0,0,0.5),inset_64px_0_84px_rgba(0,0,0,0.58),inset_-64px_0_84px_rgba(0,0,0,0.58)]" />
      </div>

      {/* ── Cover row — centered flex, no scroll ── */}
      <div
        className="absolute inset-0 flex items-start justify-center z-10"
        style={{ paddingTop: padV, paddingBottom: padV }}
      >
        {items.map(({ logIdx, offset, dist }) => {
          const manga     = mangaList[logIdx];
          const scale     = SCALES[Math.min(dist, SCALES.length - 1)];
          const isActive  = dist === 0;
          // Negative margin collapses the visual gap created by scale shrink
          const nm        = Math.round(-(coverW * (1 - scale)) / 2) + itemGap;
          const coverOffsetY = isActive
            ? 0
            : Math.round(Math.min(metaH - 24, Math.max(34, coverH * 0.12)));

          return (
            <div
              key={offset}   // stable slot key — content swaps, scale transitions smoothly
              onClick={() => handleClick(logIdx)}
              className="flex-shrink-0 cursor-pointer"
              style={{
                width:            coverW,
                transform:        `translateY(${coverOffsetY}px) scale(${scale})`,
                transformOrigin:  'top center',
                marginLeft:       nm,
                marginRight:      nm,
                willChange:       'transform, margin',
                transition:       'transform 0.5s cubic-bezier(0.22,1,0.36,1), margin 0.5s cubic-bezier(0.22,1,0.36,1)',
              }}
            >
              {/* Cover image with overlays */}
              <div
                className={`relative rounded-xl overflow-hidden border ${
                  isActive
                    ? 'border-white/20 shadow-[0_18px_55px_rgba(0,0,0,0.72)]'
                    : 'border-black/55 shadow-[0_20px_42px_rgba(0,0,0,0.9),0_0_0_1px_rgba(255,255,255,0.04)]'
                }`}
                style={{ width: coverW, height: coverH }}
              >
                <ResponsiveCover
                  manga={manga}
                  alt={manga.title}
                  loading="eager"
                  fetchpriority={isActive ? 'high' : 'low'}
                  className={`w-full h-full object-cover transition-[filter] duration-500 ease-out ${isActive ? 'brightness-100 saturate-100' : 'brightness-[0.72] saturate-[0.82]'}`}
                  draggable={false}
                />

                {!isActive && (
                  <div className="absolute inset-0 bg-black/36 pointer-events-none" />
                )}

                {/* Active glow ring */}
                {isActive && (
                  <div className="absolute inset-0 rounded-xl ring-[2px] ring-white/30 ring-inset pointer-events-none" />
                )}
              </div>

            </div>
          );
        })}
      </div>

      {active && (
        <div
          key={`spotlight-meta-${active.id}`}
          className="absolute inset-x-2 sm:inset-x-4 z-20 flex flex-col items-center gap-1.5 px-1 animate-[spotlightMetaIn_0.38s_cubic-bezier(0.22,1,0.36,1)]"
          style={{ top: padV + coverH + metaGap }}
        >
          <h3 className="w-full max-w-full truncate text-center font-headline-md text-base sm:text-lg md:text-xl font-black leading-tight text-on-surface">
            {active.title}
          </h3>

          <div className="inline-flex max-w-full items-center justify-center gap-1.5 overflow-hidden border-y border-white/18 px-2.5 py-1.5 font-body-md text-[10px] sm:text-xs md:text-sm font-bold leading-none">
            {activeRating && (
              <span className="flex min-w-0 items-center gap-1 font-extrabold text-amber-400">
                <Star className="h-3 w-3 sm:h-3.5 sm:w-3.5 fill-current shrink-0" />
                <span>{activeRating}</span>
              </span>
            )}
            {activeRating && <span className="font-black text-white/50">|</span>}
            <span className={`min-w-0 truncate font-black ${activeStatusCfg.textCls}`}>{activeStatusCfg.label}</span>
            <span className="font-black text-white/50">|</span>
            <span className="min-w-0 truncate font-extrabold text-white">{activeChapterCount} Chapter</span>
          </div>

        </div>
      )}
    </div>
  );
}
