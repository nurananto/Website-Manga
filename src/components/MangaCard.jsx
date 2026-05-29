import { useState } from 'react';
import { Star, Coins, Clock, ArrowUp } from 'lucide-react';
import CountdownTimer from './CountdownTimer';

export default function MangaCard({ manga, onReadChapter }) {
  const [localUnlocked, setLocalUnlocked] = useState(new Set());

  // Apakah ada chapter baru (UP aktif) — prioritas tertinggi untuk border
  const hasNewChapter = manga.chapters.some(ch => ch.isNew);

  const borderClass = hasNewChapter
    ? 'border-emerald-500/60 hover:border-emerald-400/80 shadow-[0_0_14px_rgba(52,211,153,0.25)] hover:shadow-[0_0_20px_rgba(52,211,153,0.4)]'
    : manga.status === 'Tamat'
    ? 'border-red-500/50 hover:border-red-500/80'
    : manga.status === 'Hiatus'
    ? 'border-zinc-500/40 hover:border-zinc-400/60'
    : 'border-white/5 hover:border-primary/20';

  return (
    <div className={`flex h-[200px] bg-surface-container rounded-xl overflow-hidden group hover:bg-surface-container-high transition-all duration-300 cursor-pointer border shadow-md ${borderClass}`}>
      {/* Cover Image Section */}
      <div className="relative w-[130px] h-full flex-shrink-0 flex items-center justify-center py-2 px-2 bg-surface-container-low">
        <img
          alt={manga.title}
          className="h-full max-h-[94%] aspect-[2/3] object-cover rounded-lg shadow-[0_8px_24px_rgba(0,0,0,0.6)] border border-white/10 group-hover:scale-105 transition-transform duration-500"
          src={manga.coverUrl}
        />

        {/* UP badge — hanya tampil saat ada chapter baru */}
        {hasNewChapter && (
          <div className="absolute top-2 left-2 bg-emerald-500/90 backdrop-blur-sm text-white px-1.5 py-0.5 rounded font-label-sm text-[9px] font-black uppercase tracking-wider shadow-sm flex items-center gap-0.5 animate-pulse">
            <ArrowUp className="w-2.5 h-2.5 stroke-[3] shrink-0" />
            <span>UP</span>
            <ArrowUp className="w-2.5 h-2.5 stroke-[3] shrink-0" />
          </div>
        )}
      </div>

      {/* Details Section */}
      <div className="flex-1 p-3 sm:p-4 flex flex-col min-w-0">
        {/* Title row */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <h3 className="font-headline-md text-lg leading-tight font-extrabold text-on-surface truncate group-hover:text-primary transition-colors">
              {manga.title}
            </h3>
            {/* Status badge di judul — hanya tampil saat tidak ada update baru */}
            {!hasNewChapter && manga.status === 'Hiatus' && (
              <span className="shrink-0 font-label-sm px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-zinc-500/15 text-zinc-400 border border-zinc-500/30">
                Hiatus
              </span>
            )}
            {!hasNewChapter && manga.status === 'Tamat' && (
              <span className="shrink-0 font-label-sm px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-red-500/15 text-red-400 border border-red-500/30">
                Tamat
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0 bg-amber-500/10 px-1.5 py-0.5 rounded-lg text-amber-500">
            <Star className="w-3 h-3 fill-current" />
            <span className="font-label-sm text-[10px] font-black">{manga.rating}</span>
          </div>
        </div>
        <p className="font-body-md text-xs text-outline mt-0.5 truncate">{manga.author}</p>

        {/* Chapters List */}
        <div className="flex flex-col gap-1 mt-auto">
          {manga.chapters.slice(0, 3).map((ch, idx) => {
            const isLocked = ch.isLocked && !localUnlocked.has(ch.id);
            // Badge status muncul di chapter pertama (terbaru) saat tidak ada update
            const showStatusBadge = idx === 0 && !hasNewChapter && (manga.status === 'Tamat' || manga.status === 'Hiatus');

            return (
              <div
                key={ch.id}
                onClick={(e) => {
                  e.stopPropagation();
                  onReadChapter(ch, manga.title);
                }}
                className="flex justify-between items-center hover:bg-surface-container-highest px-2 py-1 rounded-md transition-colors group/ch"
              >
                <div className="flex items-center gap-1.5 min-w-0 mr-2">
                  <span className="font-body-md text-sm font-semibold text-on-surface-variant group-hover/ch:text-primary transition-colors truncate">
                    {ch.title.includes(':') ? ch.title.split(':')[0] : ch.title}
                  </span>
                  {ch.isNew && (
                    <span className="relative flex items-center shrink-0">
                      <span className="absolute inset-0 rounded bg-emerald-400/40 animate-ping" />
                      <span className="relative font-label-sm bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-1 py-0.5 rounded text-[8px] font-extrabold uppercase leading-none">
                        New
                      </span>
                    </span>
                  )}
                  {showStatusBadge && (
                    <span className={`shrink-0 font-label-sm px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider ${
                      manga.status === 'Tamat'
                        ? 'bg-red-500/15 text-red-400 border border-red-500/30'
                        : 'bg-zinc-500/15 text-zinc-400 border border-zinc-500/30'
                    }`}>
                      {manga.status}
                    </span>
                  )}
                </div>

                {isLocked ? (
                  <div className="flex items-center gap-1 text-amber-400 font-label-sm text-xs font-bold bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/10 shrink-0 whitespace-nowrap">
                    <div className="flex items-center gap-0.5 border-r border-amber-500/20 pr-1 mr-1 shrink-0">
                      <Coins className="w-3.5 h-3.5 fill-current shrink-0" />
                      <span>5</span>
                    </div>
                    <div className="flex items-center gap-0.5 shrink-0">
                      <Clock className="w-3 h-3 text-amber-500/80 shrink-0" />
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
                  </div>
                ) : (
                  <span className="font-label-sm text-xs text-outline/60 whitespace-nowrap shrink-0">{ch.date}</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

