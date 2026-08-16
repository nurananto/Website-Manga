import { useState, useMemo, useEffect, useRef } from 'react';
import { nowTimestamp, chapterDateLabel } from '../utils';
import { Star, BookOpen, ArrowUpDown, Eye, Images, Download, X, ChevronLeft, ChevronRight, ChevronDown, Play, Lock } from 'lucide-react';
import SupportButtons from './SupportButtons';
import ResponsiveCover from './ResponsiveCover';
import CountdownTimer from './CountdownTimer';
import CoverScrim from './CoverScrim';
import SolidButton from './SolidButton';
import { canReadChapter, chapterAccessLevel, chapterNextAccessDate } from '../lib/chapterAccess';
import { useDialogFocus } from '../lib/useDialogFocus';
import { recordView } from '../lib/viewGate';

const EMPTY_SET = new Set();

const chapterSortValue = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : Number.NEGATIVE_INFINITY;
};

// author/artist bisa berupa string tunggal ATAU array (kolaborasi banyak
// orang, mis. studio) — selalu gabung jadi satu string ", "-separated
// sebelum dipakai hitung lebar container / tooltip.
const joinCreator = (value) => Array.isArray(value) ? value.join(', ') : (value || '');

// Tampilan ringkas: ≤2 nama tampil penuh ("A, B"), lebih dari itu dipotong
// ("A, B & 2 lainnya") supaya kartu Author/Artist tidak melebar liar kalau
// nama-namanya panjang. List lengkap bisa dibuka dengan tap (lihat
// expandedCreator) — title= cuma bonus buat desktop, HP/tablet tidak punya
// hover jadi tap adalah jalur utamanya.
const creatorDisplay = (value) => {
  if (!Array.isArray(value)) return value || '—';
  if (value.length === 0) return '—';
  if (value.length <= 2) return value.join(', ');
  return `${value.slice(0, 2).join(', ')} & ${value.length - 2} lainnya`;
};

const fitCreatorStyle = (value) => ({
  containerType: 'inline-size',
  '--creator-chars': Math.max(creatorDisplay(value).length, 8),
});

