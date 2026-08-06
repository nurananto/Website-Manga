import { useState, useEffect, useRef, useCallback } from 'react';
import { Star } from 'lucide-react';
import { coverUrlForWidth } from '../utils';
import ResponsiveCover from './ResponsiveCover';
import CoverScrim from './CoverScrim';

// textCls: warna light mode dulu (di atas panel terang), dark: menyusul (di atas scrim gelap).
// SENGAJA tidak disatukan dengan mapping status di MangaCard/MangaDetailPage —
// label ini duduk di atas cover foto blur (butuh warna lebih ngejreng/custom
// #166534 biar kebaca), sedangkan 2 tempat lain adalah badge/dot polos di atas
// kartu UI biasa. Nilai memang beda by design, bukan drift yang perlu disatukan.
const STATUS_CFG = {
  'Tamat':   { label: 'END',     textCls: 'text-red-700 dark:text-red-500' },
  'Hiatus':  { label: 'HIATUS',  textCls: 'text-zinc-600 dark:text-zinc-400' },
  'Oneshot': { label: 'ONESHOT', textCls: 'text-red-700 dark:text-red-500' },
};
const ONGOING_CFG = { label: 'ONGOING', textCls: 'text-[#166534] dark:text-emerald-300' };

// Hanya cover aktif yang membesar; cover lain tetap opaque dan digelapkan via overlay.
const SCALES = [1, 0.88];
const AUTO_ADVANCE_MS = 5000;

function getPadV() {
  const w = typeof window !== 'undefined' ? window.innerWidth : 1280;
  if (w < 640)  return 10;
  if (w < 768)  return 9;
  if (w < 1024) return 8;
  return 7;
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

// Satu snapshot layout per breakpoint — dihitung sekali per resize (bukan 6
// setState terpisah) supaya tidak memicu beberapa re-render berturut-turut.
function getLayout() {
  return {
    coverW: getCoverW(),
    maxSide: getMaxSide(),
    itemGap: getItemGap(),
    metaH: getMetaH(),
    padV: getPadV(),
    metaGap: getCoverMetaGap(),
  };
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
      <CoverScrim variant="spotlight" />
    </div>
  );
}

