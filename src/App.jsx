import { useState, useEffect, useLayoutEffect, useRef, useCallback, useEffectEvent, useMemo, lazy, Suspense } from 'react';
import TopNavBar from './components/TopNavBar';
import FeaturedCarousel from './components/FeaturedCarousel';
import SpotlightCarousel from './components/SpotlightCarousel';
import SupportButtons from './components/SupportButtons';
import LazyBoundary from './components/LazyBoundary';
import { loadCoinModals } from './lib/coinModalsLoader';
import MangaCard from './components/MangaCard';
import VisitorCount from './components/VisitorCount';
import ResponsiveCover from './components/ResponsiveCover';
import { Sparkles, RotateCcw, Search, CheckCircle, ArrowRight, ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { coverUrlForWidth, timeAgo } from './utils';
import { HomepageHeroSkeleton, MangaCardSkeleton, MangaDetailSkeleton, ReaderLoadingSkeleton } from './components/Skeleton';
import { parsePath, navigate } from './router';
import { getCurrentUser, getAccessToken, logout as authLogout, exchangeLoginCode } from './lib/auth';
import { clearCachedSession } from './lib/session';
import { clearChapterTokens } from './lib/chapterToken';
import { getReadChapters, markChapterRead, mergeReadChapters } from './lib/readChapters';
import { chapterAccessLevel } from './lib/chapterAccess';

// Lazy-load komponen besar/jarang dipakai → kurangi JS bundle awal (homepage)
const MangaDetailPage     = lazy(() => import('./components/MangaDetailPage'));
const ReaderModal         = lazy(() => import('./components/ReaderModal'));
const PrivacyPolicyModal  = lazy(() => import('./components/PrivacyPolicyModal'));
const TermsOfServiceModal = lazy(() => import('./components/TermsOfServiceModal'));
const DmcaModal           = lazy(() => import('./components/DmcaModal'));
const DisclaimerModal     = lazy(() => import('./components/DisclaimerModal'));
// Loader chunk CoinModals (dibagi dengan tombol pemicu utk prefetch saat hover).
// Ambil satu named-export dari chunk CoinModals sebagai `default` untuk React.lazy.
// Kalau modul/ekspornya tak ter-resolve (khas chunk basi saat deploy belum tuntas:
// index.js baru menunjuk hash chunk yang belum tersedia), lempar error bergaya
// "Loading chunk" agar ditangkap LazyBoundary → muat ulang sekali. Ini mencegah
// crash mentah "Cannot read properties of undefined (reading 'SupporterModal')".
const coinModal = (name) => () =>
  loadCoinModals().then((m) => {
    if (!m || typeof m[name] !== 'function') {
      throw new Error(`Loading chunk CoinModals failed (${name} tidak tersedia)`);
    }
    return { default: m[name] };
  });

const AuthModal            = lazy(coinModal('AuthModal'));
const SupporterModal       = lazy(coinModal('SupporterModal'));
const LockedChapterModal   = lazy(coinModal('LockedChapterModal'));
const AccountSettingsModal = lazy(coinModal('AccountSettingsModal'));

function LockedModalFallback() {
  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/80 px-4 backdrop-blur-md" role="status" aria-label="Membuka chapter Early Access">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-amber-400/25 bg-surface-container shadow-2xl">
        <div className="h-7 w-7 animate-spin rounded-full border-[3px] border-amber-400/25 border-t-amber-400" />
      </div>
    </div>
  );
}

// Pada build produksi katalog sudah disisipkan sebelum bundle React dijalankan.
// Gunakan langsung pada render pertama agar skeleton tidak sempat berkedip satu frame.
const BOOTSTRAP_MANGA_LIST = Array.isArray(window.__INLINE_MANGA_INDEX__)
  ? window.__INLINE_MANGA_INDEX__
  : null;
const INITIAL_ROUTE = parsePath();
const TRENDING_CACHE_KEY = 'nurananto_trending_24h';
const TRENDING_CACHE_MAX_AGE = 30 * 60 * 60 * 1000;

const SORT_OPTIONS = [
  { key: 'update',     label: 'Update' },
  { key: 'popularity', label: 'Popularitas' },
  { key: 'alphabet',   label: 'Alfabet' },
  { key: 'chapters',   label: 'Jumlah Chapter' },
];
// Klik ulang sortir aktif → balik arah. Pindah sortir → mulai dari arah
// default yang masuk akal untuk sortir itu (alfabet A→Z, sisanya terbesar dulu).
const SORT_DEFAULT_DIR = { update: 'desc', popularity: 'desc', alphabet: 'asc', chapters: 'desc' };

function readCachedTrending() {
  try {
    const cached = JSON.parse(localStorage.getItem(TRENDING_CACHE_KEY) || 'null');
    if (!cached || !Array.isArray(cached.ids) || Date.now() - cached.savedAt > TRENDING_CACHE_MAX_AGE) return [];
    return cached.ids.slice(0, 5);
  } catch {
    return [];
  }
}

// Ambil hasil prefetch yang di-kickoff dari index.html (kalau ada & cocok) supaya
// tidak fetch ulang — menghindari waterfall mount→fetch yang bikin LCP molor.
// Prefetch hanya tersedia sekali di initial load; navigasi client-side berikutnya
// tetap fetch normal seperti biasa.
function takePrefetch(type, slug) {
  const pf = window.__PREFETCH__;
  if (!pf || pf.type !== type || (type === 'manga' && pf.slug !== slug)) return null;
  delete window.__PREFETCH__;
  if (type === 'index') delete window.__INLINE_MANGA_INDEX__;
  return pf.promise;
}

