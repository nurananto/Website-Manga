import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowRight, ArrowUp, Lock, BookOpen, MessageCircle } from 'lucide-react';
import { discordCommentUrl } from '../lib/links';
import { nowTimestamp } from '../utils';
import { getAccessToken } from '../lib/auth';
import { loadTurnstile, TURNSTILE_SITEKEY } from '../lib/session';
import { getCachedChapterToken, setCachedChapterToken, invalidateChapterToken } from '../lib/chapterToken';
import ResponsiveCover from './ResponsiveCover';

// Widget Turnstile interaktif (wajib centang) untuk membuka locked chapter.
function TurnstileGate({ onToken }) {
  const ref = useRef(null);
  useEffect(() => {
    let widgetId;
    let cancelled = false;
    loadTurnstile().then((ts) => {
      if (cancelled || !ts || !ref.current || !TURNSTILE_SITEKEY) return;
      try {
        widgetId = ts.render(ref.current, {
          sitekey: TURNSTILE_SITEKEY,
          callback: (t) => onToken(t),
          'error-callback': () => {},
          'expired-callback': () => {},
        });
      } catch {}
    });
    return () => {
      cancelled = true;
      try { if (widgetId != null && window.turnstile) window.turnstile.remove(widgetId); } catch {}
    };
  }, [onToken]);
  return <div ref={ref} className="min-h-[65px] flex items-center justify-center" />;
}

