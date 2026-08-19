import { useState, memo } from 'react';
import { nowTimestamp, timeAgoShort } from '../utils';
import { Lock, BookOpen } from 'lucide-react';
import CountdownTimer from './CountdownTimer';
import ResponsiveCover from './ResponsiveCover';
import { canReadChapter, chapterAccessLevel, chapterNextAccessDate } from '../lib/chapterAccess';

// coverPriority: true setelah pembaca memakai pagination. Cover halaman tetangga
// sudah di-prefetch + di-decode oleh App, jadi kartu baru bisa dipasang eager dan
// di-decode sinkron — tanpa itu <img> yang baru dibuat (key per manga) selalu
// melukis satu frame kosong lebih dulu dan terlihat berkedip.
const EMPTY_READ_SET = new Set();

function MangaCard({ manga, onReadChapter, onViewManga, isLoggedIn, isSupporter, coverPriority = false, readChapterIds }) {
  const readChapters = readChapterIds || EMPTY_READ_SET;
  const [, setAccessVersion] = useState(0);
  const now = nowTimestamp();

  const isOneshot = manga.status === 'Oneshot';
  const isFinished = manga.status === 'Tamat' || manga.status === 'Hiatus' || isOneshot;
  const latestReleaseAge = manga.latest_release_date ? now - new Date(manga.latest_release_date).getTime() : NaN;
  const isMangaNew = Number.isFinite(latestReleaseAge) && latestReleaseAge >= 0 && latestReleaseAge < 24 * 60 * 60 * 1000;

  return (
    <div className="flex h-[164px] sm:h-[194px] md:h-[209px] lg:h-[226px] bg-surface-container rounded-xl overflow-hidden group border border-transparent hover:border-primary/20 shadow-md transition-colors">
      {/* Cover — link crawlable ke detail (SPA: preventDefault + navigate) */}
      <a
        href={`/${manga.id}/`}
        onClick={(e) => { e.preventDefault(); onViewManga(manga); }}
        aria-label={manga.title}
        // Padding disetel per-breakpoint (bukan px-2 rata semua) supaya cover
        // yang tampil rasionya ~0.70 (rata-rata cover asli manga, lihat catatan
        // riset), bukan ~0.6 (kepotong kurus/tinggi). py dinaikkan (cover jadi
        // sedikit lebih pendek) supaya px juga bisa dinaikkan — versi awal px
        // terlalu mepet (sm:px-0 = 0px), bikin efek hover:scale-105 & glow
        // cover-new-glow ikut kepotong overflow-hidden kartu di sisi kanan.
        className="relative w-[108px] sm:w-[120px] md:w-[135px] lg:w-[150px] h-full flex-shrink-0 flex items-center justify-center py-4 md:py-3.5 px-2 sm:px-1 lg:px-1.5 cursor-pointer"
      >
        <div className="relative h-full w-full">
          <ResponsiveCover
              manga={manga}
              alt={manga.title}
              title={isMangaNew ? 'Ada update baru di manga ini' : undefined}
              loading={coverPriority ? 'eager' : 'lazy'}
              fetchPriority={coverPriority ? 'high' : 'low'}
              decoding={coverPriority ? 'sync' : 'async'}
              className="h-full w-full object-cover rounded-lg bg-surface-container-high shadow-[0_2px_6px_rgba(0,0,0,0.10)] dark:shadow-[0_8px_20px_rgba(0,0,0,0.5)] border border-outline-variant hover:scale-105 transition-all duration-500"
            />
          {/* Ring "ada update" — elemen terpisah (bukan class di <img>): pseudo-
              element ::after tidak dirender di elemen <img> (replaced element),
              jadi ring-nya sibling <span> sendiri yang di-scale+opacity-in,
              lihat .cover-new-glow-ring di index.css. */}
          {isMangaNew && (
            <span aria-hidden="true" className="cover-new-glow-ring pointer-events-none absolute inset-0 rounded-lg" />
          )}
        </div>
      </a>

      {/* Details Section */}
      <div className="flex-1 py-3 pr-3 pl-1 sm:py-4 sm:pr-4 sm:pl-1.5 lg:py-5 lg:pr-5 lg:pl-2 flex flex-col min-w-0">
        {/* Title row — px-2 sm:px-2.5 lg:px-3 SAMA PERSIS dengan padding tombol
            chapter di bawah (button punya padding sendiri di luar ikon). Judul
            sengaja sejajar dengan BORDER KIRI kotak ikon buku/gembok (bukan
            dengan teks "Ch. X" setelah ikon) — makanya di sini TIDAK ada
            placeholder selebar ikon lagi, cukup padding ini saja. */}
        {/* border-b + pb sebagai pemisah visual judul vs daftar chapter di bawahnya */}
        <div className="flex items-center justify-between gap-2 px-2 sm:px-2.5 lg:px-3 pb-1.5 sm:pb-2 border-b-2 border-outline-variant/50">
          <div className="flex items-center gap-1 min-w-0 flex-1">
            <a
              href={`/${manga.id}/`}
              onClick={(e) => { e.preventDefault(); onViewManga(manga); }}
              className="min-w-0 flex-1"
            >
              <h3 className="font-headline-md text-lg md:text-xl lg:text-2xl leading-tight font-black text-on-surface truncate hover:text-primary transition-colors cursor-pointer">
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
            const isRead = readChapters.has(ch.id);

            return (
              <button
                type="button"
                key={ch.id}
                onClick={(e) => {
                  e.stopPropagation();
                  onReadChapter(ch, manga.title, manga);
                }}
                className="flex min-h-[34px] w-full sm:min-h-[40px] lg:min-h-[46px] justify-between items-center px-2 sm:px-2.5 lg:px-3 py-1 sm:py-1.5 lg:py-2 rounded-xl border text-left transition-all group/ch border-transparent hover:bg-surface-container-highest hover:border-outline-variant cursor-pointer"
              >
                <div className="flex items-center gap-1 min-w-0 mr-1">
                  <span
                    aria-hidden="true"
                    className={`mr-1 flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-[6px] md:mr-1.5 md:h-6 md:w-6 lg:h-[26px] lg:w-[26px] transition-all ${isRead ? 'opacity-40' : ''} ${
                      showEarlyAccessGate
                        ? 'border border-amber-400/60 bg-amber-500/20'
                        : 'border border-outline-variant bg-surface-container-high'
                    }`}
                  >
                    {showEarlyAccessGate ? (
                      <Lock className="h-3.5 w-3.5 text-amber-600 dark:text-amber-300 stroke-[2.5] md:h-4 md:w-4 lg:h-[18px] lg:w-[18px]" />
                    ) : (
                      <BookOpen className="h-3.5 w-3.5 text-on-surface stroke-[2.25] md:h-4 md:w-4 lg:h-[18px] lg:w-[18px]" />
                    )}
                  </span>
                  {/* opacity-80 (bukan -40) di teks: -40 nge-drop contrast on-surface-variant
                      dari ~8:1 (light) / ~10:1 (dark) jadi ~2:1 begitu chapter isRead — gagal
                      WCAG AA (butuh 4.5:1). -80 tetap kebaca "dibaca/pudar" tapi aman AA di
                      kedua tema. Icon box boleh tetap -40 karena itu dekoratif, bukan teks. */}
                  <span className={`font-body-md text-sm md:text-base lg:text-lg font-bold transition-all whitespace-nowrap ${isRead ? 'opacity-80' : ''} ${
                    showEarlyAccessGate
                      ? 'text-amber-800 dark:text-amber-300 group-hover/ch:text-amber-700 dark:group-hover/ch:text-amber-200'
                      : 'text-on-surface-variant group-hover/ch:text-primary'
                  }`}>
                    {chapterTitle}
                  </span>
                  {isUp && (
                    // ml-1.5 (bukan cuma andalkan gap-1 parent) — box-shadow glow badge
                    // ini melebar sampai 8px ke kiri (lihat @keyframes new-badge-glow di
                    // index.css), jarak gap-1 (4px) saja bikin separuh glow nembus ke
                    // tulisan chapter di sebelahnya.
                    <span className="badge-new-glow relative ml-1.5 bg-emerald-700 text-white ring-1 ring-emerald-300/70 px-1.5 py-0.5 rounded font-label-sm text-[10px] md:text-xs lg:text-sm font-black uppercase tracking-wider shrink-0">
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

                {showEarlyAccessGate && transitionAt && (
                  <CountdownTimer
                    unlockDate={transitionAt}
                    silent
                    onUnlock={() => {
                      setAccessVersion(value => value + 1);
                    }}
                  />
                )}
                <span className={`font-label-sm text-xs md:text-sm lg:text-base text-outline whitespace-nowrap shrink-0 transition-opacity ${isRead ? 'opacity-80' : ''}`}>{ch.date || timeAgoShort(ch.release_date)}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default memo(MangaCard);
