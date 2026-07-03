import { useState, useEffect } from 'react';
import { imgUrl } from '../utils';
import { Star } from 'lucide-react';

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
  const [coverW,    setCoverW]    = useState(getCoverW);
  const [maxSide,   setMaxSide]   = useState(getMaxSide);
  const [itemGap,   setItemGap]   = useState(getItemGap);

  const coverH     = Math.round(coverW * 1.5);
  const containerH = PAD_V + coverH + PAD_V;

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
    }, 5000);
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
    if (dist === 0) onViewManga(mangaList[logIdx]);
    else setActiveIdx(logIdx);
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
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black/35" />
          <div className="absolute inset-0 bg-gradient-to-b from-surface/72 via-surface/24 to-surface/72" />
          <div className="absolute inset-0 bg-gradient-to-r from-surface/78 via-transparent to-surface/78" />
      </div>

      {/* ── Cover row — centered flex, no scroll ── */}
      <div
        className="absolute inset-0 flex items-center justify-center z-10"
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
              className="flex-shrink-0 cursor-pointer"
              style={{
                width:            coverW,
                transform:        `scale(${scale})`,
                transformOrigin:  'center center',
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

                {/* Rating badge — top left */}
                {isActive && rating && (
                  <div className="absolute top-1.5 left-1.5 h-4 sm:h-5 flex items-center gap-[3px] bg-black/70 backdrop-blur-sm px-1 sm:px-1.5 rounded">
                    <Star className="w-2 h-2 sm:w-[9px] sm:h-[9px] text-amber-400 fill-current shrink-0" />
                    <span className="font-label-sm text-[8px] sm:text-[9px] font-black text-white leading-none">{rating}</span>
                  </div>
                )}

                {/* Status badge — top right */}
                {isActive && (
                  <div className="absolute top-1.5 right-1.5 h-4 sm:h-5 flex items-center bg-black/70 backdrop-blur-sm px-1 sm:px-1.5 rounded">
                    <span className={`font-label-sm text-[8px] sm:text-[9px] font-black uppercase leading-none ${statusCfg.textCls}`}>
                      {statusCfg.label}
                    </span>
                  </div>
                )}

                {/* Title — gradient overlay at bottom of cover */}
                {isActive && (
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent pt-8 pb-2 px-2">
                    <p className="font-body-md text-xs font-bold text-white/95 text-center truncate leading-tight">
                      {manga.title}
                    </p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