// ── Riwayat Baca ──────────────────────────────────────────────
function HistoryTabs({ historyEntries, handleReadChapter }) {
  return (
    <div className="flex flex-col gap-4">
      {historyEntries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-outline">
          <RotateCcw className="w-10 h-10 opacity-20 mb-3" />
          <p className="font-bold">Belum ada riwayat baca</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {historyEntries.map(({ manga, chapter }) => (
            <button type="button" key={manga.id} onClick={() => handleReadChapter(chapter, manga.title, manga)}
              className="flex w-full items-stretch gap-3 sm:gap-4 bg-surface-container border border-outline-variant/50 hover:border-primary/30 rounded-xl p-2.5 sm:p-3 md:p-4 text-left cursor-pointer transition-all hover:bg-surface-container-high active:scale-[0.99] group">
              <ResponsiveCover manga={manga} alt={manga.title}
                className="object-cover rounded-lg border border-outline-variant/60 shrink-0 shadow-md"
                style={{ aspectRatio: '2/3', width: 'auto', maxHeight: 'calc(1.25rem + 2.5rem + 1.25rem + 0.5rem)' }} />
              <div className="min-w-0 flex-1 flex flex-col justify-center gap-0.5 sm:gap-1">
                <h3 className="font-headline-md text-sm sm:text-base md:text-lg font-black text-on-surface line-clamp-1">{manga.title}</h3>
                <p className="text-xs sm:text-sm md:text-base font-bold text-primary truncate">{chapter.title}</p>
                <p className="text-[10px] sm:text-xs md:text-sm text-outline">{chapter.last_read_at ? timeAgo(chapter.last_read_at) : '—'}</p>
              </div>
              <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 text-outline/80 group-hover:text-primary shrink-0 self-center transition-colors" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function App() {
  // Modal login/Supporter tetap menjadi chunk terpisah. Unduh saat browser idle
  // agar tidak bersaing dengan cover LCP, tetapi tetap siap sebelum interaksi umum.
  useEffect(() => {
    let idleId;
    let timerId;
    if ('requestIdleCallback' in window) {
      idleId = window.requestIdleCallback(() => { void loadCoinModals(); }, { timeout: 1800 });
    } else {
      timerId = window.setTimeout(() => { void loadCoinModals(); }, 900);
    }
    return () => {
      if (idleId !== undefined) window.cancelIdleCallback(idleId);
      if (timerId !== undefined) window.clearTimeout(timerId);
    };
  }, []);

  const [MANGA_LIST, setMangaList] = useState(() => BOOTSTRAP_MANGA_LIST || []);
  const [trendingIds, setTrendingIds] = useState(readCachedTrending);
  const trendingIdsRef = useRef(trendingIds);
  const [isLoading, setIsLoading] = useState(() => !BOOTSTRAP_MANGA_LIST);
  const [routePage, setRoutePage] = useState(INITIAL_ROUTE.page);

  // Tema light/dark — default ikut preferensi OS (prefers-color-scheme), TAPI
  // begitu user pernah pilih manual (tersimpan di localStorage), pilihan itu
  // yang menang selamanya (tidak balik ikut OS lagi). Nilai awal dibaca dari
  // atribut data-theme di <html> yang sudah di-set inline script di index.html
  // (sebelum React mount) — mencegah flash tema salah sesaat sebelum JS jalan.
  const [theme, setTheme] = useState(() => {
    if (typeof document !== 'undefined') {
      const fromHtml = document.documentElement.getAttribute('data-theme');
      if (fromHtml === 'dark' || fromHtml === 'light') return fromHtml;
    }
    try {
      const saved = localStorage.getItem('mf_theme');
      if (saved === 'dark' || saved === 'light') return saved;
    } catch {}
    return (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches)
      ? 'dark' : 'light';
  });
  // useLayoutEffect (bukan useEffect) — atribut ke-set sebelum browser paint
  // frame berikutnya, supaya toggle terasa instan tanpa kedip.
  //
  // style.colorScheme SENGAJA TIDAK di-set ulang di sini (beda dari inline
  // script index.html). Di initial load itu wajib — mencegah kanvas awal
  // Chrome ikut warna gelap/terang OS sebelum CSS terbaca. Tapi di-set ULANG
  // tiap kali toggle manual justru bikin browser menghitung ulang rendering
  // native teks/UI dan memicu repaint yang terlihat seperti font "berkedip
  // menghilang sebentar" — jauh lebih kasar dibanding transisi warna CSS biasa
  // (lihat transition di index.css). Attribute data-theme saja sudah cukup
  // untuk transisi warna smooth lewat CSS custom variant `dark:`.
  useLayoutEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem('mf_theme', theme); } catch {}
  }, [theme]);
  const toggleTheme = useCallback(() => {
    setTheme(t => (t === 'dark' ? 'light' : 'dark'));
  }, []);

  // Paksa refresh saat ada versi baru di server
  const [showUpdateBanner, setShowUpdateBanner] = useState(false);
  const [buildId, setBuildId] = useState(null);
  const [updateLabel, setUpdateLabel] = useState('');
  const [isResettingApp, setIsResettingApp] = useState(false);

  const softResetApp = useCallback(async () => {
    if (isResettingApp) return;
    setIsResettingApp(true);
    try {
      clearCachedSession();
    } catch {}
    try {
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
    } catch {}
    try {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
    } catch {}
    const next = new URL(window.location.href);
    next.searchParams.set('r', Date.now().toString());
    window.location.replace(next.toString());
  }, [isResettingApp]);

  const triggerUpdate = useCallback((label) => {
    setUpdateLabel(label || '');
    setShowUpdateBanner(true);
    setTimeout(() => {
      softResetApp();
    }, 1200);
  }, [softResetApp]);

  const [selectedManga, setSelectedManga] = useState(null);
  const [loadingManga, setLoadingManga] = useState(INITIAL_ROUTE.page === 'manga');
  const selectedMangaRef = useRef(null);
  const mangaListRef = useRef(BOOTSTRAP_MANGA_LIST || []);


  useEffect(() => {
    // v = hash KODE (reload penuh saat berubah); catalog = stempel KATALOG
    // (refresh halus). Dipisah supaya sinkron katalog yang sering tidak lagi
    // menelan sinyal update kode (lihat scripts/write-version.cjs).
    let currentCode = null;
    let currentCatalog = null;
    let lastCheckedAt = 0;
    let isChecking = false;
    const checkInterval = 5 * 60 * 1000;   // poll berkala tiap 5 menit
    const focusThrottle = 30 * 1000;       // saat balik ke tab, cek bila >30 dtk

    const checkVersion = async () => {
      if (document.visibilityState !== 'visible' || isChecking) return;
      isChecking = true;
      try {
        const res = await fetch('/version.json', { cache: 'no-store' });
        const data = await res.json();
        const { v, catalog, label } = data;
        if (currentCode === null) {
          setBuildId(v);
          currentCode = v;
          currentCatalog = catalog ?? null;
        } else if (v !== currentCode) {
          // KODE berubah (hash bundle beda) → reload penuh, apa pun deploy terakhirnya.
          currentCode = v;
          currentCatalog = catalog ?? currentCatalog;
          triggerUpdate(label || '');
        } else if (catalog && catalog !== currentCatalog) {
          // Hanya KATALOG berubah (kode sama) → refresh halus tanpa reload halaman.
          currentCatalog = catalog;
          fetch('/manga/index.json', { cache: 'no-cache' })
            .then(r => r.json())
            .then(d => { setMangaList(d); mangaListRef.current = d; })
            .catch(() => {});
          // Re-fetch manga yang sedang dibuka juga
          const cur = selectedMangaRef.current;
          if (cur?.id) {
            fetch(`/manga/${cur.id}.json`, { cache: 'no-cache' })
              .then(r => r.ok ? r.json() : null)
              .then(d => { if (d) { setSelectedManga(d); selectedMangaRef.current = d; } })
              .catch(() => {});
          }
        }
      } catch {
      } finally {
        lastCheckedAt = Date.now();
        isChecking = false;
      }
    };

    checkVersion();
    const interval = setInterval(checkVersion, checkInterval);
    const handleVisibility = () => {
      // Balik ke tab → cek update segera (throttle 30 dtk) supaya reload terasa
      // hampir instan saat pengguna kembali, tak perlu menunggu poll berkala.
      if (document.visibilityState === 'visible' && Date.now() - lastCheckedAt >= focusThrottle) {
        checkVersion();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [triggerUpdate]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [sortBy, setSortBy] = useState('update');   // 'update' | 'popularity' | 'alphabet' | 'chapters'
  const [sortDir, setSortDir] = useState('desc');   // 'asc' | 'desc'
  const [isSortOpen, setIsSortOpen] = useState(false);
  const sortMenuRef = useRef(null);
  const [activeChapter, setActiveChapter] = useState(null);
  const [activeMangaTitle, setActiveMangaTitle] = useState('');
  const [activeTab, setActiveTab] = useState(INITIAL_ROUTE.page === 'history' ? 'profile' : 'library'); // 'library' | 'profile'
  const [spotlightMangaId, setSpotlightMangaId] = useState(null);
  const [featuredMangaId, setFeaturedMangaId] = useState(null);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [historyChapters, setHistoryChapters] = useState({});
  const [readChapterIds, setReadChapterIds] = useState(() => getReadChapters());
  const [currentPage, setCurrentPage] = useState(1);
  // Muat pertama tetap lazy supaya 12 cover tidak berebut bandwidth dan merusak
  // LCP. Begitu pembaca menekan pagination, cover halaman tetangga sudah
  // di-prefetch + di-decode, jadi kartu boleh dipasang eager & decode sinkron —
  // ini yang menghilangkan frame kosong saat berpindah halaman.
  const [hasPaginated, setHasPaginated] = useState(false);
  const goToPage = (next) => {
    setHasPaginated(true);
    setCurrentPage(next);
  };
  const [itemsPerPage, setItemsPerPage] = useState(() =>
    window.matchMedia('(min-width: 768px)').matches ? 12 : 6
  );
  const [isSupporter, setIsSupporter] = useState(false);
  const [supporterUntil, setSupporterUntil] = useState(null);
  const isSupporterRef = useRef(false);
  useEffect(() => {
    isSupporterRef.current = isSupporter;
  }, [isSupporter]);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [nameChangedAt, setNameChangedAt] = useState(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authReason, setAuthReason] = useState(null);
  // Splash "menyelesaikan masuk" — aktif bila balik dari OAuth (URL bawa ?code=)
  const [finishingLogin, setFinishingLogin] = useState(() => {
    try { return new URLSearchParams(window.location.search).has('code'); } catch { return false; }
  });
  const [isCoinModalOpen, setIsCoinModalOpen] = useState(false); // dipakai utk SupporterModal
  const [pendingUnlockChapter, setPendingUnlockChapter] = useState(null);
  const [pendingMangaTitle, setPendingMangaTitle] = useState('');
  const [pendingManga, setPendingManga] = useState(null);
  const [isLockedModalOpen, setIsLockedModalOpen] = useState(false);
  const [isCheckingAccess] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [showDmca, setShowDmca] = useState(false);

  useEffect(() => {
    const tabletUp = window.matchMedia('(min-width: 768px)');
    const handleBreakpointChange = (event) => {
      setItemsPerPage(event.matches ? 12 : 6);
      setCurrentPage(1);
    };
    tabletUp.addEventListener('change', handleBreakpointChange);
    return () => tabletUp.removeEventListener('change', handleBreakpointChange);
  }, []);

  // Sinkronkan metadata saat navigasi SPA. Build juga menghasilkan HTML statis
  // per manga agar crawler yang tidak menjalankan JavaScript mendapat metadata sama.
  useEffect(() => {
    const site = 'Nurananto Scanlation';
    // Canonical tetap custom domain meskipun build ini dibuka dari Pages untuk testing.
    const origin = (import.meta.env.VITE_SITE_URL || 'https://nuranantoscans.my.id').replace(/\/$/, '');
    const ensureMeta = (selector, attributes) => {
      let element = document.head.querySelector(selector);
      if (!element) {
        element = document.createElement('meta');
        document.head.appendChild(element);
      }
      Object.entries(attributes).forEach(([name, value]) => element.setAttribute(name, value || ''));
    };
    const description = (selectedManga?.description || 'Baca manga terjemahan Indonesia di Nurananto Scanlation.').trim();
    const shortDescription = description.length > 160
      ? `${description.slice(0, 160).replace(/\s+\S*$/, '')}…`
      : description;
    const mangaPath = selectedManga?.id ? `/${encodeURIComponent(selectedManga.id)}` : '/';
    const canonicalUrl = `${origin}${mangaPath}`;
    const rawImageUrl = selectedManga?.coverUrls?.desktop || selectedManga?.coverUrl || '/logo-header.webp';
    const imageUrl = new URL(rawImageUrl, `${origin}/`).href;
    let title = site;
    if (activeChapter && activeMangaTitle) {
      title = `${activeChapter.title} - ${activeMangaTitle} | ${site}`;
    } else if (selectedManga) {
      title = `${selectedManga.title} | ${site}`;
    }

    document.title = title;
    ensureMeta('meta[name="description"]', { name: 'description', content: shortDescription });
    ensureMeta('meta[name="robots"]', { name: 'robots', content: activeChapter ? 'noindex, follow' : 'index, follow' });
    ensureMeta('meta[property="og:type"]', { property: 'og:type', content: selectedManga ? 'article' : 'website' });
    ensureMeta('meta[property="og:title"]', { property: 'og:title', content: title });
    ensureMeta('meta[property="og:description"]', { property: 'og:description', content: shortDescription });
    ensureMeta('meta[property="og:url"]', { property: 'og:url', content: canonicalUrl });
    ensureMeta('meta[property="og:image"]', { property: 'og:image', content: imageUrl });
    ensureMeta('meta[name="twitter:title"]', { name: 'twitter:title', content: title });
    ensureMeta('meta[name="twitter:description"]', { name: 'twitter:description', content: shortDescription });
    ensureMeta('meta[name="twitter:image"]', { name: 'twitter:image', content: imageUrl });
    ensureMeta('meta[name="twitter:card"]', { name: 'twitter:card', content: selectedManga ? 'summary_large_image' : 'summary' });
    let canonical = document.head.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      document.head.appendChild(canonical);
    }
    canonical.href = canonicalUrl;
  }, [activeChapter, activeMangaTitle, selectedManga]);

  // Buka modal login dengan konteks (reason) + simpan "intent" yang dilanjutkan
  // setelah login (mis. beli chapter terkunci). Disimpan di sessionStorage agar
  // bertahan melintasi redirect OAuth (full-page ke Google lalu balik).
  const openAuth = (reason = null, intent = null) => {
    try {
      if (intent) sessionStorage.setItem('mf_login_intent', JSON.stringify(intent));
      else sessionStorage.removeItem('mf_login_intent');
    } catch {}
    setAuthReason(reason);
    setIsAuthModalOpen(true);
  };

  const openChapterReader = (chapter, mangaTitle) => {
    setActiveMangaTitle(mangaTitle || "");
    // Ambil mangaId dari chapter.id terlebih dahulu (paling akurat).
    // Suffix chapter bisa angka atau "oneshot".
    const mangaId = chapter.id?.replace(/-ch-[^/]+$/, '')
      || MANGA_LIST.find(m => m.chapters?.some(c => c.id === chapter.id))?.id
      || selectedMangaRef.current?.id
      || '';
    if (!mangaId) return; // tidak bisa navigasi tanpa mangaId
    navigate(`/${mangaId}/${chapter.chapter_number}`);
    // Simpan history pakai mangaId langsung. (Sebelumnya cari manga via chapter id di
    // MANGA_LIST yang cuma simpan 3 chapter terbaru → baca chapter lama = tak tersimpan.)
    setHistoryChapters(prev => ({ ...prev, [mangaId]: { ...chapter, last_read_at: new Date().toISOString() } }));
    // Tandai chapter ini "sudah dibaca" (fade di daftar chapter) — localStorage
    // instan (guest & login), disinkron ke D1 kalau login (lintas device).
    if (chapter.id) setReadChapterIds(prev => markChapterRead(chapter.id, prev));
    if (isLoggedIn && currentUser) {
      const workerUrl = import.meta.env.VITE_WORKER_URL || '';
      getAccessToken().then(token => {
        if (!token) return;
        fetch(`${workerUrl}/api/user/history`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ manga_id: mangaId, chapter_id: chapter.id, chapter_number: chapter.chapter_number, chapter_title: chapter.title }),
        }).catch(() => {});
        if (chapter.id) {
          fetch(`${workerUrl}/api/user/reads`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ chapter_ids: [chapter.id] }),
          }).catch(() => {});
        }
      });
    }
  };

  // Lanjutkan niat tertunda setelah login berhasil (buka kembali modal beli chapter).
  const resumeLoginIntent = async () => {
    let raw = null;
    try { raw = sessionStorage.getItem('mf_login_intent'); sessionStorage.removeItem('mf_login_intent'); } catch {}
    if (!raw) return;
    let intent;
    try { intent = JSON.parse(raw); } catch { return; }
    if (intent?.type !== 'unlock' || !intent.mangaId || intent.chapterNum == null) return;
    try {
      const cur = selectedMangaRef.current;
      const manga = cur?.id === intent.mangaId ? cur
        : await fetch(`/manga/${intent.mangaId}.json`).then(r => (r.ok ? r.json() : null));
      if (!manga) return;
      const ch = (manga.chapters || []).find(c => String(c.chapter_number) === String(intent.chapterNum));
      if (!ch) return;

      // Ambil status Supporter terkini — hindari race dgn me-fetch yang async
      // (kalau tidak, supporter yang baru login bisa terlanjur dianggap non-supporter).
      let supporter = isSupporterRef.current;
      if (!supporter) {
        const workerUrl = import.meta.env.VITE_WORKER_URL || '';
        const token = await getAccessToken();
        if (workerUrl && token) {
          try {
            const me = await fetch(`${workerUrl}/api/user/me`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json());
            supporter = !!me.is_supporter;
            setIsSupporter(!!me.is_supporter);
            setSupporterUntil(me.supporter_until ?? null);
          } catch {}
        }
      }

      // Supporter → langsung buka chapter. Bukan supporter → modal "Jadi Supporter".
      const accessLevel = chapterAccessLevel(ch);
      if (accessLevel === 'public' || supporter) {
        openChapterReader(ch, manga.title);
      } else {
        setPendingUnlockChapter(ch);
        setPendingMangaTitle(manga.title);
        setPendingManga(manga);
        setIsLockedModalOpen(true);
      }
    } catch {}
  };

  async function loadUserData() {
    const workerUrl = import.meta.env.VITE_WORKER_URL || '';
    if (!workerUrl) return;
    const token = await getAccessToken();
    if (!token) return;
    const headers = { 'Authorization': `Bearer ${token}` };

    fetch(`${workerUrl}/api/user/me`, { headers })
      .then(r => r.json()).then(d => {
        setIsSupporter(!!d.is_supporter);
        setSupporterUntil(d.supporter_until ?? null);
        if (d.name_changed_at) setNameChangedAt(d.name_changed_at);
        setCurrentUser(prev => prev ? { ...prev, ...(d.name ? { name: d.name } : {}), is_supporter: !!d.is_supporter, supporter_until: d.supporter_until ?? null } : prev);
      })
      .catch(() => {});

    fetch(`${workerUrl}/api/user/history`, { headers })
      .then(r => r.json()).then(rows => {
        if (!Array.isArray(rows)) return;
        const hist = {};
        rows.forEach(row => {
          hist[row.manga_id] = {
            id: row.chapter_id,
            chapter_number: row.chapter_number,
            title: row.chapter_title || `Ch. ${row.chapter_number}`,
            last_read_at: row.last_read_at,
          };
        });
        setHistoryChapters(hist);
      }).catch(() => {});

    // Gabungkan riwayat "sudah dibaca": ambil dari D1 (device lain), gabung ke
    // localStorage device ini, lalu upload balik id yang cuma ada di device ini
    // (belum pernah disinkron) supaya D1 lengkap juga.
    fetch(`${workerUrl}/api/user/reads`, { headers })
      .then(r => r.json()).then(remoteIds => {
        if (!Array.isArray(remoteIds)) return;
        const localIds = getReadChapters();
        const merged = mergeReadChapters(remoteIds, localIds);
        setReadChapterIds(merged);
        const remoteSet = new Set(remoteIds);
        const onlyLocal = [...localIds].filter(id => !remoteSet.has(id));
        if (onlyLocal.length) {
          fetch(`${workerUrl}/api/user/reads`, {
            method: 'POST',
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify({ chapter_ids: onlyLocal }),
          }).catch(() => {});
        }
      }).catch(() => {});
  }

  const loadUserDataEvent = useEffectEvent(loadUserData);
  const resumeLoginIntentEvent = useEffectEvent(resumeLoginIntent);

  // Custom auth init
  useEffect(() => {
    const initAuth = async () => {
      // OAuth callback: login code bisa muncul di path mana pun, mis.
      // /waka-chan/35?code=... → user kembali persis ke chapter tempat dia login.
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');
      if (code) {
        try {
          const user = await exchangeLoginCode(code).catch(() => null);
          // Buang ?code= dari URL tapi pertahankan path (chapter) + param lain
          params.delete('code');
          const clean = window.location.pathname + (params.toString() ? `?${params}` : '') + window.location.hash;
          window.history.replaceState(null, '', clean);
          if (user) {
            setIsLoggedIn(true);
            setCurrentUser(user);
            setIsAuthModalOpen(false);
            await loadUserDataEvent();
            await resumeLoginIntentEvent();
          } else if (parsePath().page === 'auth') {
            navigate('/', true); // legacy /auth tanpa hasil → balik ke home
          }
        } finally {
          setFinishingLogin(false);
        }
        return;
      }

      // OAuth gagal di sisi Worker → mendarat dengan ?auth_error=... (tanpa ?code).
      // Tampilkan pesan ramah lalu bersihkan param dari URL, bukan bounce senyap.
      const authError = params.get('auth_error');
      if (authError) {
        const MSG = {
          verify:         'Verifikasi keamanan gagal. Silakan coba masuk lagi.',
          server_busy:    'Server sedang sibuk. Coba masuk lagi sebentar lagi.',
          invalid_state:  'Sesi masuk kedaluwarsa. Silakan coba lagi.',
          missing_params: 'Sesi masuk kedaluwarsa. Silakan coba lagi.',
          token_exchange: 'Masuk dengan Google gagal. Silakan coba lagi.',
          profile:        'Masuk dengan Google gagal. Silakan coba lagi.',
          profile_data:   'Masuk dengan Google gagal. Silakan coba lagi.',
        };
        // Pakai setToastMessage langsung (bukan showToast) karena showToast
        // dideklarasi setelah efek ini — hindari akses sebelum deklarasi.
        setToastMessage(MSG[authError] || 'Gagal masuk. Silakan coba lagi.');
        setTimeout(() => setToastMessage(null), 3000);
        params.delete('auth_error');
        const clean = window.location.pathname + (params.toString() ? `?${params}` : '') + window.location.hash;
        window.history.replaceState(null, '', clean);
      }

      // Cek session yang sudah ada
      const user = getCurrentUser();
      if (!user) return;

      setIsLoggedIn(true);
      setCurrentUser(user);

      // Fetch balance + history + unlocked dari Worker
      await loadUserDataEvent();
    };

    initAuth();
  }, []);

  // Satu pintu refresh status Supporter dari server — dipakai saat modal donasi
  // ditutup & polling, agar transisi non↔supporter selalu sinkron.
  const refreshSupporter = async () => {
    if (!isLoggedIn) return;
    const workerUrl = import.meta.env.VITE_WORKER_URL || '';
    if (!workerUrl) return;
    const token = await getAccessToken().catch(() => null);
    if (!token) return;
    try {
      const d = await fetch(`${workerUrl}/api/user/me`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json());
      setIsSupporter(!!d.is_supporter);
      setSupporterUntil(d.supporter_until ?? null);
    } catch {}
  };

  // Transisi SUPPORTER → non saat masa aktif habis sementara user masih di halaman
  // (tanpa reload). Server tetap penjaga akses; ini sekadar menyinkronkan UI agar tak
  // "nyangkut supporter". setTimeout dibatasi ~24 hari (limit int32).
  useEffect(() => {
    if (!isSupporter || !supporterUntil) return;
    const ms = new Date(supporterUntil).getTime() - Date.now();
    if (ms > 2_000_000_000) return;                       // terlalu jauh → biar refetch nanti
    const t = setTimeout(() => setIsSupporter(false), Math.max(0, ms));
    return () => clearTimeout(t);
  }, [isSupporter, supporterUntil]);

  // Transisi non → SUPPORTER setelah donasi mid-sesi: polling saat modal donasi terbuka
  // (webhook Trakteer→D1 nyaris instan) agar status langsung kebaca tanpa reload.
  useEffect(() => {
    if (!isCoinModalOpen || !isLoggedIn) return;
    const id = setInterval(refreshSupporter, 12000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCoinModalOpen, isLoggedIn]);

  // Fetch catalog dari /manga/index.json (pakai hasil prefetch index.html kalau ada)
  useEffect(() => {
    const prefetched = takePrefetch('index');
    const req = prefetched || fetch('/manga/index.json', { cache: 'no-cache' }).then(r => r.json());
    req
      .then(data => {
        if (!data) { setIsLoading(false); return; }
        setMangaList(data); mangaListRef.current = data; setIsLoading(false);
      })
      .catch(() => setIsLoading(false));
  }, []);

  // Ranking Populer hari ini berasal dari views 24 jam Worker. Request pertama
  // ditunda sampai browser idle agar tidak masuk critical request chain homepage,
  // lalu diperbarui berkala dan saat tab kembali aktif setelah cukup lama.
  useEffect(() => {
    const workerUrl = import.meta.env.VITE_WORKER_URL || '';
    if (isLoading || !workerUrl || mangaListRef.current.length === 0) return;

    const refreshInterval = 5 * 60 * 1000;
    const controller = new AbortController();
    let idleId;
    let initialTimerId;
    let intervalId;
    let lastFetchedAt = 0;
    let isFetching = false;

    const loadTrending = async () => {
      if (document.visibilityState !== 'visible' || isFetching) return;
      isFetching = true;
      try {
        const response = await fetch(`${workerUrl}/api/trending`, {
          cache: 'no-store',
          signal: controller.signal,
        });
        if (!response.ok) return;
        const data = await response.json();
        if (!Array.isArray(data?.trending)) return;

        const catalogIds = new Set(mangaListRef.current.map((manga) => manga.id));
        const rankedIds = [...new Set(data.trending)]
          .filter((id) => catalogIds.has(id))
          .slice(0, 5);
        // Respons kosong dapat terjadi sesaat saat cron/sinkronisasi. Jangan
        // mengganti ranking valid dengan fallback total view sepanjang waktu.
        if (rankedIds.length) {
          // Worker sudah menggabungkan ranking aktif dengan snapshot D1 yang
          // masih valid. Percaya urutan server agar ID cache lama tidak terus
          // terbawa dan membuat featured carousel terlihat macet.
          const nextIds = rankedIds.slice(0, 5);
          trendingIdsRef.current = nextIds;
          setTrendingIds(nextIds);
          try {
            localStorage.setItem(TRENDING_CACHE_KEY, JSON.stringify({ ids: nextIds, savedAt: Date.now() }));
          } catch {
            // Storage dapat ditolak pada private mode; state sesi tetap cukup.
          }
        }
      } catch (error) {
        if (error?.name !== 'AbortError') {
          // Pertahankan ranking terakhir; build-time isTrending tetap menjadi
          // fallback jika belum pernah ada respons API yang valid.
        }
      } finally {
        lastFetchedAt = Date.now();
        isFetching = false;
      }
    };

    const handleVisibility = () => {
      if (
        document.visibilityState === 'visible'
        && Date.now() - lastFetchedAt >= refreshInterval
      ) {
        loadTrending();
      }
    };

    if ('requestIdleCallback' in window) {
      idleId = window.requestIdleCallback(loadTrending, { timeout: 2500 });
    } else {
      initialTimerId = window.setTimeout(loadTrending, 1500);
    }
    intervalId = window.setInterval(loadTrending, refreshInterval);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      controller.abort();
      if (idleId !== undefined) window.cancelIdleCallback(idleId);
      if (initialTimerId !== undefined) window.clearTimeout(initialTimerId);
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [isLoading]);

  // Path-based routing
  useEffect(() => {
    let lastHandledPage = parsePath().page;
    let scrollFrame;
    const handleRoute = (event) => {
      const { page, mangaId, chapterNum } = parsePath();
      const previousPage = lastHandledPage;
      setRoutePage(page);

      if (page === 'home') {
        setSelectedManga(null);
        setActiveChapter(null);
        setActiveTab('library');
      } else if (page === 'history') {
        setSelectedManga(null);
        setActiveChapter(null);
        setActiveTab('profile');
      } else if (page === 'manga') {
        const current = selectedMangaRef.current;
        if (current?.id === mangaId) {
          // Data sudah ada di memory — langsung tampil tanpa loading
          setSelectedManga(current);
          setActiveChapter(null);
        } else {
        setLoadingManga(true);
        setSelectedManga(null);
        const prefetched = takePrefetch('manga', mangaId);
        const req = prefetched || fetch(`/manga/${mangaId}.json`).then(r => r.ok ? r.json() : null);
        req
          .then(fullManga => {
            if (fullManga) {
              setSelectedManga(fullManga);
              selectedMangaRef.current = fullManga;
              setActiveChapter(null);
            } else navigate('/', true);
          })
          .catch(() => navigate('/', true))
          .finally(() => setLoadingManga(false));
        }
      } else if (page === 'reader') {
        // Fetch manga kalau belum ada atau berbeda
        const loadReader = async (manga) => {
          const ch = (manga.chapters || []).find(
            c => String(c.chapter_number) === chapterNum
          );
          if (!ch) { navigate(`/${mangaId}`, true); return; }

          const accessLevel = chapterAccessLevel(ch);
          if (accessLevel === 'supporter' && !isSupporterRef.current) {
            // Cek status Supporter terkini dulu sebelum bounce — supporter yang BARU
            // login bisa punya isSupporterRef basi (render me-fetch belum jalan).
            let supporter = false;
            if (isLoggedIn) {
              const workerUrl = import.meta.env.VITE_WORKER_URL || '';
              const token = await getAccessToken().catch(() => null);
              if (workerUrl && token) {
                try {
                  const me = await fetch(`${workerUrl}/api/user/me`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json());
                  supporter = !!me.is_supporter;
                  if (supporter) { setIsSupporter(true); if (me.supporter_until) setSupporterUntil(me.supporter_until); }
                } catch {}
              }
            }
            if (!supporter) {
              navigate(`/${mangaId}`, true);
              if (!isLoggedIn) openAuth('unlock', { type: 'unlock', mangaId, chapterNum: ch.chapter_number });
              else { setPendingUnlockChapter(ch); setPendingMangaTitle(manga.title); setPendingManga(manga); setIsLockedModalOpen(true); }
              return;
            }
          }
          setSelectedManga(manga);
          selectedMangaRef.current = manga;
          setActiveMangaTitle(manga.title);
          setActiveChapter(ch);
        };

        const current = selectedMangaRef.current;
        if (current?.id === mangaId) {
          loadReader(current);
        } else {
          const prefetched = takePrefetch('manga', mangaId);
          const req = prefetched || fetch(`/manga/${mangaId}.json`).then(r => r.ok ? r.json() : null);
          req
            .then(m => m ? loadReader(m) : navigate('/', true))
            .catch(() => navigate('/', true));
        }
      }

      if (event && page !== 'reader') {
        const restoredY = Math.max(0, Number(event.state?.scrollY) || 0);
        const targetY = page === 'manga' && previousPage !== 'reader' ? 0 : restoredY;
        cancelAnimationFrame(scrollFrame);
        scrollFrame = requestAnimationFrame(() => {
          scrollFrame = requestAnimationFrame(() => window.scrollTo({ top: targetY, behavior: 'instant' }));
        });
      }
      lastHandledPage = page;
    };

    window.addEventListener('popstate', handleRoute);
    handleRoute(); // run on mount

    return () => {
      cancelAnimationFrame(scrollFrame);
      window.removeEventListener('popstate', handleRoute);
    };
  }, [isLoggedIn]);

  const showToast = (message) => {
    setToastMessage(message);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  // Klaim koin harian (1 koin / 24 jam) — dipakai di modal Isi Koin & reader.
  // Filter manga based on search query
  const filteredManga = useMemo(() => MANGA_LIST.filter((m) =>
    m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.genres.some((g) => g.toLowerCase().includes(searchQuery.toLowerCase()))
  ), [MANGA_LIST, searchQuery]);

  const handleSortClick = (key) => {
    if (sortBy === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(key);
      setSortDir(SORT_DEFAULT_DIR[key]);
    }
    setCurrentPage(1);
    // Sama seperti pagination: cover halaman 1 hasil sortir baru dipasang
    // eager + decode sinkron, supaya tidak ada frame kosong/kedip saat
    // urutan manga berubah total.
    setHasPaginated(true);
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (sortMenuRef.current && !sortMenuRef.current.contains(event.target)) {
        setIsSortOpen(false);
      }
    };
    const handleEscape = (event) => {
      if (event.key === 'Escape') setIsSortOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const sortedManga = useMemo(() => {
    const list = [...filteredManga];
    const dir = sortDir === 'asc' ? 1 : -1;
    list.sort((a, b) => {
      switch (sortBy) {
        case 'popularity':
          return dir * ((a.total_views ?? 0) - (b.total_views ?? 0));
        case 'alphabet':
          return dir * a.title.localeCompare(b.title);
        case 'chapters':
          return dir * ((a.chapter_count ?? a.chapters?.length ?? 0) - (b.chapter_count ?? b.chapters?.length ?? 0));
        case 'update':
        default: {
          const av = a.latest_release_date ? new Date(a.latest_release_date).getTime() : 0;
          const bv = b.latest_release_date ? new Date(b.latest_release_date).getTime() : 0;
          return dir * (av - bv);
        }
      }
    });
    return list;
  }, [filteredManga, sortBy, sortDir]);

  const totalPages = Math.ceil(sortedManga.length / itemsPerPage);
  const paginatedManga = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return sortedManga.slice(startIndex, startIndex + itemsPerPage);
  }, [sortedManga, currentPage, itemsPerPage]);

  // Hangatkan cover halaman sebelum/sesudah halaman aktif agar teks dan cover
  // berganti bersamaan ketika pagination ditekan.
  useEffect(() => {
    if (typeof window === 'undefined' || totalPages <= 1) return;
    const adjacentPages = [currentPage - 1, currentPage + 1]
      .filter((page) => page >= 1 && page <= totalPages);
    for (const page of adjacentPages) {
      const offset = (page - 1) * itemsPerPage;
      for (const manga of sortedManga.slice(offset, offset + itemsPerPage)) {
        const url = coverUrlForWidth(manga, window.innerWidth);
        if (!url) continue;
        const image = new Image();
        image.fetchPriority = 'low';
        image.src = url;
        // decode() menyiapkan bitmap-nya, bukan cuma mengunduh byte. Tanpa ini
        // cover halaman berikutnya tetap perlu di-decode saat dipasang, dan
        // itulah yang terlihat sebagai kedipan sesaat ketika pagination ditekan.
        image.decode?.().catch(() => { /* URL rusak / dibatalkan — abaikan */ });
      }
    }
  }, [currentPage, sortedManga, itemsPerPage, totalPages]);

  // Auto-recovery race pasca-login: begitu status Supporter terkonfirmasi (me-fetch
  // selesai), kalau modal locked masih nyangkut untuk chapter tertunda → tutup &
  // langsung buka chapternya. Menambal kasus di mana isSupporterRef sempat basi saat
  // route/resume jalan sehingga sempat ke-bounce ke halaman detail + modal supporter.
  useEffect(() => {
    if (!isSupporter || !isLockedModalOpen || !pendingUnlockChapter) return;
    const timer = setTimeout(() => {
      const ch = pendingUnlockChapter;
      const title = pendingMangaTitle;
      setIsLockedModalOpen(false);
      setPendingUnlockChapter(null);
      openChapterReader(ch, title);
    }, 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSupporter]);

  const handleReadChapter = (chapter, mangaTitle, mangaObj) => {
    const accessLevel = chapterAccessLevel(chapter);
    const needsGate = accessLevel === 'supporter' && !isSupporter;
    if (needsGate) {
      setPendingUnlockChapter(chapter);
      setPendingMangaTitle(mangaTitle);
      setPendingManga(mangaObj || selectedManga);
      setIsLockedModalOpen(true);
      return;
    }
    openChapterReader(chapter, mangaTitle);
  };

  // Callback stabil (identitas tidak pernah berubah) untuk MangaCard yang di-memo —
  // lewat ref supaya MangaCard tidak re-render tiap App re-render tak terkait
  // (search, sort, polling), tapi tetap selalu memanggil logic handleReadChapter terbaru.
  const handleReadChapterRef = useRef(handleReadChapter);
  useEffect(() => { handleReadChapterRef.current = handleReadChapter; });
  const stableReadChapter = useCallback((chapter, mangaTitle, mangaObj) => {
    handleReadChapterRef.current(chapter, mangaTitle, mangaObj);
  }, []);
  const stableViewManga = useCallback((manga) => { navigate(`/${manga.id}`); }, []);

  const handleTabClick = (tab) => {
    setActiveTab(tab);
    setSelectedManga(null);
    setActiveChapter(null);
    setSearchQuery('');
    navigate(tab === 'profile' ? '/history' : '/');
    if (tab === 'profile' && isLoggedIn) {
      if (currentUser?.id) localStorage.removeItem(`tx_cache_${currentUser.id}`);
      const workerUrl = import.meta.env.VITE_WORKER_URL || '';
      getAccessToken().then(token => {
        if (!token || !workerUrl) return;
        fetch(`${workerUrl}/api/user/me`, { headers: { Authorization: `Bearer ${token}` } })
          .then(r => r.json())
          .then(d => {
            setIsSupporter(!!d.is_supporter);
            setSupporterUntil(d.supporter_until ?? null);
            if (d.name) setCurrentUser(prev => prev ? { ...prev, name: d.name } : prev);
          })
          .catch(() => {});
      });
    }
  };

  return (
   <LazyBoundary>
    <div className="bg-surface text-on-surface font-body-md min-h-screen flex flex-col selection:bg-primary-container selection:text-on-primary-container">

      {/* Splash saat balik dari OAuth — sebelum reader/halaman tampil kembali */}
      {finishingLogin && (
        <div className="fixed inset-0 z-[9998] flex flex-col items-center justify-center bg-surface/95 backdrop-blur-xl gap-4">
          <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
          <p className="text-sm font-bold text-on-surface">Menyelesaikan masuk…</p>
        </div>
      )}

      {/* Update overlay */}
      {showUpdateBanner && (
        <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-surface/95 backdrop-blur-xl gap-4">
          <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
          <div className="text-center">
            <p className="text-sm font-black text-on-surface">Memperbarui Nurananto Scanlation...</p>
            {updateLabel && <p className="text-xs text-outline mt-1">{updateLabel}</p>}
            <button
              onClick={softResetApp}
              className="mt-3 px-3 py-1.5 rounded-lg border border-outline-variant text-xs font-bold text-on-surface/90 hover:bg-surface-container-high transition-colors cursor-pointer"
            >
              {isResettingApp ? 'Membersihkan cache...' : 'Refresh Paksa Sekarang'}
            </button>
          </div>
        </div>
      )}

      {/* Top Nav Bar — sembunyikan saat reader aktif atau auth callback */}
      {!activeChapter && routePage !== 'auth' && (
        <TopNavBar
          activeTab={activeTab}
          onTabClick={handleTabClick}
          theme={theme}
          onToggleTheme={toggleTheme}
          onChangePasswordClick={() => setIsChangePasswordOpen(true)}
          isSupporter={isSupporter}
          supporterUntil={supporterUntil}
          isLoggedIn={isLoggedIn}
          currentUser={currentUser}
          onLoginClick={() => openAuth()}
          onLogout={async () => {
            await authLogout();
            clearChapterTokens(); // cegah reuse token chapter oleh akun lain di device ini
            setIsLoggedIn(false);
            setCurrentUser(null);
            setIsSupporter(false);
            setSupporterUntil(null);
            setHistoryChapters({});
          }}
          onBecomeSupporter={() => {
            if (isLoggedIn) setIsCoinModalOpen(true);
            else openAuth();
          }}
          onDropdownOpen={async () => {
            if (!isLoggedIn || !currentUser) return;
            const workerUrl = import.meta.env.VITE_WORKER_URL || '';
            if (!workerUrl) return;
            const token = await getAccessToken();
            if (!token) return;
            fetch(`${workerUrl}/api/user/me`, { headers: { Authorization: `Bearer ${token}` } })
              .then(r => r.json()).then(d => { setIsSupporter(!!d.is_supporter); setSupporterUntil(d.supporter_until ?? null); })
              .catch(() => {});
          }}
        />
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        {routePage === 'auth' ? (
          <div className="fixed inset-0 bg-surface flex items-center justify-center z-[199]">
            <div className="w-10 h-10 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          </div>
        ) : loadingManga && routePage !== 'reader' ? (
          <MangaDetailSkeleton />
        ) : (isLoading || !activeChapter) && routePage === 'reader' ? (
          <ReaderLoadingSkeleton />
        ) : loadingManga ? (
          <MangaDetailSkeleton />
        ) : routePage === 'reader' ? (
          null
        ) : selectedManga ? (
          /* Manga Detail View */
          <Suspense fallback={<MangaDetailSkeleton />}>
            <MangaDetailPage
              manga={selectedManga}
              onReadChapter={handleReadChapter}
              lastReadChapter={historyChapters[selectedManga.id]}
              readChapterIds={readChapterIds}
              isSupporter={isSupporter}
              isLoggedIn={isLoggedIn}
              onDonate={() => setIsCoinModalOpen(true)}
            />
          </Suspense>
        ) : (
          /* Main Views based on Tab */
          <main className="pt-4 md:pt-6 xl:pt-8 pb-4 md:pb-6 xl:pb-8 px-3 sm:px-4 md:px-5 flex flex-col gap-4 md:gap-6 xl:gap-8 w-full flex-1">
            
            {activeTab === 'library' && (
              <>
                {/* Featured Carousel — skeleton saat loading agar tidak CLS */}
                {!searchQuery && (
                  <>
                    <div
                      aria-hidden="true"
                      className="w-auto -mx-3 sm:-mx-4 md:-mx-5 border-t border-outline-variant -mb-2 md:-mb-3 xl:-mb-4"
                    />

                    {isLoading ? (
                      <HomepageHeroSkeleton />
                    ) : MANGA_LIST.length > 0 ? (
                    <>
                    <SpotlightCarousel
                      mangaList={MANGA_LIST}
                      initialMangaId={spotlightMangaId}
                      onActiveMangaChange={setSpotlightMangaId}
                      onViewManga={(manga) => { navigate(`/${manga.id}`); }}
                    />

                    <div
                      aria-hidden="true"
                      className="w-auto -mx-3 sm:-mx-4 md:-mx-5 border-t border-outline-variant -mt-2 md:-mt-3 xl:-mt-4"
                    />

                    <FeaturedCarousel
                      mangaList={MANGA_LIST}
                      trendingIds={trendingIds}
                      initialMangaId={featuredMangaId}
                      onActiveMangaChange={setFeaturedMangaId}
                      onReadChapter={(ch, title) => handleReadChapter(ch, title)}
                      onViewManga={(manga) => { navigate(`/${manga.id}`); }}
                      onReadFirst={async (mangaId) => {
                        try {
                          const r = await fetch(`/manga/${mangaId}.json`, { cache: 'no-cache' });
                          if (!r.ok) throw new Error();
                          const fullManga = await r.json();
                          const oldest = [...(fullManga.chapters || [])].sort((a, b) => {
                            const an = Number(a.chapter_number);
                            const bn = Number(b.chapter_number);
                            return (Number.isFinite(an) ? an : Number.NEGATIVE_INFINITY) - (Number.isFinite(bn) ? bn : Number.NEGATIVE_INFINITY);
                          })[0];
                          if (!oldest) throw new Error();
                          handleReadChapter(oldest, fullManga.title);
                        } catch {
                          showToast('Chapter awal gagal dimuat. Silakan coba lagi.');
                        }
                      }}
                    />

                    {/* Tombol dukungan: buka modal pengingat email dulu, bukan lompat langsung ke Trakteer */}
                    <SupportButtons className="mt-2" onDonate={() => setIsCoinModalOpen(true)} />

                    </> ) : null}
                  </>
                )}

                 {/* Catalog Listing */}
                <section className="flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="h-7 w-1 rounded-full bg-primary shrink-0" aria-hidden="true" />
                      <h2 className="font-headline-md text-xl sm:text-2xl font-black text-on-surface truncate">
                        {searchQuery ? `Search Results for "${searchQuery}"` : 'List Bacaan'}
                      </h2>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => setIsSearchOpen(!isSearchOpen)}
                        className={`h-9 w-9 flex items-center justify-center rounded-2xl border transition-all active:scale-95 cursor-pointer ${
                          isSearchOpen
                            ? 'border-primary text-primary bg-surface-container-high'
                            : 'border-outline-variant text-outline hover:border-primary/50 hover:text-primary hover:bg-surface-container-high'
                        }`}
                        title="Search manga"
                      >
                        <Search className="w-5 h-5" />
                      </button>

                      <div className="relative" ref={sortMenuRef}>
                        <button
                          onClick={() => setIsSortOpen((v) => !v)}
                          className={`h-9 w-9 flex items-center justify-center rounded-2xl border transition-all active:scale-95 cursor-pointer ${
                            isSortOpen
                              ? 'border-primary text-primary bg-surface-container-high'
                              : 'border-outline-variant text-outline hover:border-primary/50 hover:text-primary hover:bg-surface-container-high'
                          }`}
                          title="Urutkan manga"
                        >
                          <ArrowUpDown className="w-4 h-4" />
                        </button>

                        {isSortOpen && (
                          <div className="absolute right-0 top-11 w-52 bg-surface-container border border-outline-variant/40 rounded-xl shadow-2xl py-1.5 z-50 animate-[fadeIn_0.15s_ease-out]">
                            {SORT_OPTIONS.map((opt) => {
                              const active = sortBy === opt.key;
                              return (
                                <button
                                  key={opt.key}
                                  onClick={() => handleSortClick(opt.key)}
                                  className={`w-full flex items-center justify-between gap-2 px-4 py-2.5 text-sm font-body-md transition-colors cursor-pointer ${
                                    active ? 'text-primary bg-surface-container-high' : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
                                  }`}
                                >
                                  <span>{opt.label}</span>
                                  {active && (
                                    sortDir === 'asc'
                                      ? <ArrowUp className="w-3.5 h-3.5 shrink-0" />
                                      : <ArrowDown className="w-3.5 h-3.5 shrink-0" />
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Expandable Search Input (Full Width) */}
                  {isSearchOpen && (
                    <div className="relative w-full group animate-[slideDownFade_0.18s_ease-out]">
                      <Search className="w-5 h-5 text-outline absolute left-4.5 top-1/2 -translate-y-1/2 group-focus-within:text-primary transition-colors" />
                      <input
                        type="text"
                        placeholder="Search manga by title or genre..."
                        value={searchQuery}
                        onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                        className="w-full bg-surface-container/60 border border-outline-variant/40 rounded-2xl py-3.5 pl-12 pr-4 text-sm text-on-surface placeholder:text-outline focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all font-body-md shadow-inner"
                      />
                    </div>
                  )}

                  {isLoading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                      {Array.from({ length: itemsPerPage }).map((_, i) => <MangaCardSkeleton key={i} />)}
                    </div>
                  ) : filteredManga.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-outline">
                      <Sparkles className="w-12 h-12 opacity-20 mb-4" />
                      <p className="text-lg font-bold">No manga found</p>
                      <p className="text-sm">Try searching for other titles or genres</p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-4">
                      {/* Key per manga mencegah cover lama tertahan ketika teks kartu sudah
                          berubah. Cover halaman sebelum/sesudahnya sudah dipreload. */}
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 content-start items-start gap-4">
                        {Array.from({ length: totalPages > 1 ? itemsPerPage : paginatedManga.length }).map((_, i) => {
                          const manga = paginatedManga[i];
                          if (!manga) {
                            return (
                              <div
                                key={`empty-${i}`}
                                aria-hidden="true"
                                className="invisible h-[164px] sm:h-[194px] md:h-[209px] lg:h-[226px]"
                              />
                            );
                          }
                          return (
                            <div key={manga.id}>
                              <MangaCard
                                manga={manga}
                                coverPriority={hasPaginated}
                                isLoggedIn={isLoggedIn}
                                isSupporter={isSupporter}
                                onViewManga={stableViewManga}
                                onReadChapter={stableReadChapter}
                                readChapterIds={readChapterIds}
                              />
                            </div>
                          );
                        })}
                      </div>

                      {/* Pagination Controls — pil "current | total" di tengah gayanya
                          diambil dari indikator FeaturedCarousel (ukuran FIXED, gak
                          nge-scale ikut jumlah halaman — lihat catatan di commit
                          sebelumnya). Prev/Next tetap pakai teks (bukan cuma ikon)
                          seperti sebelumnya, biar aksinya jelas tanpa perlu nebak. */}
                      {totalPages > 1 && (
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => goToPage(prev => Math.max(prev - 1, 1))}
                            disabled={currentPage === 1}
                            className="px-3 sm:px-4 h-9 sm:h-10 rounded-xl border border-outline-variant bg-surface-container hover:bg-surface-container-high text-on-surface disabled:opacity-35 disabled:cursor-not-allowed flex items-center gap-1 justify-center font-label-sm text-xs sm:text-sm font-bold active:scale-95 transition-all cursor-pointer"
                          >
                            <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
                            Previous
                          </button>

                          <div className="min-w-10 h-9 sm:h-10 px-2 rounded-xl border border-outline-variant bg-surface-container text-on-surface flex items-center justify-center font-label-sm text-xs sm:text-sm font-black tabular-nums">
                            {currentPage} | {totalPages}
                          </div>

                          <button
                            onClick={() => goToPage(prev => Math.min(prev + 1, totalPages))}
                            disabled={currentPage === totalPages}
                            className="px-3 sm:px-4 h-9 sm:h-10 rounded-xl border border-outline-variant bg-surface-container hover:bg-surface-container-high text-on-surface disabled:opacity-35 disabled:cursor-not-allowed flex items-center gap-1 justify-center font-label-sm text-xs sm:text-sm font-bold active:scale-95 transition-all cursor-pointer"
                          >
                            Next
                            <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </section>
              </>
            )}

            {activeTab === 'profile' && (() => {
              const historyEntries = Object.entries(historyChapters)
                .map(([mangaId, chapter]) => ({ manga: MANGA_LIST.find(m => m.id === mangaId), chapter }))
                .filter(e => e.manga)
                .sort((a, b) => new Date(b.chapter.last_read_at || 0) - new Date(a.chapter.last_read_at || 0));
              return (
                <section className="flex flex-col gap-4 w-full">
                  <div className="border-b border-outline-variant/40 pb-4">
                    <h2 className="font-headline-md text-xl sm:text-2xl font-black text-on-surface flex items-center gap-3">
                      <RotateCcw className="w-6 h-6 text-sky-400" />
                      Riwayat
                    </h2>
                  </div>

                  {/* Sub-tab */}
                  <HistoryTabs
                    historyEntries={historyEntries}
                    handleReadChapter={handleReadChapter}
                    isLoggedIn={isLoggedIn}
                    currentUser={currentUser}
                    workerUrl={import.meta.env.VITE_WORKER_URL || ''}
                  />
                </section>
              );
            })()}
            
          </main>
        )}
      </div>

      {/* Global Footer (Only on Homepage catalog) */}
      {!loadingManga && routePage !== 'reader' && (activeTab === 'library' || !!selectedManga) && (
        <footer className="w-full pt-4 md:pt-6 xl:pt-8 pb-4 md:pb-6 xl:pb-8 bg-surface border-t border-outline-variant mt-auto">
          <div className="w-full px-4 sm:px-6 md:px-8 flex flex-col items-center gap-3">
            <div className="h-11 aspect-[1843/552] md:h-14 xl:h-16">
              <img
                src="/logo-footer.webp"
                alt="Nurananto Scanlation"
                width="1843"
                height="552"
                loading="lazy"
                decoding="async"
                className="h-full w-full object-contain"
              />
            </div>
            <VisitorCount />
            <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
              <button
                onClick={() => setShowDisclaimer(true)}
                className="font-body-sm text-[10px] text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer underline underline-offset-2"
              >
                Disclaimer
              </button>
              <span className="text-on-surface-variant text-[10px]">·</span>
              <button
                onClick={() => setShowPrivacy(true)}
                className="font-body-sm text-[10px] text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer underline underline-offset-2"
              >
                Kebijakan Privasi
              </button>
              <span className="text-on-surface-variant text-[10px]">·</span>
              <button
                onClick={() => setShowTerms(true)}
                className="font-body-sm text-[10px] text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer underline underline-offset-2"
              >
                Syarat &amp; Ketentuan
              </button>
              <span className="text-on-surface-variant text-[10px]">·</span>
              <button
                onClick={() => setShowDmca(true)}
                className="font-body-sm text-[10px] text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer underline underline-offset-2"
              >
                DMCA
              </button>
            </div>
            <span className="font-body-sm text-[10px] text-on-surface-variant">
              © {new Date().getFullYear()} Nurananto Scanlation. Fan Translation — Not for commercial use.
            </span>
            {buildId && (
              <div className="flex items-center gap-2">
                <span className="font-body-sm text-[9px] text-on-surface-variant">
                  build #{buildId.slice(-6)}
                </span>
              </div>
            )}
          </div>
        </footer>
      )}

      {/* Legal Modals */}
      <Suspense fallback={null}>
        {showPrivacy && <PrivacyPolicyModal onClose={() => setShowPrivacy(false)} />}
        {showDisclaimer && <DisclaimerModal onClose={() => setShowDisclaimer(false)} />}
        {showTerms && <TermsOfServiceModal onClose={() => setShowTerms(false)} />}
        {showDmca && <DmcaModal onClose={() => setShowDmca(false)} />}
      </Suspense>


      {/* Checking chapter access overlay */}
      {isCheckingAccess && (
        <div className="fixed inset-0 z-[250] bg-surface flex flex-col items-center justify-center gap-4 animate-[fadeIn_0.16s_ease-out]">
            <div className="relative w-14 h-14">
              <div className="absolute inset-0 rounded-full border-4 border-outline-variant/40" />
              <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-primary animate-spin" />
              <div className="absolute inset-[5px] rounded-full border-2 border-transparent border-t-primary/40 animate-spin" style={{ animationDirection: 'reverse', animationDuration: '0.8s' }} />
            </div>
            <p className="font-body-md text-sm text-outline font-semibold tracking-wide">Checking chapter access</p>
        </div>
      )}

      {/* Interactive Reader Modal */}
      {activeChapter && (
        <Suspense fallback={<ReaderLoadingSkeleton />}>
          <ReaderModal
            chapter={activeChapter}
            manga={selectedManga}
            onClose={() => {
              const detailPath = `/${selectedManga?.id || ''}`;
              if (window.history.state?.from === detailPath) {
                window.history.back();
              } else {
                navigate(detailPath, true);
              }
            }}
            onReadChapter={handleReadChapter}
            isSupporter={isSupporter}
            currentUser={currentUser}
            readChapterIds={readChapterIds}
          />
        </Suspense>
      )}

      {/* Change Password Modal */}
      {isChangePasswordOpen && (
        <Suspense fallback={null}>
          <AccountSettingsModal
            isOpen={isChangePasswordOpen}
            onClose={() => setIsChangePasswordOpen(false)}
            currentUser={currentUser}
            nameChangedAt={nameChangedAt}
            onSave={async ({ username }) => {
              const token = await getAccessToken();
              if (!token) return;
              const workerUrl = import.meta.env.VITE_WORKER_URL || '';
              try {
                // Update username jika tidak dalam cooldown
                if (username && username.trim() && username.trim() !== currentUser?.name) {
                  const nameRes = await fetch(`${workerUrl}/api/user/profile`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ name: username.trim() }),
                  });
                  const nameData = await nameRes.json();
                  if (nameRes.ok) {
                    setCurrentUser(prev => prev ? { ...prev, name: nameData.name } : prev);
                    setNameChangedAt(new Date().toISOString());
                    // Force refresh token agar JWT punya nama terbaru
                    getAccessToken(true).catch(() => {});
                  } else {
                    showToast(nameData.error || 'Gagal update username');
                    return;
                  }
                }
                // Email disimpan sebagai patokan pencocokan donasi Supporter (tanpa klaim koin).
              } catch (e) {
                console.error('Save settings error:', e);
              }
              setIsChangePasswordOpen(false);
              showToast('Pengaturan berhasil disimpan!');
            }}
          />
        </Suspense>
      )}
      {/* Auth Modal */}
      {isAuthModalOpen && (
        <Suspense fallback={null}>
          <AuthModal
            isOpen={isAuthModalOpen}
            reason={authReason}
            onClose={() => {
              setIsAuthModalOpen(false);
              try { sessionStorage.removeItem('mf_login_intent'); } catch {}
            }}
          />
        </Suspense>
      )}

      {/* Supporter Modal */}
      {isCoinModalOpen && (
        <Suspense fallback={null}>
          <SupporterModal
            isOpen={isCoinModalOpen}
            onClose={() => { setIsCoinModalOpen(false); refreshSupporter(); }}
            userEmail={currentUser?.email || ''}
          />
        </Suspense>
      )}

      {/* Locked Chapter Modal */}
      {isLockedModalOpen && (
        <Suspense fallback={<LockedModalFallback />}>
          <LockedChapterModal
            isOpen={isLockedModalOpen}
            onClose={() => setIsLockedModalOpen(false)}
            chapter={pendingUnlockChapter}
            manga={pendingManga}
            isLoggedIn={isLoggedIn}
            isSupporter={isSupporter}
            onLogin={() => {
              setIsLockedModalOpen(false);
              openAuth('unlock', { type: 'unlock', mangaId: pendingManga?.id, chapterNum: pendingUnlockChapter?.chapter_number });
            }}
            onBecomeSupporter={() => { setIsLockedModalOpen(false); setIsCoinModalOpen(true); }}
          />
        </Suspense>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] bg-surface-container-high border border-primary/20 text-on-surface px-6 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 animate-[toastIn_0.2s_ease-out]">
            <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center">
              <CheckCircle className="w-3.5 h-3.5 text-primary" />
            </div>
            <span className="text-xs font-bold">{toastMessage}</span>
        </div>
      )}
    </div>
   </LazyBoundary>
  );
}
