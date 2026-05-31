import { useState, useEffect, useRef } from 'react';
import { imgUrl } from '../utils';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Info } from 'lucide-react';

export default function FeaturedCarousel({ mangaList, onReadChapter, onViewManga }) {
  const trending = mangaList.filter((m) => m.isTrending) || [mangaList[0]];
  const [current, setCurrent] = useState(0);
  const touchStartX = useRef(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrent((prev) => (prev + 1) % trending.length);
    }, 7000);
    return () => clearInterval(timer);
  }, [current, trending.length]);

  const activeManga = trending[current] || mangaList[0];

  const handlePrev = (e) => {
    e.stopPropagation();
    setCurrent((prev) => (prev - 1 + trending.length) % trending.length);
  };

  const handleNext = (e) => {
    e.stopPropagation();
    setCurrent((prev) => (prev + 1) % trending.length);
  };

  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e) => {
    if (touchStartX.current === null) return;
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) {
      diff > 0
        ? setCurrent((prev) => (prev + 1) % trending.length)
        : setCurrent((prev) => (prev - 1 + trending.length) % trending.length);
    }
    touchStartX.current = null;
  };

  return (
    <div className="flex flex-col gap-2">
    <section
      className="relative w-full h-[220px] sm:h-[260px] md:h-[300px] lg:h-[340px] rounded-xl overflow-hidden group shadow-2xl border border-gold-pulse flex items-center justify-between"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={activeManga.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8 }}
          className="absolute inset-0 w-full h-full"
        >
          {/* Background Image (Blurred cover) */}
          <img
            alt=""
            className="w-full h-full object-cover object-center scale-125 blur-xl opacity-75"
            src={imgUrl(activeManga.coverUrl)}
          />
          {/* Vignette Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/50 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-surface/90 via-surface/30 to-transparent" />
        </motion.div>
      </AnimatePresence>

      {/* Left Side: Content Overlay — justify-between agar badges di atas, button di bawah */}
      {/* pr pixel tetap agar gap ke cover konsisten di semua lebar viewport */}
      <div className="absolute inset-0 left-0 py-2 pl-3 pr-36 sm:py-3 sm:pl-5 sm:pr-44 md:py-3 md:pl-7 md:pr-52 lg:py-4 lg:pl-9 lg:pr-60 flex flex-col justify-center z-10">

        {/* Satu blok konten, di-center secara vertikal */}
        <div className="flex flex-col gap-1.5 sm:gap-2 md:gap-2.5">
          {/* Badges */}
          <div className="flex gap-1.5 sm:gap-2 items-center flex-wrap">
            <span className="bg-amber-500/20 text-amber-500 px-2 sm:px-2.5 py-0.5 rounded-md font-label-sm text-[9px] sm:text-[10px] md:text-xs uppercase tracking-wider backdrop-blur-md border border-amber-500/30 font-semibold shadow-sm">
              Trending
            </span>
            {activeManga.genres.slice(0, 1).map((g) => (
              <span key={g} className="bg-surface-variant/85 text-on-surface px-2 sm:px-2.5 py-0.5 rounded-md font-label-sm text-[9px] sm:text-[10px] md:text-xs uppercase tracking-wider backdrop-blur-md">
                {g}
              </span>
            ))}
            {activeManga.genres.slice(1, 2).map((g) => (
              <span key={g} className="hidden sm:inline bg-surface-variant/85 text-on-surface px-2.5 py-0.5 rounded-md font-label-sm text-[10px] md:text-xs uppercase tracking-wider backdrop-blur-md">
                {g}
              </span>
            ))}
            {activeManga.genres.length > 1 && (
              <span className="inline sm:hidden bg-black/40 text-white/80 px-2 py-0.5 rounded-md font-label-sm text-[9px] uppercase tracking-wider backdrop-blur-md font-semibold border border-white/20">
                +{activeManga.genres.length - 1}
              </span>
            )}
            {activeManga.genres.length > 2 && (
              <span className="hidden sm:inline bg-black/40 text-white/80 px-2.5 py-0.5 rounded-md font-label-sm text-[10px] md:text-xs uppercase tracking-wider backdrop-blur-md font-semibold border border-white/20">
                +{activeManga.genres.length - 2}
              </span>
            )}
          </div>

          {/* Title */}
          <motion.h1
            key={`title-${activeManga.id}`}
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="font-display-lg text-lg sm:text-2xl md:text-3xl lg:text-4xl font-black text-on-surface text-shadow-md leading-tight line-clamp-2"
          >
            {activeManga.title}
          </motion.h1>

          {/* Description */}
          <motion.p
            key={`desc-${activeManga.id}`}
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="line-clamp-3 sm:line-clamp-3 md:line-clamp-4 lg:line-clamp-5 font-body-lg text-xs md:text-sm text-on-surface-variant/80 leading-relaxed text-justify"
          >
            {activeManga.description}
          </motion.p>

          {/* Buttons */}
          <motion.div
            key={`btn-${activeManga.id}`}
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="flex items-center gap-2 sm:gap-3 mt-1 sm:mt-2"
          >
            <button
              onClick={() => onReadChapter(activeManga.chapters[0], activeManga.title)}
              className="flex items-center gap-1.5 sm:gap-2 bg-gradient-to-r from-sky-400 to-indigo-600 hover:from-sky-500 hover:to-indigo-700 text-white font-bold px-3 sm:px-4 md:px-5 py-1.5 sm:py-2 md:py-2.5 rounded-lg md:rounded-xl shadow-lg hover:shadow-indigo-500/20 hover:scale-105 active:scale-[0.98] transition-all text-[10px] sm:text-xs md:text-sm cursor-pointer"
            >
              <Play className="w-3 h-3 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4 fill-current" />
              Read
            </button>
            <button
              onClick={() => onViewManga && onViewManga(activeManga)}
              className="flex items-center gap-1.5 sm:gap-2 bg-white/10 hover:bg-white/20 border border-white/10 text-white font-bold px-3 sm:px-4 md:px-5 py-1.5 sm:py-2 md:py-2.5 rounded-lg md:rounded-xl hover:scale-105 active:scale-[0.98] transition-all text-[10px] sm:text-xs md:text-sm cursor-pointer"
            >
              <Info className="w-3 h-3 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4" />
              View
            </button>
          </motion.div>
        </div>
      </div>

      {/* Right Side: Cover Image */}
      {/* Mobile: lebih besar (h-[85%]), tablet: h-[90%], desktop: h-[93%] */}
      <div className="absolute inset-y-0 right-2 sm:right-3 md:right-4 flex items-center justify-center h-full z-10 py-2 sm:py-3">
        <img
          alt={activeManga.title}
          className="h-[85%] sm:h-[90%] md:h-[93%] aspect-[2/3] object-cover rounded-lg sm:rounded-xl shadow-[0_12px_40px_rgba(0,0,0,0.5)] border border-white/10 group-hover:scale-105 transition-transform duration-500"
          src={imgUrl(activeManga.coverUrl)}
          loading="eager"
          fetchpriority="high"
        />
      </div>

    </section>

    {/* Dots — di luar carousel, tengah bawah */}
    <div className="flex justify-center gap-2">
      {trending.map((_, idx) => (
        <button
          key={idx}
          onClick={() => setCurrent(idx)}
          className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
            idx === current ? 'w-6 bg-primary' : 'w-1.5 bg-white/30 hover:bg-white/50'
          }`}
        />
      ))}
    </div>
    </div>
  );
}
