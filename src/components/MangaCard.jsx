import { useState } from 'react';
import { nowTimestamp, timeAgoShort } from '../utils';
import { Lock, ArrowUp, BookOpen } from 'lucide-react';
import CountdownTimer from './CountdownTimer';
import ResponsiveCover from './ResponsiveCover';
import { canReadChapter, chapterAccessLevel, chapterNextAccessDate } from '../lib/chapterAccess';

// coverPriority: true setelah pembaca memakai pagination. Cover halaman tetangga
// sudah di-prefetch + di-decode oleh App, jadi kartu baru bisa dipasang eager dan
// di-decode sinkron — tanpa itu <img> yang baru dibuat (key per manga) selalu
// melukis satu frame kosong lebih dulu dan terlihat berkedip.
export default function MangaCard({ manga, onReadChapter, onViewManga, isLoggedIn, isSupporter, coverPriority = false }) {
  const [, setAccessVersion] = useState(0);
  const now = nowTimestamp();

  const isOneshot = manga.status === 'Oneshot';
  const isFinished = manga.status === 'Tamat' || manga.status === 'Hiatus' || isOneshot;
  const latestReleaseAge = manga.latest_release_date ? now - new Date(manga.latest_release_date).getTime() : NaN;
  const isMangaNew = Number.isFinite(latestReleaseAge) && latestReleaseAge >= 0 && latestReleaseAge < 24 * 60 * 60 * 1000;

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
            loading={coverPriority ? 'eager' : 'lazy'}
            fetchPriority={coverPriority ? 'high' : 'low'}
            decoding={coverPriority ? 'sync' : 'async'}
            className="h-full w-full object-cover rounded-lg bg-surface-container-high shadow-[0_8px_20px_rgba(0,0,0,0.5)] border border-white/10 hover:scale-105 transition-transform duration-500"
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
            const showEarlyAccessGate = accessLevel === 'supporter' && showAccessGate;
            const transitionAt = chapterNextAccessDate(ch, now);
            const targetChapter = manga.status === 'Tamat'
              ? manga.tamat_at_chapter
              : isOneshot
              ? ch.chapter_number
              : manga.hiatus_at_chapter;
            const releaseAge = ch.release_date ? now - new Date(ch.release_date).getTime() : NaN;
            const isUp = Number.isFinite(releaseAge) && releaseAge >= 0 && releaseAge < 24 * 60 * 60 * 1000;
            const chapterTitle = isOneshot
              ? 'Oneshot'
              : (ch.title.includes(':') ? ch.title.split(':')[0] : ch.title);
            // Badge Tamat/Hiatus: HANYA muncul di chapter yang persis cocok dengan
            // tamat_at_chapter/hiatus_at_chapter. Tidak ada fallback ke chapter lain.
            const showStatusBadge = !isUp && isFinished && (
              isOneshot ||
              (targetChapter != null && String(ch.chapter_number) === String(targetChapter))
            );

            return (
              <button
                type="button"
                key={ch.id}
                onClick={(e) => {
                  e.stopPropagation();
                  onReadChapter(ch, manga.title);
                }}
                className="flex min-h-[34px] w-full sm:min-h-[40px] lg:min-h-[46px] justify-between items-center px-2 sm:px-2.5 lg:px-3 py-1 sm:py-1.5 lg:py-2 rounded-xl border text-left transition-all group/ch border-white/5 hover:bg-surface-container-highest hover:border-white/10 cursor-pointer"
              >
                <div className="flex items-center gap-1 min-w-0 mr-1">
                  <span
                    aria-hidden="true"
                    className={`mr-1 flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-[6px] md:mr-1.5 md:h-6 md:w-6 lg:h-[26px] lg:w-[26px] ${
                      showEarlyAccessGate
                        ? 'border border-amber-400/60 bg-amber-500/20'
                        : 'border border-white/20 bg-white/5'
                    }`}
                  >
                    {showEarlyAccessGate ? (
                      <Lock className="h-3.5 w-3.5 text-amber-300 stroke-[2.5] md:h-4 md:w-4 lg:h-[18px] lg:w-[18px]" />
                    ) : (
                      <BookOpen className="h-3.5 w-3.5 text-white stroke-[2.25] md:h-4 md:w-4 lg:h-[18px] lg:w-[18px]" />
                    )}
                  </span>
                  <span className={`font-body-md text-sm md:text-base lg:text-lg font-bold transition-colors whitespace-nowrap ${
                    showEarlyAccessGate
                      ? 'text-amber-300 group-hover/ch:text-amber-200'
                      : 'text-on-surface-variant group-hover/ch:text-primary'
                  }`}>
                    {chapterTitle}
                  </span>
                  {isUp && (
                    <span className="badge-new-glow bg-emerald-500 text-white ring-1 ring-emerald-300/70 px-1.5 py-0.5 rounded font-label-sm text-[10px] md:text-xs lg:text-sm font-black uppercase tracking-wider flex items-center gap-0.5 shrink-0">
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

                {showEarlyAccessGate && transitionAt && (
                  <CountdownTimer
                    unlockDate={transitionAt}
                    silent
                    onUnlock={() => {
                      setAccessVersion(value => value + 1);
                    }}
                  />
                )}
                <span className="font-label-sm text-xs md:text-sm lg:text-base text-outline whitespace-nowrap shrink-0">{ch.date || timeAgoShort(ch.release_date)}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
