import { useState, useEffect } from 'react';
import { imgUrl } from '../utils';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Play, Info } from 'lucide-react';

export default function FeaturedCarousel({ mangaList, onReadChapter, onViewManga }) {
  const trending = mangaList.filter((m) => m.isTrending) || [mangaList[0]];
  const [current, setCurrent] = useState(0);

  // Auto slide every 4 seconds (timer resets when current slide changes)
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrent((prev) => (prev + 1) % trending.length);
    }, 4000);
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

  return (
    <section className="relative w-full h-[240px] md:h-[280px] rounded-xl overflow-hidden group shadow-2xl border border-white/5 flex items-center justify-between">
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
            className="w-full h-full object-cover object-center scale-125 blur-3xl opacity-25"
            src={imgUrl(activeManga.coverUrl)}
          />
          {/* Vignette Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/60 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-surface via-surface/30 to-transparent" />
        </motion.div>
      </AnimatePresence>

      {/* Left Side: Content Overlay */}
      <div className="absolute inset-y-0 left-0 p-4 md:p-6 md:pl-8 flex flex-col justify-center gap-3 z-10 w-full sm:w-2/3 md:w-3/5">
        <div className="flex gap-2 items-center flex-wrap">
          <span className="bg-amber-500/20 text-amber-500 px-2.5 py-0.5 rounded-md font-label-sm text-[10px] md:text-xs uppercase tracking-wider backdrop-blur-md border border-amber-500/30 font-semibold shadow-sm">
            Trending Now
          </span>
          {activeManga.genres.slice(0, 2).map((g) => (
            <span key={g} className="bg-surface-variant/85 text-on-surface px-2.5 py-0.5 rounded-md font-label-sm text-[10px] md:text-xs uppercase tracking-wider backdrop-blur-md">
              {g}
            </span>
          ))}
          {activeManga.genres.length > 2 && (
            <span className="bg-white/5 text-outline px-2.5 py-0.5 rounded-md font-label-sm text-[10px] md:text-xs uppercase tracking-wider backdrop-blur-md font-semibold border border-white/5">
              +{activeManga.genres.length - 2} More
            </span>
          )}
        </div>

        <motion.h1
          key={`title-${activeManga.id}`}
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="font-display-lg text-xl sm:text-2xl md:text-3xl lg:text-4xl font-black text-on-surface text-shadow-md leading-tight"
        >
          {activeManga.title}
        </motion.h1>

        <motion.p
          key={`desc-${activeManga.id}`}
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="font-body-lg text-sm md:text-sm text-on-surface-variant/90 line-clamp-2 max-w-lg leading-relaxed"
        >
          {activeManga.description}
        </motion.p>

        <motion.div
          key={`btn-${activeManga.id}`}
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="flex items-center gap-3 mt-1"
        >
          <button
            onClick={() => onReadChapter(activeManga.chapters[0], activeManga.title)}
            className="flex items-center gap-2 bg-gradient-to-r from-sky-400 to-indigo-600 hover:from-sky-500 hover:to-indigo-700 text-white font-bold px-4 py-2 rounded-lg shadow-lg hover:shadow-indigo-500/20 hover:scale-105 active:scale-98 transition-all text-xs cursor-pointer"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            Read Now
          </button>
          <button
            onClick={() => onViewManga && onViewManga(activeManga)}
            className="flex items-center gap-2 bg-white/10 hover:bg-white/20 border border-white/10 text-white font-bold px-4 py-2 rounded-lg hover:scale-105 active:scale-98 transition-all text-xs cursor-pointer"
          >
            <Info className="w-3.5 h-3.5" />
            View Manga
          </button>
        </motion.div>
      </div>

      {/* Right Side: Cover Image */}
      <div className="absolute inset-y-0 right-2 hidden sm:flex items-center justify-center h-full z-10 py-2">
        <img
          alt={activeManga.title}
          className="h-full max-h-[93%] aspect-[2/3] object-cover rounded-lg shadow-[0_12px_40px_rgba(0,0,0,0.5)] border border-white/10 group-hover:scale-105 transition-transform duration-500"
          src={imgUrl(activeManga.coverUrl)}
        />
      </div>

      {/* Manual Navigation Controls */}
      <button
        onClick={handlePrev}
        className="absolute left-4 top-1/2 -translate-y-1/2 w-9 h-9 rounded-lg bg-surface/40 hover:bg-surface/80 border border-white/5 backdrop-blur-md flex items-center justify-center text-on-surface opacity-0 group-hover:opacity-100 transition-opacity z-20 cursor-pointer"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
      <button
        onClick={handleNext}
        className="absolute right-4 top-1/2 -translate-y-1/2 w-9 h-9 rounded-lg bg-surface/40 hover:bg-surface/80 border border-white/5 backdrop-blur-md flex items-center justify-center text-on-surface opacity-0 group-hover:opacity-100 transition-opacity z-20 cursor-pointer"
      >
        <ChevronRight className="w-4 h-4" />
      </button>

      {/* Carousel Indicators */}
      <div className="absolute bottom-3 left-4 md:left-8 flex gap-2 z-20">
        {trending.map((_, idx) => (
          <button
            key={idx}
            onClick={() => setCurrent(idx)}
            className={`h-1 rounded transition-all duration-300 cursor-pointer ${
              idx === current ? 'w-6 bg-primary shadow-glow' : 'w-1.5 bg-white/20 hover:bg-white/40'
            }`}
          />
        ))}
      </div>
    </section>
  );
}
