import { useState, useEffect, useRef, useCallback, useEffectEvent, useMemo, lazy, Suspense } from 'react';
import TopNavBar from './components/TopNavBar';
import FeaturedCarousel from './components/FeaturedCarousel';
import SpotlightCarousel from './components/SpotlightCarousel';
import SupportButtons from './components/SupportButtons';
import MangaCard from './components/MangaCard';
import VisitorCount from './components/VisitorCount';
import ResponsiveCover from './components/ResponsiveCover';
import { Sparkles, Compass, RotateCcw, Search, CheckCircle, ArrowRight } from 'lucide-react';
import { coverUrlForWidth, timeAgo } from './utils';
import { HomepageHeroSkeleton, MangaCardSkeleton, MangaDetailSkeleton, ReaderLoadingSkeleton } from './components/Skeleton';
import { parsePath, navigate } from './router';
import { getCurrentUser, getAccessToken, logout as authLogout, exchangeLoginCode } from './lib/auth';
import { clearCachedSession } from './lib/session';
import { clearChapterTokens } from './lib/chapterToken';
import { chapterAccessLevel } from './lib/chapterAccess';

// Lazy-load komponen besar/jarang dipakai → kurangi JS bundle awal (homepage)
const MangaDetailPage     = lazy(() => import('./components/MangaDetailPage'));
const ReaderModal         = lazy(() => import('./components/ReaderModal'));
const PrivacyPolicyModal  = lazy(() => import('./components/PrivacyPolicyModal'));
const TermsOfServiceModal = lazy(() => import('./components/TermsOfServiceModal'));
const DmcaModal           = lazy(() => import('./components/DmcaModal'));
const DisclaimerModal     = lazy(() => import('./components/DisclaimerModal'));
const AuthModal           = lazy(() => import('./components/CoinModals').then(m => ({ default: m.AuthModal })));
const SupporterModal      = lazy(() => import('./components/CoinModals').then(m => ({ default: m.SupporterModal })));
const LockedChapterModal  = lazy(() => import('./components/CoinModals').then(m => ({ default: m.LockedChapterModal })));
const AccountSettingsModal = lazy(() => import('./components/CoinModals').then(m => ({ default: m.AccountSettingsModal })));

// Pada build produksi katalog sudah disisipkan sebelum bundle React dijalankan.
// Gunakan langsung pada render pertama agar skeleton tidak sempat berkedip satu frame.
const BOOTSTRAP_MANGA_LIST = Array.isArray(window.__INLINE_MANGA_INDEX__)
  ? window.__INLINE_MANGA_INDEX__
  : null;
