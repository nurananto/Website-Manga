import { useState, useMemo, useEffect } from 'react';
import { imgUrl, timeAgo } from '../utils';
import { Star, BookOpen, ArrowUpDown, ArrowUp, Eye, Coins, Clock } from 'lucide-react';
import CountdownTimer from './CountdownTimer';
import { MangaDetailSkeleton } from './Skeleton';

export default function MangaDetailPage({ manga, onReadChapter, lastReadChapter, unlockedChapters }) {
  const [isLoading, setIsLoading] = useState(true);
  const [expandedSynopsis, setExpandedSynopsis] = useState(false);

  useEffect(() => {
    setIsLoading(true);
    const t = setTimeout(() => setIsLoading(false), 400);
    return () => clearTimeout(t);
  }, [manga?.id]);
  const [sortNewest, setSortNewest] = useState(true);
  const [showAllChapters, setShowAllChapters] = useState(false);
  const [activeDetailTab, setActiveDetailTab] = useState('info');
  const [localUnlockedChapters, setLocalUnlockedChapters] = useState(new Set());
  // Gabung local (baru dibeli sesi ini) + D1 (sudah dibeli sebelumnya)
  const effectiveUnlocked = unlockedChapters
    ? new Set([...unlockedChapters, ...localUnlockedChapters])
    : localUnlockedChapters;
  const [readChapters, setReadChapters] = useState(new Set());

  const sortedChapters = useMemo(() => {
    const list = [...manga.chapters];
    return sortNewest ? list : list.reverse();
  }, [manga.chapters, sortNewest]);

const renderChapterRow = (ch, idx) => {
    const isNew = !!ch.release_date && (Date.now() - new Date(ch.release_date).getTime()) < 24 * 60 * 60 * 1000;
    const isUnread = !readChapters.has(ch.id);
    const isTimeUnlocked = ch.unlockDate && new Date(ch.unlockDate).getTime() <= Date.now();
    const isLocked = ch.isLocked && !isTimeUnlocked && !effectiveUnlocked.has(ch.id);
    const isOneshot = manga.status === 'Oneshot';
    const isFinished = manga.status === 'Tamat' || manga.status === 'Hiatus' || isOneshot;
    const targetChapter = manga.status === 'Tamat' ? manga.tamat_at_chapter : isOneshot ? ch.chapter_number : manga.hiatus_at_chapter;
    const showStatusBadge = isFinished && (isOneshot || (
      targetChapter != null
        ? ch.chapter_number === targetChapter
        : sortNewest ? idx === 0 : idx === sortedChapters.length - 1
    ));

    const chapterViews = ch.views && ch.views > 0
      ? ch.views >= 1000 ? `${(ch.views / 1000).toFixed(1)}k` : String(ch.views)
      : '—';

    return (
      <div
        key={ch.id}
        onClick={() => {
          setReadChapters(prev => new Set([...prev, ch.id]));
          onReadChapter(ch, manga.title);
        }}
        className="group flex items-center justify-between py-3 px-2 sm:px-3 hover:bg-white/5 transition-all cursor-pointer rounded-xl border border-white/8 hover:border-white/15 bg-surface-container/30"
      >
        {/* Left: title + date — redup kalau sudah dibaca */}
        <div className={`flex items-center gap-3 min-w-0 flex-1 transition-opacity ${!isUnread ? 'opacity-40' : ''}`}>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 min-w-0">
              <p className="font-body-md text-sm sm:text-sm md:text-base text-on-surface font-bold group-hover:text-primary transition-colors truncate">
                {ch.title}
              </p>
              {isNew && (
                <span className="bg-emerald-500/90 backdrop-blur-sm text-white px-1 py-0.5 rounded font-label-sm text-[8px] font-black uppercase tracking-wider flex items-center gap-0.5 shrink-0 animate-pulse">
                  <ArrowUp className="w-2 h-2 stroke-[3] shrink-0" />
                  <span>UP</span>
                </span>
              )}
              {showStatusBadge && (
                <span className={`shrink-0 font-label-sm px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider ${
                  manga.status === 'Tamat' || isOneshot
                    ? 'bg-red-500/15 text-red-400 border border-red-500/30'
                    : 'bg-zinc-500/15 text-zinc-400 border border-zinc-500/30'
                }`}>
                  {isOneshot ? 'Oneshot' : manga.status}
                </span>
              )}
            </div>
            <p className="font-label-sm text-xs sm:text-xs md:text-sm text-outline/60 mt-0.5">{ch.date || timeAgo(ch.release_date)}</p>
          </div>
        </div>

        {/* Right: coin lock + views / views only */}
        <div className="flex items-center gap-1.5 shrink-0 ml-2">
          {isLocked ? (
            <div className="flex items-center text-amber-400 font-label-sm text-xs font-bold bg-amber-500/10 px-2 py-1 rounded border border-amber-500/10 shrink-0 whitespace-nowrap">
              <div className="flex items-center gap-1 border-r border-amber-500/20 pr-1.5 mr-1.5 shrink-0">
                <Coins className="w-3.5 h-3.5 fill-current shrink-0" />
                <span>5</span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Clock className="w-3 h-3 text-amber-500/80 shrink-0" />
                <CountdownTimer
                  unlockDate={ch.unlockDate}
                  onUnlock={() => {
                    setLocalUnlockedChapters(prev => {
                      const next = new Set(prev);
                      next.add(ch.id);
                      return next;
                    });
                  }}
                />
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-1 text-outline/50 font-label-sm text-xs select-none shrink-0">
              <Eye className="w-3.5 h-3.5 shrink-0" />
              <span>{chapterViews}</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  if (isLoading) return <MangaDetailSkeleton />;

  return (
    <div className="w-full min-h-screen bg-surface text-on-surface font-body-md relative pb-20">
      {/* Main Section — pt mengikuti TopNavBar (72px) */}
      <div className="pt-[72px] w-full">
        {/* Hero Banner Section */}
        <section className="relative mx-3 sm:mx-4 md:mx-5 mt-4 rounded-2xl overflow-hidden border border-white/15 flex items-end pt-3 pb-2">
          {/* Blurred dynamic background */}
          <div className="absolute inset-0 z-0 overflow-hidden">
            <img
              alt=""
              className="w-full h-full object-cover scale-125 blur-2xl opacity-55"
              src={imgUrl(manga.coverUrl)}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/50 to-surface/10" />
          </div>

          {/* Info Over Cover Container */}
          <div className="relative z-10 w-full px-4 sm:px-6 md:px-8 flex flex-col items-center text-center sm:flex-row sm:items-end sm:text-left gap-6 pb-4">
            {/* Cover Image */}
            <div className="w-[200px] sm:w-[200px] md:w-[220px] aspect-[2/3] flex-shrink-0">
              <img
                alt={`${manga.title} Cover`}
                className="w-full h-full object-cover rounded-xl shadow-2xl border-2 border-white/25"
                src={imgUrl(manga.coverUrl)}
              />
            </div>

            {/* Metadata info */}
            <div className="flex-grow w-full flex flex-col items-center sm:items-start mt-3 sm:mt-0 pb-1">
              {/* Title — max 2 baris */}
              <h2 className="font-headline-md text-2xl sm:text-3xl md:text-4xl lg:text-5xl leading-tight text-on-surface font-black tracking-tight mb-1.5 text-center sm:text-left line-clamp-2">
                {manga.title}
              </h2>

              {/* Alternative Title */}
              <p className="text-outline/80 text-sm sm:text-base md:text-lg font-semibold mb-3 leading-normal text-center sm:text-left line-clamp-1">
                {manga.alternativeTitle || manga.alt_title || ''}
              </p>

            </div>
          </div>
        </section>

        {/* Trakteer Donation Banner - Full Width Below Cover */}
        <div className="w-full mt-4">
          <a
            href="https://trakteer.id"
            target="_blank"
            rel="noopener noreferrer"
            className="relative w-full overflow-hidden bg-gradient-to-r from-red-950/40 via-red-900/25 to-red-950/40 border-y border-red-500/20 py-3 flex items-center group shadow-md hover:border-red-500/40 hover:bg-red-950/50 transition-all duration-300 cursor-pointer"
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
                    <span className="flex items-center gap-1.5 bg-red-600 text-white px-2 py-0.5 rounded text-[10px] sm:text-xs font-black shadow-sm group-hover:scale-105 transition-transform shrink-0">
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
                    <span className="flex items-center gap-1.5 bg-red-600 text-white px-2 py-0.5 rounded text-[10px] sm:text-xs font-black shadow-sm group-hover:scale-105 transition-transform shrink-0">
                      Donasi
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </a>
        </div>

        {/* Wrapper: border di mobile/tablet, tidak di desktop */}
        <div className="mx-3 sm:mx-4 md:mx-5 mt-4 border border-white/15 rounded-2xl lg:border-0 lg:rounded-none lg:mx-0 lg:mt-0">

          {/* Tab Switcher — mobile/tablet only */}
          <div className="flex border-b border-white/10 lg:hidden">
            <button
              onClick={() => setActiveDetailTab('info')}
              className={`flex-1 py-3 text-sm font-bold border-b-2 transition-all cursor-pointer ${
                activeDetailTab === 'info'
                  ? 'border-primary text-primary font-black'
                  : 'border-transparent text-outline hover:text-on-surface'
              }`}
            >
              Manga Info
            </button>
            <button
              onClick={() => setActiveDetailTab('chapters')}
              className={`flex-1 py-3 text-sm font-bold border-b-2 transition-all cursor-pointer ${
                activeDetailTab === 'chapters'
                  ? 'border-primary text-primary font-black'
                  : 'border-transparent text-outline hover:text-on-surface'
              }`}
            >
              Chapter List
            </button>
          </div>

          {/* Grid: 1 kolom mobile, 2 kolom desktop */}
          <div className="grid grid-cols-1 lg:grid-cols-12 lg:gap-5 lg:mt-4 lg:px-4 lg:items-start">
            {/* Column 1: Info */}
            <div className={`lg:col-span-5 lg:flex flex-col gap-4 p-3 lg:border lg:border-white/10 lg:rounded-2xl ${activeDetailTab === 'info' ? 'flex' : 'hidden'}`}>

            {/* Stats: Rating + Chapters + Total Views */}
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              <div className="flex flex-col items-center gap-1 sm:gap-1.5 p-3 sm:p-4 bg-surface-container/20 rounded-xl border border-white/5">
                <div className="flex items-center gap-1.5">
                  <Star className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400 fill-current" />
                  <span className="font-headline-md text-lg sm:text-xl md:text-2xl font-black text-on-surface">{manga.rating}</span>
                </div>
                <span className="font-label-sm text-xs sm:text-xs md:text-sm text-outline/70 font-semibold uppercase tracking-wide">Rating</span>
              </div>
              <div className="flex flex-col items-center gap-1 sm:gap-1.5 p-3 sm:p-4 bg-surface-container/20 rounded-xl border border-white/5">
                <div className="flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400" />
                  <span className="font-headline-md text-lg sm:text-xl md:text-2xl font-black text-on-surface">{manga.chapters.length}</span>
                </div>
                <span className="font-label-sm text-xs sm:text-xs md:text-sm text-outline/70 font-semibold uppercase tracking-wide">Chapters</span>
              </div>
              <div className="flex flex-col items-center gap-1 sm:gap-1.5 p-3 sm:p-4 bg-surface-container/20 rounded-xl border border-white/5">
                <div className="flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-sky-400" />
                  <span className="font-headline-md text-lg sm:text-xl md:text-2xl font-black text-on-surface">{manga.total_views ? (manga.total_views >= 1000 ? `${(manga.total_views / 1000).toFixed(1)}k` : String(manga.total_views)) : '—'}</span>
                </div>
                <span className="font-label-sm text-xs sm:text-xs md:text-sm text-outline/70 font-semibold uppercase tracking-wide">Views</span>
              </div>
            </div>

            {/* Author + Artist */}
            <div className="grid grid-cols-2 gap-0 bg-surface-container/20 rounded-xl border border-white/5 overflow-hidden">
              <div className="flex flex-col gap-1 p-3 sm:p-4 border-r border-white/5 min-w-0">
                <span className="font-label-sm text-xs text-outline/60 font-bold uppercase tracking-widest">Author</span>
                <span className="font-body-md text-sm sm:text-sm md:text-base font-bold text-on-surface truncate">{manga.author || '—'}</span>
              </div>
              <div className="flex flex-col gap-1 p-3 sm:p-4 min-w-0">
                <span className="font-label-sm text-xs text-outline/60 font-bold uppercase tracking-widest">Artist</span>
                <span className="font-body-md text-sm font-bold text-on-surface truncate">{manga.artist || '—'}</span>
              </div>
            </div>

            {/* Status + Type */}
            <div className="grid grid-cols-2 gap-0 bg-surface-container/20 rounded-xl border border-white/5 overflow-hidden">
              <div className="flex flex-col gap-1 p-3 sm:p-4 border-r border-white/5">
                <span className="font-label-sm text-xs text-outline/60 font-bold uppercase tracking-widest">Status</span>
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${
                    manga.status === 'Tamat' || manga.status === 'Oneshot' ? 'bg-red-400' :
                    manga.status === 'Hiatus' ? 'bg-zinc-400' : 'bg-emerald-400'
                  }`} />
                  <span className={`font-body-md text-sm sm:text-sm md:text-base font-black ${
                    manga.status === 'Tamat' || manga.status === 'Oneshot' ? 'text-red-400' :
                    manga.status === 'Hiatus' ? 'text-zinc-400' : 'text-emerald-400'
                  }`}>{manga.status || 'Ongoing'}</span>
                </div>
              </div>
              <div className="flex flex-col gap-1 p-3 sm:p-4">
                <span className="font-label-sm text-xs text-outline/60 font-bold uppercase tracking-widest">Type</span>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-white/60 shrink-0" />
                  <span className="font-body-md text-sm sm:text-sm md:text-base font-black text-on-surface">{manga.type || 'MANGA'}</span>
                </div>
              </div>
            </div>

            {/* Genres */}
            <div className="flex flex-wrap gap-1.5 sm:gap-2">
              {manga.genres.map((g) => (
                <span key={g} className="font-label-sm bg-surface-container-high px-3 py-1.5 rounded-lg text-xs sm:text-sm md:text-base text-on-surface border border-white/5 font-semibold">
                  {g}
                </span>
              ))}
            </div>

            {/* MangaDex + Raw Link */}
            <div className="grid grid-cols-2 gap-3">
              {manga.mangadex_url ? (
                <a href={manga.mangadex_url} target="_blank" rel="noopener noreferrer"
                  className="h-9 sm:h-10 md:h-11 bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/20 rounded-xl font-label-sm text-xs sm:text-sm font-bold flex items-center justify-center gap-2 active:scale-95 transition-all text-orange-400 hover:text-orange-300 cursor-pointer">
                  MangaDex
                </a>
              ) : (
                <div className="h-10 bg-surface-container/20 border border-white/5 rounded-xl font-label-sm text-xs font-bold flex items-center justify-center text-outline/30 select-none">MangaDex</div>
              )}
              {manga.raw_url ? (
                <a href={manga.raw_url} target="_blank" rel="noopener noreferrer"
                  className="h-9 sm:h-10 md:h-11 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/20 rounded-xl font-label-sm text-xs sm:text-sm font-bold flex items-center justify-center gap-2 active:scale-95 transition-all text-cyan-400 hover:text-cyan-300 cursor-pointer">
                  Raw Link
                </a>
              ) : (
                <div className="h-10 bg-surface-container/20 border border-white/5 rounded-xl font-label-sm text-xs font-bold flex items-center justify-center text-outline/30 select-none">Raw Link</div>
              )}
            </div>

            {/* Synopsis */}
            <div className="flex flex-col gap-2">
              <h3 className="font-headline-md text-base sm:text-lg text-on-surface font-black">Synopsis</h3>
              <p className="font-body-md text-sm sm:text-sm md:text-base text-on-surface-variant leading-relaxed opacity-90 text-justify">
                {expandedSynopsis ? (manga.description || '') : `${(manga.description || '').substring(0, 160)}${(manga.description || '').length > 160 ? '...' : ''}`}
                <button
                  onClick={() => setExpandedSynopsis(v => !v)}
                  className="font-label-sm text-primary font-bold ml-1.5 text-xs hover:underline cursor-pointer"
                >
                  {expandedSynopsis ? 'Show less' : 'Read more'}
                </button>
              </p>
            </div>
          </div>

          {/* Column 2: Chapters */}
          <div className={`lg:col-span-7 lg:flex flex-col p-3 lg:border lg:border-white/10 lg:rounded-2xl ${activeDetailTab === 'chapters' ? 'flex' : 'hidden'}`}>

            {/* Chapter List Header */}
            <div className="flex items-center justify-between mb-3 border-b border-white/5 pb-2">
              <h3 className="font-headline-md text-base sm:text-lg text-on-surface font-black">
                Chapters <span className="font-body-md text-on-surface-variant font-normal text-xs sm:text-sm">({manga.chapters.length})</span>
              </h3>
              <button
                onClick={() => setSortNewest(v => !v)}
                className="font-label-sm text-on-surface-variant hover:text-primary flex items-center gap-1.5 transition-colors cursor-pointer text-xs font-black uppercase tracking-wider"
              >
                <span>{sortNewest ? 'Newest' : 'Oldest'}</span>
                <ArrowUpDown className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Chapter List */}
            <div className="flex flex-col gap-1.5">
              {showAllChapters ? (
                sortedChapters.map((ch, idx) => renderChapterRow(ch, idx))
              ) : (
                <>
                  {/* Paling Baru (Top 3 newest) */}
                  {sortedChapters.slice(0, 6).map((ch, idx) => renderChapterRow(ch, idx))}

                  {/* View More Button — muncul kalau ada chapter tersembunyi (di luar 6 teratas + 1 pinned bawah) */}
                  {sortedChapters.length > 7 && (
                    <div className="py-2.5 px-2 -mx-2">
                      <button
                        onClick={() => setShowAllChapters(true)}
                        className="font-label-sm w-full py-2.5 bg-surface-container/20 hover:bg-surface-container-high/40 border border-white/5 rounded-lg text-on-surface-variant hover:text-primary tracking-wider text-xs font-bold transition-all cursor-pointer text-center"
                      >
                        View More ({sortedChapters.length - 7} more chapters)
                      </button>
                    </div>
                  )}

                  {/* Paling Awal / Chapter 1 (Pinned at bottom) */}
                  {sortedChapters.length > 6 && renderChapterRow(sortedChapters[sortedChapters.length - 1], sortedChapters.length - 1)}
                </>
              )}
            </div>

            {/* View Less Chapters Button (Shows at the bottom only when expanded) */}
            {showAllChapters && sortedChapters.length > 7 && (
              <button
                onClick={() => setShowAllChapters(false)}
                className="font-label-sm w-full mt-4 py-3 bg-surface-container/20 hover:bg-surface-container-high/40 border border-white/5 rounded-lg text-on-surface-variant hover:text-primary tracking-wider text-xs font-bold transition-all cursor-pointer text-center"
              >
                View Less
              </button>
            )}
          </div>
          </div>{/* end grid */}
        </div>{/* end wrapper border */}
      </div>
    </div>
  );
}
