import { memo } from 'react';
import { nowTimestamp, timeAgoShort } from '../utils';
import { Lock } from 'lucide-react';
import ResponsiveCover from './ResponsiveCover';
import { canReadChapter, chapterAccessLevel } from '../lib/chapterAccess';

// Kartu versi poster untuk mode grid — cover dominan, judul 2 baris ellipsis
// di bawahnya, lalu 2 chapter terbaru saja (beda dari MangaCard mode list yang
// tampilkan 3 chapter di samping cover). Prop & logic akses chapter sama
// persis dengan MangaCard.jsx supaya kedua mode konsisten — cuma layout yang beda.
const EMPTY_READ_SET = new Set();

function MangaCardGrid({ manga, onReadChapter, onViewManga, isLoggedIn, isSupporter, coverPriority = false, readChapterIds }) {
  const readChapters = readChapterIds || EMPTY_READ_SET;
  const now = nowTimestamp();

  const isOneshot = manga.status === 'Oneshot';
  const latestReleaseAge = manga.latest_release_date ? now - new Date(manga.latest_release_date).getTime() : NaN;
  const isMangaNew = Number.isFinite(latestReleaseAge) && latestReleaseAge >= 0 && latestReleaseAge < 24 * 60 * 60 * 1000;

  return (
    <div className="flex h-full flex-col gap-1.5 sm:gap-2">
      {/* Box 1: cover + judul */}
      <div className="flex flex-col bg-surface-container rounded-xl overflow-hidden group border border-transparent hover:border-primary/20 shadow-md transition-colors">
        {/* Cover — poster penuh, rasio 2:3 (lihat catatan riset rasio cover di MangaCard.jsx) */}
        <a
          href={`/${manga.id}/`}
          onClick={(e) => { e.preventDefault(); onViewManga(manga); }}
          aria-label={manga.title}
          className="relative block w-full aspect-[2/3] shrink-0 cursor-pointer overflow-hidden"
        >
          <ResponsiveCover
            manga={manga}
            alt={manga.title}
            title={isMangaNew ? 'Ada update baru di manga ini' : undefined}
            loading={coverPriority ? 'eager' : 'lazy'}
            fetchPriority={coverPriority ? 'high' : 'low'}
            decoding={coverPriority ? 'sync' : 'async'}
            className="h-full w-full object-cover bg-surface-container-high"
          />
          {isMangaNew && (
            <span aria-hidden="true" className="cover-new-glow-ring pointer-events-none absolute inset-0" />
          )}
        </a>

        <a
          href={`/${manga.id}/`}
          onClick={(e) => { e.preventDefault(); onViewManga(manga); }}
          className="block p-2 sm:p-2.5"
        >
          <h3 className="font-headline-md text-sm md:text-base lg:text-lg font-black leading-tight text-on-surface line-clamp-2 text-justify min-h-[2.5em] hover:text-primary transition-colors cursor-pointer">
            {manga.title}
          </h3>
        </a>
      </div>

      {/* Chapter terbaru — tiap chapter box SENDIRI-SENDIRI (bukan digabung jadi
          1 box), sama seperti box cover+judul di atas. Slot kosong (manga yang
          cuma punya 1 chapter) tetap dapat box invisible berukuran sama persis
          (padding+border+isi placeholder) supaya tinggi kartu ini tidak lebih
          pendek dari kartu sebelah — baris grid jadi tidak naik/turun. */}
      {[...Array(2)].map((_, idx) => {
        const ch = manga.chapters[idx];
        if (!ch) return (
          <div
            key={`ph-${idx}`}
            aria-hidden="true"
            className="invisible flex w-full items-center justify-between gap-1 rounded-lg border border-transparent p-1.5 sm:p-2"
          >
            <span className="font-body-md text-sm md:text-base lg:text-lg font-bold">.</span>
          </div>
        );
        const accessLevel = chapterAccessLevel(ch, now);
        const isProtected = accessLevel !== 'public';
        const showAccessGate = isProtected && !canReadChapter(ch, { isLoggedIn, isSupporter }, now);
        const releaseAge = ch.release_date ? now - new Date(ch.release_date).getTime() : NaN;
        const isUp = Number.isFinite(releaseAge) && releaseAge >= 0 && releaseAge < 24 * 60 * 60 * 1000;
        const chapterTitle = isOneshot
          ? 'Oneshot'
          : (ch.title.includes(':') ? ch.title.split(':')[0] : ch.title);
        const isRead = readChapters.has(ch.id);

        return (
          <button
            type="button"
            key={ch.id}
            onClick={(e) => { e.stopPropagation(); onReadChapter(ch, manga.title, manga); }}
            className="flex w-full min-w-0 items-center justify-between gap-1 text-left cursor-pointer group/ch bg-surface-container rounded-lg border border-transparent hover:border-primary/20 shadow-md transition-colors p-1.5 sm:p-2"
          >
            <span className="flex min-w-0 items-center gap-1">
              {showAccessGate && <Lock className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-300" />}
              <span className={`font-body-md text-sm md:text-base lg:text-lg font-bold truncate transition-all ${isRead ? 'opacity-70' : ''} ${
                showAccessGate
                  ? 'text-amber-800 dark:text-amber-300'
                  : 'text-on-surface-variant group-hover/ch:text-primary'
              }`}>
                {chapterTitle}
              </span>
              {isUp && (
                <span className="badge-new-glow relative bg-emerald-700 text-white ring-1 ring-emerald-300/70 px-1.5 py-0.5 rounded font-label-sm text-[10px] md:text-xs lg:text-sm font-black uppercase tracking-wider shrink-0">
                  NEW
                </span>
              )}
            </span>
            <span className={`font-label-sm text-xs md:text-sm lg:text-base text-outline whitespace-nowrap shrink-0 transition-opacity ${isRead ? 'opacity-80' : ''}`}>
              {ch.date || timeAgoShort(ch.release_date)}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export default memo(MangaCardGrid);