// Info jadwal rilis chapter berikutnya: countdown kalau tanggal, teks kalau bukan,
// pesan hijau "segera rilis" kalau tidak ada jadwal atau waktunya sudah lewat.
function NextUpdateInfo({ value }) {
  const [now, setNow] = useState(nowTimestamp);
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

function PageImage({ src, fallbackSrc, idx, registerPage, ready, onAccessError }) {
  const [loaded,     setLoaded]     = useState(false);
  const [failed,     setFailed]     = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [useFallback, setUseFallback] = useState(false);
  const [inView,     setInView]     = useState(idx < 3);
  const [blobUrl,    setBlobUrl]    = useState(null);
  const wrapRef = useRef(null);
  const activeSrc = useFallback && fallbackSrc ? fallbackSrc : src;

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

  // Ambil gambar via fetch → blob, supaya <img src> tampil "blob:" bukan path asli
  // (path tetap terlihat di Network tab — ini cuma obscure DOM/klik-kanan/hotlink).
  // Kalau fetch CDN gagal (mis. CORS belum di-set), jatuh ke worker (fallbackSrc).
  useEffect(() => {
    if (!ready || !inView || !activeSrc) return;
    let cancelled = false;
    let objUrl = null;
    fetch(activeSrc)
      .then(r => { if (!r.ok) { const e = new Error(`HTTP ${r.status}`); e.status = r.status; throw e; } return r.blob(); })
      .then(blob => {
        if (cancelled) return;
        objUrl = URL.createObjectURL(blob);
        setBlobUrl(objUrl);
      })
      .catch((err) => {
        if (cancelled) return;
        if (fallbackSrc && !useFallback) setUseFallback(true); // coba worker sekali
        // Hanya laporkan error AKSES (401/403 = token ditolak server). Error lain
        // (404/429/jaringan) cukup gagalkan halaman ini saja — JANGAN reset token
        // (mencegah loop Turnstile di gambar ke-2, ke-3, dst).
        else { setFailed(true); onAccessError?.(err?.status); }
      });
    return () => { cancelled = true; if (objUrl) URL.revokeObjectURL(objUrl); };
  }, [ready, inView, activeSrc, retryCount]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRetry = (e) => {
    e.stopPropagation();
    setFailed(false);
    setLoaded(false);
    setRetryCount(c => c + 1);
  };

  return (
    <div
      ref={el => { wrapRef.current = el; registerPage?.(idx, el); }}
      className="w-full relative"
      // Placeholder pakai aspect-ratio (bukan minHeight:85vh) — tingginya turunan dari
      // LEBAR kontainer, sama seperti gambar asli nanti (w-full h-auto). Rasio 2/3 adalah
      // perkiraan umum halaman manga; jauh lebih dekat ke ukuran akhir daripada 85% tinggi
      // viewport (yang tak ada hubungannya sama sekali dengan dimensi gambar), sehingga
      // pergeseran layout (CLS) saat gambar selesai dimuat jauh lebih kecil.
      style={loaded ? undefined : { aspectRatio: '2 / 3' }}
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
        decoding="async"
        className={`w-full h-auto block transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
        src={blobUrl || undefined}
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
      />
    </div>
  );
}

function useChapterDropdown() {
  const [openChapterList, setOpenChapterList] = useState(null);
  const [dropdownAnchor, setDropdownAnchor] = useState(null);
  const chapterBtnRefs = useRef({});

  const measureAnchor = (position) => {
    const button = chapterBtnRefs.current[position];
    if (!button) return;
    const rect = button.getBoundingClientRect();
    const base = { left: rect.left, width: rect.width };
    setDropdownAnchor(position === 'top'
      ? { ...base, top: rect.bottom + 6 }
      : {
          ...base,
          bottom: window.innerHeight - rect.top + 6,
          maxHeight: Math.min(205, rect.top - 16),
        });
  };

  const toggleChapterList = (position) => {
    if (openChapterList === position) {
      setOpenChapterList(null);
      return;
    }
    measureAnchor(position);
    setOpenChapterList(position);
  };

  useEffect(() => {
    if (!openChapterList) return;
    let frameId;
    const handleResize = () => {
      cancelAnimationFrame(frameId);
      frameId = requestAnimationFrame(() => measureAnchor(openChapterList));
    };
    window.addEventListener('resize', handleResize);
    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('resize', handleResize);
    };
  }, [openChapterList]);

  return { chapterBtnRefs, dropdownAnchor, openChapterList, setOpenChapterList, toggleChapterList };
}

export default function ReaderModal({ chapter, manga, onClose, onReadChapter, isSupporter, currentUser }) {
  const now = nowTimestamp();
  const chapterNeedsToken = !!chapter?.unlockDate && new Date(chapter.unlockDate).getTime() > now;
  const activeChapter = chapter;
  const activeManga = manga;
  const discordLink = discordCommentUrl(activeManga?.discord_channel_id); // channel per judul (meta.json)

  // null = tutup, 'top' = dibuka dari navbar atas, 'bottom' = dari navbar bawah
  const {
    chapterBtnRefs,
    dropdownAnchor,
    openChapterList,
    setOpenChapterList,
    toggleChapterList,
  } = useChapterDropdown();
  const [showLastChapterModal, setShowLastChapterModal] = useState(false);
  const [showDiscordRedirect, setShowDiscordRedirect] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [barExpanded, setBarExpanded] = useState(false);
  const scrollRef = useRef(null);
  const pageRefs = useRef([]);
  const registerPage = (index, element) => {
    pageRefs.current[index] = element;
  };
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  // Kirim view ke Worker. Dedup PER HARI (WIB), bukan permanen — biar pembaca yang
  // balik lagi besok tetap terhitung (server tetap dedup ip+chapter+hari = anti-inflasi).
  useEffect(() => {
    if (!chapter?.id || chapterNeedsToken) return;
    const workerUrl = import.meta.env.VITE_WORKER_URL;
    if (!workerUrl) return;
    const day = new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10); // WIB
    const key = `vw_${chapter.id}_${day}`;
    try {
      if (localStorage.getItem(key)) return; // sudah dihitung hari ini
      // bersihkan penanda lama (hari sebelumnya + format permanen "viewed_" lama)
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (k && (k.startsWith('vw_') || k.startsWith('dvw_') || k.startsWith('viewed_')) && !k.endsWith(day)) localStorage.removeItem(k);
      }
      localStorage.setItem(key, '1');
    } catch {}
    fetch(`${workerUrl}/api/r/${chapter.id}`, { method: 'POST' }).catch(() => {});
  }, [chapter?.id, chapterNeedsToken]);

  const chapters = manga?.chapters || [];
  const currentIdx = chapters.findIndex(ch => ch.id === chapter?.id);
  const prevChapter = chapters[currentIdx + 1] ?? null; // lebih lama
  const nextChapter = chapters[currentIdx - 1] ?? null; // lebih baru

  // Helper: cek apakah chapter benar-benar locked (belum free & user bukan Supporter)
  const isChapterLocked = (ch) => {
    if (!ch?.unlockDate) return false;
    if (new Date(ch.unlockDate).getTime() <= now) return false;
    if (isSupporter) return false;
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
  // CDN publik untuk chapter free — di-hardcode (sama dengan preconnect di index.html).
  // URL ini infrastruktur tetap & publik; di-hardcode agar tidak bergantung pada secret
  // VITE_CDN_URL yang terbukti tidak reliabel (sering berisi nilai salah).
  const cdnBase   = 'https://cdn.nuranantoscans.my.id';
  const imageBase = (import.meta.env.VITE_IMAGE_URL || import.meta.env.VITE_WORKER_URL || '').replace(/\/$/, '');
  const [pages, setPages] = useState([]);
  const [pageCount, setPageCount] = useState(0);
  const [imgAccess, setImgAccess] = useState(null);
  const [imgHash, setImgHash] = useState(null);
  const [tsToken, setTsToken] = useState(null); // token Turnstile (wajib centang)
  const tokenFromCacheRef = useRef(false);      // token aktif berasal dari cache?
  const reauthAttemptRef  = useRef(0);          // maks 1× re-Turnstile per buka chapter (anti-loop)
  const nextPageRef = useRef(1);
  const userId = currentUser?.id || null;

  // Chapter masih dalam masa lock (sudah dibeli, tapi image worker butuh access token)
  // Saat ganti chapter: kalau ada token cache yang masih berlaku (chapter sudah
  // dibeli & dibuka < 30 menit lalu) → pakai langsung, lewati Turnstile.
  // Kalau tidak → reset, gate Turnstile akan tampil.
  useEffect(() => {
    tokenFromCacheRef.current = false;
    reauthAttemptRef.current = 0;
    const cached = (chapterNeedsToken && userId && chapter?.id)
      ? getCachedChapterToken(userId, chapter.id) : null;
    const timer = setTimeout(() => {
      setTsToken(null);
      if (cached) {
        tokenFromCacheRef.current = true;
        setImgAccess(cached.token);
        setImgHash(cached.h);
      } else {
        setImgAccess(null);
        setImgHash(null);
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [chapter?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Setelah Turnstile dicentang (tsToken ada) → ambil access token + hash, lalu cache.
  useEffect(() => {
    if (!chapter?.id || !chapterNeedsToken || !tsToken) return;
    const workerUrl = import.meta.env.VITE_WORKER_URL || '';
    if (!workerUrl) return;
    let cancelled = false;
    (async () => {
      try {
        const tok = await getAccessToken();
        if (!tok || cancelled) return;
        const res = await fetch(`${workerUrl}/api/user/chapter-token`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${tok}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chapter_id: chapter.id,
            chapter_number: chapter.chapter_number,
            chapter_title: chapter.title,
            turnstile_token: tsToken,
          }),
        });
        const d = await res.json();
        if (!cancelled && d.token) {
          tokenFromCacheRef.current = false; // token segar (bukan dari cache)
          setImgAccess(d.token);
          setImgHash(d.h || null);
          if (userId && d.h) setCachedChapterToken(userId, chapter.id, d.token, d.h, d.expires_in);
        }
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [chapter?.id, tsToken]); // eslint-disable-line react-hooks/exhaustive-deps

  // Token cache ditolak server (IP berubah / kedaluwarsa di server) → gambar 403.
  // Hanya token dari cache yang bisa basi saat dipakai; token segar valid saat dicetak.
  // Buang cache & minta Turnstile baru.
  const handleLockedImageError = (status) => {
    // Hanya re-Turnstile kalau server menolak token (401/403) — bukan 404/429/jaringan.
    if (status !== 401 && status !== 403) return;
    if (!tokenFromCacheRef.current) return;      // token segar valid saat dicetak; jangan reset
    if (reauthAttemptRef.current >= 1) return;   // sudah 1× re-auth → stop (anti-loop)
    reauthAttemptRef.current += 1;
    tokenFromCacheRef.current = false;
    if (userId && chapter?.id) invalidateChapterToken(userId, chapter.id);
    setImgAccess(null);
    setImgHash(null);
    setTsToken(null);
  };

  // Gratis: CDN langsung siap. Terkunci: tunggu access token + hash path.
  const imageReady = chapterNeedsToken ? (!!imgAccess && !!imgHash) : true;

  // Chapter yang BARU lepas kunci mungkin belum selesai dimigrasi dari manga-locked ke
  // manga-media. CDN (R2 langsung) akan balas 404 yang ter-cache lama → arahkan ke worker
  // (images.) yang punya migrasi-on-access selama jendela ini, setelahnya aman ke CDN.
  // PENTING: jendela ini HARUS > interval cron migrasi. Cron = tiap 3 jam → pakai 6 jam
  // (2× interval) agar tetap aman walau satu run cron terlewat.
  const FRESHLY_FREED_MS = 6 * 60 * 60 * 1000;
  const freshlyFreed = !!chapter?.unlockDate &&
    now - new Date(chapter.unlockDate).getTime() >= 0 &&
    now - new Date(chapter.unlockDate).getTime() < FRESHLY_FREED_MS;

  const makeUrl = useCallback((idx) => {
    const num = String(idx).padStart(2, '0');
    if (chapterNeedsToken) {
      // Path di-hash agar judul/chapter tidak terbaca di URL: /c/<hash>/<NN>.webp
      return `${imageBase}/c/${imgHash}/${num}.webp?access=${encodeURIComponent(imgAccess)}`;
    }
    // Baru lepas kunci → lewat worker (migrasi-on-access). Selain itu → CDN langsung.
    const base = freshlyFreed && imageBase ? imageBase : (cdnBase || imageBase);
    const chapterFolder = chapter?.r2_folder ?? chapter?.chapter_number;
    return `${base}/manga/${manga?.id}/${chapterFolder}/Image${num}.webp`;
  }, [chapter?.r2_folder, chapter?.chapter_number, chapterNeedsToken, freshlyFreed, imageBase, imgAccess, imgHash, manga?.id]);

  // Generate semua URL sekaligus.
  useEffect(() => {
    if (!chapter?.id || !manga?.id || !chapter.pages) return;
    pageRefs.current = [];
    const all = Array.from({ length: chapter.pages }, (_, i) => makeUrl(i + 1));
    nextPageRef.current = chapter.pages + 1;
    const timer = setTimeout(() => {
      setPages(all);
      setPageCount(chapter.pages);
    }, 0);
    return () => clearTimeout(timer);
  }, [chapter?.id, chapter?.pages, makeUrl, manga?.id]);

  // Reset currentPage saat chapter berganti. Hanya scroll ke atas kalau TIDAK ada
  // posisi tersimpan — supaya "Lanjut Baca" tidak berkedip atas dulu.
  useEffect(() => {
    if (!chapter?.id) return;
    pageRefs.current = [];
    const saved = parseInt(localStorage.getItem(`reader_page_${chapter.id}`) || '');
    const hasResume = !isNaN(saved) && saved > 0 && saved < (chapter.pages ?? 0) - 1;
    const timer = setTimeout(() => {
      setCurrentPage(0);
      if (!hasResume) scrollRef.current?.scrollTo({ top: 0, behavior: 'instant' });
    }, 0);
    return () => clearTimeout(timer);
  }, [chapter?.id, chapter?.pages]);

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
  }, [chapter?.id, pages]);

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
  }, [pageCount, activeChapter?.id, setOpenChapterList]);

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
  }, [setOpenChapterList]);

  const handleNext = () => {
    if (nextDisabled) return;
    // Ongoing di chapter terbaru → tampil modal info
    if (isAtNewest && normalizedStatus === 'ongoing' && !isAtConfiguredEndChapter) {
      setShowLastChapterModal(true);
      return;
    }
    if (!nextChapter) return;
    // Chapter terkunci ditangani sepenuhnya oleh handleReadChapter di App:
    // ia membuka LockedChapterModal (yang sudah punya tombol Login/Beli + countdown).
    // Tidak perlu modal countdown terpisah di sini agar tidak muncul dua modal.
    onReadChapter(nextChapter, activeManga.title);
  };

  const handlePrev = () => {
    if (prevDisabled) return;
    onReadChapter(prevChapter, activeManga.title);
  };

  if (!activeChapter) return null;

  // Render helper (bukan komponen) — dipanggil sebagai fungsi agar tidak
  // di-remount tiap render dan tidak melanggar react-hooks/static-components.
  const renderNavBar = (position) => (
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
          ref={(el) => { chapterBtnRefs.current[position] = el; }}
          onClick={() => toggleChapterList(position)}
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

  const renderDetailBackBar = () => (
    <div className="flex gap-2 px-2 py-2">
      <button
        onClick={onClose}
        className="h-11 min-w-0 flex-1 cursor-pointer rounded-xl border border-white/10 bg-surface-container px-3 transition-colors hover:bg-surface-container-high active:scale-[0.99] sm:h-12 sm:px-4 md:h-14"
      >
        <div className="flex h-full items-center gap-2.5 sm:gap-3">
          <ArrowLeft className="h-4 w-4 shrink-0 text-primary sm:h-5 sm:w-5" />
          <div className="min-w-0 flex-1 text-left">
            <p className="font-label-sm text-[10px] font-black uppercase tracking-wider text-on-surface sm:text-xs">Kembali ke Detail</p>
            <p className="truncate font-body-md text-xs font-bold text-primary/85 sm:text-sm">{activeManga?.title}</p>
          </div>
        </div>
      </button>

      <button
        type="button"
        onClick={() => setShowDiscordRedirect(true)}
        disabled={!discordLink}
        aria-label="Buka komentar di Discord"
        className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-primary/30 bg-primary/15 text-primary transition-colors hover:bg-primary/25 active:scale-95 disabled:cursor-not-allowed disabled:opacity-35 sm:h-12 sm:w-12 md:h-14 md:w-14"
      >
        <MessageCircle className="h-5 w-5" />
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

            {/* Kembali ke detail + komentar Discord — atas */}
            {renderDetailBackBar()}

            {/* Navigasi atas */}
            {renderNavBar('top')}

            {/* Pemisah navigasi dan gambar pertama */}
            <div className="h-px bg-white/20" />

            <div
              className="w-full lg:max-w-[720px] lg:mx-auto"
              onClick={() => setBarExpanded(v => !v)}
            >
              {pages.map((p, idx) => (
                <PageImage
                  key={p}
                  src={p}
                  fallbackSrc={!chapterNeedsToken && cdnBase && imageBase ? p.replace(cdnBase, imageBase) : null}
                  idx={idx}
                  registerPage={registerPage}
                  ready={imageReady}
                  onAccessError={chapterNeedsToken ? handleLockedImageError : undefined}
                />
              ))}
            </div>

            {/* Navigasi bawah */}
            {renderNavBar('bottom')}

            {/* Kembali ke detail + komentar Discord — bawah */}
            {renderDetailBackBar()}

            <div className="pb-4 md:pb-6 xl:pb-8" />
          </div>
        </div>

        {/* Gate Turnstile — locked chapter wajib centang sebelum gambar dimuat */}
        {chapterNeedsToken && !imgAccess && (
          <div className="absolute inset-0 z-[205] bg-[#090b0d]/95 backdrop-blur-sm flex flex-col items-center justify-center gap-5 px-6">
            <div className="flex flex-col items-center gap-2 text-center">
              <Lock className="w-8 h-8 text-primary" />
              <h3 className="font-headline-md text-base sm:text-lg font-black text-on-surface">Verifikasi untuk membuka chapter</h3>
              <p className="font-body-md text-xs sm:text-sm text-outline/70 max-w-xs">
                Chapter berbayar — centang kotak di bawah untuk memuat gambar.
              </p>
            </div>
            {!tsToken ? (
              <TurnstileGate onToken={setTsToken} />
            ) : (
              <div className="flex items-center gap-2 text-outline/70">
                <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                <span className="font-body-md text-sm">Memuat akses chapter...</span>
              </div>
            )}
            <button
              onClick={onClose}
              className="mt-2 font-label-sm text-xs font-bold px-5 py-2 rounded-xl border border-white/10 text-outline hover:text-on-surface hover:bg-white/5 transition-colors cursor-pointer"
            >
              ← Kembali
            </button>
          </div>
        )}

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
                  <ResponsiveCover
                    manga={activeManga}
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

        {/* Konfirmasi sebelum membuka channel komentar Discord */}
        <AnimatePresence>
          {showDiscordRedirect && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[65] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
              onClick={() => setShowDiscordRedirect(false)}
            >
              <motion.div
                initial={{ scale: 0.92, opacity: 0, y: 18 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.92, opacity: 0, y: 18 }}
                onClick={(event) => event.stopPropagation()}
                className="flex w-full max-w-sm flex-col gap-4 rounded-2xl border border-[#5865F2]/35 bg-surface-container p-5 text-center shadow-2xl"
              >
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#5865F2]/20 text-[#8b95ff]">
                  <img src="/discord-mark-white.svg" alt="Discord" className="h-6 w-6 object-contain" />
                </div>
                <div>
                  <h3 className="font-headline-md text-base font-black text-on-surface sm:text-lg">Buka komentar di Discord?</h3>
                  <p className="mt-1.5 font-body-md text-xs leading-relaxed text-outline/75 sm:text-sm">
                    Kamu akan diarahkan ke channel Discord untuk membaca atau menulis komentar chapter ini.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setShowDiscordRedirect(false)}
                    className="h-10 cursor-pointer rounded-xl border border-white/10 bg-white/5 text-xs font-bold text-on-surface transition-colors hover:bg-white/10 sm:text-sm"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      window.open(discordLink, '_blank', 'noopener,noreferrer');
                      setShowDiscordRedirect(false);
                    }}
                    className="h-10 cursor-pointer rounded-xl bg-[#5865F2] text-xs font-black text-white transition-colors hover:bg-[#4b57d1] sm:text-sm"
                  >
                    Buka Discord
                  </button>
                </div>
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
                style={{ maxHeight: dropdownAnchor.maxHeight ?? 205 }}
                ref={el => {
                  if (!el) return;
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
                      <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        <span className="truncate">{ch.title}</span>
                        {ch.isNew && (
                          <span className="badge-new-glow shrink-0 font-label-sm bg-emerald-500 text-white border border-emerald-300/70 px-1 py-0.5 rounded text-[8px] font-extrabold uppercase">New</span>
                        )}
                        {isLocked && (
                          <span className="shrink-0 font-label-sm px-1.5 py-0.5 rounded text-[8px] sm:text-[9px] font-black uppercase tracking-wider bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center gap-0.5">
                            <Lock className="w-2.5 h-2.5 shrink-0" />
                            <span>Early Access</span>
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </AnimatePresence>,
          document.body
        )}

      </motion.div>
    </AnimatePresence>
  );
}
