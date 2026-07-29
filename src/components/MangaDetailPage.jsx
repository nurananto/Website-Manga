import { useState, useMemo, useEffect, useRef } from 'react';
import { nowTimestamp, timeAgo } from '../utils';
import { Star, BookOpen, ArrowUpDown, ArrowUp, Eye, Images, Download, X, ChevronLeft, ChevronRight, ChevronDown, Play, Lock } from 'lucide-react';
import SupportButtons from './SupportButtons';
import ResponsiveCover from './ResponsiveCover';
import CountdownTimer from './CountdownTimer';
import { canReadChapter, chapterAccessLevel, chapterNextAccessDate } from '../lib/chapterAccess';
import { useDialogFocus } from '../lib/useDialogFocus';
import { recordView } from '../lib/viewGate';

const chapterSortValue = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : Number.NEGATIVE_INFINITY;
};

const fitCreatorStyle = (value) => ({
  containerType: 'inline-size',
  '--creator-chars': Math.max(String(value || '').length, 8),
});

export default function MangaDetailPage({ manga, onReadChapter, lastReadChapter, isSupporter, isLoggedIn, onDonate }) {
  const [expandedSynopsis, setExpandedSynopsis] = useState(false);

  // Rekam view halaman detail (manga dibuka tapi belum tentu dibaca).
  // Dedup ringan per sesi; server juga dedup per IP/hari. chapter_id = slug manga
  // (tanpa "-ch-") → cron menghitungnya sebagai detail_views.
  useEffect(() => {
    if (!manga?.id) return;
    const workerUrl = import.meta.env.VITE_WORKER_URL || '';
    if (!workerUrl) return;
    // Dedup PER HARI (WIB) di localStorage — pembaca yang balik lagi besok tetap
    // terhitung (server tetap dedup ip+id+hari). Sebelumnya sessionStorage per-sesi.
    const day = new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
    const key = `dvw_${manga.id}_${day}`;
    try {
      if (localStorage.getItem(key)) return;
    } catch {}
    // Tandai dedup-harian HANYA jika server benar-benar mencatat (lolos view-gate),
    // supaya percobaan yang gagal (Turnstile ditutup/keblok) bisa dicoba lagi.
    recordView(manga.id).then((ok) => {
      if (ok) { try { localStorage.setItem(key, '1'); } catch {} }
    });
  }, [manga?.id]);
  const [sortNewest, setSortNewest] = useState(true);
  const [showAllChapters, setShowAllChapters] = useState(false);
  const [activeDetailTab, setActiveDetailTab] = useState('info');
  const [accessNow, setAccessNow] = useState(() => Date.now());
  const [readChapters, setReadChapters] = useState(new Set());
  const [lightboxCover, setLightboxCover] = useState(null);
  const lightboxRef = useRef(null);
  const [galleryPage, setGalleryPage] = useState(0);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const GALLERY_PER_PAGE = 6;
  const galleryPages = Math.ceil((manga?.cover_gallery?.length ?? 0) / GALLERY_PER_PAGE);
  useDialogFocus(lightboxRef, () => setLightboxCover(null), Boolean(lightboxCover));

  useEffect(() => {
    const timer = setTimeout(() => setGalleryPage(0), 0);
    return () => clearTimeout(timer);
  }, [manga?.id]);

  const downloadCover = async (g) => {
    const url = g.urls.desktop;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${manga.title}${g.volume ? ` - Vol ${g.volume}` : ''}.webp`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      window.open(url, '_blank');
    }
  };

  const sortedChapters = useMemo(() => {
    const list = [...manga.chapters];
    return sortNewest ? list : list.reverse();
  }, [manga.chapters, sortNewest]);

  // Satu timer tersembunyi untuk transisi terdekat. Badge/gembok berubah tepat
  // waktu tanpa menampilkan countdown dan tanpa membuat timer untuk tiap baris.
  const nextAccessTransition = useMemo(() => {
    const transitions = manga.chapters
      .map((chapter) => chapterNextAccessDate(chapter, accessNow))
      .filter((timestamp) => Number.isFinite(timestamp) && timestamp > accessNow);
    return transitions.length ? Math.min(...transitions) : null;
  }, [accessNow, manga.chapters]);

const renderChapterRow = (ch) => {
    const now = nowTimestamp();
    const releaseAge = ch.release_date ? now - new Date(ch.release_date).getTime() : NaN;
    const isNew = Number.isFinite(releaseAge) && releaseAge >= 0 && releaseAge < 24 * 60 * 60 * 1000;
    const isUnread = !readChapters.has(ch.id);
    const accessLevel = chapterAccessLevel(ch, now);
    const isBlocked = !canReadChapter(ch, { isLoggedIn, isSupporter }, now);
    const showEarlyAccess = accessLevel === 'supporter' && isBlocked;
    const isOneshot = manga.status === 'Oneshot';
    const isFinished = manga.status === 'Tamat' || manga.status === 'Hiatus' || isOneshot;
    const targetChapter = manga.status === 'Tamat' ? manga.tamat_at_chapter : isOneshot ? ch.chapter_number : manga.hiatus_at_chapter;
    // Badge status disembunyikan selama badge UP (isNew) masih tampil.
    // Hanya muncul di chapter yang persis = tamat_at_chapter/hiatus_at_chapter.
    const showStatusBadge = !isNew && isFinished && (
      isOneshot || (targetChapter != null && String(ch.chapter_number) === String(targetChapter))
    );
    const chapterTitle = isOneshot ? 'Oneshot' : ch.title;

    const chapterViews = ch.views && ch.views > 0
      ? ch.views >= 1000 ? `${(ch.views / 1000).toFixed(1)}k` : String(ch.views)
      : '—';

    return (
      <button
        type="button"
        key={ch.id}
        onClick={() => {
          // Chapter terkunci hanya membuka modal beli — belum benar-benar dibaca,
          // jadi jangan tandai "sudah dibaca" (cegah row meredup setelah modal ditutup).
          if (!isBlocked) setReadChapters(prev => new Set([...prev, ch.id]));
          onReadChapter(ch, manga.title);
        }}
        className="group flex w-full items-center justify-between py-3 px-2 sm:px-3 text-left transition-all cursor-pointer rounded-xl border bg-surface-container/30 border-white/8 hover:bg-white/5 hover:border-white/15"
      >
        {/* Left: title + date — redup kalau sudah dibaca */}
        <div className={`flex items-center gap-2.5 min-w-0 flex-1 transition-opacity ${!isUnread ? 'opacity-40' : ''}`}>
          <span
            aria-hidden="true"
            className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
              showEarlyAccess
                ? 'bg-amber-500/20 border border-amber-400/60'
                : 'bg-white/5 border border-white/20'
            }`}
          >
            {showEarlyAccess ? (
              <Lock className="w-6 h-6 md:w-[26px] md:h-[26px] lg:w-7 lg:h-7 text-amber-300 stroke-[2.5]" />
            ) : (
              <BookOpen className="w-6 h-6 md:w-[26px] md:h-[26px] lg:w-7 lg:h-7 text-white stroke-[2.25]" />
            )}
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 min-w-0">
              <p className={`font-body-md text-sm md:text-base lg:text-lg font-bold transition-colors truncate ${
                showEarlyAccess
                  ? 'text-amber-300 group-hover:text-amber-200'
                  : 'text-on-surface group-hover:text-primary'
              }`}>
                {chapterTitle}
              </p>
              {showEarlyAccess && (
                <span className="shrink-0 font-label-sm px-1.5 py-0.5 rounded text-[10px] md:text-xs lg:text-sm font-black uppercase tracking-wider bg-amber-500/15 text-amber-400 border border-amber-500/30">
                  Early Access
                </span>
              )}
              {isNew && (
                <span className="bg-emerald-500 text-white ring-1 ring-emerald-300/70 px-1.5 py-0.5 rounded font-label-sm text-[10px] md:text-xs lg:text-sm font-black uppercase tracking-wider flex items-center gap-0.5 shrink-0 animate-pulse">
                  <ArrowUp className="w-2.5 h-2.5 md:w-3 md:h-3 stroke-[3] shrink-0" />
                  <span>UP</span>
                </span>
              )}
              {showStatusBadge && (
                <span className={`shrink-0 font-label-sm px-1.5 py-0.5 rounded text-[10px] md:text-xs lg:text-sm font-black uppercase tracking-wider ${
                  manga.status === 'Tamat' || isOneshot
                    ? 'bg-red-500/15 text-red-400 border border-red-500/30'
                    : 'bg-zinc-500/15 text-zinc-400 border border-zinc-500/30'
                }`}>
                  {manga.status === 'Tamat' || isOneshot ? 'END' : manga.status}
                </span>
              )}
            </div>
            <p className="font-label-sm text-xs md:text-sm lg:text-base text-outline/60 mt-0.5">{ch.date || timeAgo(ch.release_date)}</p>
          </div>
        </div>

        {/* Right: views */}
        <div className="flex items-center gap-1.5 shrink-0 ml-2">
          <div className="flex items-center gap-1 text-outline/50 font-label-sm text-xs md:text-sm lg:text-base select-none shrink-0">
            <Eye className="w-3.5 h-3.5 md:w-4 md:h-4 shrink-0" />
            <span>{chapterViews}</span>
          </div>
        </div>
      </button>
    );
  };

  return (
    <div role="main" className="w-full min-h-screen bg-surface text-on-surface font-body-md relative pb-4 md:pb-6 xl:pb-8">
      {nextAccessTransition && (
        <CountdownTimer
          unlockDate={nextAccessTransition}
          silent
          onUnlock={() => setAccessNow(Date.now())}
        />
      )}
      {/* Main Section — pt mengikuti TopNavBar (72px) */}
      <div className="pt-4 md:pt-6 xl:pt-8 w-full">
        {/* Hero Banner Section */}
        <section className="relative mx-3 sm:mx-4 md:mx-5 rounded-2xl overflow-hidden border border-white/15 flex items-end pt-3 pb-2">
          {/* Darkened dynamic background */}
          <div className="absolute inset-0 z-0 overflow-hidden">
            <ResponsiveCover
              manga={manga}
              alt=""
              loading="eager"
              fetchPriority="low"
              className="w-full h-full object-cover object-top brightness-[0.68] saturate-[0.95]"
            />
            <div className="absolute inset-0 bg-black/28" />
            <div className="absolute inset-0 bg-gradient-to-t from-surface/56 via-surface/20 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-r from-surface/72 via-surface/18 to-transparent" />
            <div className="absolute inset-0 shadow-[inset_0_22px_64px_rgba(0,0,0,0.45),inset_0_-58px_90px_rgba(0,0,0,0.5),inset_64px_0_84px_rgba(0,0,0,0.58),inset_-64px_0_84px_rgba(0,0,0,0.58)]" />
          </div>

          {/* Info Over Cover Container */}
          <div className="relative z-10 w-full px-4 sm:px-6 md:px-8 flex flex-col items-center text-center sm:flex-row sm:items-end sm:text-left gap-3 sm:gap-6 pb-4">
            {/* Cover Image */}
            <div className="w-[200px] sm:w-[200px] md:w-[220px] aspect-[2/3] flex-shrink-0">
              <ResponsiveCover
                  manga={manga}
                  alt={`${manga.title} Cover`}
                  loading="eager"
                  fetchPriority="high"
                  className="w-full h-full object-cover rounded-xl shadow-2xl border-2 border-white/25"
                />
            </div>

            {/* Metadata info */}
            <div className="flex-grow min-w-0 w-full flex flex-col items-center sm:items-start pb-1">
              {/* Title — max 2 baris */}
              <h2 className="font-headline-md text-2xl sm:text-3xl md:text-4xl lg:text-5xl leading-tight text-on-surface font-black tracking-tight mb-1.5 text-center sm:text-left line-clamp-2">
                {manga.title}
              </h2>

              {/* Alternative Title */}
              <p className="text-outline/80 text-sm sm:text-base md:text-lg font-semibold mb-3 leading-normal text-center sm:text-left line-clamp-1">
                {manga.alternativeTitle || manga.alt_title || ''}
              </p>

              {/* Baca dari Awal + Lanjut Baca */}
              {(() => {
                const chaptersAsc = [...(manga.chapters || [])].sort((a, b) => chapterSortValue(a.chapter_number) - chapterSortValue(b.chapter_number));
                const firstChapter = chaptersAsc[0];
                const continueChapter = lastReadChapter
                  ? (manga.chapters || []).find(c =>
                      c.id === lastReadChapter.id ||
                      String(c.chapter_number) === String(lastReadChapter.chapter_number))
                  : null;
                if (!firstChapter) return null;
                return (
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 sm:gap-3">
                    <button
                      onClick={() => onReadChapter(firstChapter, manga.title)}
                      className="h-9 sm:h-10 md:h-11 px-4 sm:px-5 rounded-xl bg-white hover:bg-white/90 text-black font-bold text-xs sm:text-sm md:text-base flex items-center gap-2 active:scale-95 transition-all cursor-pointer shadow-md"
                    >
                      <BookOpen className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      {manga.status === 'Oneshot' ? 'Baca Oneshot' : `Baca Ch. ${firstChapter.chapter_number}`}
                    </button>
                    {continueChapter && (
                      <button
                        onClick={() => onReadChapter(continueChapter, manga.title)}
                        className="h-9 sm:h-10 md:h-11 px-4 sm:px-5 rounded-xl bg-surface-container-high hover:bg-surface-container-highest border border-white/10 text-on-surface font-bold text-xs sm:text-sm md:text-base flex items-center gap-2 active:scale-95 transition-all cursor-pointer shadow-md"
                      >
                        <Play className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-current" />
                        Continue {manga.status === 'Oneshot' ? 'Oneshot' : `Ch. ${continueChapter.chapter_number}`}
                      </button>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
        </section>

        {/* Tombol dukungan: buka modal pengingat email dulu, bukan lompat langsung ke Trakteer */}
        <div className="w-full mt-4 md:mt-6 xl:mt-8 px-3 sm:px-4 md:px-5">
          <SupportButtons onDonate={onDonate} />
        </div>

        {/* Wrapper: border di mobile/tablet, tidak di desktop */}
        <div className="mx-3 sm:mx-4 md:mx-5 mt-4 md:mt-6 border border-white/15 rounded-2xl lg:border-0 lg:rounded-none lg:mx-0 lg:mt-0">

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
              <div className="creator-fit flex flex-col gap-1 p-3 sm:p-4 border-r border-white/5 min-w-0" style={fitCreatorStyle(manga.author)}>
                <span className="font-label-sm text-xs text-outline/60 font-bold uppercase tracking-widest">Author</span>
                <span className="font-body-md text-sm sm:text-sm md:text-base font-bold text-on-surface truncate">{manga.author || '—'}</span>
              </div>
              <div className="creator-fit flex flex-col gap-1 p-3 sm:p-4 min-w-0" style={fitCreatorStyle(manga.artist)}>
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
                  }`}>{manga.status === 'Tamat' ? 'Complete' : (manga.status || 'Ongoing')}</span>
                </div>
              </div>
              <div className="flex flex-col gap-1 p-3 sm:p-4">
                <span className="font-label-sm text-xs text-outline/60 font-bold uppercase tracking-widest">Type</span>
                <div className="flex items-center gap-2">
                  {(() => {
                    const t = (manga.type || 'manga').toLowerCase();
                    const isWebtoon = t === 'webtoon';
                    return (
                      <>
                        <span className="w-2 h-2 rounded-full shrink-0 bg-white/60" />
                        <span className="font-body-md text-sm sm:text-sm md:text-base font-black text-on-surface">
                          {isWebtoon ? 'Webtoon' : 'Manga'}
                        </span>
                      </>
                    );
                  })()}
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
              <h3 className="font-headline-md text-base sm:text-lg text-on-surface font-black">Sinopsis</h3>
              <p className="font-body-md text-sm sm:text-sm md:text-base text-on-surface-variant leading-relaxed opacity-90 text-justify">
                {expandedSynopsis ? (manga.description || '') : `${(manga.description || '').substring(0, 160)}${(manga.description || '').length > 160 ? '...' : ''}`}
                {(manga.description || '').length > 160 && (
                  <button
                    onClick={() => setExpandedSynopsis(v => !v)}
                    className="font-label-sm text-primary font-bold ml-1.5 text-xs hover:underline cursor-pointer"
                  >
                    {expandedSynopsis ? 'Tampilkan lebih sedikit' : 'Baca selengkapnya'}
                  </button>
                )}
              </p>
            </div>

            {/* Galeri cover — header gaya tab (tengah + garis bawah), bisa di-hide */}
            {Array.isArray(manga.cover_gallery) && manga.cover_gallery.length > 0 && (
              <div className="w-full border-t-2 border-primary">
                <button
                  onClick={() => setGalleryOpen(v => !v)}
                  className={`w-full py-3 flex items-center justify-center gap-2 border-b-2 transition-all cursor-pointer ${
                    galleryOpen ? 'border-primary text-primary' : 'border-white/10 text-outline hover:text-on-surface'
                  }`}
                >
                  <Images className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span className="font-headline-md text-sm sm:text-base font-bold">Cover Manga</span>
                  <span className="font-label-sm text-[10px] sm:text-xs font-black text-outline/70 bg-white/5 border border-white/10 rounded-full px-2 py-0.5">
                    {manga.cover_gallery.length}
                  </span>
                  {galleryPages > 1 && galleryOpen && (
                    <span className="font-label-sm text-[10px] sm:text-xs font-bold text-outline/60">
                      {galleryPage + 1}/{galleryPages}
                    </span>
                  )}
                  <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${galleryOpen ? 'rotate-180' : ''}`} />
                </button>

                {galleryOpen && (
                  <div className="relative mt-3">
                    {/* Tombol geser kiri */}
                    {galleryPages > 1 && (
                      <button
                        onClick={() => setGalleryPage(p => Math.max(0, p - 1))}
                        disabled={galleryPage === 0}
                        aria-label="Halaman cover sebelumnya"
                        className="absolute -left-1.5 top-1/2 -translate-y-1/2 z-20 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-black/60 backdrop-blur-sm border border-white/15 flex items-center justify-center text-white disabled:opacity-25 disabled:cursor-not-allowed hover:bg-black/80 active:scale-95 transition-all cursor-pointer"
                      >
                        <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
                      </button>
                    )}

                    <div className="grid grid-cols-3 sm:grid-cols-6 lg:grid-cols-3 gap-2 sm:gap-3">
                      {manga.cover_gallery
                        .slice(galleryPage * GALLERY_PER_PAGE, (galleryPage + 1) * GALLERY_PER_PAGE)
                        .map((g, i) => {
                          const isCurrent = !!g.is_current;
                          return (
                            <button
                              key={`${galleryPage}-${i}`}
                              onClick={() => setLightboxCover(g)}
                              className={`group relative rounded-xl overflow-hidden border transition-all duration-300 cursor-pointer hover:-translate-y-1 hover:shadow-[0_10px_30px_rgba(0,0,0,0.6)] ${
                                isCurrent ? 'border-primary/50 ring-1 ring-primary/30' : 'border-white/10 hover:border-primary/40'
                              }`}
                            >
                              <img
                                src={g.urls.mobile}
                                alt={g.volume ? `Cover Vol. ${g.volume}` : 'Cover'}
                                loading="lazy"
                                className="w-full aspect-[2/3] object-cover group-hover:scale-105 transition-transform duration-300"
                              />
                              <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/80 to-transparent pointer-events-none" />
                              {g.volume && (
                                <span className="absolute bottom-1.5 left-1.5 bg-black/70 backdrop-blur-sm text-white px-1.5 py-0.5 rounded font-label-sm text-[9px] sm:text-[10px] font-black">
                                  Vol. {g.volume}
                                </span>
                              )}
                              {isCurrent && (
                                <span className="absolute top-1.5 right-1.5 bg-primary/90 text-on-primary px-1.5 py-0.5 rounded font-label-sm text-[8px] sm:text-[9px] font-black uppercase tracking-wider">
                                  Dipakai
                                </span>
                              )}
                            </button>
                          );
                        })}
                    </div>

                    {/* Tombol geser kanan */}
                    {galleryPages > 1 && (
                      <button
                        onClick={() => setGalleryPage(p => Math.min(galleryPages - 1, p + 1))}
                        disabled={galleryPage >= galleryPages - 1}
                        aria-label="Halaman cover berikutnya"
                        className="absolute -right-1.5 top-1/2 -translate-y-1/2 z-20 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-black/60 backdrop-blur-sm border border-white/15 flex items-center justify-center text-white disabled:opacity-25 disabled:cursor-not-allowed hover:bg-black/80 active:scale-95 transition-all cursor-pointer"
                      >
                        <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
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

        {/* Lightbox cover — zoom di halaman, tidak menutupi seluruh layar */}
        {lightboxCover && (
          <div
            className="fixed inset-0 z-[400] bg-black/70 flex items-center justify-center p-4 sm:p-10"
            onClick={() => setLightboxCover(null)}
          >
            <button
              type="button"
              aria-label="Tutup tampilan cover"
              onClick={() => setLightboxCover(null)}
              className="absolute top-4 right-4 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white cursor-pointer transition-colors z-10"
            >
              <X className="w-5 h-5" />
            </button>

            <div
              ref={lightboxRef}
              role="dialog"
              aria-modal="true"
              aria-label="Pratinjau cover manga"
              tabIndex={-1}
              className="relative"
              onClick={e => e.stopPropagation()}
            >
              <img
                src={lightboxCover.urls.desktop}
                alt={lightboxCover.volume ? `Cover Vol. ${lightboxCover.volume}` : 'Cover'}
                className="max-h-[82vh] max-w-[88vw] sm:max-w-[60vw] lg:max-w-[42vw] rounded-xl shadow-2xl border border-white/15 object-contain"
              />
              {lightboxCover.volume && (
                <span className="absolute top-3 left-3 bg-black/70 backdrop-blur-sm text-white px-2 py-1 rounded-lg font-label-sm text-xs sm:text-sm font-black">
                  Vol. {lightboxCover.volume}
                </span>
              )}
              {/* Tombol download — pojok kanan bawah */}
              <button
                onClick={() => downloadCover(lightboxCover)}
                className="absolute bottom-3 right-3 h-9 sm:h-10 px-3 sm:px-4 rounded-xl bg-primary hover:bg-primary/90 text-on-primary font-black text-xs sm:text-sm flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all shadow-lg"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Download</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
