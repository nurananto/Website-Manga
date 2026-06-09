import { useState, useRef, useEffect, useCallback } from 'react';
import { imgUrl } from '../utils';
import { Star } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const STATUS_CFG = {
  'Tamat':   { label: 'END',     textCls: 'text-red-400' },
  'Hiatus':  { label: 'HIATUS',  textCls: 'text-zinc-400' },
  'Oneshot': { label: 'ONESHOT', textCls: 'text-purple-400' },
};
const ONGOING_CFG = { label: 'ONGOING', textCls: 'text-emerald-400' };

const SCALES    = [1, 0.76, 0.60, 0.49, 0.41, 0.35];
const OPACITIES = [1, 0.85, 0.68, 0.50, 0.34, 0.20];

// Match FeaturedCarousel cover dimensions (height: 220/260/300/340, cover 85-93%)
function getCoverW() {
  const w = typeof window !== 'undefined' ? window.innerWidth : 1280;
  if (w < 640)  return 120;
  if (w < 768)  return 150;
  if (w < 1024) return 184;
  return 208;
}

function getMostRecentIdx(list) {
  let best = 0, bestMs = 0;
  list.forEach((manga, idx) => {
    const t = (manga.chapters || []).reduce((m, ch) =>
      Math.max(m, ch.release_date ? new Date(ch.release_date).getTime() : 0), 0);
    if (t > bestMs) { bestMs = t; best = idx; }
  });
  return best;
}

// Gap added between cover items
const ITEM_GAP = 8;
const PAD_V    = 12;

