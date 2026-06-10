import { useState, useEffect, useRef } from 'react';
import TopNavBar from './components/TopNavBar';
import FeaturedCarousel from './components/FeaturedCarousel';
import SpotlightCarousel from './components/SpotlightCarousel';
import MangaCard from './components/MangaCard';
import ReaderModal from './components/ReaderModal';
import MangaDetailPage from './components/MangaDetailPage';
import { Sparkles, TrendingUp, BookOpen, Compass, RotateCcw, User, Heart, Shield, HelpCircle, Star, Search, Key, X, Coffee, CheckCircle, ArrowRight, Coins, ChevronLeft, ChevronRight } from 'lucide-react';
import { imgUrl, timeAgo } from './utils';
import { motion, AnimatePresence } from 'framer-motion';
import { AuthModal, CoinPurchaseModal, UnlockModal, LockedChapterModal, TrakteerEmailModal, AccountSettingsModal } from './components/CoinModals';
import PrivacyPolicyModal from './components/PrivacyPolicyModal';
import TermsOfServiceModal from './components/TermsOfServiceModal';
import DmcaModal from './components/DmcaModal';
import { MangaCardSkeleton, MangaDetailSkeleton } from './components/Skeleton';
import { parsePath, navigate } from './router';
import { supabase } from './lib/supabase';

