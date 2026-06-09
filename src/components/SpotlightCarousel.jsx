import { useState, useRef, useEffect, useCallback } from 'react';
import { imgUrl } from '../utils';
import { Star } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const STATUS_CFG = {
  'Tamat':   { label: 'END',     cls: 'bg-red-500/25 text-red-300 border-red-500/50' },
  'Hiatus':  { label: 'HIATUS',  cls: 'bg-zinc-500/25 text-zinc-300 border-zinc-500/50' },
  'Oneshot': { label: 'ONESHOT', cls: 'bg-purple-500/25 text-purple-300 border-purple-500/50' },
};
const ONGOING_CFG = { label: 'ONGOING', cls: 'bg-emerald-500/25 text-emerald-300 border-emerald-500/50' };

// Scale & opacity by distance from active
const SCALES   = [1, 0.78, 0.63, 0.52, 0.44, 0.38];
const OPACITIES = [1, 0.88, 0.70, 0.52, 0.36, 0.22];

// Cover width at each breakpoint (px)
const COVER_W_SM  = 96;   // <640
const COVER_W_MD  = 112;  // 640-1023
const COVER_W_LG  = 132;  // ≥1024

function getCoverW() {
  const w = typeof window !== 'undefined' ? window.innerWidth : 1024;
  if (w < 640)  return COVER_W_SM;
  if (w < 1024) return COVER_W_MD;
  return COVER_W_LG;
}

/** Index of manga with the most recent chapter release_date */
function getMostRecentIdx(mangaList) {
  let best = 0;
  let bestMs = 0;
  mangaList.forEach((manga, idx) => {
    const latest = (manga.chapters || []).reduce((max, ch) => {
      const t = ch.release_date ? new Date(ch.release_date).getTime() : 0;
      return t > max ? t : max;
    }, 0);
    if (latest > bestMs) { bestMs = latest; best = idx; }
  });
  return best;
}

