import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowRight, ArrowUp, Lock, Clock, BookOpen, Coins } from 'lucide-react';
import CountdownTimer from './CountdownTimer';
import { ReaderPageSkeleton } from './Skeleton';
import { imgUrl } from '../utils';
import { getAccessToken } from '../lib/auth';

// Info jadwal rilis chapter berikutnya: countdown kalau tanggal, teks kalau bukan,
// pesan hijau "segera rilis" kalau tidak ada jadwal atau waktunya sudah lewat.
function NextUpdateInfo({ value }) {
  const [now, setNow] = useState(Date.now());
  const hasValue = value != null && String(value).trim() !== '';
  const t = hasValue ? new Date(value).getTime() : NaN;
  const isDate = hasValue && !isNaN(t);
  useEffect(() => {
    if (!isDate) return;
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, [isDate, t]);

  const soonBox = (
    <p className="font-body-md text-xs sm:text-sm text-on-surface/80 mt-3 bg-emerald-500/10 rounded-lg px-3 py-2 border border-emerald-500/20">
      <span className="text-emerald-400 font-bold">Chapter baru segera rilis!</span> Pantau terus ya 🔥
    </p>
  );

  // Tidak ada jadwal → pesan default (pembeda)
  if (!hasValue) return soonBox;

  // Ada isi tapi bukan tanggal → tampilkan teks apa adanya
  if (!isDate) {
    return (
      <p className="font-body-md text-xs sm:text-sm text-on-surface/80 mt-3 bg-surface-container-high/50 rounded-lg px-3 py-2 border border-white/5">
        Chapter berikutnya diupload sekitar <span className="text-primary font-bold">{value}</span>
      </p>
    );
  }

  const diff = t - now;
  if (diff <= 0) return soonBox;

  const totalMin = Math.floor(diff / 60_000);
  const d = Math.floor(totalMin / 1440);
  const h = Math.floor((totalMin % 1440) / 60);
  const m = totalMin % 60;
  const parts = [];
  if (d) parts.push(`${d} hari`);
  if (h) parts.push(`${h} jam`);
  if (!d && m) parts.push(`${m} menit`);

  return (
    <p className="font-body-md text-xs sm:text-sm text-on-surface/80 mt-3 bg-surface-container-high/50 rounded-lg px-3 py-2 border border-white/5">
      Chapter berikutnya rilis dalam <span className="text-primary font-bold">{parts.join(' ') || 'kurang dari 1 menit'}</span>
    </p>
  );
}

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

function PageImage({ src, idx, pageRefs, ready }) {
  const [loaded,     setLoaded]     = useState(false);
  const [failed,     setFailed]     = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [inView,     setInView]     = useState(idx < 3);
  const wrapRef = useRef(null);

  // IntersectionObserver untuk lazy pages
  useEffect(() => {
    if (inView) return;
    const el = wrapRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setInView(true); },
      { rootMargin: '300px' }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [inView]);

  // Reset saat src ganti (chapter/token baru)
  useEffect(() => {
    setLoaded(false);
    setFailed(false);
  }, [src]);

  const handleRetry = (e) => {
    e.stopPropagation();
    setFailed(false);
    setLoaded(false);
    setRetryCount(c => c + 1);
  };

  return (
    <div
      ref={el => { wrapRef.current = el; if (pageRefs) pageRefs.current[idx] = el; }}
      className="w-full relative"
      style={{ minHeight: loaded ? 'auto' : '85vh' }}
    >
      {!ready && inView && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0d0f11]">
          <span className="font-body-md text-sm text-outline/50">Memuat akses chapter...</span>
        </div>
      )}
      {ready && !loaded && !failed && inView && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0d0f11]">
          <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      )}
      {failed && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0d0f11] gap-3">
          <span className="font-body-md text-sm text-outline/50">Gagal memuat halaman {idx + 1}</span>
          <button
            onClick={handleRetry}
            className="font-label-sm text-xs font-bold px-5 py-2.5 rounded-xl bg-white/10 active:bg-white/25 text-white/70 active:text-white transition-colors cursor-pointer touch-manipulation select-none"
          >
            Coba lagi
          </button>
        </div>
      )}
      <img
        key={retryCount}
        alt={`Page ${idx + 1}`}
        loading={idx < 3 ? 'eager' : 'lazy'}
        decoding="async"
        fetchpriority={idx === 0 ? 'high' : 'auto'}
        className={`w-full h-auto block transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
        src={ready && inView ? src : undefined}
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
      />
    </div>
  );
}

export default function ReaderModal({ chapter, manga, onClose, onReadChapter, unlockedChapters, isLoggedIn, currentUser, onLoginClick }) {
  // Freeze last known values saat exit animation agar konten tidak hilang
  const frozenChapter = useRef(chapter);
  const frozenManga = useRef(manga);
  useEffect(() => { if (chapter) frozenChapter.current = chapter; }, [chapter]);
  useEffect(() => { if (manga) frozenManga.current = manga; }, [manga]);
  const activeChapter = chapter || frozenChapter.current;
  const activeManga = manga || frozenManga.current;

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

  // Helper: cek apakah chapter benar-benar locked (belum dibeli & belum free)
  const isChapterLocked = (ch) => {
    if (!ch?.unlockDate) return false;
    if (new Date(ch.unlockDate).getTime() <= Date.now()) return false;
    if (unlockedChapters?.has(ch.id)) return false;
    return true;
  };

  const isOneshot = chapters.length === 1 || activeManga?.status === 'Oneshot';
  const isAtOldest = !prevChapter; // sudah di chapter pertama/terlama
  const isAtNewest = !nextChapter; // sudah di chapter terbaru
  const normalizedStatus = String(manga?.status || '').toLowerCase();
  const configuredEndChapter = normalizedStatus === 'tamat'
    ? manga?.tamat_at_chapter
    : normalizedStatus === 'hiatus'
      ? manga?.hiatus_at_chapter
      : null;
  const isAtConfiguredEndChapter = configuredEndChapter != null
    && Number(activeChapter?.chapter_number) === Number(configuredEndChapter);
  const isFinishedSeries = normalizedStatus === 'tamat' || normalizedStatus === 'hiatus' || isOneshot;

  // Next di-disable saat: chapter terbaru + series selesai atau chapter akhir sesuai metadata.
  const nextDisabled = isAtNewest && (
    isFinishedSeries ||
    isAtConfiguredEndChapter
  );
  // Prev di-disable saat: sudah di chapter paling lama / oneshot
  const prevDisabled = isAtOldest || isOneshot;

  // Gambar gratis → CDN publik (R2, tanpa worker/token). Terkunci → worker + access token.
  const cdnBase   = (import.meta.env.VITE_CDN_URL || '').replace(/\/$/, '');
  const imageBase = (import.meta.env.VITE_IMAGE_URL || import.meta.env.VITE_WORKER_URL || '').replace(/\/$/, '');
  const [pages, setPages] = useState([]);
  const [pageCount, setPageCount] = useState(0);
  const [imgAccess, setImgAccess] = useState(null);
  const nextPageRef = useRef(1);

  // Chapter masih dalam masa lock (sudah dibeli, tapi image worker butuh access token)
  const chapterNeedsToken = !!chapter?.unlockDate && new Date(chapter.unlockDate).getTime() > Date.now();

  // Ambil access token untuk gambar chapter yang masih locked
  useEffect(() => {
    setImgAccess(null);
    if (!chapter?.id || !chapterNeedsToken) return;
    const workerUrl = import.meta.env.VITE_WORKER_URL || '';
    if (!workerUrl) return;
    (async () => {
      try {
        const tok = await getAccessToken();
        if (!tok) return;
        const res = await fetch(`${workerUrl}/api/user/chapter-token`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${tok}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ chapter_id: chapter.id }),
        });
        const d = await res.json();
        if (d.token) setImgAccess(d.token);
      } catch {}
    })();
  }, [chapter?.id]);

  // Gratis: CDN langsung siap. Terkunci: tunggu access token.
  const imageReady = chapterNeedsToken ? !!imgAccess : true;

  const makeUrl = (idx) => {
    const num = String(idx).padStart(2, '0');
    const path = `/manga/${manga?.id}/${chapter?.chapter_number}/Image${num}.webp`;
    if (chapterNeedsToken) {
      return `${imageBase}${path}${imgAccess ? `?access=${encodeURIComponent(imgAccess)}` : ''}`;
    }
    return `${cdnBase || imageBase}${path}`;
  };

  // Generate semua URL sekaligus.
  useEffect(() => {
    if (!chapter?.id || !manga?.id || !chapter.pages) return;
    activeChapterIdRef.current = chapter.id;
    pageRefs.current = [];
    const all = Array.from({ length: chapter.pages }, (_, i) => makeUrl(i + 1));
    nextPageRef.current = chapter.pages + 1;
    setPages(all);
    setPageCount(chapter.pages);
  }, [chapter?.id, imgAccess]);

  // Reset currentPage saat chapter berganti. Hanya scroll ke atas kalau TIDAK ada
  // posisi tersimpan — supaya "Lanjut Baca" tidak berkedip atas dulu.
  useEffect(() => {
    if (!chapter?.id) return;
    setCurrentPage(0);
    pageRefs.current = [];
    const saved = parseInt(localStorage.getItem(`reader_page_${chapter.id}`) || '');
    const hasResume = !isNaN(saved) && saved > 0 && saved < (chapter.pages ?? 0) - 1;
    if (!hasResume) scrollRef.current?.scrollTo({ top: 0, behavior: 'instant' });
  }, [chapter?.id]);

  // Restore posisi baca terakhir secepat mungkin setelah halaman dirender
  useEffect(() => {
    if (!chapter?.id || pages.length === 0) return;
    const saved = parseInt(localStorage.getItem(`reader_page_${chapter.id}`) || '');
    if (isNaN(saved) || saved <= 0 || saved >= pages.length - 1) return;
    let cancelled = false;
    const tryScroll = (attempts = 0) => {
      if (cancelled) return;
      const el = pageRefs.current[saved];
      if (el) {
        el.scrollIntoView({ behavior: 'instant', block: 'start' });
      } else if (attempts < 30) {
        requestAnimationFrame(() => tryScroll(attempts + 1));
      }
    };
    requestAnimationFrame(() => tryScroll());
    return () => { cancelled = true; };
  }, [pages]);

  // Scroll event: update currentPage + simpan page index
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handleScroll = () => {
      const max = el.scrollHeight - el.clientHeight;
      if (max <= 0) return;
      const ratio = el.scrollTop / max;
      const page = Math.min(pageCount - 1, Math.floor(ratio * pageCount));
      setCurrentPage(page);
      setOpenChapterList(null);
      if (activeChapter?.id) {
        localStorage.setItem(`reader_page_${activeChapter.id}`, page);
      }
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
    if (isAtNewest && normalizedStatus === 'ongoing' && !isAtConfiguredEndChapter) {
      setShowLastChapterModal(true);
      return;
    }
    if (!nextChapter) return;
    if (isChapterLocked(nextChapter) && !isLoggedIn) {
      // Belum login — tidak perlu cek server, tampilkan countdown langsung
      setLockedNext(nextChapter);
      setShowLockedModal(true);
      return;
    }
    // onReadChapter (handleReadChapter di App) memverifikasi kepemilikan ke server
    onReadChapter(nextChapter, activeManga.title);
  };

  const handlePrev = () => {
    if (prevDisabled) return;
    onReadChapter(prevChapter, activeManga.title);
  };

  if (!activeChapter) return null;

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
            const base = { left: rect.left, width: rect.width };
            if (position === 'top') {
              setDropdownAnchor({ ...base, top: rect.bottom + 6 });
            } else {
              const spaceAbove = rect.top - 16;
              setDropdownAnchor({
                ...base,
                bottom: window.innerHeight - rect.top + 6,
                maxHeight: Math.min(205, spaceAbove) + 'px',
              });
            }
            setOpenChapterList(v => v === position ? null : position);
          }}
          className="w-full h-9 sm:h-10 md:h-11 rounded-xl bg-surface-container hover:bg-surface-container-high border border-white/5 flex items-center justify-center gap-2 px-2 sm:px-3 text-xs sm:text-sm md:text-base font-bold text-on-surface active:scale-95 transition-all cursor-pointer truncate"
        >
          <BookOpen className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary shrink-0" />
          <span className="truncate">{activeChapter.title.split(':')[0]}</span>
        </button>
      </div>

      {/* Next */}
      <button
        onClick={handleNext}
        disabled={nextDisabled}
        className="flex-1 h-9 sm:h-10 md:h-11 rounded-xl bg-primary hover:bg-primary/90 flex items-center justify-center gap-2 text-xs sm:text-sm md:text-base font-bold text-on-primary disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 transition-all cursor-pointer"
      >
        <span className="hidden sm:inline">Next</span>
        <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
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
            <div className="px-2 py-2 md:py-3 xl:py-4">
              <button
                onClick={onClose}
                className="relative w-full h-12 sm:h-14 md:h-16 px-3 sm:px-4 rounded-2xl border border-white/15 flex items-center gap-3 active:scale-[0.99] cursor-pointer overflow-hidden"
              >
                {/* Blurred cover background */}
                {activeManga?.coverUrl && (
                  <>
                    <img src={imgUrl(activeManga.coverUrl)} alt="" aria-hidden
                      className="absolute inset-0 w-full h-full object-cover scale-110 blur-xl opacity-40 pointer-events-none"
                    />
                    <div className="absolute inset-0 bg-surface-container/60 pointer-events-none" />
                  </>
                )}
                <ArrowLeft className="relative w-5 h-5 text-primary shrink-0" />
                <div className="relative min-w-0 flex-1 text-left">
                  <p className="font-label-sm text-xs sm:text-xs md:text-sm font-bold text-primary uppercase tracking-wider truncate">{activeManga?.title}</p>
                  <h2 className="font-body-md text-sm sm:text-sm md:text-base font-extrabold text-on-surface truncate">{activeChapter.title}</h2>
                </div>
                {activeManga?.coverUrl && (
                  <div className="relative h-full py-1.5 flex items-center shrink-0">
                    <img
                      src={imgUrl(activeManga.coverUrl)}
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

            <div
              className="w-full lg:max-w-[720px] lg:mx-auto"
              onClick={() => setBarExpanded(v => !v)}
            >
              {pages.map((p, idx) => (
                <PageImage
                  key={idx}
                  src={p}
                  idx={idx}
                  pageRefs={pageRefs}
                  ready={imageReady}
                />
              ))}
            </div>

            {/* Navigasi bawah */}
            <NavBar position="bottom" />

            {/* Tombol kembali — bawah, squircle */}
            <div className="px-2 py-2 md:py-3 xl:py-4">
              <button
                onClick={onClose}
                className="relative w-full h-12 sm:h-14 md:h-16 px-3 sm:px-4 rounded-2xl border border-white/15 flex items-center gap-3 active:scale-[0.99] cursor-pointer overflow-hidden"
              >
                {/* Blurred cover background */}
                {activeManga?.coverUrl && (
                  <>
                    <img src={imgUrl(activeManga.coverUrl)} alt="" aria-hidden
                      className="absolute inset-0 w-full h-full object-cover scale-110 blur-xl opacity-40 pointer-events-none"
                    />
                    <div className="absolute inset-0 bg-surface-container/60 pointer-events-none" />
                  </>
                )}
                <ArrowLeft className="relative w-5 h-5 text-primary shrink-0" />
                <div className="relative min-w-0 flex-1 text-left">
                  <p className="font-label-sm text-xs sm:text-xs md:text-sm font-bold text-primary uppercase tracking-wider truncate">{activeManga?.title}</p>
                  <h2 className="font-body-md text-sm sm:text-sm md:text-base font-extrabold text-on-surface truncate">{activeChapter.title}</h2>
                </div>
                {activeManga?.coverUrl && (
                  <div className="relative h-full py-1.5 flex items-center shrink-0">
                    <img
                      src={imgUrl(activeManga.coverUrl)}
                      alt=""
                      className="h-full aspect-[2/3] object-cover rounded-lg shadow-[0_8px_24px_rgba(0,0,0,0.6)] border border-white/10"
                    />
                  </div>
                )}
              </button>
            </div>

            <div className="pb-4 md:pb-6 xl:pb-8" />
          </div>
        </div>

        {/* Progress Bar — thin default, expand on hover/tap */}
        <div
          className="fixed bottom-0 left-0 right-0 z-[202] pb-safe cursor-pointer"
          onMouseEnter={() => setBarExpanded(true)}
          onMouseLeave={() => setBarExpanded(false)}
          onClick={() => setBarExpanded(v => !v)}
        >
          {/* Bubble layer — di luar overflow-hidden agar tidak ter-clip */}
          {barExpanded && (
            <div className="flex items-end px-3 gap-2 pointer-events-none select-none">
              <div className="w-5 shrink-0" />
              <div className="flex-1 flex gap-[3px]">
                {Array.from({ length: pageCount }).map((_, i) => (
                  <div key={i} className="flex-1 relative" style={{ height: 21 }}>
                    {i === currentPage && (
                      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 flex flex-col items-center">
                        {/* Pill */}
                        <div className="bg-primary text-on-primary font-label-sm text-[10px] sm:text-xs font-black px-2 py-0.5 rounded-full whitespace-nowrap leading-none min-w-[20px] text-center">
                          {i + 1}
                        </div>
                        {/* Arrow pointing down */}
                        <div className="w-0 h-0 border-l-[4px] border-r-[4px] border-t-[5px] border-l-transparent border-r-transparent border-t-primary" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className="w-5 shrink-0" />
            </div>
          )}

          {/* Expanded: pill segments */}
          <div
            className={`overflow-hidden transition-all duration-200 bg-black/80 backdrop-blur-sm flex items-center gap-2 px-3 ${barExpanded ? 'h-9' : 'h-0'}`}
          >
            <span className="font-label-sm text-xs md:text-sm font-bold text-white/50 shrink-0 w-5 text-right tabular-nums leading-none">
              1
            </span>
            <div className="flex-1 flex items-center gap-[3px]">
              {Array.from({ length: pageCount }).map((_, i) => (
                <div key={i} className="flex-1 relative group/seg">
                  {/* Bubble hover untuk non-aktif */}
                  <div className={`absolute bottom-full mb-1 left-1/2 -translate-x-1/2
                    font-label-sm text-[10px] sm:text-xs font-black px-1.5 py-0.5 rounded-md pointer-events-none
                    opacity-0 group-hover/seg:opacity-100 transition-opacity duration-100 whitespace-nowrap
                    bg-white/20 text-white/70
                    ${i === currentPage ? 'hidden' : ''}`}>
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
            <span className="font-label-sm text-xs md:text-sm font-bold text-white/50 shrink-0 w-5 tabular-nums leading-none">
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
                {/* Cover manga menggantikan ikon buku */}
                {activeManga?.coverUrl && (
                  <img
                    src={imgUrl(activeManga.coverUrl)}
                    alt={activeManga.title}
                    className="w-24 aspect-[2/3] object-cover rounded-xl mx-auto shadow-lg border border-white/15"
                  />
                )}
                <div>
                  <h3 className="font-headline-md text-base sm:text-lg md:text-xl font-black text-on-surface">Kamu sudah sampai chapter terbaru!</h3>
                  <p className="font-headline-md text-sm sm:text-base font-black text-on-surface/90 mt-2 line-clamp-2">{activeManga?.title}</p>
                  <p className="font-label-sm text-[10px] sm:text-xs text-outline/60 font-bold uppercase tracking-wider mt-1">Chapter saat ini</p>
                  <p className="font-body-md text-sm sm:text-base text-primary font-bold">{activeChapter?.title}</p>

                  <NextUpdateInfo value={activeManga?.next_update} />
                </div>
                <button
                  onClick={() => { setShowLastChapterModal(false); onClose(); }}
                  className="w-full h-11 rounded-xl bg-primary text-on-primary font-bold text-sm sm:text-base active:scale-95 transition-all cursor-pointer"
                >
                  Kembali ke Detail Manga
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
              style={{
                position: 'fixed',
                left: dropdownAnchor?.left ?? 8,
                width: dropdownAnchor?.width ?? 'auto',
                zIndex: 9999,
                top: dropdownAnchor?.top,
                bottom: dropdownAnchor?.bottom,
              }}
              className="bg-surface-container border border-white/10 rounded-xl shadow-2xl overflow-hidden"
            >
              <div
                className="overflow-y-auto hide-scrollbar"
                ref={el => {
                  if (!el) return;
                  // Ukur tinggi row pertama → maxHeight = 5 baris tepat
                  const firstRow = el.firstElementChild;
                  if (firstRow) {
                    const rowH = firstRow.offsetHeight;
                    el.style.maxHeight = (dropdownAnchor?.maxHeight
                      ? Math.min(rowH * 5, parseInt(dropdownAnchor.maxHeight))
                      : rowH * 5) + 'px';
                  }
                  const active = el.querySelector('[data-active="true"]');
                  if (active) active.scrollIntoView({ block: 'nearest' });
                }}
              >
                {chapters.map((ch) => {
                  const isActive = ch.id === activeChapter.id;
                  const isLocked = isChapterLocked(ch);
                  return (
                    <button
                      key={ch.id}
                      data-active={isActive ? 'true' : 'false'}
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
                      <div className="flex items-center gap-1.5 min-w-0">
                        {isLocked && <Lock className="w-3 h-3 text-amber-400/80 shrink-0" />}
                        <span className="truncate">{ch.title}</span>
                        {ch.isNew && (
                          <span className="shrink-0 font-label-sm bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-1 py-0.5 rounded text-[8px] font-extrabold uppercase">New</span>
                        )}
                      </div>
                      {isLocked && (
                        <div className="flex items-center gap-0.5 text-amber-400/80 text-[10px] font-semibold shrink-0 ml-2 whitespace-nowrap">
                          <Clock className="w-3 h-3 shrink-0" />
                          <CountdownTimer unlockDate={ch.unlockDate} />
                        </div>
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
                className="bg-surface-container border border-white/10 rounded-2xl p-6 max-w-sm sm:max-w-md md:max-w-lg w-full shadow-2xl flex flex-col gap-5 text-center"
              >
                <div>
                  <p className="font-label-sm text-xs sm:text-sm md:text-base text-outline/70 uppercase tracking-widest font-bold mb-1">Chapter berikutnya</p>
                  <h3 className="font-headline-md text-base sm:text-lg md:text-xl font-black text-on-surface">{lockedNext.title}</h3>
                </div>

                {/* Countdown besar — update tiap detik */}
                <div className="flex flex-col items-center gap-2 bg-surface-container-high/40 rounded-xl py-5 px-4 border border-white/5">
                  <p className="font-label-sm text-xs sm:text-sm md:text-base text-outline/60 font-bold uppercase tracking-wider">Gratis dalam</p>
                  <CountdownLarge unlockDate={lockedNext.unlockDate} />
                </div>

                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => {
                      setShowLockedModal(false);
                      onReadChapter(lockedNext, manga.title);
                    }}
                    className="w-full h-12 sm:h-14 rounded-xl bg-gradient-to-r from-amber-400 to-amber-600 hover:from-amber-500 hover:to-amber-700 text-white font-black text-sm sm:text-base md:text-lg flex items-center justify-center gap-2 active:scale-95 transition-all cursor-pointer shadow-md border border-yellow-600/30"
                  >
                    <Coins className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />
                    Beli dengan 5 Koin
                  </button>
                  <button
                    onClick={() => setShowLockedModal(false)}
                    className="w-full h-10 sm:h-12 rounded-xl border border-white/10 text-xs sm:text-sm md:text-base font-bold text-outline hover:text-on-surface hover:bg-white/5 transition-all cursor-pointer"
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