const INITIAL_ROUTE = parsePath();
const TRENDING_CACHE_KEY = 'nurananto_trending_24h';
const TRENDING_CACHE_MAX_AGE = 30 * 60 * 60 * 1000;

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
            <div key={manga.id} onClick={() => handleReadChapter(chapter, manga.title, manga)}
              className="flex items-stretch gap-3 sm:gap-4 bg-surface-container border border-white/8 hover:border-primary/30 rounded-xl p-2.5 sm:p-3 md:p-4 cursor-pointer transition-all hover:bg-surface-container-high active:scale-[0.99] group">
              <ResponsiveCover manga={manga} alt={manga.title}
                className="object-cover rounded-lg border border-white/10 shrink-0 shadow-md"
                style={{ aspectRatio: '2/3', width: 'auto', maxHeight: 'calc(1.25rem + 2.5rem + 1.25rem + 0.5rem)' }} />
              <div className="min-w-0 flex-1 flex flex-col justify-center gap-0.5 sm:gap-1">
                <h3 className="font-headline-md text-sm sm:text-base md:text-lg font-black text-on-surface line-clamp-1">{manga.title}</h3>
                <p className="text-xs sm:text-sm md:text-base font-bold text-primary truncate">{chapter.title}</p>
                <p className="text-[10px] sm:text-xs md:text-sm text-outline">{chapter.last_read_at ? timeAgo(chapter.last_read_at) : '—'}</p>
              </div>
              <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 text-outline/80 group-hover:text-primary shrink-0 self-center transition-colors" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [MANGA_LIST, setMangaList] = useState(() => BOOTSTRAP_MANGA_LIST || []);
  const [trendingIds, setTrendingIds] = useState(readCachedTrending);
  const trendingIdsRef = useRef(trendingIds);
  const [isLoading, setIsLoading] = useState(() => !BOOTSTRAP_MANGA_LIST);
  const [routePage, setRoutePage] = useState(INITIAL_ROUTE.page);

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
    let currentVersion = null;
    let lastCheckedAt = 0;
    let isChecking = false;
    const checkInterval = 10 * 60 * 1000;

    const checkVersion = async () => {
      if (document.visibilityState !== 'visible' || isChecking) return;
      isChecking = true;
      try {
        const res = await fetch('/version.json', { cache: 'no-store' });
        const data = await res.json();
        const { v, label, type } = data;
        if (currentVersion === null) {
          setBuildId(v);
          currentVersion = v;
        } else if (v !== currentVersion) {
          currentVersion = v;
          if (type === 'catalog') {
            // Chapter baru — cukup refresh catalog tanpa reload halaman
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
          } else {
            // Kode baru — perlu reload penuh
            triggerUpdate(label || '');
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
      if (document.visibilityState === 'visible' && Date.now() - lastCheckedAt >= checkInterval) {
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
  const [activeChapter, setActiveChapter] = useState(null);
  const [activeMangaTitle, setActiveMangaTitle] = useState('');
  const [activeTab, setActiveTab] = useState(INITIAL_ROUTE.page === 'history' ? 'profile' : 'library'); // 'library', 'discover', 'updates', 'profile'
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [historyChapters, setHistoryChapters] = useState({});
  const [currentPage, setCurrentPage] = useState(1);
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

  // Dynamic document title + meta description (snippet Google per halaman)
  useEffect(() => {
    const site = 'Nurananto Scanlation';
    const setDesc = (txt) => {
      const el = document.querySelector('meta[name="description"]');
      if (el) el.setAttribute('content', txt || '');
    };
    if (activeChapter && activeMangaTitle) {
      document.title = `${activeChapter.title} - ${activeMangaTitle} | ${site}`;
    } else if (selectedManga) {
      document.title = `${selectedManga.title} | ${site}`;
      const d = (selectedManga.description || '').trim();
      if (d) setDesc(d.length > 160 ? d.slice(0, 160).replace(/\s+\S*$/, '') + '…' : d);
    } else {
      document.title = site;
      setDesc('nurananto scanslation');
    }
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
    if (isLoggedIn && currentUser) {
      const workerUrl = import.meta.env.VITE_WORKER_URL || '';
      getAccessToken().then(token => {
        if (!token) return;
        fetch(`${workerUrl}/api/user/history`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ manga_id: mangaId, chapter_id: chapter.id, chapter_number: chapter.chapter_number, chapter_title: chapter.title }),
        }).catch(() => {});
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
    const handleRoute = () => {
      const { page, mangaId, chapterNum } = parsePath();
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
    };

    window.addEventListener('popstate', handleRoute);
    handleRoute(); // run on mount

    return () => window.removeEventListener('popstate', handleRoute);
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

  const totalPages = Math.ceil(filteredManga.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedManga = filteredManga.slice(startIndex, startIndex + itemsPerPage);

  // Hangatkan cover halaman sebelum/sesudah halaman aktif agar teks dan cover
  // berganti bersamaan ketika pagination ditekan.
  useEffect(() => {
    if (typeof window === 'undefined' || totalPages <= 1) return;
    const adjacentPages = [currentPage - 1, currentPage + 1]
      .filter((page) => page >= 1 && page <= totalPages);
    for (const page of adjacentPages) {
      const offset = (page - 1) * itemsPerPage;
      for (const manga of filteredManga.slice(offset, offset + itemsPerPage)) {
        const url = coverUrlForWidth(manga, window.innerWidth);
        if (!url) continue;
        const image = new Image();
        image.fetchPriority = 'low';
        image.src = url;
      }
    }
  }, [currentPage, filteredManga, itemsPerPage, totalPages]);

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
              className="mt-3 px-3 py-1.5 rounded-lg border border-white/15 text-xs font-bold text-on-surface/90 hover:bg-white/10 transition-colors cursor-pointer"
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
          <div className="fixed inset-0 bg-[#090b0d] flex items-center justify-center z-[199]">
            <div className="w-10 h-10 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          </div>
        ) : loadingManga && routePage !== 'reader' ? (
          <MangaDetailSkeleton />
        ) : (isLoading || !activeChapter) && routePage === 'reader' ? (
          <ReaderLoadingSkeleton />
        ) : loadingManga ? (
          <MangaDetailSkeleton />
        ) : selectedManga ? (
          /* Manga Detail View */
          <Suspense fallback={<MangaDetailSkeleton />}>
            <MangaDetailPage
              manga={selectedManga}
              onReadChapter={handleReadChapter}
              lastReadChapter={historyChapters[selectedManga.id]}
              isSupporter={isSupporter}
              isLoggedIn={isLoggedIn}
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
                      className="w-auto -mx-3 sm:-mx-4 md:-mx-5 border-t border-white/60 -mb-2 md:-mb-3 xl:-mb-4"
                    />

                    {isLoading ? (
                      <HomepageHeroSkeleton />
                    ) : MANGA_LIST.length > 0 ? (
                    <>
                    <SpotlightCarousel
                      mangaList={MANGA_LIST}
                      onViewManga={(manga) => { navigate(`/${manga.id}`); }}
                    />

                    <div
                      aria-hidden="true"
                      className="w-auto -mx-3 sm:-mx-4 md:-mx-5 border-t border-white/60 -mt-2 md:-mt-3 xl:-mt-4"
                    />

                    <FeaturedCarousel
                      mangaList={MANGA_LIST}
                      trendingIds={trendingIds}
                      onReadChapter={(ch, title) => handleReadChapter(ch, title)}
                      onViewManga={(manga) => { navigate(`/${manga.id}`); }}
                      onReadFirst={async (mangaId) => {
                        const r = await fetch(`/manga/${mangaId}.json`, { cache: 'no-cache' });
                        if (!r.ok) return;
                        const fullManga = await r.json();
                        const oldest = [...(fullManga.chapters || [])].sort((a, b) => {
                          const an = Number(a.chapter_number);
                          const bn = Number(b.chapter_number);
                          return (Number.isFinite(an) ? an : Number.NEGATIVE_INFINITY) - (Number.isFinite(bn) ? bn : Number.NEGATIVE_INFINITY);
                        })[0];
                        if (oldest) handleReadChapter(oldest, fullManga.title);
                      }}
                    />

                    {/* Tombol dukungan: Donasi Trakteer + Gabung Discord */}
                    <SupportButtons className="mt-2" />

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
                    <button
                      onClick={() => setIsSearchOpen(!isSearchOpen)}
                      className={`p-2 rounded-full hover:bg-white/5 text-outline hover:text-primary transition-all active:scale-95 cursor-pointer ${
                        isSearchOpen ? 'text-primary bg-white/5' : ''
                      }`}
                      title="Search manga"
                    >
                      <Search className="w-5 h-5" />
                    </button>
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
                                className="invisible h-[160px] sm:h-[190px] md:h-[205px] lg:h-[220px]"
                              />
                            );
                          }
                          return (
                            <div key={manga.id}>
                              <MangaCard
                                manga={manga}
                                isLoggedIn={isLoggedIn}
                                isSupporter={isSupporter}
                                onViewManga={() => { navigate(`/${manga.id}`); }}
                                onReadChapter={(ch, title) => handleReadChapter(ch, title || manga.title, manga)}
                              />
                            </div>
                          );
                        })}
                      </div>

                      {/* Pagination Controls */}
                      {totalPages > 1 && (
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                            disabled={currentPage === 1}
                            className="px-4 py-2 min-w-[92px] text-center rounded-xl bg-surface-container border border-white/5 text-xs font-bold text-outline hover:text-on-surface disabled:opacity-30 disabled:pointer-events-none hover:bg-surface-container-high transition-all cursor-pointer"
                          >
                            Previous
                          </button>
                          
                          {(() => {
                            // Jendela 2 nomor halaman: [current, current+1], kecuali di
                            // halaman terakhir → [last-1, last]. Yang aktif di-highlight.
                            const startP = currentPage === totalPages ? currentPage - 1 : currentPage;
                            return [startP, startP + 1].map((p) => (
                              <button
                                key={p}
                                onClick={() => setCurrentPage(p)}
                                className={p === currentPage
                                  ? "w-9 h-9 rounded-xl text-xs font-black bg-primary text-on-primary shadow-lg shadow-primary/20 cursor-default"
                                  : "w-9 h-9 rounded-xl text-xs font-black bg-surface-container border border-white/5 text-outline hover:text-on-surface hover:bg-surface-container-high cursor-pointer"}
                              >
                                {p}
                              </button>
                            ));
                          })()}

                          <button
                            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                            disabled={currentPage === totalPages}
                            className="px-4 py-2 min-w-[92px] text-center rounded-xl bg-surface-container border border-white/5 text-xs font-bold text-outline hover:text-on-surface disabled:opacity-30 disabled:pointer-events-none hover:bg-surface-container-high transition-all cursor-pointer"
                          >
                            Next
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </section>
              </>
            )}

            {activeTab === 'discover' && (
              <section className="flex flex-col gap-6">
                <div className="border-b border-white/5 pb-4">
                  <h2 className="font-headline-md text-xl sm:text-2xl font-black text-on-surface flex items-center gap-3">
                    <Compass className="w-6 h-6 text-primary" />
                    Discover Genres
                  </h2>
                  <p className="text-outline text-sm mt-1">Explore titles grouped by your favorite themes.</p>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {['Action', 'Sci-Fi', 'Fantasy', 'Adventure', 'Dark Fantasy', 'System', 'Historical', 'Martial Arts'].map((genre) => {
                    const count = MANGA_LIST.filter(m => m.genres.includes(genre)).length;
                    return (
                      <button
                        key={genre}
                        onClick={() => {
                          setSearchQuery(genre);
                          navigate('/');
                        }}
                        className="p-6 bg-surface-container rounded-2xl border border-white/5 hover:border-primary/20 hover:bg-surface-container-high text-left transition-all active:scale-95 cursor-pointer shadow-md group"
                      >
                        <h3 className="font-bold text-lg text-on-surface group-hover:text-primary transition-colors">{genre}</h3>
                        <p className="text-xs text-outline mt-2">{count} titles available</p>
                      </button>
                    );
                  })}
                </div>
              </section>
            )}

            {activeTab === 'updates' && (
              <section className="flex flex-col gap-6">
                <div className="border-b border-white/5 pb-4">
                  <h2 className="font-headline-md text-xl sm:text-2xl font-black text-on-surface flex items-center gap-3">
                    <RotateCcw className="w-6 h-6 text-primary" />
                    Recent Activity
                  </h2>
                  <p className="text-outline text-sm mt-1">Stay up to date with your reading history.</p>
                </div>

                <div className="flex flex-col bg-surface-container rounded-[32px] border border-white/5 overflow-hidden divide-y divide-white/5">
                  {MANGA_LIST.slice(0, 4).map((manga, idx) => {
                    const latestChapter = manga.chapters[0];
                    const readTimes = [
                      'Read 2 hours ago',
                      'Read 1 day ago',
                      'Read 3 days ago',
                      'Read 1 week ago'
                    ];
                    return (
                      <div 
                        key={manga.id} 
                        onClick={() => { navigate(`/${manga.id}`); }}
                        className="py-5 px-5 flex items-center gap-5 hover:bg-white/5 cursor-pointer transition-colors"
                      >
                        <ResponsiveCover
                          manga={manga}
                          alt={manga.title} 
                          className="w-14 aspect-[2/3] object-cover rounded-xl border border-white/10 shrink-0 shadow-md" 
                        />
                        <div className="min-w-0 flex-1 flex flex-col justify-center">
                          <h3 className="font-extrabold text-sm md:text-base text-on-surface truncate">{manga.title}</h3>
                          <p className="text-xs text-outline mt-0.5 truncate">Read: {latestChapter.title}</p>
                          <span className="text-[10px] text-outline mt-1 font-semibold">
                            {readTimes[idx % readTimes.length]}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {activeTab === 'profile' && (() => {
              const historyEntries = Object.entries(historyChapters)
                .map(([mangaId, chapter]) => ({ manga: MANGA_LIST.find(m => m.id === mangaId), chapter }))
                .filter(e => e.manga)
                .sort((a, b) => new Date(b.chapter.last_read_at || 0) - new Date(a.chapter.last_read_at || 0));
              return (
                <section className="flex flex-col gap-4 w-full">
                  <div className="border-b border-white/5 pb-4">
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
      {!loadingManga && (activeTab === 'library' || !!selectedManga) && (
        <footer className="w-full pt-4 md:pt-6 xl:pt-8 pb-4 md:pb-6 xl:pb-8 bg-surface border-t border-white/60 mt-auto">
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
                className="font-body-sm text-[10px] text-outline hover:text-on-surface transition-colors cursor-pointer underline underline-offset-2"
              >
                Disclaimer
              </button>
              <span className="text-outline/70 text-[10px]">·</span>
              <button
                onClick={() => setShowPrivacy(true)}
                className="font-body-sm text-[10px] text-outline hover:text-on-surface transition-colors cursor-pointer underline underline-offset-2"
              >
                Kebijakan Privasi
              </button>
              <span className="text-outline/70 text-[10px]">·</span>
              <button
                onClick={() => setShowTerms(true)}
                className="font-body-sm text-[10px] text-outline hover:text-on-surface transition-colors cursor-pointer underline underline-offset-2"
              >
                Syarat &amp; Ketentuan
              </button>
              <span className="text-outline/70 text-[10px]">·</span>
              <button
                onClick={() => setShowDmca(true)}
                className="font-body-sm text-[10px] text-outline hover:text-on-surface transition-colors cursor-pointer underline underline-offset-2"
              >
                DMCA
              </button>
            </div>
            <span className="font-body-sm text-[10px] text-outline/80">
              © {new Date().getFullYear()} Nurananto Scanlation. Fan Translation — Not for commercial use.
            </span>
            {buildId && (
              <div className="flex items-center gap-2">
                <span className="font-body-sm text-[9px] text-outline/70">
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
        <div className="fixed inset-0 z-[250] bg-[#090b0d] flex flex-col items-center justify-center gap-4 animate-[fadeIn_0.16s_ease-out]">
            <div className="relative w-14 h-14">
              <div className="absolute inset-0 rounded-full border-4 border-white/8" />
              <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-primary animate-spin" />
              <div className="absolute inset-[5px] rounded-full border-2 border-transparent border-t-primary/40 animate-spin" style={{ animationDirection: 'reverse', animationDuration: '0.8s' }} />
            </div>
            <p className="font-body-md text-sm text-outline/70 font-semibold tracking-wide">Checking chapter access</p>
        </div>
      )}

      {/* Interactive Reader Modal */}
      {activeChapter && (
        <Suspense fallback={<ReaderLoadingSkeleton />}>
          <ReaderModal
            chapter={activeChapter}
            manga={selectedManga}
            onClose={() => { navigate(`/${selectedManga?.id || ''}`); }}
            onReadChapter={handleReadChapter}
            isSupporter={isSupporter}
            currentUser={currentUser}
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
        <Suspense fallback={null}>
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
  );
}