export default function SpotlightCarousel({
  mangaList,
  onViewManga,
  initialMangaId = null,
  onActiveMangaChange,
}) {
  const N = mangaList.length;
  const [activeIdx, setActiveIdx] = useState(() => {
    const savedIdx = initialMangaId
      ? mangaList.findIndex((manga) => manga.id === initialMangaId)
      : -1;
    return savedIdx >= 0 ? savedIdx : getMostRecentIdx(mangaList);
  });
  const [isPageVisible, setIsPageVisible] = useState(() => document.visibilityState === 'visible');
  const [pendingDetailIdx, setPendingDetailIdx] = useState(null);
  const [autoResetKey, setAutoResetKey] = useState(0);
  const [layout, setLayout] = useState(getLayout);
  const { coverW, maxSide, itemGap, metaH, padV, metaGap } = layout;
  const [hasMoved, setHasMoved] = useState(false);
  const [previousIdx, setPreviousIdx] = useState(null);
  const activeIdxRef = useRef(activeIdx);
  const nextAdvanceAtRef = useRef(0);

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
    const onResize = () => setLayout(getLayout());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    const handleVisibility = () => {
      const visible = document.visibilityState === 'visible';
      // Browser dapat mengeksekusi timer yang sudah jatuh tempo tepat ketika
      // tab dibuka lagi. Geser tenggat lebih dulu agar frame lama tidak
      // langsung meloncat ke cover berikutnya.
      nextAdvanceAtRef.current = visible ? Date.now() + AUTO_ADVANCE_MS : Number.POSITIVE_INFINITY;
      setIsPageVisible(visible);
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  useEffect(() => {
    if (N <= 1 || !isPageVisible) return undefined;

    nextAdvanceAtRef.current = Date.now() + AUTO_ADVANCE_MS;
    const timer = window.setTimeout(() => {
      if (
        document.visibilityState !== 'visible'
        || Date.now() + 50 < nextAdvanceAtRef.current
      ) return;
      moveTo(activeIdxRef.current + 1);
      setPendingDetailIdx(null);
    }, AUTO_ADVANCE_MS);
    return () => window.clearTimeout(timer);
  }, [activeIdx, autoResetKey, N, isPageVisible, moveTo]);

  useEffect(() => {
    const activeId = mangaList[activeIdx]?.id;
    if (activeId) onActiveMangaChange?.(activeId);
  }, [activeIdx, mangaList, onActiveMangaChange]);

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
    if (pendingDetailIdx === logIdx) {
      onViewManga?.(mangaList[logIdx]);
      return;
    }
    setPendingDetailIdx(logIdx);
    setAutoResetKey((value) => value + 1);
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
            <button
              type="button"
              key={manga.id}
              onClick={() => handleClick(logIdx)}
              aria-label={isActive ? `Buka detail ${manga.title}` : `Tampilkan ${manga.title}`}
              className="absolute cursor-pointer border-0 bg-transparent p-0 text-left"
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
                    ? 'border-[#E5E7EB] shadow-[0_4px_10px_rgba(0,0,0,0.10)] dark:border-white/20 dark:shadow-[0_8px_20px_rgba(0,0,0,0.55)]'
                    : 'border-black/10 shadow-[0_2px_6px_rgba(0,0,0,0.08)] dark:border-black/55 dark:shadow-[0_6px_14px_rgba(0,0,0,0.45),0_0_0_1px_rgba(255,255,255,0.04)]'
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

                {/* Dim overlay cover non-aktif — ikut tema: putih tembus pandang di
                    light mode (biar nyatu sama background terang, bukan bikin
                    corak hitam), scrim gelap di dark mode seperti sebelumnya. */}
                <div className={`absolute inset-0 bg-white/45 dark:bg-black/36 pointer-events-none transition-all duration-500 ${isActive ? 'opacity-0' : 'opacity-100'}`} />

                {/* Active glow ring */}
                <div className={`absolute inset-0 rounded-xl ring-[2px] ring-black/10 dark:ring-white/30 ring-inset pointer-events-none transition-all duration-500 ${isActive ? 'opacity-100' : 'opacity-0'}`} />
              </div>

            </button>
          );
        })}
      </div>

      {active && (
        <div
          key={`spotlight-meta-${active.id}`}
          className={`absolute inset-x-2 sm:inset-x-4 z-20 flex flex-col items-center gap-1.5 px-1 ${hasMoved ? 'animate-[spotlightMetaIn_0.38s_cubic-bezier(0.22,1,0.36,1)]' : ''}`}
          style={{ top: padV + coverH + metaGap }}
        >
          <h3 className="w-full max-w-full truncate text-center font-headline-md text-base sm:text-lg md:text-xl font-black leading-tight text-on-surface dark:text-white dark:[text-shadow:0_1px_3px_rgba(0,0,0,0.9),0_2px_10px_rgba(0,0,0,0.75)]">
            {active.title}
          </h3>

          <div className="inline-flex max-w-full items-center justify-center gap-1.5 overflow-hidden border-y-2 border-[#9CA3AF] dark:border-white/35 px-2.5 py-1.5 font-body-md text-xs sm:text-sm md:text-base font-bold leading-none">
            {activeRating && (
              <span className="flex min-w-0 items-center gap-1 font-extrabold text-amber-700 dark:text-amber-400">
                <Star className="h-3.5 w-3.5 sm:h-4 sm:w-4 fill-current shrink-0" />
                <span>{activeRating}</span>
              </span>
            )}
            {activeRating && <span className="font-black text-on-surface-variant dark:text-white/50">|</span>}
            <span className={`min-w-0 truncate font-black ${activeStatusCfg.textCls}`}>{activeStatusCfg.label}</span>
            <span className="font-black text-on-surface-variant dark:text-white/50">|</span>
            <span className="min-w-0 truncate font-extrabold text-on-surface-variant dark:text-white">{activeChapterCount} Chapter</span>
          </div>

        </div>
      )}
    </div>
  );
}
