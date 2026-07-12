import { useState, useRef } from 'react';
import { imgUrl } from '../utils';
import { ChevronLeft, ChevronRight, Play, Info } from 'lucide-react';

export default function FeaturedCarousel({ mangaList, onViewManga, onReadFirst }) {
  const trending = mangaList.filter((m) => m.isTrending);
  const slides = trending.length ? trending : mangaList.slice(0, 5);
  const [current, setCurrent] = useState(0);
  const touchStartX = useRef(null);

  const activeManga = slides[current] || mangaList[0];
  const canNavigate = slides.length > 1;
  const goPrev = () => {
    if (!canNavigate) return;
    setCurrent((prev) => (prev - 1 + slides.length) % slides.length);
  };
  const goNext = () => {
    if (!canNavigate) return;
    setCurrent((prev) => (prev + 1) % slides.length);
  };

  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e) => {
    if (touchStartX.current === null || slides.length <= 1) return;
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) {
      diff > 0
        ? setCurrent((prev) => (prev + 1) % slides.length)
        : setCurrent((prev) => (prev - 1 + slides.length) % slides.length);
    }
    touchStartX.current = null;
  };

  return (
    <div className="flex flex-col gap-3">
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <span className="h-7 w-1 rounded-full bg-primary shrink-0" aria-hidden="true" />
        <h2 className="font-headline-md text-xl sm:text-2xl font-black text-on-surface truncate">
          Populer hari ini
        </h2>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={goPrev}
          disabled={!canNavigate}
          aria-label="Sebelumnya"
          className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl border border-white/10 bg-surface-container hover:bg-surface-container-high text-on-surface disabled:opacity-35 disabled:cursor-not-allowed flex items-center justify-center active:scale-95 transition-all cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>
        <div className="min-w-10 h-9 sm:h-10 px-2 rounded-xl border border-white/10 bg-surface-container text-on-surface flex items-center justify-center font-label-sm text-xs sm:text-sm font-black tabular-nums">
          {current + 1} | {Math.max(slides.length, 1)}
        </div>
        <button
          type="button"
          onClick={goNext}
          disabled={!canNavigate}
          aria-label="Berikutnya"
          className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl border border-white/10 bg-surface-container hover:bg-surface-container-high text-on-surface disabled:opacity-35 disabled:cursor-not-allowed flex items-center justify-center active:scale-95 transition-all cursor-pointer"
        >
          <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>
      </div>
    </div>
    <section
      className="relative w-full h-[220px] sm:h-[260px] md:h-[300px] lg:h-[340px] rounded-xl overflow-hidden group shadow-2xl border border-brand-pulse flex items-center justify-between"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div key={activeManga.id} className="absolute inset-0 w-full h-full animate-[featuredSlideIn_0.45s_cubic-bezier(0.22,1,0.36,1)]">
          {/* Background Image with dark overlays */}
          <img
            alt=""
            className="w-full h-full object-cover object-top"
            src={imgUrl(activeManga.coverUrls?.mobile || activeManga.coverUrl)}
          />
          {/* Vignette Overlay */}
          <div className="absolute inset-0 bg-black/45" />
          <div className="absolute inset-0 bg-gradient-to-t from-surface/95 via-surface/55 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-surface/90 via-surface/44 to-transparent" />
      </div>

      {/* Left Side: Content Overlay — justify-between agar badges di atas, button di bawah */}
      {/* pr pixel tetap agar gap ke cover konsisten di semua lebar viewport */}
      <div className="absolute inset-0 left-0 py-2 pl-3 pr-36 sm:py-3 sm:pl-5 sm:pr-44 md:py-3 md:pl-7 md:pr-52 lg:py-4 lg:pl-9 lg:pr-60 flex flex-col justify-center z-10">

        {/* Satu blok konten, di-center secara vertikal */}
        <div className="flex flex-col gap-1.5 sm:gap-2 md:gap-2.5">
          {/* Badges */}
          <div className="flex gap-1.5 sm:gap-2 items-center flex-wrap">
            {/* genre 1: selalu tampil (termasuk mobile) */}
            {activeManga.genres[0] && (
              <span className="bg-surface-variant/85 text-on-surface px-2 sm:px-2.5 py-0.5 rounded-md font-label-sm text-[9px] sm:text-[10px] md:text-xs uppercase tracking-wider backdrop-blur-md">
                {activeManga.genres[0]}
              </span>
            )}
            {/* genre 2: tampil juga di mobile */}
            {activeManga.genres[1] && (
              <span className="bg-surface-variant/85 text-on-surface px-2 sm:px-2.5 py-0.5 rounded-md font-label-sm text-[9px] sm:text-[10px] md:text-xs uppercase tracking-wider backdrop-blur-md">
                {activeManga.genres[1]}
              </span>
            )}
            {/* genre ke-3: tablet ke atas */}
            {activeManga.genres[2] && (
              <span className="hidden sm:inline bg-surface-variant/85 text-on-surface px-2.5 py-0.5 rounded-md font-label-sm text-[10px] md:text-xs uppercase tracking-wider backdrop-blur-md">
                {activeManga.genres[2]}
              </span>
            )}
            {/* genre ke-4: desktop */}
            {activeManga.genres[3] && (
              <span className="hidden lg:inline bg-surface-variant/85 text-on-surface px-2.5 py-0.5 rounded-md font-label-sm text-xs uppercase tracking-wider backdrop-blur-md">
                {activeManga.genres[3]}
              </span>
            )}
            {/* overflow "+N" */}
            {activeManga.genres.length > 2 && (
              <span className="sm:hidden bg-black/40 text-white/80 px-2 py-0.5 rounded-md font-label-sm text-[9px] uppercase tracking-wider backdrop-blur-md font-semibold border border-white/20">
                +{activeManga.genres.length - 2}
              </span>
            )}
            {activeManga.genres.length > 3 && (
              <span className="hidden sm:inline lg:hidden bg-black/40 text-white/80 px-2.5 py-0.5 rounded-md font-label-sm text-[10px] md:text-xs uppercase tracking-wider backdrop-blur-md font-semibold border border-white/20">
                +{activeManga.genres.length - 3}
              </span>
            )}
            {activeManga.genres.length > 4 && (
              <span className="hidden lg:inline bg-black/40 text-white/80 px-2.5 py-0.5 rounded-md font-label-sm text-xs uppercase tracking-wider backdrop-blur-md font-semibold border border-white/20">
                +{activeManga.genres.length - 4}
              </span>
            )}
          </div>

          {/* Title */}
          <h1
            key={`title-${activeManga.id}`}
            className="min-w-0 font-display-lg text-xl sm:text-2xl md:text-3xl lg:text-4xl font-black text-on-surface text-shadow-md leading-tight truncate animate-[slideUpFade_0.3s_ease-out]"
          >
            {activeManga.title}
          </h1>

          {/* Description */}
          <p
            key={`desc-${activeManga.id}`}
            className="line-clamp-3 sm:line-clamp-3 md:line-clamp-4 lg:line-clamp-4 font-body-lg text-xs sm:text-sm md:text-base lg:text-lg text-on-surface-variant leading-relaxed text-justify animate-[slideUpFade_0.34s_ease-out]"
          >
            {activeManga.description}
          </p>

          {/* Buttons */}
          <div
            key={`btn-${activeManga.id}`}
            className="flex items-center gap-2 sm:gap-3 mt-1 sm:mt-2 animate-[slideUpFade_0.38s_ease-out]"
          >
            <button
              onClick={() => onReadFirst(activeManga.id)}
              className="flex items-center gap-1.5 sm:gap-2 bg-white hover:bg-white/90 text-black font-bold px-3 sm:px-4 md:px-5 py-1.5 sm:py-2 md:py-2.5 rounded-lg md:rounded-xl shadow-md active:scale-[0.98] transition-all text-[10px] sm:text-xs md:text-sm lg:text-base cursor-pointer"
            >
              <Play className="w-3 h-3 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4 fill-current" />
              Read
            </button>
            <button
              onClick={() => onViewManga && onViewManga(activeManga)}
              className="flex items-center gap-1.5 sm:gap-2 bg-surface-container-high hover:bg-surface-container-highest border border-white/10 text-white font-bold px-3 sm:px-4 md:px-5 py-1.5 sm:py-2 md:py-2.5 rounded-lg md:rounded-xl shadow-md active:scale-[0.98] transition-all text-[10px] sm:text-xs md:text-sm lg:text-base cursor-pointer"
            >
              <Info className="w-3 h-3 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4" />
              View
            </button>
          </div>
        </div>
      </div>

      {/* Right Side: Cover Image */}
      {/* Mobile: lebih besar (h-[85%]), tablet: h-[90%], desktop: h-[93%] */}
      <div className="absolute inset-y-0 right-2 sm:right-3 md:right-4 flex items-center justify-center h-full z-10 py-2 sm:py-3">
        <img
          alt={activeManga.title}
          className="h-[85%] sm:h-[90%] md:h-[93%] aspect-[2/3] object-cover rounded-lg sm:rounded-xl shadow-[0_12px_40px_rgba(0,0,0,0.5)] border border-white/10 group-hover:scale-105 transition-transform duration-500 animate-[featuredCoverIn_0.45s_cubic-bezier(0.22,1,0.36,1)]"
          src={imgUrl(activeManga.coverUrl)}
          loading="eager"
          fetchpriority="high"
        />
      </div>

    </section>

    </div>
  );
}