export default function SpotlightCarousel({ mangaList, onViewManga }) {
  const [activeIdx, setActiveIdx] = useState(() => getMostRecentIdx(mangaList));
  const [coverW, setCoverW] = useState(getCoverW);
  const [spacerW, setSpacerW] = useState(0);
  const scrollRef  = useRef(null);
  const itemRefs   = useRef([]);
  const autoRef    = useRef(null);

  const coverH = Math.round(coverW * 1.5);
  // Total container height: cover + title row + vertical padding
  const containerH = coverH + (coverW < 100 ? 44 : 52);

  // Update coverW and spacerW on resize
  useEffect(() => {
    const onResize = () => {
      setCoverW(getCoverW());
      if (scrollRef.current) {
        setSpacerW(Math.round(scrollRef.current.offsetWidth / 2 - getCoverW() / 2));
      }
    };
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Re-center when coverW changes
  useEffect(() => { centerItem(activeIdx, false); }, [coverW]); // eslint-disable-line

  const centerItem = useCallback((idx, smooth = true) => {
    const container = scrollRef.current;
    const el = itemRefs.current[idx];
    if (!container || !el) return;
    const left = el.offsetLeft - container.offsetWidth / 2 + el.offsetWidth / 2;
    container.scrollTo({ left, behavior: smooth ? 'smooth' : 'instant' });
  }, []);

  // Center on active change
  useEffect(() => { centerItem(activeIdx); }, [activeIdx, centerItem]);

  // Auto-advance every 5s
  useEffect(() => {
    const tick = () => setActiveIdx(p => (p + 1) % mangaList.length);
    autoRef.current = setInterval(tick, 5000);
    return () => clearInterval(autoRef.current);
  }, [mangaList.length]);

  const resetAuto = () => {
    clearInterval(autoRef.current);
    autoRef.current = setInterval(
      () => setActiveIdx(p => (p + 1) % mangaList.length),
      5000
    );
  };

  const handleClick = (idx) => {
    resetAuto();
    if (idx === activeIdx) {
      onViewManga(mangaList[idx]);
    } else {
      setActiveIdx(idx);
    }
  };

  const active = mangaList[activeIdx];

  return (
    <div
      className="relative w-full rounded-xl overflow-hidden"
      style={{ height: containerH }}
    >
      {/* ── Blurred background ── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={active?.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.55 }}
          className="absolute inset-0 pointer-events-none z-0"
        >
          <img
            src={imgUrl(active?.coverUrl)}
            alt=""
            className="absolute inset-0 w-full h-full object-cover scale-150 blur-3xl opacity-60"
          />
          {/* Vignettes */}
          <div className="absolute inset-0 bg-gradient-to-b from-surface/55 via-transparent to-surface/55" />
          <div className="absolute inset-0 bg-gradient-to-r from-surface/75 via-transparent to-surface/75" />
        </motion.div>
      </AnimatePresence>

      {/* ── Scrollable covers row ── */}
      <div
        ref={scrollRef}
        className="absolute inset-0 flex items-start overflow-x-auto hide-scrollbar z-10"
        style={{ paddingTop: Math.round((containerH - coverH - (coverW < 100 ? 36 : 42)) / 2) }}
      >
        {/* Left spacer — allows first item to be centered */}
        <div className="flex-shrink-0" style={{ width: spacerW }} />

        {mangaList.map((manga, idx) => {
          const dist      = Math.abs(idx - activeIdx);
          const scale     = SCALES[Math.min(dist, SCALES.length - 1)];
          const opacity   = OPACITIES[Math.min(dist, OPACITIES.length - 1)];
          const isActive  = idx === activeIdx;
          // Negative margin to collapse the extra space created by scale
          const nm = Math.round(-(coverW * (1 - scale)) / 2);
          const statusCfg = STATUS_CFG[manga.status] || ONGOING_CFG;

          return (
            <div
              key={manga.id}
              ref={el => { itemRefs.current[idx] = el; }}
              onClick={() => handleClick(idx)}
              className="flex-shrink-0 flex flex-col items-center cursor-pointer"
              style={{
                width: coverW,
                transform: `scale(${scale})`,
                transformOrigin: 'center top',
                opacity,
                marginLeft:  nm,
                marginRight: nm,
                transition:  'transform 0.38s cubic-bezier(0.4,0,0.2,1), opacity 0.38s ease, margin 0.38s ease',
              }}
            >
              {/* Cover image */}
              <div
                className="relative rounded-lg overflow-hidden shadow-2xl"
                style={{ width: coverW, height: coverH }}
              >
                <img
                  src={imgUrl(manga.coverUrl)}
                  alt={manga.title}
                  className={`w-full h-full object-cover ${isActive ? 'brightness-105' : 'brightness-80'}`}
                  draggable={false}
                />

                {/* Active ring */}
                {isActive && (
                  <div className="absolute inset-0 rounded-lg ring-2 ring-white/30 ring-inset pointer-events-none" />
                )}

                {/* Rating — top left */}
                {isActive && (
                  <div className="absolute top-1.5 left-1.5 flex items-center gap-0.5 bg-black/65 backdrop-blur-sm px-1.5 py-0.5 rounded-md">
                    <Star className="w-2.5 h-2.5 text-amber-400 fill-current shrink-0" />
                    <span className="font-mono text-[10px] font-black text-white leading-none">
                      {manga.rating || '—'}
                    </span>
                  </div>
                )}

                {/* Status — top right */}
                {isActive && (
                  <div
                    className={`absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded-md text-[8px] font-black uppercase tracking-wider border backdrop-blur-sm ${statusCfg.cls}`}
                  >
                    {statusCfg.label}
                  </div>
                )}
              </div>

              {/* Title — only visible when active */}
              <p
                className="font-body-md font-bold text-white/90 text-center truncate px-1 mt-1.5"
                style={{
                  width: coverW,
                  fontSize: coverW < 100 ? 10 : coverW < 120 ? 11 : 12,
                  opacity: isActive ? 1 : 0,
                  transition: 'opacity 0.3s ease',
                  lineHeight: '1.3',
                }}
              >
                {manga.title}
              </p>
            </div>
          );
        })}

        {/* Right spacer */}
        <div className="flex-shrink-0" style={{ width: spacerW }} />
      </div>

      {/* ── Hint label (tap once = select, twice = detail) — small, bottom center ── */}
      <p className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[9px] text-white/25 font-semibold tracking-wide pointer-events-none z-10 whitespace-nowrap">
        Tap sekali untuk pilih · Tap lagi untuk detail
      </p>
    </div>
  );
}