export default function MangaDetailPage({ manga, onReadChapter, lastReadChapter, readChapterIds, isSupporter, isLoggedIn, onDonate }) {
  const [expandedSynopsis, setExpandedSynopsis] = useState(false);
  // Author/Artist dengan >2 nama tampil dipotong ("A, B & N lainnya") — tap
  // untuk expand. title= (hover) tetap dipasang buat desktop, tapi ini yang
  // jadi jalur utama karena HP/tablet tidak punya hover sama sekali.
  const [expandedCreator, setExpandedCreator] = useState({ author: false, artist: false });

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
    // Tandai dedup-harian HANYA jika server benar-benar mencatat, supaya
    // percobaan yang gagal (jaringan/rate limit) bisa dicoba lagi.
    recordView(manga.id).then((ok) => {
      if (ok) { try { localStorage.setItem(key, '1'); } catch {} }
    });
  }, [manga?.id]);
  const [sortNewest, setSortNewest] = useState(true);
  const [showAllChapters, setShowAllChapters] = useState(false);
  const [activeDetailTab, setActiveDetailTab] = useState('info');
  const [accessNow, setAccessNow] = useState(() => Date.now());
  const readChapters = readChapterIds || EMPTY_SET;
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

  // Chapter pertama (nomor terkecil) buat tombol "Baca dari Awal" — cuma butuh
  // 1 elemen, jadi cukup scan min O(n) + di-memo, bukan sort O(n log n) ulang
  // tiap render (dulu inline di JSX, kepicu ulang tiap state apa pun berubah:
  // tab switch, buka galeri, expand sinopsis, dst — mubazir utk manga
  // berchapter banyak, mis. 216 chapter di Waka-chan).
  const firstChapter = useMemo(() => {
    const list = manga.chapters || [];
    return list.reduce((min, ch) =>
      !min || chapterSortValue(ch.chapter_number) < chapterSortValue(min.chapter_number) ? ch : min
    , null);
  }, [manga.chapters]);

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
        onClick={() => onReadChapter(ch, manga.title)}
        className="group flex w-full items-center justify-between py-3 px-2 sm:px-3 text-left transition-all cursor-pointer rounded-xl border bg-surface-container/30 border-transparent hover:bg-surface-container-high hover:border-outline-variant"
      >
        {/* Left: title + date — redup kalau sudah dibaca */}
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <span
            aria-hidden="true"
            className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-all ${!isUnread ? 'opacity-40' : ''} ${
              showEarlyAccess
                ? 'bg-amber-500/20 border border-amber-400/60'
                : 'bg-surface-container-high border border-outline-variant'
            }`}
          >
            {showEarlyAccess ? (
              <Lock className="w-6 h-6 md:w-[26px] md:h-[26px] lg:w-7 lg:h-7 text-amber-600 dark:text-amber-300 stroke-[2.5]" />
            ) : (
              <BookOpen className="w-6 h-6 md:w-[26px] md:h-[26px] lg:w-7 lg:h-7 text-on-surface stroke-[2.25]" />
            )}
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 min-w-0">
              {/* opacity-80 (bukan -40): -40 gagal WCAG AA (contrast jatuh terlalu
                  rendah begitu chapter sudah dibaca) — lihat MangaCard.jsx. */}
              <p className={`font-body-md text-sm md:text-base lg:text-lg font-bold transition-all truncate ${!isUnread ? 'opacity-80' : ''} ${
                showEarlyAccess
                  ? 'text-amber-600 dark:text-amber-300 group-hover:text-amber-500 dark:group-hover:text-amber-200'
                  : 'text-on-surface group-hover:text-primary'
              }`}>
                {chapterTitle}
              </p>
              {showEarlyAccess && (
                <span className="shrink-0 font-label-sm px-1.5 py-0.5 rounded text-[10px] md:text-xs lg:text-sm font-black uppercase tracking-wider bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                  Early Access
                </span>
              )}
              {isNew && (
                <span className="badge-new-glow bg-emerald-700 text-white ring-1 ring-emerald-300/70 px-1.5 py-0.5 rounded font-label-sm text-[10px] md:text-xs lg:text-sm font-black uppercase tracking-wider shrink-0">
                  NEW
                </span>
              )}
              {showStatusBadge && (
                <span className={`shrink-0 font-label-sm px-1.5 py-0.5 rounded text-[10px] md:text-xs lg:text-sm font-black uppercase tracking-wider ${
                  manga.status === 'Tamat' || isOneshot
                    ? 'bg-red-500/15 text-red-700 dark:text-red-400 border border-red-500/30'
                    : 'bg-zinc-500/15 text-zinc-700 dark:text-zinc-400 border border-zinc-500/30'
                }`}>
                  {manga.status === 'Tamat' || isOneshot ? 'END' : manga.status}
                </span>
              )}
            </div>
            {/* text-outline solid (bukan /60): /60 cuma ~2.4:1 di atas bg — gagal WCAG
                AA (butuh 4.5:1) walau tanpa isUnread dimming. Samakan dengan MangaCard. */}
            <p className={`font-label-sm text-xs md:text-sm lg:text-base text-outline mt-0.5 transition-opacity ${!isUnread ? 'opacity-80' : ''}`}>{ch.date || chapterDateLabel(ch.release_date)}</p>
          </div>
        </div>

        {/* Right: views */}
        <div className="flex items-center gap-1.5 shrink-0 ml-2">
          <div className="flex items-center gap-1 text-outline font-label-sm text-xs md:text-sm lg:text-base select-none shrink-0">
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
        <section className="relative mx-3 sm:mx-4 md:mx-5 rounded-2xl overflow-hidden border border-transparent flex items-end pt-3 pb-2">
          {/* Darkened dynamic background */}
          <div className="absolute inset-0 z-0 overflow-hidden bg-surface-container-high">
            <ResponsiveCover
              manga={manga}
              alt=""
              loading="eager"
              fetchPriority="low"
              className="w-full h-full object-cover object-top brightness-[0.68] saturate-[0.95]"
            />
            <CoverScrim variant="hero" />
          </div>

          {/* Info Over Cover Container */}
          <div className="relative z-10 w-full px-4 sm:px-6 md:px-8 flex flex-col items-center text-center sm:flex-row sm:items-end sm:text-left gap-3 sm:gap-6 pb-4">
            {/* Cover Image */}
            {/* aspect-[7/10] (~0.70), bukan 2/3 — rata-rata rasio cover asli
                di situs ini, lihat MangaCard/FeaturedCarousel/SpotlightCarousel */}
            <div className="w-[200px] sm:w-[200px] md:w-[220px] aspect-[7/10] flex-shrink-0 rounded-xl bg-surface-container-high">
              <ResponsiveCover
                  manga={manga}
                  alt={`${manga.title} Cover`}
                  loading="eager"
                  fetchPriority="high"
                  className="w-full h-full object-cover rounded-xl shadow-2xl"
                />
            </div>

            {/* Metadata info */}
            <div className="flex-grow min-w-0 w-full flex flex-col items-center sm:items-start pb-1">
              {/* Title — max 2 baris */}
              <h2 className="font-headline-md text-2xl sm:text-3xl md:text-4xl lg:text-5xl leading-tight text-on-surface dark:text-white dark:[text-shadow:0_1px_3px_rgba(0,0,0,0.9),0_2px_12px_rgba(0,0,0,0.75)] font-black tracking-tight mb-1.5 text-center sm:text-left line-clamp-2">
                {manga.title}
              </h2>

              {/* Alternative Title — ikut tema seperti Judul di atas: panel terang
                  tembus pandang di light mode (teks gelap), scrim gelap tetap di
                  dark mode (teks putih), sama seperti FeaturedCarousel/SpotlightCarousel. */}
              <p className="text-on-surface-variant dark:text-white/90 dark:[text-shadow:0_1px_2px_rgba(0,0,0,0.9),0_1px_8px_rgba(0,0,0,0.7)] text-sm sm:text-base md:text-lg font-semibold mb-3 leading-normal text-center sm:text-left line-clamp-1">
                {manga.alternativeTitle || manga.alt_title || ''}
              </p>

              {/* Baca dari Awal + Lanjut Baca */}
              {(() => {
                const continueChapter = lastReadChapter
                  ? (manga.chapters || []).find(c =>
                      c.id === lastReadChapter.id ||
                      String(c.chapter_number) === String(lastReadChapter.chapter_number))
                  : null;
                if (!firstChapter) return null;
                return (
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 sm:gap-3">
                    <SolidButton variant="light" size="fixed" onClick={() => onReadChapter(firstChapter, manga.title)}>
                      <BookOpen className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      {manga.status === 'Oneshot' ? 'Baca Oneshot' : `Baca Ch. ${firstChapter.chapter_number}`}
                    </SolidButton>
                    {continueChapter && (
                      <SolidButton variant="dark" size="fixed" onClick={() => onReadChapter(continueChapter, manga.title)}>
                        <Play className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-current" />
                        Lanjut {manga.status === 'Oneshot' ? 'Oneshot' : `Ch. ${continueChapter.chapter_number}`}
                      </SolidButton>
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
        <div className="mx-3 sm:mx-4 md:mx-5 mt-4 md:mt-6 border border-outline-variant rounded-2xl lg:border-0 lg:rounded-none lg:mx-0 lg:mt-0">

          {/* Tab Switcher — mobile/tablet only */}
          <div className="flex border-b border-outline-variant lg:hidden">
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
            <div className={`lg:col-span-5 lg:flex flex-col gap-4 p-3 lg:border lg:border-outline-variant lg:rounded-2xl ${activeDetailTab === 'info' ? 'flex' : 'hidden'}`}>

            {/* Stats: Rating + Chapters + Total Views */}
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              {/* Tanpa border — cukup beda warna background dari halaman buat jadi
                  "sekat" antar tile. Border cuma dipertahankan di elemen yang bisa
                  diklik (MangaDex/Raw Link di bawah), bukan di info pasif kayak ini. */}
              <div className="flex flex-col items-center gap-1 sm:gap-1.5 p-3 sm:p-4 bg-surface-container/50 rounded-xl">
                <div className="flex items-center gap-1.5">
                  <Star className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400 fill-current" />
                  <span className="font-headline-md text-lg sm:text-xl md:text-2xl font-black text-on-surface">{manga.rating}</span>
                </div>
                <span className="font-label-sm text-xs sm:text-xs md:text-sm text-outline font-semibold uppercase tracking-wide">Rating</span>
              </div>
              <div className="flex flex-col items-center gap-1 sm:gap-1.5 p-3 sm:p-4 bg-surface-container/50 rounded-xl">
                <div className="flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400" />
                  <span className="font-headline-md text-lg sm:text-xl md:text-2xl font-black text-on-surface">{manga.chapters.length}</span>
                </div>
                <span className="font-label-sm text-xs sm:text-xs md:text-sm text-outline font-semibold uppercase tracking-wide">Chapters</span>
              </div>
              <div className="flex flex-col items-center gap-1 sm:gap-1.5 p-3 sm:p-4 bg-surface-container/50 rounded-xl">
                <div className="flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-sky-400" />
                  <span className="font-headline-md text-lg sm:text-xl md:text-2xl font-black text-on-surface">{manga.total_views ? (manga.total_views >= 1000 ? `${(manga.total_views / 1000).toFixed(1)}k` : String(manga.total_views)) : '—'}</span>
                </div>
                <span className="font-label-sm text-xs sm:text-xs md:text-sm text-outline font-semibold uppercase tracking-wide">Views</span>
              </div>
            </div>

            {/* Author + Artist — dulu 1 kotak bareng + garis pemisah tengah (border-r),
                sekarang 2 tile terpisah (masing-masing bg sendiri, dipisah gap) biar
                konsisten sama pola tile Rating/Chapters/Views di atas. */}
            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              {[
                { key: 'author', label: 'Author', value: manga.author, textCls: 'text-sm sm:text-sm md:text-base' },
                { key: 'artist', label: 'Artist', value: manga.artist, textCls: 'text-sm' },
              ].map(({ key, label, value, textCls }) => {
                const isTruncated = Array.isArray(value) && value.length > 2;
                const isExpanded = isTruncated && expandedCreator[key];
                return (
                  <div key={key} className="creator-fit flex flex-col gap-1 p-3 sm:p-4 min-w-0 bg-surface-container/50 rounded-xl" style={fitCreatorStyle(value)}>
                    <span className="font-label-sm text-xs text-outline font-bold uppercase tracking-widest">{label}</span>
                    {isTruncated ? (
                      <button
                        type="button"
                        onClick={() => setExpandedCreator((prev) => ({ ...prev, [key]: !prev[key] }))}
                        title={joinCreator(value)}
                        aria-expanded={isExpanded}
                        className={`font-body-md ${textCls} font-bold text-on-surface text-left cursor-pointer ${isExpanded ? '' : 'truncate'}`}
                      >
                        {isExpanded ? joinCreator(value) : creatorDisplay(value)}
                      </button>
                    ) : (
                      <span className={`font-body-md ${textCls} font-bold text-on-surface truncate`}>{creatorDisplay(value)}</span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Status + Type — sama seperti Author/Artist di atas. */}
            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              <div className="flex flex-col gap-1 p-3 sm:p-4 bg-surface-container/50 rounded-xl">
                <span className="font-label-sm text-xs text-outline font-bold uppercase tracking-widest">Status</span>
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${
                    manga.status === 'Tamat' || manga.status === 'Oneshot' ? 'bg-red-400' :
                    manga.status === 'Hiatus' ? 'bg-zinc-400' : 'bg-emerald-400'
                  }`} />
                  <span className={`font-body-md text-sm sm:text-sm md:text-base font-black ${
                    manga.status === 'Tamat' || manga.status === 'Oneshot' ? 'text-red-700 dark:text-red-400' :
                    manga.status === 'Hiatus' ? 'text-zinc-600 dark:text-zinc-400' : 'text-emerald-700 dark:text-emerald-400'
                  }`}>{manga.status === 'Tamat' ? 'Complete' : (manga.status || 'Ongoing')}</span>
                </div>
              </div>
              <div className="flex flex-col gap-1 p-3 sm:p-4 bg-surface-container/50 rounded-xl">
                <span className="font-label-sm text-xs text-outline font-bold uppercase tracking-widest">Type</span>
                <div className="flex items-center gap-2">
                  {(() => {
                    const t = (manga.type || 'manga').toLowerCase();
                    const isWebtoon = t === 'webtoon';
                    return (
                      <>
                        <span className="w-2 h-2 rounded-full shrink-0 bg-outline" />
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
                <span key={g} className="font-label-sm bg-surface-container-high px-3 py-1.5 rounded-lg text-xs sm:text-sm md:text-base text-on-surface font-semibold">
                  {g}
                </span>
              ))}
            </div>

            {/* MangaDex + Raw Link */}
            <div className="grid grid-cols-2 gap-3">
              {manga.mangadex_url ? (
                <a href={manga.mangadex_url} target="_blank" rel="noopener noreferrer"
                  className="h-9 sm:h-10 md:h-11 bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/30 rounded-xl font-label-sm text-xs sm:text-sm font-bold flex items-center justify-center gap-2 active:scale-95 transition-all text-orange-700 dark:text-orange-400 hover:text-orange-800 dark:hover:text-orange-300 cursor-pointer">
                  MangaDex
                </a>
              ) : (
                <div className="h-10 bg-surface-container/20 border border-outline-variant/40 rounded-xl font-label-sm text-xs font-bold flex items-center justify-center text-outline/30 select-none">MangaDex</div>
              )}
              {manga.raw_url ? (
                <a href={manga.raw_url} target="_blank" rel="noopener noreferrer"
                  className="h-9 sm:h-10 md:h-11 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 rounded-xl font-label-sm text-xs sm:text-sm font-bold flex items-center justify-center gap-2 active:scale-95 transition-all text-cyan-700 dark:text-cyan-400 hover:text-cyan-800 dark:hover:text-cyan-300 cursor-pointer">
                  Raw Link
                </a>
              ) : (
                <div className="h-10 bg-surface-container/20 border border-outline-variant/40 rounded-xl font-label-sm text-xs font-bold flex items-center justify-center text-outline/30 select-none">Raw Link</div>
              )}
            </div>

            {/* Synopsis */}
            <div className="flex flex-col gap-2">
              <h3 className="font-headline-md text-base sm:text-lg text-on-surface font-black">Sinopsis</h3>
              <p className="font-body-md text-sm sm:text-sm md:text-base text-on-surface-variant leading-relaxed opacity-90 text-justify whitespace-pre-line">
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
                    galleryOpen ? 'border-primary text-primary' : 'border-outline-variant text-outline hover:text-on-surface'
                  }`}
                >
                  <Images className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span className="font-headline-md text-sm sm:text-base font-bold">Cover Manga</span>
                  <span className="font-label-sm text-[10px] sm:text-xs font-black text-outline bg-surface-container-high border border-outline-variant rounded-full px-2 py-0.5">
                    {manga.cover_gallery.length}
                  </span>
                  {galleryPages > 1 && galleryOpen && (
                    <span className="font-label-sm text-[10px] sm:text-xs font-bold text-outline">
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
                                isCurrent ? 'border-primary/50 ring-1 ring-primary/30' : 'border-outline-variant hover:border-primary/40'
                              }`}
                            >
                              <ResponsiveCover
                                manga={{ coverUrls: g.urls, coverUrl: g.urls.mobile }}
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
          <div className={`lg:col-span-7 lg:flex flex-col p-3 lg:border lg:border-outline-variant lg:rounded-2xl ${activeDetailTab === 'chapters' ? 'flex' : 'hidden'}`}>

            {/* Chapter List Header */}
            <div className="flex items-center justify-between mb-3 border-b border-outline-variant/40 pb-2">
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
                        className="font-label-sm w-full py-2.5 bg-surface-container/20 hover:bg-surface-container-high/40 border-2 border-outline-variant rounded-lg text-on-surface-variant hover:text-primary tracking-wider text-xs font-bold transition-all cursor-pointer text-center"
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
                className="font-label-sm w-full mt-4 py-3 bg-surface-container/20 hover:bg-surface-container-high/40 border border-outline-variant/40 rounded-lg text-on-surface-variant hover:text-primary tracking-wider text-xs font-bold transition-all cursor-pointer text-center"
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
              <ResponsiveCover
                manga={{ coverUrls: lightboxCover.urls, coverUrl: lightboxCover.urls.desktop }}
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
