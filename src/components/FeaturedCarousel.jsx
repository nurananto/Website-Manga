import { useEffect, useMemo, useState, useRef } from 'react';
import { ChevronLeft, ChevronRight, Play, Info } from 'lucide-react';
import ResponsiveCover from './ResponsiveCover';
import CoverScrim from './CoverScrim';
import SolidButton from './SolidButton';
import { coverUrlForWidth } from '../utils';

// Badge genre di banner — base sama semua, cuma beda ukuran (mobile vs sm+
// penuh) dan gaya "+N" overflow. Dulu 6 blok JSX disalin manual, sekarang loop.
const GENRE_TAG_BASE = 'rounded-md font-label-sm uppercase backdrop-blur-md bg-[#2b2b2b]/85 text-white dark:bg-white/85 dark:text-black';

function GenreTag({ children, hiddenOnMobile = false }) {
  const sizeCls = hiddenOnMobile
    ? 'px-2.5 py-0.5 text-[10px] md:text-xs tracking-wider'
    : 'px-1.5 sm:px-2.5 py-0.5 text-[9px] sm:text-[10px] md:text-xs sm:tracking-wider';
  return (
    <span className={`${GENRE_TAG_BASE} ${sizeCls} ${hiddenOnMobile ? 'hidden sm:inline' : ''}`}>
      {children}
    </span>
  );
}

// "+N genre lainnya" — onlyMobile dipakai saat mobile cuma nampung 3 genre
// penuh (sisanya diringkas), bordered dipakai varian sm+ (setelah 4 genre penuh).
function GenreOverflowTag({ count, onlyMobile = false, bordered = false }) {
  const base = `${GENRE_TAG_BASE} font-semibold text-white/80 dark:text-black/70`;
  return onlyMobile ? (
    <span className={`${base} sm:hidden px-1.5 py-0.5 text-[9px]`}>+{count}</span>
  ) : (
    <span className={`${base} hidden sm:inline px-2.5 py-0.5 text-[10px] md:text-xs tracking-wider ${bordered ? 'border border-white/20 dark:border-black/20' : ''}`}>
      +{count}
    </span>
  );
}

