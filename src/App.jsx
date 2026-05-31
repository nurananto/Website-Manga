import { useState, useEffect, useRef } from 'react';
import TopNavBar from './components/TopNavBar';
import FeaturedCarousel from './components/FeaturedCarousel';
import MangaCard from './components/MangaCard';
import ReaderModal from './components/ReaderModal';
import MangaDetailPage from './components/MangaDetailPage';
import { Sparkles, TrendingUp, BookOpen, Compass, RotateCcw, User, Heart, Shield, HelpCircle, Star, Search, Key, X, Coffee, CheckCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { AuthModal, CoinPurchaseModal, UnlockModal } from './components/CoinModals';
import { MangaCardSkeleton, MangaDetailSkeleton } from './components/Skeleton';
import { parsePath, navigate } from './router';

export default function App() {
  const [MANGA_LIST, setMangaList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

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
  const [bookmarkedIds, setBookmarkedIds] = useState(() => new Set([1, 2]));
  const [historyChapters, setHistoryChapters] = useState({});
  const [currentPage, setCurrentPage] = useState(1);
  const [userCoins, setUserCoins] = useState(120);
  const [isLoggedIn, setIsLoggedIn] = useState(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isCoinModalOpen, setIsCoinModalOpen] = useState(false);
  const [isUnlockModalOpen, setIsUnlockModalOpen] = useState(false);
  const [pendingUnlockChapter, setPendingUnlockChapter] = useState(null);
  const [pendingMangaTitle, setPendingMangaTitle] = useState('');
  const [toastMessage, setToastMessage] = useState(null);
  const ITEMS_PER_PAGE = 6;

  // Fetch catalog dari /manga/index.json
  useEffect(() => {
    fetch('/manga/index.json?t=' + Date.now())
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

  const toggleBookmark = (id) => {
    setBookmarkedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
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
      setHistoryChapters(prev => ({
        ...prev,
        [manga.id]: chapter
      }));
    }
  };

  const handleReadChapter = (chapter, mangaTitle) => {
    const isTimeUnlocked = chapter.unlockDate && new Date(chapter.unlockDate).getTime() <= new Date().getTime();

    if (chapter.isLocked && !isTimeUnlocked) {
      if (!isLoggedIn) {
        setIsAuthModalOpen(true);
        return;
      }

      setPendingUnlockChapter(chapter);
      setPendingMangaTitle(mangaTitle);
      setIsUnlockModalOpen(true);
      return;
    }
    
    openChapterReader(chapter, mangaTitle);
  };

  const handleConfirmUnlock = () => {
    if (!pendingUnlockChapter) return;
    
    if (userCoins >= 5) {
      setUserCoins(prev => prev - 5);
      pendingUnlockChapter.isLocked = false; // unlock it in-memory
      setIsUnlockModalOpen(false);
      showToast("Chapter berhasil dibuka!");
      openChapterReader(pendingUnlockChapter, pendingMangaTitle);
      setPendingUnlockChapter(null);
    } else {
      setIsUnlockModalOpen(false);
      setIsCoinModalOpen(true);
    }
  };

  const handleTabClick = (tab) => {
    navigate('/');
    setSearchQuery('');
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
          onLoginClick={() => setIsAuthModalOpen(true)}
          onLogout={() => {
            setIsLoggedIn(false);
            alert('Berhasil keluar!');
          }}
          onBuyCoinsClick={() => {
            if (isLoggedIn) {
              setIsCoinModalOpen(true);
            } else {
              setIsAuthModalOpen(true);
            }
          }}
        />
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        {loadingManga ? (
          <MangaDetailSkeleton />
        ) : selectedManga ? (
          /* Manga Detail View */
          <MangaDetailPage
            manga={selectedManga}
            onReadChapter={handleReadChapter}
            isBookmarked={bookmarkedIds.has(selectedManga.id)}
            onToggleBookmark={() => toggleBookmark(selectedManga.id)}
            lastReadChapter={historyChapters[selectedManga.id]}
          />
        ) : (
          /* Main Views based on Tab */
          <main className="pt-[88px] pb-16 px-2 sm:px-3 md:px-4 flex flex-col gap-12 w-full flex-1">
            
            {activeTab === 'library' && (
              <>
                {/* Featured Carousel */}
                {!searchQuery && MANGA_LIST.length > 0 && (
                  <>
                    <FeaturedCarousel 
                      mangaList={MANGA_LIST} 
                      onReadChapter={(ch, title) => handleReadChapter(ch, title)} 
                      onViewManga={(manga) => { navigate(`/${manga.id}`); }}
                    />
                    
                    {/* Trakteer Donation Banner */}
                    <a
                      href="https://trakteer.id"
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
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5 xl:gap-6">
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
                      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5 xl:gap-6">
                        {paginatedManga.map((manga) => (
                          <div key={manga.id}>
                            <MangaCard
                              manga={manga}
                              onViewManga={() => { navigate(`/${manga.id}`); }}
                              onReadChapter={(ch, title) => handleReadChapter(ch, title || manga.title)}
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
              const bookmarkedManga = MANGA_LIST.filter(m => bookmarkedIds.has(m.id));
              return (
                <section className="flex flex-col gap-6 max-w-2xl mx-auto w-full">
                  <div className="border-b border-white/5 pb-4">
                    <h2 className="font-headline-md text-xl sm:text-2xl font-black text-on-surface flex items-center gap-3">
                      <Heart className="w-6 h-6 text-rose-500 fill-rose-500" />
                      Bookmarked Series
                    </h2>
                    <p className="text-outline text-sm mt-1">Readings you have saved to your library.</p>
                  </div>

                  {bookmarkedManga.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-outline">
                      <Heart className="w-12 h-12 opacity-20 mb-4" />
                      <p className="text-lg font-bold">No bookmarks yet</p>
                      <p className="text-sm">Click the bookmark icon on any manga details page to save it here</p>
                    </div>
                  ) : (
                    <div className="flex flex-col bg-surface-container rounded-[32px] border border-white/5 overflow-hidden divide-y divide-white/5">
                      {bookmarkedManga.map((manga) => {
                        const latestChapter = manga.chapters[0];
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
                              <p className="text-xs text-outline mt-0.5 truncate">Latest: {latestChapter.title}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>
              );
            })()}
            
          </main>
        )}
      </div>

      {/* Global Footer (Only on Homepage catalog) */}
      {!selectedManga && activeTab === 'library' && (
        <footer className="w-full py-12 bg-surface-container-lowest border-t border-white/5 mt-auto">
          <div className="max-w-[1600px] mx-auto px-6 md:px-12 flex flex-col md:flex-row justify-between items-center gap-6 w-full">
            <span className="font-headline-md text-xl sm:text-2xl font-black text-on-surface">
              MangaFlow
            </span>
            <div className="flex flex-wrap justify-center gap-6">
              <a className="font-label-sm text-xs text-outline hover:text-primary transition-colors uppercase tracking-wider font-semibold" href="#">Privacy Policy</a>
              <a className="font-label-sm text-xs text-outline hover:text-primary transition-colors uppercase tracking-wider font-semibold" href="#">Terms of Service</a>
              <a className="font-label-sm text-xs text-outline hover:text-primary transition-colors uppercase tracking-wider font-semibold" href="#">Help Center</a>
              <a className="font-label-sm text-xs text-outline hover:text-primary transition-colors uppercase tracking-wider font-semibold" href="#">Discord</a>
              <a className="font-label-sm text-xs text-outline hover:text-primary transition-colors uppercase tracking-wider font-semibold" href="#">Contact Us</a>
            </div>
            <span className="font-body-sm text-xs text-outline/80">
              © 2024 MangaFlow. Premium Cinematic Reading.
            </span>
          </div>
        </footer>
      )}

      {/* Interactive Reader Modal */}
      {activeChapter && (
        <ReaderModal
          chapter={activeChapter}
          manga={selectedManga}
          onClose={() => { navigate(`/${selectedManga?.id || ''}`); }}
          onReadChapter={handleReadChapter}
        />
      )}

      {/* Change Password Modal */}
      {isChangePasswordOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
          <div className="bg-surface-container w-full max-w-sm mx-4 rounded-3xl border border-white/10 shadow-2xl p-6 flex flex-col gap-4 animate-[slideUp_0.25s_ease-out]">
            <div className="flex justify-between items-center border-b border-white/5 pb-3">
              <h3 className="text-lg font-black text-on-surface flex items-center gap-2">
                <Key className="w-5 h-5 text-amber-500" />
                Change Password
              </h3>
              <button 
                onClick={() => setIsChangePasswordOpen(false)} 
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/5 text-outline cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-outline uppercase tracking-wider">Current Password</label>
                <input 
                  type="password" 
                  placeholder="••••••••" 
                  className="w-full bg-surface-container-high border border-white/5 rounded-xl px-4 py-3 text-sm outline-none focus:border-primary transition-all text-on-surface" 
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-outline uppercase tracking-wider">New Password</label>
                <input 
                  type="password" 
                  placeholder="••••••••" 
                  className="w-full bg-surface-container-high border border-white/5 rounded-xl px-4 py-3 text-sm outline-none focus:border-primary transition-all text-on-surface" 
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-outline uppercase tracking-wider">Confirm New Password</label>
                <input 
                  type="password" 
                  placeholder="••••••••" 
                  className="w-full bg-surface-container-high border border-white/5 rounded-xl px-4 py-3 text-sm outline-none focus:border-primary transition-all text-on-surface" 
                />
              </div>
            </div>
            <div className="flex gap-3 mt-2">
              <button 
                onClick={() => setIsChangePasswordOpen(false)} 
                className="flex-1 h-11 rounded-xl border border-white/10 text-xs font-bold text-outline hover:bg-white/5 hover:text-on-surface transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button 
                onClick={() => { 
                  alert('Password updated successfully!'); 
                  setIsChangePasswordOpen(false); 
                }} 
                className="flex-1 h-11 rounded-xl bg-gradient-to-r from-sky-400 to-indigo-600 hover:from-sky-500 hover:to-indigo-700 text-white text-xs font-bold transition-colors cursor-pointer shadow-lg hover:shadow-indigo-500/20"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Auth Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onLogin={() => {
          setIsLoggedIn(true);
          showToast('Login Berhasil! Selamat datang kembali.');
        }}
      />

      {/* Coin Purchase Modal */}
      <CoinPurchaseModal
        isOpen={isCoinModalOpen}
        onClose={() => setIsCoinModalOpen(false)}
        userCoins={userCoins}
        onPurchase={(addedCoins) => {
          setUserCoins(prev => prev + addedCoins);
        }}
      />

      {/* Unlock Modal */}
      <UnlockModal
        isOpen={isUnlockModalOpen}
        onClose={() => setIsUnlockModalOpen(false)}
        chapter={pendingUnlockChapter}
        userCoins={userCoins}
        onConfirm={handleConfirmUnlock}
        onGoToStore={() => {
          setIsUnlockModalOpen(false);
          setIsCoinModalOpen(true);
        }}
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
