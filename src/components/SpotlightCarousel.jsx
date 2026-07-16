import { useState, useEffect, useRef, useCallback } from 'react';
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
  return 5;
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

function SpotlightBackground({ manga, animate = false, priority = 'low' }) {
  if (!manga) return null;
  return (
    <div className={`absolute inset-0 pointer-events-none ${animate ? 'animate-[fadeIn_0.45s_ease-out]' : ''}`}>
      <ResponsiveCover
        manga={manga}
        alt=""
        loading="eager"
        fetchPriority={priority}
        decoding="async"
        className="absolute inset-0 w-full h-full object-cover object-top brightness-[0.68] saturate-[0.95]"
      />
      <div className="absolute inset-0 bg-black/28" />
      <div className="absolute inset-0 bg-gradient-to-t from-surface/56 via-surface/20 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-r from-surface/72 via-surface/18 to-transparent" />
      <div className="absolute inset-0 shadow-[inset_0_22px_64px_rgba(0,0,0,0.45),inset_0_-58px_90px_rgba(0,0,0,0.5),inset_64px_0_84px_rgba(0,0,0,0.58),inset_-64px_0_84px_rgba(0,0,0,0.58)]" />
    </div>
  );
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
  const [hasMoved, setHasMoved] = useState(false);
  const [previousIdx, setPreviousIdx] = useState(null);
  const activeIdxRef = useRef(activeIdx);

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

  const moveTo = useCallback((nextIdx) => {
    const normalized = ((nextIdx % N) + N) % N;
    const current = activeIdxRef.current;
    if (normalized === current) return;
    setPreviousIdx(current);
    activeIdxRef.current = normalized;
    setHasMoved(true);
    setActiveIdx(normalized);
  }, [N]);

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
      moveTo(activeIdxRef.current + 1);
      setPendingDetailIdx(null);
    }, 8000);
    return () => clearInterval(timer);
  }, [N, isPaused, moveTo]);

  useEffect(() => {
    if (previousIdx === null) return undefined;
    const timer = setTimeout(() => setPreviousIdx(null), 500);
    return () => clearTimeout(timer);
  }, [activeIdx, previousIdx]);

  // Cover aktif sudah ditemukan lewat preload HTML + elemen LCP. Hangatkan hanya
  // satu cover berikutnya agar perpindahan otomatis mulus tanpa memenuhi antrean.
  useEffect(() => {
    if (N <= 1) return;
    const next = mangaList[(activeIdx + 1) % N];
    const url = coverUrlForWidth(next, window.innerWidth);
    if (!url) return;
    const img = new Image();
    img.fetchPriority = 'low';
    img.src = url;
  }, [activeIdx, mangaList, N]);

  const handleClick = (logIdx) => {
    if (isPaused && pendingDetailIdx === logIdx) {
      onViewManga?.(mangaList[logIdx]);
      return;
    }
    setIsPaused(true);
    setPendingDetailIdx(logIdx);
    moveTo(logIdx);
  };

  const active = mangaList[activeIdx];
  const previous = previousIdx === null ? null : mangaList[previousIdx];
  const activeStatusCfg = STATUS_CFG[active?.status] || ONGOING_CFG;
  const activeRating = active?.rating != null ? Number(active.rating).toFixed(1) : null;
  const activeChapterCount = active?.chapter_count ?? active?.chapters?.length ?? 0;

  return (
    <div
      className="relative w-auto -mx-3 sm:-mx-4 md:-mx-5 overflow-hidden"
      style={{ height: containerH }}
    >
      {/* ── Darkened background from active cover ── */}
      {previous && (
        <div className="absolute inset-0 z-0">
          <SpotlightBackground manga={previous} />
        </div>
      )}
      <div key={active?.id} className="absolute inset-0 z-[1]">
        <SpotlightBackground manga={active} animate={hasMoved} priority="high" />
      </div>

      {/* ── Cover row — centered flex, no scroll ── */}
      <div className="absolute inset-0 z-10">
        {items.map(({ logIdx, offset, dist }) => {
          const manga     = mangaList[logIdx];
          const scale     = SCALES[Math.min(dist, SCALES.length - 1)];
          const isActive  = dist === 0;
          const sideStep   = coverW * 0.88 + itemGap * 2;
          const activeStep = coverW * 0.94 + itemGap * 2;
          const x = offset === 0
            ? 0
            : Math.sign(offset) * (activeStep + (dist - 1) * sideStep);
          const coverOffsetY = isActive
            ? 0
            : Math.round(Math.min(metaH - 24, Math.max(34, coverH * 0.12)));

          return (
            <div
              key={manga.id}
              onClick={() => handleClick(logIdx)}
              className="absolute cursor-pointer"
              style={{
                left:             '50%',
                top:              padV,
                width:            coverW,
                transform:        `translateX(calc(-50% + ${x}px)) translateY(${coverOffsetY}px) scale(${scale})`,
                transformOrigin:  'top center',
                zIndex:            side - dist + 1,
                willChange:       'transform',
                transition:       'transform 0.55s cubic-bezier(0.22,1,0.36,1)',
              }}
            >
              {/* Cover image with overlays */}
              <div
                className={`relative rounded-xl overflow-hidden border transition-[border-color,box-shadow] duration-500 ${
                  isActive
                    ? 'border-white/20 shadow-[0_18px_55px_rgba(0,0,0,0.72)]'
                    : 'border-black/55 shadow-[0_20px_42px_rgba(0,0,0,0.9),0_0_0_1px_rgba(255,255,255,0.04)]'
                }`}
                style={{ width: coverW, height: coverH }}
              >
                <ResponsiveCover
                  manga={manga}
                  alt={manga.title}
                  loading={isActive || offset === 1 ? 'eager' : 'lazy'}
                  fetchPriority={isActive ? 'high' : 'low'}
                  decoding="async"
                  className={`w-full h-full object-cover transition-[filter] duration-500 ease-out ${isActive ? 'brightness-100 saturate-100' : 'brightness-[0.72] saturate-[0.82]'}`}
                  draggable={false}
                />

                <div className={`absolute inset-0 bg-black/36 pointer-events-none transition-opacity duration-500 ${isActive ? 'opacity-0' : 'opacity-100'}`} />

                {/* Active glow ring */}
                <div className={`absolute inset-0 rounded-xl ring-[2px] ring-white/30 ring-inset pointer-events-none transition-opacity duration-500 ${isActive ? 'opacity-100' : 'opacity-0'}`} />
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