// ── History Tabs: Baca + Koin ────────────────────────────────
function HistoryTabs({ historyEntries, handleReadChapter, isLoggedIn, currentUser, workerUrl, supabase }) {
  const [tab, setTab] = useState('read');
  const [txData, setTxData] = useState(null);
  const [txPage, setTxPage] = useState(1);
  const [txLoading, setTxLoading] = useState(false);
  const CACHE_KEY = `tx_cache_${currentUser?.id || 'guest'}`;
  const CACHE_TTL = 365 * 24 * 3600 * 1000; // 1 tahun

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
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;
      const res = await fetch(`${workerUrl}/api/user/transactions?page=${page}&limit=10`, {
        headers: { 'Authorization': `Bearer ${session.access_token}` },
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
              const isPositive = tx.type === 'trakteer';
              const coinAmount = isPositive ? `+${tx.amount}` : `-${Math.abs(tx.amount)}`;
              return (
                <div key={tx.id} className="flex items-center gap-3 bg-surface-container border border-white/8 rounded-xl p-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isPositive ? 'bg-amber-500/10' : 'bg-red-500/10'}`}>
                    <Coins className={`w-4 h-4 ${isPositive ? 'text-amber-400' : 'text-red-400'}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs sm:text-sm font-bold text-on-surface truncate">{tx.note || tx.type}</p>
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
  const initialRoute = useState(() => parsePath())[0];

  // Paksa refresh saat ada versi baru di server
  useEffect(() => {
    let currentVersion = null;

    const checkVersion = async () => {
      try {
        const res = await fetch('/version.json?t=' + Date.now(), { cache: 'no-store' });
        const { v } = await res.json();
        if (currentVersion === null) {
          currentVersion = v; // simpan versi pertama
        } else if (v !== currentVersion) {
          window.location.reload(); // versi berbeda → reload
        }
      } catch {
        // ignore network error
      }
    };

    checkVersion();
    const interval = setInterval(checkVersion, 60 * 1000); // cek tiap 1 menit
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
  const [showTrakteerModal, setShowTrakteerModal] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isCoinModalOpen, setIsCoinModalOpen] = useState(false);
  const [isUnlockModalOpen, setIsUnlockModalOpen] = useState(false);
  const [d1UnlockedChapters, setD1UnlockedChapters] = useState(new Set());
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

  // Supabase auth — listen session changes
  useEffect(() => {
    // Cek session saat ini
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setIsLoggedIn(true);
        setCurrentUser(session.user);
      }
    });

    // Listen perubahan auth (login/logout/magic link callback)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        setIsLoggedIn(true);
        setCurrentUser(session.user);
        setIsAuthModalOpen(false);
        // Pertama kali login → tampilkan modal konfirmasi email (pre-filled dari akun)
        if (event === 'SIGNED_IN' && !session.user.user_metadata?.trakteer_email) {
          setShowTrakteerModal(true);
        }
        // Fetch coin balance + history + auto-claim dari Worker
        const workerUrl = import.meta.env.VITE_WORKER_URL || '';
        if (workerUrl && session.access_token) {
          const headers = { 'Authorization': `Bearer ${session.access_token}` };
          // Auto-claim dulu, lalu fetch balance terbaru
          const claimEmail = session.user.user_metadata?.trakteer_email || session.user.email;
          const doFetchBalance = () => fetch(`${workerUrl}/api/user/me`, { headers })
            .then(r => r.json()).then(d => { if (typeof d.coins === 'number') setUserCoins(d.coins); })
            .catch(() => {});

          if (claimEmail) {
            fetch(`${workerUrl}/api/user/claim-coins`, {
              method: 'POST',
              headers: { ...headers, 'Content-Type': 'application/json' },
              body: JSON.stringify({ trakteer_email: claimEmail }),
            }).then(r => r.json()).then(d => {
              if (d.transferred > 0) localStorage.removeItem(`tx_cache_${session.user.id}`);
            }).catch(() => {}).finally(() => doFetchBalance()); // fetch balance SETELAH claim
          } else {
            doFetchBalance();
          }
          // History — load dari D1 ke state
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
          // Unlocked chapters — load dari D1
          fetch(`${workerUrl}/api/user/unlocked`, { headers })
            .then(r => r.json()).then(ids => {
              if (Array.isArray(ids)) setD1UnlockedChapters(new Set(ids));
            }).catch(() => {});
        }
      } else {
        setIsLoggedIn(false);
        setCurrentUser(null);
        setUserCoins(0);
        setHistoryChapters({});
        setD1UnlockedChapters(new Set());
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Fetch catalog dari /manga/index.json
  useEffect(() => {
    fetch('/manga/index.json', { cache: 'no-cache' })
      .then(r => r.json())
      .then(data => { setMangaList(data); mangaListRef.current = data; setIsLoading(false); })
      .catch(() => setIsLoading(false));
  }, []);

  // Path-based routing
  useEffect(() => {
    const handleRoute = () => {
      const { page, mangaId, chapterNum } = parsePath();

      if (page === 'home') {
        setSelectedManga(null);
        setActiveChapter(null);
        setActiveTab('library');
      } else if (page === 'history') {
        setSelectedManga(null);
        setActiveChapter(null);
        setActiveTab('profile');
      } else if (page === 'manga') {
        setLoadingManga(true);
        setSelectedManga(null);
        fetch(`/manga/${mangaId}.json?t=${Date.now()}`)
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
      } else if (page === 'reader') {
        // Fetch manga kalau belum ada atau berbeda
        const loadReader = (manga) => {
          const ch = (manga.chapters || []).find(
            c => String(c.chapter_number) === chapterNum
          );
          if (!ch) { navigate(`/${mangaId}`, true); return; }

          const isTimeUnlocked = ch.unlockDate && new Date(ch.unlockDate).getTime() <= Date.now();
          if (ch.isLocked && !isTimeUnlocked) {
            navigate(`/${mangaId}`, true);
            if (!isLoggedIn) setIsAuthModalOpen(true);
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
          fetch(`/manga/${mangaId}.json?t=${Date.now()}`)
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
    // Ambil mangaId dari ref, atau extract dari chapter.id (format: "waka-chan-ch-35")
    const mangaId = selectedMangaRef.current?.id
      || chapter.id?.replace(/-ch-[\d.]+$/, '')
      || MANGA_LIST.find(m => m.chapters?.some(c => c.id === chapter.id))?.id
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
        supabase.auth.getSession().then(({ data: { session } }) => {
          if (!session?.access_token) return;
          fetch(`${workerUrl}/api/user/history`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
            body: JSON.stringify({ manga_id: manga.id, chapter_id: chapter.id, chapter_number: chapter.chapter_number, chapter_title: chapter.title }),
          }).catch(() => {});
        });
      }
    }
  };

  const handleReadChapter = (chapter, mangaTitle, mangaObj) => {
    const isTimeUnlocked = chapter.unlockDate && new Date(chapter.unlockDate).getTime() <= new Date().getTime();
    const isLocked = chapter.isLocked && !isTimeUnlocked && !d1UnlockedChapters.has(chapter.id);

    if (isLocked) {
      setIsCheckingAccess(true);
      setTimeout(() => {
        setIsCheckingAccess(false);
        setPendingUnlockChapter(chapter);
        setPendingMangaTitle(mangaTitle);
        setPendingManga(mangaObj || selectedManga);
        setIsLockedModalOpen(true);
      }, 700);
      return;
    }

    openChapterReader(chapter, mangaTitle);
  };

  const handleConfirmUnlock = async () => {
    if (!pendingUnlockChapter) return;
    if (userCoins < 5) { setIsUnlockModalOpen(false); setIsCoinModalOpen(true); return; }

    const workerUrl = import.meta.env.VITE_WORKER_URL || '';
    const { data: { session } } = await supabase.auth.getSession();

    if (workerUrl && session?.access_token) {
      try {
        const res = await fetch(`${workerUrl}/api/user/unlock-chapter`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ chapter_id: pendingUnlockChapter.id, cost: 5 }),
        });
        const d = await res.json();
        if (!res.ok && !d.already_owned) {
          showToast(d.error === 'Insufficient coins' ? 'Koin tidak cukup!' : 'Gagal membuka chapter.');
          return;
        }
        if (typeof d.coins_remaining === 'number') setUserCoins(d.coins_remaining);
        else setUserCoins(prev => prev - 5);
        // Invalidate tx cache
        if (session.user) localStorage.removeItem(`tx_cache_${session.user.id}`);
      } catch {
        showToast('Koneksi gagal, coba lagi.');
        return;
      }
    } else {
      // Offline fallback
      setUserCoins(prev => prev - 5);
    }

    setD1UnlockedChapters(prev => new Set([...prev, pendingUnlockChapter.id]));
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
  };

  return (
    <div className="bg-surface text-on-surface font-body-md min-h-screen flex flex-col selection:bg-primary-container selection:text-on-primary-container pb-safe-20">
      
      {/* Top Nav Bar — sembunyikan saat reader aktif */}
      {!activeChapter && (
        <TopNavBar
          activeTab={activeTab}
          onTabClick={handleTabClick}
          onChangePasswordClick={() => setIsChangePasswordOpen(true)}
          userCoins={userCoins}
          isLoggedIn={isLoggedIn}
          currentUser={currentUser}
          onLoginClick={() => setIsAuthModalOpen(true)}
          onLogout={async () => {
            await supabase.auth.signOut();
            setIsLoggedIn(false);
            setCurrentUser(null);
          }}
          onBuyCoinsClick={() => {
            if (isLoggedIn) {
              setIsCoinModalOpen(true);
            } else {
              setIsAuthModalOpen(true);
            }
          }}
          onDropdownOpen={async () => {
            if (!isLoggedIn || !currentUser) return;
            const workerUrl = import.meta.env.VITE_WORKER_URL || '';
            if (!workerUrl) return;
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token) return;
            const headers = { 'Authorization': `Bearer ${session.access_token}` };
            const claimEmail = currentUser.user_metadata?.trakteer_email || currentUser.email;
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
        {loadingManga && initialRoute.page !== 'reader' ? (
          <MangaDetailSkeleton />
        ) : (isLoading || !activeChapter) && initialRoute.page === 'reader' ? (
          <div className="fixed inset-0 bg-[#090b0d] flex items-center justify-center z-[199]">
            <div className="w-10 h-10 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          </div>
        ) : loadingManga ? (
          <MangaDetailSkeleton />
        ) : selectedManga ? (
          /* Manga Detail View */
          <MangaDetailPage
            manga={selectedManga}
            onReadChapter={handleReadChapter}
            lastReadChapter={historyChapters[selectedManga.id]}
            unlockedChapters={d1UnlockedChapters}
          />
        ) : (
          /* Main Views based on Tab */
          <main className="pt-[88px] pb-16 px-2 sm:px-3 md:px-4 flex flex-col gap-12 w-full flex-1">
            
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
                    
                    {/* Trakteer Donation Banner */}
                    <a
                      href="https://trakteer.id/NuranantoScanlation"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="relative w-full overflow-hidden bg-gradient-to-r from-red-950/40 via-red-900/25 to-red-950/40 border border-red-500/20 py-3 rounded-xl flex items-center group shadow-md hover:border-red-500/40 hover:bg-red-950/50 transition-all duration-300 -mt-2 -mb-4 cursor-pointer"
                    >
                      <div className="flex whitespace-nowrap animate-marquee">
                        {/* Track 1 */}
                        <div className="flex items-center gap-8 pr-8">
                          {Array.from({ length: 3 }).map((_, i) => (
                            <div key={i} className="flex items-center gap-3 text-xs sm:text-sm font-bold text-white">
                              <img 
                                src="https://cdn.trakteer.id/images/embed/trbtn-icon.png" 
                                alt="Trakteer Logo" 
                                className="w-5 h-5 object-contain shrink-0 brightness-0 invert drop-shadow-[0_0_4px_rgba(255,255,255,0.3)] group-hover:scale-110 transition-transform duration-300"
                              />
                              <span>Suka dengan hasil terjemahan ini? Silahkan donasi ke Trakteer!</span>
                              <span className="flex items-center gap-1.5 bg-red-600 text-white px-2 py-0.5 rounded text-xs font-black shadow-sm group-hover:scale-105 transition-transform shrink-0">
                                Donasi
                              </span>
                            </div>
                          ))}
                        </div>
                        {/* Track 2 */}
                        <div className="flex items-center gap-8 pr-8">
                          {Array.from({ length: 3 }).map((_, i) => (
                            <div key={i} className="flex items-center gap-3 text-xs sm:text-sm font-bold text-white">
                              <img 
                                src="https://cdn.trakteer.id/images/embed/trbtn-icon.png" 
                                alt="Trakteer Logo" 
                                className="w-5 h-5 object-contain shrink-0 brightness-0 invert drop-shadow-[0_0_4px_rgba(255,255,255,0.3)] group-hover:scale-110 transition-transform duration-300"
                              />
                              <span>Suka dengan hasil terjemahan ini? Silahkan donasi ke Trakteer!</span>
                              <span className="flex items-center gap-1.5 bg-red-600 text-white px-2 py-0.5 rounded text-xs font-black shadow-sm group-hover:scale-105 transition-transform shrink-0">
                                Donasi
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </a>
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
                            className="px-4 py-2 rounded-xl bg-surface-container border border-white/5 text-xs font-bold text-outline hover:text-on-surface disabled:opacity-30 disabled:pointer-events-none hover:bg-surface-container-high transition-all cursor-pointer"
                          >
                            Previous
                          </button>
                          
                          <button
                            className="w-9 h-9 rounded-xl text-xs font-black transition-all bg-primary text-on-primary shadow-lg shadow-primary/20 cursor-default"
                          >
                            {currentPage}
                          </button>

                          <button
                            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                            disabled={currentPage === totalPages}
                            className="px-4 py-2 rounded-xl bg-surface-container border border-white/5 text-xs font-bold text-outline hover:text-on-surface disabled:opacity-30 disabled:pointer-events-none hover:bg-surface-container-high transition-all cursor-pointer"
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
                    supabase={supabase}
                  />
                </section>
              );
            })()}
            
          </main>
        )}
      </div>

      {/* Global Footer (Only on Homepage catalog) */}
      {!selectedManga && activeTab === 'library' && (
        <footer className="w-full py-10 bg-surface-container-lowest border-t border-white/5 mt-auto">
          <div className="w-full px-4 sm:px-6 md:px-8 flex flex-col items-center gap-4">
            <span className="font-headline-md text-lg font-black text-on-surface">
              Nurananto Scanlation
            </span>
            <div className="w-full border border-white/8 rounded-xl px-5 sm:px-6 py-4 bg-white/[0.02]">
              <p className="font-body-sm text-xs text-outline/70 leading-relaxed text-justify">
                Ini adalah situs fan terjemahan <em>unofficial</em> yang dibuat semata-mata karena kecintaan terhadap manga.
                Seluruh karya yang ditampilkan di sini merupakan milik penerbit dan pengarang aslinya.
                Jika sudah tersedia versi resmi/official dalam bahasa Indonesia, kami sangat mendukung kamu untuk membeli dan mendukung karya aslinya.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
              <span className="font-body-sm text-[10px] text-outline/40">
                © {new Date().getFullYear()} Nurananto Scanlation. Fan Translation — Not for commercial use.
              </span>
              <span className="text-outline/20 text-[10px]">·</span>
              <button
                onClick={() => setShowPrivacy(true)}
                className="font-body-sm text-[10px] text-outline/40 hover:text-outline/70 transition-colors cursor-pointer underline underline-offset-2"
              >
                Privacy Policy
              </button>
              <span className="text-outline/20 text-[10px]">·</span>
              <button
                onClick={() => setShowTerms(true)}
                className="font-body-sm text-[10px] text-outline/40 hover:text-outline/70 transition-colors cursor-pointer underline underline-offset-2"
              >
                Terms of Service
              </button>
              <span className="text-outline/20 text-[10px]">·</span>
              <button
                onClick={() => setShowDmca(true)}
                className="font-body-sm text-[10px] text-outline/40 hover:text-outline/70 transition-colors cursor-pointer underline underline-offset-2"
              >
                DMCA
              </button>
            </div>
          </div>
        </footer>
      )}

      {/* Legal Modals */}
      {showPrivacy && <PrivacyPolicyModal onClose={() => setShowPrivacy(false)} />}
      {showTerms && <TermsOfServiceModal onClose={() => setShowTerms(false)} />}
      {showDmca && <DmcaModal onClose={() => setShowDmca(false)} />}

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
        <ReaderModal
          chapter={activeChapter}
          manga={selectedManga}
          onClose={() => { navigate(`/${selectedManga?.id || ''}`); }}
          onReadChapter={handleReadChapter}
          unlockedChapters={d1UnlockedChapters}
        />
      )}

      {/* Change Password Modal */}
      {isChangePasswordOpen && (
        <AccountSettingsModal
          isOpen={isChangePasswordOpen}
          onClose={() => setIsChangePasswordOpen(false)}
          currentUser={currentUser}
          onSave={async ({ username, trakteerEmail }) => {
            const updates = {};
            if (username) updates.full_name = username;
            if (trakteerEmail) updates.trakteer_email = trakteerEmail;
            if (Object.keys(updates).length) {
              await supabase.auth.updateUser({ data: updates });
            }
            // Claim koin pending dari donasi Trakteer sebelum akun dibuat
            if (trakteerEmail) {
              const { data: { session } } = await supabase.auth.getSession();
              if (session?.access_token) {
                const workerUrl = import.meta.env.VITE_WORKER_URL || '';
                try {
                  const claimRes = await fetch(`${workerUrl}/api/user/claim-coins`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
                    body: JSON.stringify({ trakteer_email: trakteerEmail }),
                  });
                  const d = await claimRes.json();
                  if (d.transferred > 0) {
                    showToast(`${d.transferred} koin berhasil diklaim!`);
                    setUserCoins(prev => prev + d.transferred);
                  }
                  // Re-fetch balance dari Worker untuk pastikan sinkron
                  const meRes = await fetch(`${workerUrl}/api/user/me`, {
                    headers: { 'Authorization': `Bearer ${session.access_token}` },
                  });
                  const me = await meRes.json();
                  if (typeof me.coins === 'number') setUserCoins(me.coins);
                } catch (e) {
                  console.error('Claim coins error:', e);
                }
              }
            }
            setIsChangePasswordOpen(false);
            showToast('Pengaturan berhasil disimpan!');
          }}
        />
      )}
      {/* Auth Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
      />

      {/* Trakteer Email Modal — muncul saat pertama kali login */}
      <TrakteerEmailModal
        isOpen={showTrakteerModal}
        defaultEmail={currentUser?.email || ''}
        onClose={() => setShowTrakteerModal(false)}
        onSave={async (email) => {
          await supabase.auth.updateUser({ data: { trakteer_email: email } });
          setCurrentUser(prev => prev ? { ...prev, user_metadata: { ...prev.user_metadata, trakteer_email: email } } : prev);
          setShowTrakteerModal(false);
          showToast('Email berhasil disimpan!');
        }}
      />

      {/* Coin Purchase Modal */}
      <CoinPurchaseModal
        isOpen={isCoinModalOpen}
        onClose={() => setIsCoinModalOpen(false)}
        userCoins={userCoins}
        userEmail={currentUser?.user_metadata?.trakteer_email || currentUser?.email || ''}
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
        onLogin={() => { setIsLockedModalOpen(false); setIsAuthModalOpen(true); }}
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
