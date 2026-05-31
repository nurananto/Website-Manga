import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowRight, ArrowUp, Coins, Clock, BookOpen } from 'lucide-react';
import { ReaderPageSkeleton } from './Skeleton';
import { imgUrl } from '../utils';

function CountdownLarge({ unlockDate }) {
  const [time, setTime] = useState({ h: 0, m: 0, s: 0 });

  useEffect(() => {
    const update = () => {
      const diff = new Date(unlockDate).getTime() - Date.now();
      if (diff <= 0) { setTime({ h: 0, m: 0, s: 0 }); return; }
      const totalSec = Math.floor(diff / 1000);
      setTime({
        h: Math.floor(totalSec / 3600),
        m: Math.floor((totalSec % 3600) / 60),
        s: totalSec % 60,
      });
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [unlockDate]);

  const pad = (n) => String(n).padStart(2, '0');

  return (
    <div className="flex items-end gap-2 justify-center">
      {[{ v: time.h, l: 'JAM' }, { v: time.m, l: 'MENIT' }, { v: time.s, l: 'DETIK' }].reduce((acc, { v, l }, i) => {
        const cell = (
          <div key={l} className="flex flex-col items-center">
            <span className="font-mono text-4xl sm:text-5xl md:text-6xl font-black text-on-surface tabular-nums leading-none">{pad(v)}</span>
            <span className="font-label-sm text-[10px] sm:text-xs md:text-sm text-outline/60 font-bold uppercase tracking-widest mt-1">{l}</span>
          </div>
        );
        if (i === 0) return [cell];
        return [...acc, <span key={`sep${i}`} className="font-mono text-3xl font-black text-outline/40 pb-5">:</span>, cell];
      }, [])}
    </div>
  );
}

function PageImage({ src, idx, pageRefs }) {
  const [loaded, setLoaded] = useState(false);

  return (
    <div
      ref={el => { pageRefs.current[idx] = el; }}
      className="w-full relative"
      style={{ minHeight: loaded ? 'auto' : '85vh' }}
    >
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#0d0f11]">
          <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      )}
      <img
        alt={`Page ${idx + 1}`}
        loading="lazy"
        decoding="async"
        className={`w-full h-auto block transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
        src={src}
        onLoad={() => setLoaded(true)}
      />
    </div>
  );
}

export default function ReaderModal({ chapter, manga, onClose, onReadChapter }) {
  // null = tutup, 'top' = dibuka dari navbar atas, 'bottom' = dari navbar bawah
  const [openChapterList, setOpenChapterList] = useState(null);
  const [dropdownAnchor, setDropdownAnchor] = useState(null); // pixel position dari getBoundingClientRect
  const [showLastChapterModal, setShowLastChapterModal] = useState(false);
  const [showLockedModal, setShowLockedModal] = useState(false);
  const [lockedNext, setLockedNext] = useState(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [barExpanded, setBarExpanded] = useState(false);
  const scrollRef = useRef(null);
  const pageRefs = useRef([]);
  const activeChapterIdRef = useRef(null); // guard agar onSuccess tidak fire untuk chapter lama

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  // Kirim view ke Worker — hanya 1x per chapter (localStorage sebagai guard)
  useEffect(() => {
    if (!chapter?.id) return;
    const key = `viewed_${chapter.id}`;
    if (localStorage.getItem(key)) return; // sudah pernah buka
    localStorage.setItem(key, '1');
    const workerUrl = import.meta.env.VITE_WORKER_URL;
    if (workerUrl) {
      fetch(`${workerUrl}/api/view/${chapter.id}`, { method: 'POST' }).catch(() => {});
    }
  }, [chapter?.id]);

  const chapters = manga?.chapters || [];
  const currentIdx = chapters.findIndex(ch => ch.id === chapter?.id);
  const prevChapter = chapters[currentIdx + 1] ?? null; // lebih lama
  const nextChapter = chapters[currentIdx - 1] ?? null; // lebih baru

  const isOneshot = chapters.length === 1 || manga?.status === 'Oneshot';
  const isAtOldest = !prevChapter; // sudah di chapter pertama/terlama
  const isAtNewest = !nextChapter; // sudah di chapter terbaru

  // Next di-disable saat: chapter terbaru + (Tamat / Hiatus / Oneshot)
  const nextDisabled = isAtNewest && (
    manga?.status === 'Tamat' ||
    manga?.status === 'Hiatus' ||
    isOneshot
  );
  // Prev di-disable saat: sudah di chapter paling lama / oneshot
  const prevDisabled = isAtOldest || isOneshot;

  const workerUrl = import.meta.env.VITE_WORKER_URL || '';
  const [pages, setPages] = useState([]);
  const [pageCount, setPageCount] = useState(0);
  const nextPageRef = useRef(1);

  const makeUrl = (idx) => {
    const num = String(idx).padStart(2, '0');
    return `${workerUrl}/images/manga/${manga?.id}/${chapter?.chapter_number}/Image${num}.webp`;
  };

  // pages wajib — generate semua URL sekaligus, tidak ada 404
  useEffect(() => {
    if (!chapter?.id || !manga?.id || !chapter.pages) return;
    activeChapterIdRef.current = chapter.id;
    pageRefs.current = [];
    const all = Array.from({ length: chapter.pages }, (_, i) => makeUrl(i + 1));
    nextPageRef.current = chapter.pages + 1;
    setPages(all);
    setPageCount(chapter.pages);
  }, [chapter?.id]);

  // Reset scroll + currentPage saat chapter berganti
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: 'instant' });
    setCurrentPage(0);
    pageRefs.current = [];
  }, [chapter?.id]);

  // Scroll event: update currentPage dari ratio scroll
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handleScroll = () => {
      const max = el.scrollHeight - el.clientHeight;
      if (max <= 0) return;
      const ratio = el.scrollTop / max;
      const page = Math.min(pageCount - 1, Math.floor(ratio * pageCount));
      setCurrentPage(page);
    };
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, [pageCount]);

  useEffect(() => {
    const handleClose = (e) => {
      // Tutup dropdown kalau klik/tap di luar area chapter selector
      // Cek apakah target ada di dalam elemen yang punya data-chapter-selector
      const inside = e.target.closest('[data-chapter-selector]');
      if (!inside) setOpenChapterList(null);
    };
    document.addEventListener('mousedown', handleClose);
    document.addEventListener('touchstart', handleClose);
    return () => {
      document.removeEventListener('mousedown', handleClose);
      document.removeEventListener('touchstart', handleClose);
    };
  }, []);

  const handleNext = () => {
    if (nextDisabled) return;
    // Ongoing di chapter terbaru → tampil modal info
    if (isAtNewest && manga?.status === 'Ongoing') {
      setShowLastChapterModal(true);
      return;
    }
    if (!nextChapter) return;
    const isTimeUnlocked = nextChapter.unlockDate && new Date(nextChapter.unlockDate).getTime() <= Date.now();
    if (nextChapter.isLocked && !isTimeUnlocked) {
      setLockedNext(nextChapter);
      setShowLockedModal(true);
      return;
    }
    onReadChapter(nextChapter, manga.title);
  };

  const handlePrev = () => {
    if (prevDisabled) return;
    onReadChapter(prevChapter, manga.title);
  };

  if (!chapter) return null;

  const NavBar = ({ position }) => (
    <div className={`flex items-center gap-2 w-full px-2 py-2 bg-surface-container-lowest/90 backdrop-blur-md border-white/20 ${
      position === 'top' ? 'border-b' : 'border-t pb-safe-4'
    }`}>
      {/* Previous */}
      <button
        onClick={handlePrev}
        disabled={prevDisabled}
        className="flex-1 h-9 sm:h-10 md:h-11 rounded-xl bg-surface-container hover:bg-surface-container-high border border-white/5 flex items-center justify-center gap-2 text-xs sm:text-sm md:text-base font-bold text-on-surface disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 transition-all cursor-pointer"
      >
        <ArrowLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        <span className="hidden sm:inline">Prev</span>
      </button>

      {/* Chapter Selector */}
      <div data-chapter-selector className="relative flex-[2]">
        <button
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            setDropdownAnchor(position === 'top'
              ? { top: rect.bottom + 6 }
              : { bottom: window.innerHeight - rect.top + 6 }
            );
            setOpenChapterList(v => v === position ? null : position);
          }}
          className="w-full h-9 sm:h-10 md:h-11 rounded-xl bg-surface-container hover:bg-surface-container-high border border-white/5 flex items-center justify-center gap-2 px-2 sm:px-3 text-xs sm:text-xs md:text-sm font-bold text-on-surface active:scale-95 transition-all cursor-pointer truncate"
        >
          <BookOpen className="w-3.5 h-3.5 text-primary shrink-0" />
          <span className="truncate">{chapter.title.split(':')[0]}</span>
        </button>
      </div>

      {/* Next */}
      <button
        onClick={handleNext}
        disabled={nextDisabled}
        className="flex-1 h-9 sm:h-10 md:h-11 rounded-xl bg-primary hover:bg-primary/90 flex items-center justify-center gap-2 text-xs sm:text-sm md:text-base font-bold text-on-primary disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 transition-all cursor-pointer"
      >
        <span className="hidden sm:inline">Next</span>
        <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[200] bg-[#090b0d] flex flex-col font-body-md"
      >
        {/* Webtoon Canvas — seluruh konten ikut scroll termasuk top bar */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto bg-[#090b0d] flex flex-col items-center hide-scrollbar">
          <div className="w-full">

            {/* Tombol kembali — atas, squircle */}
            <div className="px-2 py-2">
              <button
                onClick={onClose}
                className="relative w-full h-12 sm:h-14 md:h-16 px-3 sm:px-4 rounded-2xl border border-white/15 flex items-center gap-3 active:scale-[0.99] cursor-pointer overflow-hidden"
              >
                {/* Blurred cover background */}
                {manga?.coverUrl && (
                  <>
                    <img src={imgUrl(manga?.coverUrl)} alt="" aria-hidden
                      className="absolute inset-0 w-full h-full object-cover scale-110 blur-xl opacity-40 pointer-events-none"
                    />
                    <div className="absolute inset-0 bg-surface-container/60 pointer-events-none" />
                  </>
                )}
                <ArrowLeft className="relative w-5 h-5 text-primary shrink-0" />
                <div className="relative min-w-0 flex-1 text-left">
                  <p className="font-label-sm text-xs sm:text-xs md:text-sm font-bold text-primary uppercase tracking-wider truncate">{manga?.title}</p>
                  <h2 className="font-body-md text-sm sm:text-sm md:text-base font-extrabold text-on-surface truncate">{chapter.title}</h2>
                </div>
                {manga?.coverUrl && (
                  <div className="relative h-full py-1.5 flex items-center shrink-0">
                    <img
                      src={imgUrl(manga?.coverUrl)}
                      alt=""
                      className="h-full aspect-[2/3] object-cover rounded-lg shadow-[0_8px_24px_rgba(0,0,0,0.6)] border border-white/10"
                    />
                  </div>
                )}
              </button>
            </div>

            {/* Navigasi atas */}
            <NavBar position="top" />

            {/* Pemisah navigasi dan gambar pertama */}
            <div className="h-px bg-white/20" />

            <div className="w-full lg:max-w-[720px] lg:mx-auto">
              {pages.map((p, idx) => (
                <PageImage
                  key={idx}
                  src={p}
                  idx={idx}
                  pageRefs={pageRefs}
                />
              ))}
            </div>

            {/* Navigasi bawah — di bawah gambar terakhir */}
            <NavBar position="bottom" />

            {/* Tombol kembali — bawah, squircle */}
            <div className="px-2 py-2 pb-8">
              <button
                onClick={onClose}
                className="relative w-full h-12 sm:h-14 md:h-16 px-3 sm:px-4 rounded-2xl border border-white/15 flex items-center gap-3 active:scale-[0.99] cursor-pointer overflow-hidden"
              >
                {/* Blurred cover background */}
                {manga?.coverUrl && (
                  <>
                    <img src={imgUrl(manga?.coverUrl)} alt="" aria-hidden
                      className="absolute inset-0 w-full h-full object-cover scale-110 blur-xl opacity-40 pointer-events-none"
                    />
                    <div className="absolute inset-0 bg-surface-container/60 pointer-events-none" />
                  </>
                )}
                <ArrowLeft className="relative w-5 h-5 text-primary shrink-0" />
                <div className="relative min-w-0 flex-1 text-left">
                  <p className="font-label-sm text-xs sm:text-xs md:text-sm font-bold text-primary uppercase tracking-wider truncate">{manga?.title}</p>
                  <h2 className="font-body-md text-sm sm:text-sm md:text-base font-extrabold text-on-surface truncate">{chapter.title}</h2>
                </div>
                {manga?.coverUrl && (
                  <div className="relative h-full py-1.5 flex items-center shrink-0">
                    <img
                      src={imgUrl(manga?.coverUrl)}
                      alt=""
                      className="h-full aspect-[2/3] object-cover rounded-lg shadow-[0_8px_24px_rgba(0,0,0,0.6)] border border-white/10"
                    />
                  </div>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Progress Bar — thin default, expand on hover/tap */}
        <div
          className="fixed bottom-0 left-0 right-0 z-[202] pb-safe cursor-pointer"
          onMouseEnter={() => setBarExpanded(true)}
          onMouseLeave={() => setBarExpanded(false)}
          onClick={() => setBarExpanded(v => !v)}
        >
          {/* Expanded: pill segments + bubble halaman */}
          <div
            className={`overflow-hidden transition-all duration-200 bg-black/80 backdrop-blur-sm flex items-center gap-2 px-3 ${barExpanded ? 'h-9' : 'h-0'}`}
          >
            <span className="font-label-sm text-xs md:text-sm font-bold text-white/50 shrink-0 w-5 text-right tabular-nums">
              {currentPage + 1}
            </span>
            <div className="flex-1 flex items-center gap-[3px] relative">
              {Array.from({ length: pageCount }).map((_, i) => (
                <div key={i} className="flex-1 relative group/seg">
                  {/* Bubble nomor halaman */}
                  <div className={`absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2
                    font-label-sm text-[10px] font-black px-1.5 py-0.5 rounded-md pointer-events-none
                    opacity-0 group-hover/seg:opacity-100 transition-opacity duration-100 whitespace-nowrap
                    ${i <= currentPage
                      ? 'bg-primary text-on-primary'
                      : 'bg-white/20 text-white/70'
                    }`}>
                    {i + 1}
                  </div>
                  {/* Pill */}
                  <button
                    onClick={() => pageRefs.current[i]?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                    className={`w-full h-[6px] rounded-full transition-colors duration-150 cursor-pointer ${
                      i <= currentPage ? 'bg-primary' : 'bg-white/25 hover:bg-white/50'
                    }`}
                  />
                </div>
              ))}
            </div>
            <span className="font-label-sm text-xs md:text-sm font-bold text-white/50 shrink-0 w-5 tabular-nums">
              {pageCount}
            </span>
          </div>

          {/* Minimized: garis tipis */}
          <div className="h-[3px] bg-white/10 w-full">
            <div
              className="h-full bg-primary transition-all duration-300 rounded-r-full"
              style={{ width: `${pageCount > 1 ? (currentPage / (pageCount - 1)) * 100 : 100}%` }}
            />
          </div>
        </div>

        {/* Tombol scroll-to-top — fixed di dalam z-[200] reader */}
        <button
          onClick={() => scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed z-[201] w-11 h-11 rounded-l-2xl rounded-r-none bg-black/20 hover:bg-black/60 active:bg-black/80 border border-r-0 border-white/10 hover:border-white/30 flex items-center justify-center text-white/30 hover:text-white active:text-white transition-all duration-200 cursor-pointer active:scale-95 backdrop-blur-sm"
          style={{ top: '70%', right: 0 }}
          aria-label="Scroll ke atas"
        >
          <ArrowUp className="w-5 h-5" />
        </button>

        {/* Modal: Chapter Terakhir */}
        <AnimatePresence>
          {showLastChapterModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
              onClick={() => setShowLastChapterModal(false)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                onClick={e => e.stopPropagation()}
                className="bg-surface-container border border-white/10 rounded-2xl p-6 max-w-sm w-full shadow-2xl flex flex-col gap-4 text-center"
              >
                <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                  <BookOpen className="w-7 h-7 text-primary" />
                </div>
                <div>
                  <h3 className="font-headline-md text-base sm:text-lg font-black text-on-surface">Kamu sudah sampai chapter terbaru!</h3>
                  <p className="font-headline-md text-base font-black text-on-surface mt-1">{manga?.title}</p>
                  <p className="font-body-md text-sm text-outline mt-0.5">{chapters[0]?.title}</p>
                  <p className="font-label-sm text-xs text-outline/60 mt-0.5">Diupload: {chapters[0]?.date}</p>
                  {manga?.nextUpdate && (
                    <p className="font-body-md text-sm text-on-surface/80 mt-3 bg-surface-container-high/50 rounded-lg px-3 py-2 border border-white/5">
                      Chapter selanjutnya akan diupdate setelah{' '}
                      <span className="text-primary font-bold">{manga.nextUpdate}</span>
                    </p>
                  )}
                </div>
                <button
                  onClick={() => setShowLastChapterModal(false)}
                  className="w-full h-11 rounded-xl bg-primary text-on-primary font-bold text-sm active:scale-95 transition-all cursor-pointer"
                >
                  Kembali Baca
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Dropdown chapter list — portal agar selalu di atas gambar */}
        {openChapterList && dropdownAnchor && createPortal(
          <AnimatePresence>
            <motion.div
              key="chapter-dropdown"
              data-chapter-selector
              initial={{ opacity: 0, y: openChapterList === 'top' ? -8 : 8, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: openChapterList === 'top' ? -8 : 8, scale: 0.97 }}
              transition={{ duration: 0.15 }}
              style={{ position: 'fixed', left: 8, right: 8, zIndex: 9999, ...dropdownAnchor }}
              className="bg-surface-container border border-white/10 rounded-xl shadow-2xl overflow-hidden"
            >
              <div className="overflow-y-auto hide-scrollbar" style={{ maxHeight: '40vh' }}>
                {chapters.map((ch) => {
                  const isActive = ch.id === chapter.id;
                  const isLocked = ch.isLocked && !(ch.unlockDate && new Date(ch.unlockDate).getTime() <= Date.now());
                  return (
                    <button
                      key={ch.id}
                      onClick={() => {
                        setOpenChapterList(null);
                        if (!isActive) onReadChapter(ch, manga.title);
                      }}
                      className={`w-full flex items-center justify-between px-4 py-3 text-left text-xs sm:text-xs md:text-sm font-semibold transition-colors cursor-pointer border-b border-white/5 last:border-0 ${
                        isActive
                          ? 'bg-primary/10 text-primary font-black'
                          : 'text-on-surface-variant hover:bg-white/5 hover:text-on-surface'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="truncate">{ch.title}</span>
                        {ch.isNew && (
                          <span className="shrink-0 font-label-sm bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-1 py-0.5 rounded text-[8px] font-extrabold uppercase">New</span>
                        )}
                      </div>
                      {isLocked && (
                        <span className="flex items-center gap-1 text-amber-400 shrink-0 ml-2">
                          <Coins className="w-3 h-3 fill-current" />
                          <span>5</span>
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </AnimatePresence>,
          document.body
        )}

        {/* Modal: Chapter Terkunci */}
        <AnimatePresence>
          {showLockedModal && lockedNext && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
              onClick={() => setShowLockedModal(false)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                onClick={e => e.stopPropagation()}
                className="bg-surface-container border border-white/10 rounded-2xl p-6 max-w-sm w-full shadow-2xl flex flex-col gap-5 text-center"
              >
                <div>
                  <p className="font-label-sm text-xs text-outline/70 uppercase tracking-widest font-bold mb-1">Chapter berikutnya</p>
                  <h3 className="font-headline-md text-base sm:text-lg md:text-xl font-black text-on-surface">{lockedNext.title}</h3>
                </div>

                {/* Countdown besar — update tiap detik */}
                <div className="flex flex-col items-center gap-2 bg-surface-container-high/40 rounded-xl py-5 px-4 border border-white/5">
                  <p className="font-label-sm text-xs sm:text-xs md:text-sm text-outline/60 font-bold uppercase tracking-wider">Gratis dalam</p>
                  <CountdownLarge unlockDate={lockedNext.unlockDate} />
                </div>

                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => {
                      setShowLockedModal(false);
                      onReadChapter(lockedNext, manga.title);
                    }}
                    className="w-full h-12 rounded-xl bg-gradient-to-r from-amber-400 to-amber-600 hover:from-amber-500 hover:to-amber-700 text-white font-black text-sm flex items-center justify-center gap-2 active:scale-95 transition-all cursor-pointer shadow-md border border-yellow-600/30"
                  >
                    <Coins className="w-4 h-4 fill-current" />
                    Beli dengan 5 Koin
                  </button>
                  <button
                    onClick={() => setShowLockedModal(false)}
                    className="w-full h-10 rounded-xl border border-white/10 text-xs font-bold text-outline hover:text-on-surface hover:bg-white/5 transition-all cursor-pointer"
                  >
                    Nanti saja
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  );
}
