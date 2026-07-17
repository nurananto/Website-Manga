import { useState } from 'react';
import { nowTimestamp, timeAgoShort } from '../utils';
import { Lock, ArrowUp } from 'lucide-react';
import CountdownTimer from './CountdownTimer';
import ResponsiveCover from './ResponsiveCover';
import { canReadChapter, chapterAccessLevel, chapterNextAccessDate } from '../lib/chapterAccess';

export default function MangaCard({ manga, onReadChapter, onViewManga, isLoggedIn, isSupporter }) {
  const [, setAccessVersion] = useState(0);
  const now = nowTimestamp();

  const isOneshot = manga.status === 'Oneshot';
  const isFinished = manga.status === 'Tamat' || manga.status === 'Hiatus' || isOneshot;
  const isMangaNew = !!manga.latest_release_date && (now - new Date(manga.latest_release_date).getTime()) < 24 * 60 * 60 * 1000;

  return (
    <div className="flex h-[160px] sm:h-[190px] md:h-[205px] lg:h-[220px] bg-surface-container rounded-xl overflow-hidden group border border-white/5 hover:border-primary/20 shadow-md transition-colors">
      {/* Cover — link crawlable ke detail (SPA: preventDefault + navigate) */}
      <a
        href={`/${manga.id}`}
        onClick={(e) => { e.preventDefault(); onViewManga(); }}
        aria-label={manga.title}
        className="relative w-[108px] sm:w-[120px] md:w-[135px] lg:w-[150px] h-full flex-shrink-0 flex items-center justify-center py-2 sm:py-2.5 md:py-3 px-2 cursor-pointer"
      >
        <ResponsiveCover
            manga={manga}
            alt={manga.title}
            loading="eager"
            fetchPriority="auto"
            decoding="async"
            className="h-full w-full object-cover rounded-lg shadow-[0_8px_20px_rgba(0,0,0,0.5)] border border-white/10 hover:scale-105 transition-transform duration-500"
          />
      </a>

      {/* Details Section */}
      <div className="flex-1 py-3 pr-3 pl-1 sm:py-4 sm:pr-4 sm:pl-1.5 lg:py-5 lg:pr-5 lg:pl-2 flex flex-col min-w-0">
        {/* Title row */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            {isMangaNew && (
              <span className="badge-new-glow shrink-0 rounded-md bg-emerald-500 px-1.5 py-0.5 font-label-sm text-[10px] md:text-xs font-black uppercase tracking-wider text-white ring-1 ring-emerald-300/70">
                NEW
              </span>
            )}
            <a
              href={`/${manga.id}`}
              onClick={(e) => { e.preventDefault(); onViewManga(); }}
              className="min-w-0 flex-1"
            >
              <h3 className="font-headline-md text-base md:text-lg lg:text-xl leading-tight font-black text-on-surface truncate hover:text-primary transition-colors cursor-pointer">
                {manga.title}
              </h3>
            </a>
            {/* Badge status hanya tampil di chapter row sesuai tamat/hiatus_at_chapter */}
          </div>
        </div>

        {/* Chapters List — selalu 3 slot + justify-between agar posisi baris
            PERSIS sama dengan kartu 3-chapter (slot kosong = filler invisible
            setinggi baris asli, supaya distribusi identik & responsif). */}
        <div className="flex flex-col flex-1 mt-2 justify-between">
          {[...Array(3)].map((_, idx) => {
            const ch = manga.chapters[idx];
            if (!ch) return (
              <div key={`ph-${idx}`} aria-hidden
                className="invisible flex min-h-[34px] sm:min-h-[40px] lg:min-h-[46px] items-center px-2 sm:px-2.5 lg:px-3 py-1 sm:py-1.5 lg:py-2 rounded-xl border border-transparent">
                <span className="font-body-md text-sm md:text-base lg:text-lg font-bold">.</span>
              </div>
            );
            const accessLevel = chapterAccessLevel(ch, now);
            const isProtected = accessLevel !== 'public';
            const showAccessGate = isProtected && !canReadChapter(ch, { isLoggedIn, isSupporter }, now);
            const transitionAt = chapterNextAccessDate(ch, now);
            const targetChapter = manga.status === 'Tamat'
              ? manga.tamat_at_chapter
              : isOneshot
              ? ch.chapter_number
              : manga.hiatus_at_chapter;
            const isUp = !!ch.release_date && (now - new Date(ch.release_date).getTime()) < 24 * 60 * 60 * 1000;
            const chapterTitle = isOneshot
              ? 'Oneshot'
              : (ch.title.includes(':') ? ch.title.split(':')[0] : ch.title);
            // Badge Tamat/Hiatus: HANYA muncul di chapter yang persis cocok dengan
            // tamat_at_chapter/hiatus_at_chapter. Tidak ada fallback ke chapter lain.
            const showStatusBadge = !isUp && isFinished && (
              isOneshot ||
              (targetChapter != null && ch.chapter_number === targetChapter)
            );

            return (
              <div
                key={ch.id}
                onClick={(e) => {
                  e.stopPropagation();
                  onReadChapter(ch, manga.title);
                }}
                className="flex min-h-[34px] sm:min-h-[40px] lg:min-h-[46px] justify-between items-center px-2 sm:px-2.5 lg:px-3 py-1 sm:py-1.5 lg:py-2 rounded-xl border transition-all group/ch border-white/5 hover:bg-surface-container-highest hover:border-white/10"
              >
                <div className="flex items-center gap-1 min-w-0 mr-1">
                  <span className="font-body-md text-sm md:text-base lg:text-lg font-bold text-on-surface-variant group-hover/ch:text-primary transition-colors whitespace-nowrap">
                    {chapterTitle}
                  </span>
                  {showAccessGate && <Lock className="w-3.5 h-3.5 md:w-4 md:h-4 lg:w-5 lg:h-5 text-amber-400 shrink-0" />}
                  {isUp && (
                    <span className="bg-emerald-500 text-white ring-1 ring-emerald-300/70 px-1.5 py-0.5 rounded font-label-sm text-[10px] md:text-xs lg:text-sm font-black uppercase tracking-wider flex items-center gap-0.5 shrink-0 animate-pulse">
                      <ArrowUp className="w-2.5 h-2.5 md:w-3 md:h-3 lg:w-3.5 lg:h-3.5 stroke-[3] shrink-0" />
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

                {showAccessGate && transitionAt && (
                  <CountdownTimer
                    unlockDate={transitionAt}
                    silent
                    onUnlock={() => {
                      setAccessVersion(value => value + 1);
                    }}
                  />
                )}
                <span className="font-label-sm text-xs md:text-sm lg:text-base text-outline whitespace-nowrap shrink-0">{ch.date || timeAgoShort(ch.release_date)}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
