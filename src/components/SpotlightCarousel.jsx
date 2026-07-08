import { useState, useEffect } from 'react';
import { imgUrl } from '../utils';
import { Info, Play, Star } from 'lucide-react';

const STATUS_CFG = {
  'Tamat':   { label: 'END',     textCls: 'text-red-300' },
  'Hiatus':  { label: 'HIATUS',  textCls: 'text-zinc-300' },
  'Oneshot': { label: 'ONESHOT', textCls: 'text-purple-300' },
};
const ONGOING_CFG = { label: 'ONGOING', textCls: 'text-emerald-300' };

// Scale & opacity: hanya yang aktif membesar; semua sisanya seragam
const SCALES    = [1, 0.88];
const OPACITIES = [1, 0.78, 0.78, 0.62, 0.5, 0.4];

const PAD_V = 12;
const META_H = 112;

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

export default function SpotlightCarousel({ mangaList, onViewManga, onReadNow }) {
  const N = mangaList.length;
  const [activeIdx, setActiveIdx] = useState(() => getMostRecentIdx(mangaList));
  const [coverW,    setCoverW]    = useState(getCoverW);
  const [maxSide,   setMaxSide]   = useState(getMaxSide);
  const [itemGap,   setItemGap]   = useState(getItemGap);

  const coverH     = Math.round(coverW * 1.5);
  const containerH = PAD_V + coverH + META_H + PAD_V;
  const metaW      = Math.max(coverW, coverW < 230 ? 224 : coverW);

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
    const onResize = () => { setCoverW(getCoverW()); setMaxSide(getMaxSide()); setItemGap(getItemGap()); };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (N <= 1) return undefined;
    const timer = setInterval(() => {
      setActiveIdx((idx) => (idx + 1) % N);
    }, 8000);
    return () => clearInterval(timer);
  }, [N]);

  // Preload all covers in the current window + 1 step ahead on each side
  useEffect(() => {
    const toLoad = new Set();
    for (let d = -side - 1; d <= side + 1; d++) {
      const idx = ((activeIdx + d) % N + N) % N;
      const m = mangaList[idx];
      const url = imgUrl(m?.coverUrls?.mobile || m?.coverUrl);
      if (url) toLoad.add(url);
    }
    // fetchPriority 'low' agar preload tetangga tidak berebut bandwidth dengan
    // gambar LCP (background blur + cover aktif) yang sedang dimuat.
    toLoad.forEach(url => { const img = new Image(); img.fetchPriority = 'low'; img.src = url; });
  }, [activeIdx]); // eslint-disable-line

  const handleClick = (logIdx, dist) => {
    if (dist > 0) setActiveIdx(logIdx);
  };

  const handleReadNow = (e, manga) => {
    e.stopPropagation();
    onReadNow?.(manga);
  };

  const handleViewDetail = (e, manga) => {
    e.stopPropagation();
    onViewManga?.(manga);
  };

  const active = mangaList[activeIdx];

  return (
    <div
      className="relative w-full rounded-xl overflow-hidden"
      style={{ height: containerH }}
    >
      {/* ── Darkened background from active cover ── */}
      <div key={active?.id} className="absolute inset-0 pointer-events-none z-0 animate-[fadeIn_0.4s_ease-out]">
          <img
            src={imgUrl(active?.coverUrls?.mobile || active?.coverUrl)} alt=""
            loading="eager"
            fetchpriority="high"
            className="absolute inset-0 w-full h-full object-cover object-top"
          />
          <div className="absolute inset-0 bg-black/45" />
          <div className="absolute inset-0 bg-gradient-to-t from-surface/95 via-surface/55 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-surface/90 via-surface/44 to-transparent" />
      </div>

      {/* ── Cover row — centered flex, no scroll ── */}
      <div
        className="absolute inset-0 flex items-start justify-center z-10"
        style={{ paddingTop: PAD_V, paddingBottom: PAD_V }}
      >
        {items.map(({ logIdx, offset, dist }) => {
          const manga     = mangaList[logIdx];
          const scale     = SCALES[Math.min(dist, SCALES.length - 1)];
          const opacity   = OPACITIES[Math.min(dist, OPACITIES.length - 1)];
          const isActive  = dist === 0;
          // Negative margin collapses the visual gap created by scale shrink
          const nm        = Math.round(-(coverW * (1 - scale)) / 2) + itemGap;
          const statusCfg = STATUS_CFG[manga.status] || ONGOING_CFG;
          const rating    = manga.rating != null ? Number(manga.rating).toFixed(1) : null;

          return (
            <div
              key={offset}   // stable slot key — content swaps, scale transitions smoothly
              onClick={() => handleClick(logIdx, dist)}
              className={`flex-shrink-0 ${isActive ? 'cursor-default' : 'cursor-pointer'}`}
              style={{
                width:            coverW,
                transform:        `scale(${scale})`,
                transformOrigin:  'top center',
                opacity,
                marginLeft:       nm,
                marginRight:      nm,
                willChange:       'transform, opacity, margin',
                transition:       'transform 0.5s cubic-bezier(0.22,1,0.36,1), opacity 0.5s cubic-bezier(0.22,1,0.36,1), margin 0.5s cubic-bezier(0.22,1,0.36,1)',
              }}
            >
              {/* Cover image with overlays */}
              <div
                className="relative rounded-xl overflow-hidden shadow-2xl"
                style={{ width: coverW, height: coverH }}
              >
                <img
                  src={imgUrl(manga.coverUrls?.mobile || manga.coverUrl)}
                  alt={manga.title}
                  loading="eager"
                  fetchpriority={isActive ? 'high' : 'low'}
                  className={`w-full h-full object-cover transition-[filter] duration-500 ease-out ${isActive ? 'brightness-105' : 'brightness-[0.65]'}`}
                  draggable={false}
                />

                {/* Active glow ring */}
                {isActive && (
                  <div className="absolute inset-0 rounded-xl ring-[2px] ring-white/30 ring-inset pointer-events-none" />
                )}
              </div>

              {isActive && (
                <div
                  className="relative left-1/2 mt-2 flex h-[104px] -translate-x-1/2 flex-col items-center gap-1.5 px-0.5"
                  style={{ width: metaW }}
                >
                  <div key={`spotlight-meta-${manga.id}`} className="flex w-full flex-col items-center gap-1.5 animate-[spotlightMetaIn_0.38s_cubic-bezier(0.22,1,0.36,1)]">
                    <h3 className="w-full truncate text-center font-headline-md text-sm sm:text-base md:text-lg font-black leading-tight text-on-surface">
                      {manga.title}
                    </h3>

                    <div className="flex w-full items-center justify-center gap-1.5 overflow-hidden font-body-md text-[10px] sm:text-xs md:text-sm leading-none">
                      {rating && (
                        <span className="flex min-w-0 items-center gap-1 font-semibold text-amber-400">
                          <Star className="h-3 w-3 sm:h-3.5 sm:w-3.5 fill-current shrink-0" />
                          <span>{rating}</span>
                        </span>
                      )}
                      {rating && <span className="text-white/35">|</span>}
                      <span className={`min-w-0 truncate ${statusCfg.textCls}`}>{statusCfg.label}</span>
                      <span className="text-white/35">|</span>
                      <span className="min-w-0 truncate text-white">{manga.chapters?.length || 0} Chapter</span>
                    </div>
                  </div>

                  <div className="mt-1 grid w-full grid-cols-2 gap-1.5 sm:gap-2">
                    <button
                      type="button"
                      onClick={(e) => handleReadNow(e, manga)}
                      className="flex h-8 sm:h-9 md:h-10 items-center justify-center gap-1 sm:gap-1.5 rounded-lg md:rounded-xl bg-white hover:bg-white/90 px-2 sm:px-3 md:px-4 text-[10px] sm:text-xs md:text-sm font-bold leading-none text-black shadow-md active:scale-[0.98] transition-all cursor-pointer"
                    >
                      <Play className="h-3 w-3 sm:h-3.5 sm:w-3.5 md:h-4 md:w-4 fill-current shrink-0" />
                      <span className="truncate">Baca Sekarang</span>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleViewDetail(e, manga)}
                      className="flex h-8 sm:h-9 md:h-10 items-center justify-center gap-1 sm:gap-1.5 rounded-lg md:rounded-xl border border-white/10 bg-surface-container-high hover:bg-surface-container-highest px-2 sm:px-3 md:px-4 text-[10px] sm:text-xs md:text-sm font-bold leading-none text-white shadow-md active:scale-[0.98] transition-all cursor-pointer"
                    >
                      <Info className="h-3 w-3 sm:h-3.5 sm:w-3.5 md:h-4 md:w-4 shrink-0" />
                      <span className="truncate">View Detail</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
