import { useState } from 'react';
import { imgUrl, timeAgo } from '../utils';
import { Lock, Clock, ArrowUp } from 'lucide-react';
import CountdownTimer from './CountdownTimer';

export default function MangaCard({ manga, onReadChapter, onViewManga, unlockedChapters }) {
  const [localUnlocked, setLocalUnlocked] = useState(new Set());

  const isOneshot = manga.status === 'Oneshot';
  const isFinished = manga.status === 'Tamat' || manga.status === 'Hiatus' || isOneshot;

  const hasRecentUpdate = manga.chapters.some(ch => {
    if (!ch.release_date) return false;
    return (Date.now() - new Date(ch.release_date).getTime()) < 24 * 60 * 60 * 1000;
  });
  const hasNewChapter = hasRecentUpdate;

  const borderClass = hasNewChapter
    ? 'border-emerald-500/60 hover:border-emerald-400/80 shadow-[0_0_14px_rgba(52,211,153,0.25)] hover:shadow-[0_0_20px_rgba(52,211,153,0.4)]'
    : manga.status === 'Tamat' || isOneshot
    ? 'border-red-500/50 hover:border-red-500/80'
    : manga.status === 'Hiatus'
    ? 'border-zinc-500/40 hover:border-zinc-400/60'
    : 'border-white/5 hover:border-primary/20';

  return (
    <div className={`flex h-[160px] sm:h-[190px] md:h-[205px] lg:h-[220px] bg-surface-container rounded-xl overflow-hidden group border shadow-md ${borderClass}`}>
      {/* Cover — klik ke detail */}
      <div
        onClick={onViewManga}
        className="relative w-[108px] sm:w-[120px] md:w-[135px] lg:w-[150px] h-full flex-shrink-0 flex items-center justify-center py-2 sm:py-2.5 md:py-3 px-2 cursor-pointer"
      >
        <picture>
          {manga.coverUrls?.mobile  && <source media="(max-width: 640px)"  srcSet={imgUrl(manga.coverUrls.mobile)} />}
          {manga.coverUrls?.tablet  && <source media="(max-width: 1024px)" srcSet={imgUrl(manga.coverUrls.tablet)} />}
          <img
            alt={manga.title}
            className="h-full w-full object-cover rounded-lg shadow-[0_8px_20px_rgba(0,0,0,0.5)] border border-white/10 hover:scale-105 transition-transform duration-500"
            src={imgUrl(manga.coverUrls?.desktop ?? manga.coverUrl)}
          />
        </picture>

      </div>

      {/* Details Section */}
      <div className="flex-1 p-3 sm:p-4 lg:p-5 flex flex-col min-w-0">
        {/* Title row */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <h3
              onClick={onViewManga}
              className="font-headline-md text-base md:text-lg lg:text-xl leading-tight font-black text-on-surface truncate hover:text-primary transition-colors cursor-pointer"
            >
              {manga.title}
            </h3>
            {/* Badge status hanya tampil di chapter row sesuai tamat/hiatus_at_chapter */}
          </div>
        </div>

        {/* Chapters List — flex-1 + justify-between agar ngepas bawah cover */}
        <div className="flex flex-col flex-1 justify-between mt-2">
          {manga.chapters.slice(0, 3).map((ch, idx) => {
            const isLocked = !!ch.unlockDate && new Date(ch.unlockDate).getTime() > Date.now()
              && !localUnlocked.has(ch.id) && !unlockedChapters?.has(ch.id);
            // Badge status muncul di chapter pertama (terbaru) saat tidak ada update
            // Badge Tamat/Hiatus muncul di chapter yang sesuai tamat_at_chapter/hiatus_at_chapter
            const targetChapter = manga.status === 'Tamat'
              ? manga.tamat_at_chapter
              : isOneshot
              ? ch.chapter_number // oneshot: badge di semua chapter (cuma 1)
              : manga.hiatus_at_chapter;
            const showStatusBadge = isFinished && (isOneshot || (targetChapter != null && ch.chapter_number === targetChapter));

            return (
              <div
                key={ch.id}
                onClick={(e) => {
                  e.stopPropagation();
                  onReadChapter(ch, manga.title);
                }}
                className="flex justify-between items-center hover:bg-surface-container-highest px-2 sm:px-2.5 lg:px-3 py-1 sm:py-1.5 lg:py-2 rounded-xl border border-white/5 hover:border-white/10 transition-all group/ch"
              >
                <div className="flex items-center gap-1 min-w-0 mr-1">
                  {isLocked && <Lock className="w-3 h-3 text-amber-400/80 shrink-0" />}
                  <span className="font-body-md text-sm md:text-base lg:text-lg font-bold text-on-surface-variant group-hover/ch:text-primary transition-colors whitespace-nowrap">
                    {ch.title.includes(':') ? ch.title.split(':')[0] : ch.title}
                  </span>
                  {ch.release_date && (Date.now() - new Date(ch.release_date).getTime()) < 24 * 60 * 60 * 1000 && (
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

                {isLocked ? (
                  <div className="flex items-center gap-0.5 text-amber-400/80 font-label-sm text-xs font-semibold shrink-0 whitespace-nowrap">
                    <Clock className="w-3 h-3 shrink-0" />
                    <CountdownTimer
                      unlockDate={ch.unlockDate}
                      onUnlock={() => {
                        setLocalUnlocked(prev => {
                          const next = new Set(prev);
                          next.add(ch.id);
                          return next;
                        });
                      }}
                    />
                  </div>
                ) : (
                  <span className="font-label-sm text-[10px] sm:text-xs lg:text-sm text-outline/60 whitespace-nowrap shrink-0">{ch.date || timeAgo(ch.release_date)}</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

