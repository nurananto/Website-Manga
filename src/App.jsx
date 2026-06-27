import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import TopNavBar from './components/TopNavBar';
import FeaturedCarousel from './components/FeaturedCarousel';
import SpotlightCarousel from './components/SpotlightCarousel';
import SupportButtons from './components/SupportButtons';
import MangaCard from './components/MangaCard';
import VisitorCount from './components/VisitorCount';
import { Sparkles, TrendingUp, Compass, RotateCcw, Search, CheckCircle, ArrowRight, Coins, ChevronLeft, ChevronRight } from 'lucide-react';
import { imgUrl, timeAgo } from './utils';
import { motion, AnimatePresence } from 'framer-motion';
import { AuthModal, CoinPurchaseModal, LockedChapterModal, TrakteerEmailModal, AccountSettingsModal } from './components/CoinModals';
import { MangaCardSkeleton, MangaDetailSkeleton } from './components/Skeleton';
import { parsePath, navigate } from './router';
import { getCurrentUser, getAccessToken, logout as authLogout, exchangeLoginCode } from './lib/auth';
import { clearCachedSession } from './lib/session';
import { getDeviceId } from './lib/device';
import { clearChapterTokens } from './lib/chapterToken';

// Lazy-load komponen besar/jarang dipakai → kurangi JS bundle awal (homepage)
const MangaDetailPage     = lazy(() => import('./components/MangaDetailPage'));
const ReaderModal         = lazy(() => import('./components/ReaderModal'));
const PrivacyPolicyModal  = lazy(() => import('./components/PrivacyPolicyModal'));
const TermsOfServiceModal = lazy(() => import('./components/TermsOfServiceModal'));
const DmcaModal           = lazy(() => import('./components/DmcaModal'));