export default function SpotlightCarousel({ mangaList, onViewManga }) {
  const N = mangaList.length;

  // Virtual tripled list for infinite loop: [copy_L][original][copy_R]
  // dispIdx is always kept in [N, 2N).
  const [dispIdx, setDispIdx] = useState(() => getMostRecentIdx(mangaList) + N);
  const [coverW,  setCoverW]  = useState(getCoverW);
  const [spacerW, setSpacerW] = useState(0);

  const scrollRef = useRef(null);
  const itemRefs  = useRef([]);
  const autoRef   = useRef(null);
  const snapping  = useRef(false);

  const logicalIdx = ((dispIdx % N) + N) % N;
  const coverH     = Math.round(coverW * 1.5);
  const containerH = PAD_V + coverH + PAD_V;

  // ── Measure ─────────────────────────────────────────────────────
  useEffect(() => {
    const measure = () => {
      const w = getCoverW();
      setCoverW(w);
      if (scrollRef.current)
        setSpacerW(Math.max(0, Math.round(scrollRef.current.offsetWidth / 2 - w / 2)));
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  // ── Scroll helpers ───────────────────────────────────────────────
  const centerItem = useCallback((pos, smooth = true) => {
    const el  = itemRefs.current[pos];
    const box = scrollRef.current;
    if (!el || !box) return;
    const left = el.offsetLeft - box.offsetWidth / 2 + el.offsetWidth / 2;
    box.scrollTo({ left, behavior: smooth ? 'smooth' : 'instant' });
  }, []);

  // Scroll and snap-back to middle copy when reaching edge copies
  useEffect(() => {
    if (snapping.current) { snapping.current = false; return; }

    centerItem(dispIdx, true);

    const snap = setTimeout(() => {
      let target = dispIdx;
      if (dispIdx >= 2 * N)  target = dispIdx - N;
      else if (dispIdx < N)  target = dispIdx + N;
      if (target !== dispIdx) {
        snapping.current = true;
        centerItem(target, false);
        setDispIdx(target);
      }
    }, 420);

    return () => clearTimeout(snap);
  }, [dispIdx, N, centerItem]);

  // Re-center instantly when cover size changes
  useEffect(() => { centerItem(dispIdx, false); }, [coverW]); // eslint-disable-line

  // ── Auto-advance ─────────────────────────────────────────────────
  const resetAuto = useCallback(() => {
    clearInterval(autoRef.current);
    autoRef.current = setInterval(() => setDispIdx(p => p + 1), 5000);
  }, []);

  useEffect(() => { resetAuto(); return () => clearInterval(autoRef.current); }, [resetAuto]);

  // ── Click handler ─────────────────────────────────────────────────
  const handleClick = (pos) => {
    resetAuto();
    const clickedLogical = ((pos % N) + N) % N;
    if (clickedLogical === logicalIdx) {
      onViewManga(mangaList[logicalIdx]);
    } else {
      setDispIdx(pos);
    }
  };

  const active = mangaList[logicalIdx];

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
          transition={{ duration: 0.5 }}
          className="absolute inset-0 pointer-events-none z-0"
        >
          <img src={imgUrl(active?.coverUrl)} alt=""
            className="absolute inset-0 w-full h-full object-cover scale-150 blur-3xl opacity-55" />
          <div className="absolute inset-0 bg-gradient-to-b from-surface/60 via-surface/10 to-surface/60" />
          <div className="absolute inset-0 bg-gradient-to-r from-surface/80 via-transparent to-surface/80" />
        </motion.div>
      </AnimatePresence>

      {/* ── Covers row ── */}
      <div
        ref={scrollRef}
        className="absolute inset-0 flex items-start overflow-x-auto hide-scrollbar z-10"
        style={{ paddingTop: PAD_V }}
      >
        {/* Left spacer */}
        <div className="flex-shrink-0" style={{ width: spacerW }} />

        {Array.from({ length: 3 * N }, (_, pos) => {
          const logical   = pos % N;
          const manga     = mangaList[logical];
          const dist      = Math.abs(pos - dispIdx);
          const scale     = SCALES[Math.min(dist, SCALES.length - 1)];
          const opacity   = OPACITIES[Math.min(dist, OPACITIES.length - 1)];
          const isActive  = pos === dispIdx;
          const nm        = Math.round(-(coverW * (1 - scale)) / 2) + ITEM_GAP;
          const statusCfg = STATUS_CFG[manga.status] || ONGOING_CFG;
          const rating    = manga.rating != null
            ? Number(manga.rating).toFixed(1)
            : null;

          return (
            <div
              key={`${pos}-${logical}`}
              ref={el => { itemRefs.current[pos] = el; }}
              onClick={() => handleClick(pos)}
              className="flex-shrink-0 cursor-pointer"
              style={{
                width: coverW,
                transform: `scale(${scale})`,
                transformOrigin: 'center top',
                opacity,
                marginLeft:  nm,
                marginRight: nm,
                transition: 'transform 0.38s cubic-bezier(0.4,0,0.2,1), opacity 0.38s ease, margin 0.38s ease',
              }}
            >
              {/* Cover with title overlay at bottom */}
              <div
                className="relative rounded-xl overflow-hidden shadow-2xl"
                style={{ width: coverW, height: coverH }}
              >
                <img
                  src={imgUrl(manga.coverUrl)}
                  alt={manga.title}
                  className={`w-full h-full object-cover ${isActive ? 'brightness-105' : 'brightness-70'}`}
                  draggable={false}
                />

                {/* Active ring */}
                {isActive && (
                  <div className="absolute inset-0 rounded-xl ring-[2.5px] ring-white/35 ring-inset pointer-events-none" />
                )}

                {/* Rating — top left (active only) */}
                {isActive && rating && (
                  <div className="absolute top-2 left-2 flex items-center gap-0.5 bg-black/70 backdrop-blur-sm px-1.5 py-0.5 rounded-md">
                    <Star className="w-2.5 h-2.5 text-amber-400 fill-current shrink-0" />
                    <span className="font-mono text-[10px] font-black text-white leading-none">
                      {rating}
                    </span>
                  </div>
                )}

                {/* Status — top right (active only), same badge style */}
                {isActive && (
                  <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-sm px-1.5 py-0.5 rounded-md">
                    <span className={`font-mono text-[10px] font-black uppercase leading-none ${statusCfg.textCls}`}>
                      {statusCfg.label}
                    </span>
                  </div>
                )}

                {/* Title overlay — bottom gradient (active only) */}
                {isActive && (
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent pt-6 pb-2 px-2">
                    <p
                      className="font-bold text-white/95 text-center truncate leading-tight"
                      style={{ fontSize: coverW < 140 ? 10 : coverW < 170 ? 11 : 12 }}
                    >
                      {manga.title}
                    </p>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Right spacer */}
        <div className="flex-shrink-0" style={{ width: spacerW }} />
      </div>
    </div>
  );
}