export default function FeaturedCarousel({
  mangaList,
  trendingIds = [],
  onViewManga,
  onReadFirst,
  initialMangaId = null,
  onActiveMangaChange,
}) {
  const slides = useMemo(() => {
    const byId = new Map(mangaList.map((manga) => [manga.id, manga]));
    const ranked = trendingIds.map((id) => byId.get(id)).filter(Boolean);
    // Jangan campur ranking rolling 24 jam dengan total view sepanjang waktu.
    if (ranked.length) return ranked.slice(0, 5);
    // Sebelum API/cache siap, gunakan urutan katalog tanpa membaca isTrending
    // lifetime. Begitu respons datang, lima slot diganti ranking 24 jam.
    return mangaList.slice(0, 5);
  }, [mangaList, trendingIds]);
  const [activeMangaId, setActiveMangaId] = useState(() => initialMangaId || slides[0]?.id || null);
  const touchStartX = useRef(null);

  const matchedIndex = slides.findIndex((manga) => manga.id === activeMangaId);
  const current = matchedIndex >= 0 ? matchedIndex : 0;
  const activeManga = slides[current] || mangaList[0];
  const canNavigate = slides.length > 1;

  const selectIndex = (index) => {
    const manga = slides[index];
    if (manga) setActiveMangaId(manga.id);
  };

  useEffect(() => {
    if (!activeManga?.id) return;
    onActiveMangaChange?.(activeManga.id);
  }, [activeManga?.id, onActiveMangaChange]);

  // Hangatkan cover di kedua arah agar judul dan gambar berganti pada frame yang sama.
  useEffect(() => {
    if (!canNavigate || typeof window === 'undefined') return;
    const adjacent = [
      slides[(current - 1 + slides.length) % slides.length],
      slides[(current + 1) % slides.length],
    ];
    adjacent.forEach((manga) => {
      const url = coverUrlForWidth(manga, window.innerWidth);
      if (!url) return;
      const image = new Image();
      image.fetchPriority = 'low';
      image.src = url;
    });
  }, [canNavigate, current, slides]);

  const goPrev = () => {
    if (!canNavigate) return;
    selectIndex((current - 1 + slides.length) % slides.length);
  };
  const goNext = () => {
    if (!canNavigate) return;
    selectIndex((current + 1) % slides.length);
  };

  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e) => {
    if (touchStartX.current === null || slides.length <= 1) return;
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) {
      const next = diff > 0
        ? (current + 1) % slides.length
        : (current - 1 + slides.length) % slides.length;
      selectIndex(next);
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
          className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl border border-outline-variant bg-surface-container hover:bg-surface-container-high text-on-surface disabled:opacity-35 disabled:cursor-not-allowed flex items-center justify-center active:scale-95 transition-all cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>
        <div className="min-w-10 h-9 sm:h-10 px-2 rounded-xl border border-outline-variant bg-surface-container text-on-surface flex items-center justify-center font-label-sm text-xs sm:text-sm font-black tabular-nums">
          {current + 1} | {Math.max(slides.length, 1)}
        </div>
        <button
          type="button"
          onClick={goNext}
          disabled={!canNavigate}
          aria-label="Berikutnya"
          className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl border border-outline-variant bg-surface-container hover:bg-surface-container-high text-on-surface disabled:opacity-35 disabled:cursor-not-allowed flex items-center justify-center active:scale-95 transition-all cursor-pointer"
        >
          <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>
      </div>
    </div>
    <section
      className="relative w-full h-[165px] sm:h-[190px] md:h-[218px] lg:h-[245px] rounded-xl overflow-hidden group shadow-2xl border border-primary/45 flex items-center justify-between"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div key={activeManga.id} className="absolute inset-0 w-full h-full bg-surface-container-high animate-[featuredSlideIn_0.45s_cubic-bezier(0.22,1,0.36,1)]">
          {/* Background Image with dark overlays */}
          <ResponsiveCover
            manga={activeManga}
            alt=""
            loading="eager"
            fetchPriority="auto"
            decoding="async"
            className="w-full h-full object-cover object-top"
          />
          <CoverScrim variant="hero" />
      </div>

      {/* Left Side: Content Overlay — justify-between agar badges di atas, button di bawah */}
      {/* pr pixel tetap agar gap ke cover konsisten di semua lebar viewport. Nilai
          dihitung dari lebar cover aktual (aspect-[7/10] × tinggi efektifnya, lihat
          h-[96%] dst di bawah) + ~10-20px jarak — ikut disesuaikan tiap cover
          diperbesar/diperkecil supaya gap tidak kelewat lega atau kepotong. */}
      <div className="absolute inset-0 left-0 py-1.5 pl-3 pr-32 sm:py-2 sm:pl-5 sm:pr-36 md:py-2.5 md:pl-7 md:pr-40 lg:py-3 lg:pl-9 lg:pr-48 flex flex-col justify-center z-10">

        {/* Satu blok konten, di-center secara vertikal */}
        <div className="flex flex-col gap-1.5 sm:gap-2 md:gap-2.5">
          {/* Badges — genre[0..2] tampil semua breakpoint, genre[3] cuma sm+,
              sisanya diringkas jadi "+N" (angkanya beda antara mobile & sm+
              karena mobile cuma sanggup nampung 3 genre penuh). */}
          <div className="flex gap-1 sm:gap-2 items-center flex-wrap">
            {activeManga.genres.slice(0, 3).map((genre) => (
              <GenreTag key={genre}>{genre}</GenreTag>
            ))}
            {activeManga.genres[3] && (
              <GenreTag hiddenOnMobile>{activeManga.genres[3]}</GenreTag>
            )}
            {activeManga.genres.length > 3 && (
              <GenreOverflowTag onlyMobile count={activeManga.genres.length - 3} />
            )}
            {activeManga.genres.length > 4 && (
              <GenreOverflowTag bordered count={activeManga.genres.length - 4} />
            )}
          </div>

          {/* Title */}
          <h1
            key={`title-${activeManga.id}`}
            className="min-w-0 font-display-lg text-xl sm:text-2xl md:text-3xl lg:text-4xl font-black text-on-surface dark:text-white dark:[text-shadow:0_1px_3px_rgba(0,0,0,0.9),0_2px_12px_rgba(0,0,0,0.75)] leading-tight truncate animate-[slideUpFade_0.3s_ease-out]"
          >
            {activeManga.title}
          </h1>

          {/* Description */}
          <p
            key={`desc-${activeManga.id}`}
            className="line-clamp-2 sm:line-clamp-3 font-body-lg text-xs sm:text-sm md:text-base lg:text-lg text-on-surface-variant dark:text-white/90 dark:[text-shadow:0_1px_2px_rgba(0,0,0,0.9),0_1px_8px_rgba(0,0,0,0.7)] leading-relaxed text-justify animate-[slideUpFade_0.34s_ease-out]"
          >
            {activeManga.description}
          </p>

          {/* Buttons */}
          <div
            key={`btn-${activeManga.id}`}
            className="flex items-center gap-2 sm:gap-3 mt-1 sm:mt-2 animate-[slideUpFade_0.38s_ease-out]"
          >
            <SolidButton variant="light" onClick={() => onReadFirst(activeManga.id)}>
              <Play className="w-3 h-3 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4 fill-current" />
              Baca dari Awal
            </SolidButton>
            <SolidButton variant="dark" onClick={() => onViewManga && onViewManga(activeManga)}>
              <Info className="w-3 h-3 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4" />
              Lihat Detail
            </SolidButton>
          </div>
        </div>
      </div>

      {/* Right Side: Cover Image */}
      {/* Mobile: lebih besar (h-[96%]), tablet: h-[97%], desktop: h-[98%] — mepet
          ke tepi atas/bawah kontainernya sendiri (wrapper py-2/py-3 di bawah). */}
      <div key={`featured-cover-${activeManga.id}`} className="absolute inset-y-0 right-2 sm:right-3 md:right-4 flex items-center justify-center h-full z-10 py-2 sm:py-3">
        <ResponsiveCover
          manga={activeManga}
          alt={activeManga.title}
          // aspect-[7/10] (~0.70), bukan 2/3 (0.667) — rata-rata rasio cover
          // manga asli di situs ini ~0.70 (diukur langsung dari 31 file cover).
          // h tetap proporsional karena lebar ikut aspect-ratio, bukan fixed —
          // pr text block di atas ikut disesuaikan supaya gap ke cover wajar.
          className="h-[96%] sm:h-[97%] md:h-[98%] aspect-[7/10] object-cover rounded-lg sm:rounded-xl shadow-[0_4px_14px_rgba(0,0,0,0.14)] dark:shadow-[0_12px_40px_rgba(0,0,0,0.5)] border border-black/10 dark:border-white/10 group-hover:scale-105 transition-all duration-500 animate-[featuredCoverIn_0.45s_cubic-bezier(0.22,1,0.36,1)]"
          loading="eager"
          fetchPriority="auto"
          decoding="async"
        />
      </div>

    </section>

    </div>
  );
}