// ── History Tabs: Baca + Koin ────────────────────────────────
function HistoryTabs({ historyEntries, handleReadChapter, isLoggedIn, currentUser, workerUrl }) {
  const [tab, setTab] = useState('read');
  const [txData, setTxData] = useState(null);
  const [txPage, setTxPage] = useState(1);
  const [txLoading, setTxLoading] = useState(false);
  const CACHE_KEY = `tx_cache_${currentUser?.id || 'guest'}`;
  const CACHE_TTL = 2 * 60 * 1000; // 2 menit

  const fetchTransactions = async (page = 1) => {
    if (!isLoggedIn) return;
    const cacheRaw = localStorage.getItem(CACHE_KEY);
    if (cacheRaw && page === 1) {
      try {
        const cache = JSON.parse(cacheRaw);
        if (Date.now() - cache.ts < CACHE_TTL) { setTxData(cache.data); return; }
      } catch {}
    }
    setTxLoading(true);
    try {
      const token = await getAccessToken();
      if (!token) return;
      const res = await fetch(`${workerUrl}/api/user/transactions?page=${page}&limit=10`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const d = await res.json();
      setTxData(d);
      // Hanya cache kalau ada data
      if (page === 1 && d.data?.length > 0) localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data: d }));
    } catch {} finally { setTxLoading(false); }
  };

  useEffect(() => { if (tab === 'coin') fetchTransactions(txPage); }, [tab, txPage]);

  return (
    <div className="flex flex-col gap-4">
      {/* Sub-tabs */}
      <div className="flex gap-1 bg-surface-container-high rounded-xl p-1">
        {[{ id: 'read', label: 'Riwayat Baca' }, { id: 'coin', label: 'Riwayat Koin' }].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 h-9 rounded-lg text-xs font-bold transition-all cursor-pointer ${tab === t.id ? 'bg-surface-container text-on-surface shadow-sm' : 'text-outline hover:text-on-surface'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Riwayat Baca */}
      {tab === 'read' && (
        historyEntries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-outline">
            <RotateCcw className="w-10 h-10 opacity-20 mb-3" />
            <p className="font-bold">Belum ada riwayat baca</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {historyEntries.map(({ manga, chapter }) => (
              <div key={manga.id} onClick={() => handleReadChapter(chapter, manga.title, manga)}
                className="flex items-stretch gap-3 sm:gap-4 bg-surface-container border border-white/8 hover:border-primary/30 rounded-xl p-2.5 sm:p-3 md:p-4 cursor-pointer transition-all hover:bg-surface-container-high active:scale-[0.99] group">
                <img alt={manga.title} src={imgUrl(manga.coverUrl)}
                  className="object-cover rounded-lg border border-white/10 shrink-0 shadow-md"
                  style={{ aspectRatio: '2/3', width: 'auto', maxHeight: 'calc(1.25rem + 2.5rem + 1.25rem + 0.5rem)' }} />
                <div className="min-w-0 flex-1 flex flex-col justify-center gap-0.5 sm:gap-1">
                  <h3 className="font-headline-md text-sm sm:text-base md:text-lg font-black text-on-surface line-clamp-1">{manga.title}</h3>
                  <p className="text-xs sm:text-sm md:text-base font-bold text-primary truncate">{chapter.title}</p>
                  <p className="text-[10px] sm:text-xs md:text-sm text-outline/60">{chapter.last_read_at ? timeAgo(chapter.last_read_at) : '—'}</p>
                </div>
                <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 text-outline/30 group-hover:text-primary shrink-0 self-center transition-colors" />
              </div>
            ))}
          </div>
        )
      )}

      {/* Riwayat Koin */}
      {tab === 'coin' && (
        !isLoggedIn ? (
          <p className="text-center text-outline py-10 text-sm">Login untuk melihat riwayat koin</p>
        ) : txLoading ? (
          <div className="flex justify-center py-10"><div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" /></div>
        ) : !txData || txData.data?.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-outline">
            <Coins className="w-10 h-10 opacity-20 mb-3" />
            <p className="font-bold">Belum ada transaksi koin</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {txData.data.map(tx => {
              const isPositive = tx.type === 'trakteer' || tx.type === 'daily';
              const coinAmount = isPositive ? `+${tx.amount}` : `-${Math.abs(tx.amount)}`;
              return (
                <div key={tx.id} className="flex items-center gap-3 bg-surface-container border border-white/8 rounded-xl p-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isPositive ? 'bg-amber-500/10' : 'bg-red-500/10'}`}>
                    <Coins className={`w-4 h-4 ${isPositive ? 'text-amber-400' : 'text-red-400'}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs sm:text-sm font-bold text-on-surface truncate">
                      {isPositive
                        ? `Beli koin sebanyak ${tx.note?.split(': ').pop() ?? ''}`
                        : tx.note || tx.type}
                    </p>
                    <p className="text-[10px] text-outline/60">{tx.created_at ? timeAgo(tx.created_at) : '—'}</p>
                  </div>
                  <span className={`text-sm font-black shrink-0 ${isPositive ? 'text-amber-400' : 'text-red-400'}`}>
                    {coinAmount}
                  </span>
                </div>
              );
            })}
            {/* Pagination */}
            {txData.pages > 1 && (
              <div className="flex items-center justify-center gap-3 pt-2">
                <button onClick={() => setTxPage(p => Math.max(1, p - 1))} disabled={txPage === 1}
                  className="w-8 h-8 rounded-lg bg-surface-container-high border border-white/8 flex items-center justify-center disabled:opacity-30 cursor-pointer">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs text-outline">{txPage} / {txData.pages}</span>
                <button onClick={() => setTxPage(p => Math.min(txData.pages, p + 1))} disabled={txPage === txData.pages}
                  className="w-8 h-8 rounded-lg bg-surface-container-high border border-white/8 flex items-center justify-center disabled:opacity-30 cursor-pointer">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )
      )}
    </div>
  );
}

export default function App() {
  const [MANGA_LIST, setMangaList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [routePage, setRoutePage] = useState(() => parsePath().page);

  // Paksa refresh saat ada versi baru di server
  const [showUpdateBanner, setShowUpdateBanner] = useState(false);
  const [buildId, setBuildId] = useState(null);
  const [updateLabel, setUpdateLabel] = useState('');
  const [isResettingApp, setIsResettingApp] = useState(false);

  const softResetApp = async () => {
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
  };

  const triggerUpdate = (label) => {
    setUpdateLabel(label || '');
    setShowUpdateBanner(true);
    setTimeout(() => {
      softResetApp();
    }, 1200);
  };


  useEffect(() => {
    let currentVersion = null;

    const checkVersion = async () => {
      try {
        const res = await fetch('/version.json?t=' + Date.now(), { cache: 'no-store' });
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
      } catch {}
    };

    checkVersion();
    const interval = setInterval(checkVersion, 60 * 1000);
    return () => clearInterval(interval);
  }, []);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [activeChapter, setActiveChapter] = useState(null);
  const [activeMangaTitle, setActiveMangaTitle] = useState('');
  const [selectedManga, setSelectedManga] = useState(null);
  const [loadingManga, setLoadingManga] = useState(false);
  const selectedMangaRef = useRef(null);
  const mangaListRef = useRef([]);
  const [activeTab, setActiveTab] = useState('library'); // 'library', 'discover', 'updates', 'profile'
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [historyChapters, setHistoryChapters] = useState({});
  const [currentPage, setCurrentPage] = useState(1);
  const [userCoins, setUserCoins] = useState(0);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [nameChangedAt, setNameChangedAt] = useState(null);
  const [showTrakteerModal, setShowTrakteerModal] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authReason, setAuthReason] = useState(null);
  // Splash "menyelesaikan masuk" — aktif bila balik dari OAuth (URL bawa ?code=)
  const [finishingLogin, setFinishingLogin] = useState(() => {
    try { return new URLSearchParams(window.location.search).has('code'); } catch { return false; }
  });
  const [isCoinModalOpen, setIsCoinModalOpen] = useState(false);
  const [, setIsUnlockModalOpen] = useState(false);
  const [d1UnlockedChapters, setD1UnlockedChapters] = useState(new Set());
  const d1UnlockedRef = useRef(d1UnlockedChapters);
  d1UnlockedRef.current = d1UnlockedChapters;
  const [pendingUnlockChapter, setPendingUnlockChapter] = useState(null);
  const [pendingMangaTitle, setPendingMangaTitle] = useState('');
  const [pendingManga, setPendingManga] = useState(null);
  const [isLockedModalOpen, setIsLockedModalOpen] = useState(false);
  const [isCheckingAccess, setIsCheckingAccess] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [showDmca, setShowDmca] = useState(false);
  const ITEMS_PER_PAGE = 6;

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
      setDesc('');
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
      if (!ch || d1UnlockedRef.current.has(ch.id)) return;
      setPendingUnlockChapter(ch);
      setPendingMangaTitle(manga.title);
      setPendingManga(manga);
      setIsLockedModalOpen(true);
    } catch {}
  };

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
            await loadUserData(user);
            await resumeLoginIntent();
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
      await loadUserData(user);
    };

    initAuth();
  }, []);

  const loadUserData = async (user) => {
    const workerUrl = import.meta.env.VITE_WORKER_URL || '';
    if (!workerUrl) return;
    const token = await getAccessToken();
    if (!token) return;
    const headers = { 'Authorization': `Bearer ${token}` };

    const doFetchBalance = () => fetch(`${workerUrl}/api/user/me`, { headers })
      .then(r => r.json()).then(d => {
        if (typeof d.coins === 'number') setUserCoins(d.coins);
        if (d.name_changed_at) setNameChangedAt(d.name_changed_at);
        setCurrentUser(prev => prev ? { ...prev, ...(d.name ? { name: d.name } : {}), is_donor: !!d.is_donor, daily_claim_at: d.daily_claim_at ?? null } : prev);
      })
      .catch(() => {});

    // Auto-claim coins dari trakteer (pakai email Google)
    const claimEmail = user.email;
    if (claimEmail) {
      fetch(`${workerUrl}/api/user/claim-coins`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ trakteer_email: claimEmail }),
      }).then(r => r.json()).then(d => {
        if (d.transferred > 0) localStorage.removeItem(`tx_cache_${user.id}`);
      }).catch(() => {}).finally(() => doFetchBalance());
    } else {
      doFetchBalance();
    }

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

    fetch(`${workerUrl}/api/user/unlocked`, { headers })
      .then(r => r.json()).then(ids => {
        if (Array.isArray(ids)) {
          unlockedFetchedAt.current = Date.now();
          setD1UnlockedChapters(new Set(ids));
        }
      }).catch(() => {});

  };

  // Fetch catalog dari /manga/index.json
  useEffect(() => {
    fetch('/manga/index.json', { cache: 'no-cache' })
      .then(r => r.json())
      .then(data => {
        setMangaList(data); mangaListRef.current = data; setIsLoading(false);
        // Override trending pakai views terkini (24 jam) dari worker.
        // Kalau kosong/gagal → tetap pakai isTrending build-time (fallback).
        const workerUrl = import.meta.env.VITE_WORKER_URL || '';
        if (!workerUrl) return;
        fetch(`${workerUrl}/api/trending`)
          .then(r => r.ok ? r.json() : null)
          .then(t => {
            if (!t?.trending?.length) return;
            const ids = [...t.trending];
            // lengkapi sampai 5 dari trending build-time agar carousel tidak terlalu sedikit
            for (const m of data) { if (ids.length >= 5) break; if (m.isTrending && !ids.includes(m.id)) ids.push(m.id); }
            const set = new Set(ids.slice(0, 5));
            const updated = data.map(m => ({ ...m, isTrending: set.has(m.id) }));
            setMangaList(updated); mangaListRef.current = updated;
          })
          .catch(() => {});
      })
      .catch(() => setIsLoading(false));
  }, []);

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
        fetch(`/manga/${mangaId}.json`)
          .then(r => r.ok ? r.json() : null)
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
        const loadReader = (manga) => {
          const ch = (manga.chapters || []).find(
            c => String(c.chapter_number) === chapterNum
          );
          if (!ch) { navigate(`/${mangaId}`, true); return; }

          const stillLocked = ch.unlockDate && new Date(ch.unlockDate).getTime() > Date.now();
          if (stillLocked && !d1UnlockedRef.current.has(ch.id)) {
            navigate(`/${mangaId}`, true);
            if (!isLoggedIn) openAuth('unlock', { type: 'unlock', mangaId, chapterNum: ch.chapter_number });
            else { setPendingUnlockChapter(ch); setPendingMangaTitle(manga.title); setIsUnlockModalOpen(true); }
            return;
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
          fetch(`/manga/${mangaId}.json`)
            .then(r => r.ok ? r.json() : null)
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
  const handleDailyClaim = async () => {
    const workerUrl = import.meta.env.VITE_WORKER_URL || '';
    const token = await getAccessToken();
    if (!workerUrl || !token) return { ok: false };
    try {
      const res = await fetch(`${workerUrl}/api/user/daily-claim`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'X-Device-Id': getDeviceId() },
      });
      const d = await res.json();
      if (d.ok) {
        setUserCoins(prev => prev + (d.coins_added || 1));
        setCurrentUser(prev => prev ? { ...prev, daily_claim_at: new Date().toISOString() } : prev);
        showToast(`+${d.coins_added || 1} koin harian diklaim!`);
      } else if (d.blocked) {
        showToast('Klaim harian dibatasi pada perangkat ini.');
      }
      return d;
    } catch { return { ok: false }; }
  };

  // Filter manga based on search query
  const filteredManga = MANGA_LIST.filter((m) =>
    m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.genres.some((g) => g.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const totalPages = Math.ceil(filteredManga.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedManga = filteredManga.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const openChapterReader = (chapter, mangaTitle) => {
    setActiveMangaTitle(mangaTitle || "");
    // Ambil mangaId dari chapter.id terlebih dahulu (paling akurat)
    const mangaId = chapter.id?.replace(/-ch-[\d.]+$/, '')
      || MANGA_LIST.find(m => m.chapters?.some(c => c.id === chapter.id))?.id
      || selectedMangaRef.current?.id
      || '';
    if (!mangaId) return; // tidak bisa navigasi tanpa mangaId
    navigate(`/${mangaId}/${chapter.chapter_number}`);
    const manga = MANGA_LIST.find(m => m.chapters.some(c => c.id === chapter.id));
    if (manga) {
      // Simpan ke localStorage (semua user)
      setHistoryChapters(prev => ({ ...prev, [manga.id]: { ...chapter, last_read_at: new Date().toISOString() } }));
      // Sync ke D1 (user login saja) — upsert, timpa chapter lama
      if (isLoggedIn && currentUser) {
        const workerUrl = import.meta.env.VITE_WORKER_URL || '';
        getAccessToken().then(token => {
          if (!token) return;
          fetch(`${workerUrl}/api/user/history`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ manga_id: manga.id, chapter_id: chapter.id, chapter_number: chapter.chapter_number, chapter_title: chapter.title }),
          }).catch(() => {});
        });
      }
    }
  };

  // Verifikasi kepemilikan chapter langsung ke server + refresh daftar unlocked.
  // Hasil di-cache 60 detik agar klik berulang tidak memboroskan request worker.
  const unlockedFetchedAt = useRef(0);
  const verifyOwnership = async (chapterId) => {
    const workerUrl = import.meta.env.VITE_WORKER_URL || '';
    if (!workerUrl || !isLoggedIn) return false;
    if (Date.now() - unlockedFetchedAt.current < 60_000) {
      return d1UnlockedRef.current.has(chapterId);
    }
    try {
      const token = await getAccessToken();
      if (!token) return false;
      const res = await fetch(`${workerUrl}/api/user/unlocked`, { headers: { Authorization: `Bearer ${token}` } });
      const ids = await res.json();
      if (Array.isArray(ids)) {
        unlockedFetchedAt.current = Date.now();
        const set = new Set(ids);
        setD1UnlockedChapters(set);
        return set.has(chapterId);
      }
    } catch {}
    return false;
  };

  const handleReadChapter = (chapter, mangaTitle, mangaObj) => {
    const isLocked = !!chapter.unlockDate && new Date(chapter.unlockDate).getTime() > Date.now() && !d1UnlockedChapters.has(chapter.id);

    if (isLocked) {
      setIsCheckingAccess(true);
      verifyOwnership(chapter.id).then(owned => {
        setIsCheckingAccess(false);
        if (owned) {
          openChapterReader(chapter, mangaTitle);
          return;
        }
        setPendingUnlockChapter(chapter);
        setPendingMangaTitle(mangaTitle);
        setPendingManga(mangaObj || selectedManga);
        setIsLockedModalOpen(true);
      });
      return;
    }

    openChapterReader(chapter, mangaTitle);
  };

  const UNLOCK_COST = 10;
  // Pindah modal: tutup modal chapter terkunci, buka modal beli koin.
  const goToBuyCoins = () => {
    setIsLockedModalOpen(false);
    setIsUnlockModalOpen(false);
    setIsCoinModalOpen(true);
  };

  const handleConfirmUnlock = async () => {
    if (!pendingUnlockChapter) return;
    // Koin tidak cukup → arahkan ke modal beli koin.
    if (userCoins < UNLOCK_COST) { goToBuyCoins(); return; }

    const workerUrl = import.meta.env.VITE_WORKER_URL || '';
    const token = await getAccessToken();

    if (workerUrl && token) {
      try {
        const res = await fetch(`${workerUrl}/api/user/unlock-chapter`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chapter_id: pendingUnlockChapter.id,
            manga_id: pendingManga?.id || selectedManga?.id || pendingUnlockChapter.id.split('-ch-')[0],
            cost: UNLOCK_COST,
          }),
        });
        const d = await res.json();
        if (!res.ok && !d.already_owned) {
          // Saldo berubah / kurang di server → buka modal beli koin, bukan sekadar toast.
          if (d.error === 'Insufficient coins') goToBuyCoins();
          else showToast('Gagal membuka chapter.');
          return;
        }
        // Sudah dimiliki → server TIDAK memotong koin, jadi jangan kurangi lokal.
        if (d.already_owned) { /* tanpa potongan */ }
        else if (typeof d.coins_remaining === 'number') setUserCoins(d.coins_remaining);
        else setUserCoins(prev => prev - UNLOCK_COST);
        // Invalidate tx cache
        if (currentUser) localStorage.removeItem(`tx_cache_${currentUser.id}`);
      } catch {
        showToast('Koneksi gagal, coba lagi.');
        return;
      }
    } else {
      // Offline fallback
      setUserCoins(prev => prev - UNLOCK_COST);
    }

    // Tandai owned secara SINKRON (ref + state) supaya pengecekan rute saat
    // openChapterReader→navigate tidak menendang balik chapter yang baru dibeli.
    const owned = new Set([...d1UnlockedRef.current, pendingUnlockChapter.id]);
    d1UnlockedRef.current = owned;
    setD1UnlockedChapters(owned);

    setIsLockedModalOpen(false);
    setIsUnlockModalOpen(false);
    showToast('Chapter berhasil dibuka!');
    openChapterReader(pendingUnlockChapter, pendingMangaTitle);
    setPendingUnlockChapter(null);
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
            if (typeof d.coins === 'number') setUserCoins(d.coins);
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
          userCoins={userCoins}
          isLoggedIn={isLoggedIn}
          currentUser={currentUser}
          onLoginClick={() => openAuth()}
          onLogout={async () => {
            await authLogout();
            clearChapterTokens(); // cegah reuse token chapter oleh akun lain di device ini
            setIsLoggedIn(false);
            setCurrentUser(null);
            setUserCoins(0);
            setHistoryChapters({});
            setD1UnlockedChapters(new Set());
          }}
          onBuyCoinsClick={() => {
            if (isLoggedIn) {
              setIsCoinModalOpen(true);
            } else {
              openAuth();
            }
          }}
          onDropdownOpen={async () => {
            if (!isLoggedIn || !currentUser) return;
            const workerUrl = import.meta.env.VITE_WORKER_URL || '';
            if (!workerUrl) return;
            const token = await getAccessToken();
            if (!token) return;
            const headers = { 'Authorization': `Bearer ${token}` };
            const claimEmail = currentUser.email;
            if (claimEmail) {
              fetch(`${workerUrl}/api/user/claim-coins`, {
                method: 'POST',
                headers: { ...headers, 'Content-Type': 'application/json' },
                body: JSON.stringify({ trakteer_email: claimEmail }),
              }).then(r => r.json()).then(d => {
                if (d.transferred > 0) localStorage.removeItem(`tx_cache_${currentUser.id}`);
              }).catch(() => {}).finally(() => {
                fetch(`${workerUrl}/api/user/me`, { headers })
                  .then(r => r.json()).then(d => { if (typeof d.coins === 'number') setUserCoins(d.coins); })
                  .catch(() => {});
              });
            }
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
          <div className="fixed inset-0 bg-[#090b0d] flex items-center justify-center z-[199]">
            <div className="w-10 h-10 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          </div>
        ) : loadingManga ? (
          <MangaDetailSkeleton />
        ) : selectedManga ? (
          /* Manga Detail View */
          <Suspense fallback={<MangaDetailSkeleton />}>
            <MangaDetailPage
              manga={selectedManga}
              onReadChapter={handleReadChapter}
              lastReadChapter={historyChapters[selectedManga.id]}
              unlockedChapters={d1UnlockedChapters}
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
                    {isLoading ? (
                      <div className="flex flex-col gap-2">
                        <div className="h-[220px] sm:h-[260px] md:h-[300px] lg:h-[340px] rounded-xl bg-surface-container animate-pulse border border-white/5" />
                        <div className="flex justify-center gap-2">
                          <div className="h-1.5 w-6 rounded-full bg-surface-container-high animate-pulse" />
                          <div className="h-1.5 w-1.5 rounded-full bg-surface-container-high animate-pulse" />
                        </div>
                      </div>
                    ) : MANGA_LIST.length > 0 ? (
                    <>
                    <SpotlightCarousel
                      mangaList={MANGA_LIST}
                      onViewManga={(manga) => { navigate(`/${manga.id}`); }}
                    />

                    <FeaturedCarousel
                      mangaList={MANGA_LIST}
                      onReadChapter={(ch, title) => handleReadChapter(ch, title)}
                      onViewManga={(manga) => { navigate(`/${manga.id}`); }}
                      onReadFirst={async (mangaId) => {
                        const r = await fetch(`/manga/${mangaId}.json`, { cache: 'no-cache' });
                        if (!r.ok) return;
                        const fullManga = await r.json();
                        const oldest = [...(fullManga.chapters || [])].sort((a, b) => a.chapter_number - b.chapter_number)[0];
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
                  <div className="flex items-center justify-between border-b border-white/5 pb-4">
                    <h2 className="font-headline-md text-xl sm:text-2xl font-black text-on-surface flex items-center gap-3">
                      <TrendingUp className="w-6 h-6 text-amber-500" />
                      {searchQuery ? `Search Results for "${searchQuery}"` : 'Latest Updates'}
                    </h2>
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
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="relative w-full group"
                    >
                      <Search className="w-5 h-5 text-outline absolute left-4.5 top-1/2 -translate-y-1/2 group-focus-within:text-primary transition-colors" />
                      <input
                        type="text"
                        placeholder="Search manga by title or genre..."
                        value={searchQuery}
                        onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                        className="w-full bg-surface-container/60 border border-outline-variant/40 rounded-2xl py-3.5 pl-12 pr-4 text-sm text-on-surface placeholder:text-outline focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all font-body-md shadow-inner"
                      />
                    </motion.div>
                  )}

                  {isLoading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 xl:gap-6">
                      {Array.from({ length: 6 }).map((_, i) => <MangaCardSkeleton key={i} />)}
                    </div>
                  ) : filteredManga.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-outline">
                      <Sparkles className="w-12 h-12 opacity-20 mb-4" />
                      <p className="text-lg font-bold">No manga found</p>
                      <p className="text-sm">Try searching for other titles or genres</p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 xl:gap-6">
                        {paginatedManga.map((manga) => (
                          <div key={manga.id}>
                            <MangaCard
                              manga={manga}
                              unlockedChapters={d1UnlockedChapters}
                              onViewManga={() => { navigate(`/${manga.id}`); }}
                              onReadChapter={(ch, title) => handleReadChapter(ch, title || manga.title, manga)}
                            />
                          </div>
                        ))}
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
                                  ? "w-9 h-9 rounded-xl text-xs font-black transition-all bg-primary text-on-primary shadow-lg shadow-primary/20 cursor-default"
                                  : "w-9 h-9 rounded-xl text-xs font-black transition-all bg-surface-container border border-white/5 text-outline hover:text-on-surface hover:bg-surface-container-high cursor-pointer"}
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
                        <img 
                          alt={manga.title} 
                          className="w-14 aspect-[2/3] object-cover rounded-xl border border-white/10 shrink-0 shadow-md" 
                          src={manga.coverUrl} 
                        />
                        <div className="min-w-0 flex-1 flex flex-col justify-center">
                          <h3 className="font-extrabold text-sm md:text-base text-on-surface truncate">{manga.title}</h3>
                          <p className="text-xs text-outline mt-0.5 truncate">Read: {latestChapter.title}</p>
                          <span className="text-[10px] text-outline/60 mt-1 font-semibold">
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
            <img src="/logo-footer.webp" alt="Nurananto Scanlation" width="1843" height="552" className="h-11 md:h-14 xl:h-16 w-auto" />
            <div className="w-full border border-white/8 rounded-xl px-5 sm:px-6 py-4 bg-white/[0.02]">
              <p className="font-body-sm text-xs text-outline/70 leading-relaxed text-center">
                Ini adalah situs fan terjemahan <em>unofficial</em> yang dibuat semata-mata karena kecintaan terhadap manga.
                Seluruh karya yang ditampilkan di sini merupakan milik penerbit dan pengarang aslinya.
                Jika sudah tersedia versi resmi/official dalam bahasa Indonesia, kami sangat mendukung kamu untuk membeli dan mendukung karya aslinya.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
              <button
                onClick={() => setShowPrivacy(true)}
                className="font-body-sm text-[10px] text-outline/40 hover:text-outline/70 transition-colors cursor-pointer underline underline-offset-2"
              >
                Kebijakan Privasi
              </button>
              <span className="text-outline/20 text-[10px]">·</span>
              <button
                onClick={() => setShowTerms(true)}
                className="font-body-sm text-[10px] text-outline/40 hover:text-outline/70 transition-colors cursor-pointer underline underline-offset-2"
              >
                Syarat &amp; Ketentuan
              </button>
              <span className="text-outline/20 text-[10px]">·</span>
              <button
                onClick={() => setShowDmca(true)}
                className="font-body-sm text-[10px] text-outline/40 hover:text-outline/70 transition-colors cursor-pointer underline underline-offset-2"
              >
                DMCA
              </button>
            </div>
            <span className="font-body-sm text-[10px] text-outline/40">
              © {new Date().getFullYear()} Nurananto Scanlation. Fan Translation — Not for commercial use.
            </span>
            <VisitorCount />
            {buildId && (
              <div className="flex items-center gap-2">
                <span className="font-body-sm text-[9px] text-outline/25">
                  build #{buildId.slice(-6)}
                </span>
                <button
                  onClick={softResetApp}
                  className="font-body-sm text-[9px] text-outline/35 hover:text-outline/70 underline underline-offset-2 transition-colors cursor-pointer"
                >
                  Reset cache app
                </button>
              </div>
            )}
          </div>
        </footer>
      )}

      {/* Legal Modals */}
      <Suspense fallback={null}>
        {showPrivacy && <PrivacyPolicyModal onClose={() => setShowPrivacy(false)} />}
        {showTerms && <TermsOfServiceModal onClose={() => setShowTerms(false)} />}
        {showDmca && <DmcaModal onClose={() => setShowDmca(false)} />}
      </Suspense>


      {/* Checking chapter access overlay */}
      <AnimatePresence>
        {isCheckingAccess && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[250] bg-[#090b0d] flex flex-col items-center justify-center gap-4"
          >
            <div className="relative w-14 h-14">
              <div className="absolute inset-0 rounded-full border-4 border-white/8" />
              <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-primary animate-spin" />
              <div className="absolute inset-[5px] rounded-full border-2 border-transparent border-t-primary/40 animate-spin" style={{ animationDirection: 'reverse', animationDuration: '0.8s' }} />
            </div>
            <p className="font-body-md text-sm text-outline/70 font-semibold tracking-wide">Checking chapter access</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Interactive Reader Modal */}
      {activeChapter && (
        <Suspense fallback={null}>
          <ReaderModal
            chapter={activeChapter}
            manga={selectedManga}
            onClose={() => { navigate(`/${selectedManga?.id || ''}`); }}
            onReadChapter={handleReadChapter}
            unlockedChapters={d1UnlockedChapters}
            isLoggedIn={isLoggedIn}
            currentUser={currentUser}
            userCoins={userCoins}
            onDailyClaim={handleDailyClaim}
            onLoginClick={() => openAuth('reader')}
          />
        </Suspense>
      )}

      {/* Change Password Modal */}
      {isChangePasswordOpen && (
        <AccountSettingsModal
          isOpen={isChangePasswordOpen}
          onClose={() => setIsChangePasswordOpen(false)}
          currentUser={currentUser}
          nameChangedAt={nameChangedAt}
          onSave={async ({ username, trakteerEmail }) => {
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
              // Claim koin dari Trakteer
              if (trakteerEmail) {
                const claimRes = await fetch(`${workerUrl}/api/user/claim-coins`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                  body: JSON.stringify({ trakteer_email: trakteerEmail }),
                });
                const d = await claimRes.json();
                if (d.transferred > 0) {
                  showToast(`${d.transferred} koin berhasil diklaim!`);
                  setUserCoins(prev => prev + d.transferred);
                }
                const meRes = await fetch(`${workerUrl}/api/user/me`, { headers: { 'Authorization': `Bearer ${token}` } });
                const me = await meRes.json();
                if (typeof me.coins === 'number') setUserCoins(me.coins);
              }
            } catch (e) {
              console.error('Save settings error:', e);
            }
            setIsChangePasswordOpen(false);
            showToast('Pengaturan berhasil disimpan!');
          }}
        />
      )}
      {/* Auth Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        reason={authReason}
        onClose={() => {
          setIsAuthModalOpen(false);
          try { sessionStorage.removeItem('mf_login_intent'); } catch {}
        }}
      />

      {/* Trakteer Email Modal — muncul saat pertama kali login */}
      <TrakteerEmailModal
        isOpen={showTrakteerModal}
        defaultEmail={currentUser?.email || ''}
        onClose={() => setShowTrakteerModal(false)}
        onSave={async () => {
          setShowTrakteerModal(false);
          showToast('Email berhasil disimpan!');
        }}
      />

      {/* Coin Purchase Modal */}
      <CoinPurchaseModal
        isOpen={isCoinModalOpen}
        onClose={() => setIsCoinModalOpen(false)}
        userCoins={userCoins}
        userEmail={currentUser?.email || ''}
        dailyClaimAt={currentUser?.daily_claim_at || null}
        onDailyClaim={handleDailyClaim}
        onPurchase={(addedCoins) => {
          setUserCoins(prev => prev + addedCoins);
        }}
      />

      {/* Locked Chapter Modal */}
      <LockedChapterModal
        isOpen={isLockedModalOpen}
        onClose={() => setIsLockedModalOpen(false)}
        chapter={pendingUnlockChapter}
        manga={pendingManga}
        isLoggedIn={isLoggedIn}
        userCoins={userCoins}
        onConfirm={handleConfirmUnlock}
        onLogin={() => { setIsLockedModalOpen(false); openAuth('unlock', { type: 'unlock', mangaId: pendingManga?.id, chapterNum: pendingUnlockChapter?.chapter_number }); }}
        onGoToStore={() => { setIsLockedModalOpen(false); setIsCoinModalOpen(true); }}
      />

      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -50, scale: 0.9 }}
            className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] bg-surface-container-high border border-primary/20 text-on-surface px-6 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 animate-[fadeIn_0.2s_ease-out]"
          >
            <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center">
              <CheckCircle className="w-3.5 h-3.5 text-primary" />
            </div>
            <span className="text-xs font-bold">{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
