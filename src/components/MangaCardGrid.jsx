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
  const isEnded = manga.status === 'Tamat' || isOneshot;
  const isHiatus = manga.status === 'Hiatus';
  const isFinished = isEnded || isHiatus;
  const latestReleaseAge = manga.latest_release_date ? now - new Date(manga.latest_release_date).getTime() : NaN;
  const isMangaNew = Number.isFinite(latestReleaseAge) && latestReleaseAge >= 0 && latestReleaseAge < 24 * 60 * 60 * 1000;

  return (
    <div className="flex h-full flex-col gap-1.5 sm:gap-2">
      {/* Box 1: cover + judul — glow "ada update" & border status manga
          (lihat MangaCard.jsx) ditaruh DI SINI (bukan cuma di cover) supaya
          gak crash dgn layout grid yg cover-nya mepet ujung box.
          Wrapper LUAR tanpa overflow-hidden — ring glow ditaruh sbg sibling
          box (bukan child-nya yang overflow-hidden) supaya pas scale-up dia
          bisa nongol MELEBIHI tepi border, bukan kepotong di dalam. */}
      <div className="relative">
      <div className={`flex flex-col bg-surface-container rounded-xl overflow-hidden group shadow-md transition-colors ${
        // "Ada update baru" (isMangaNew) menang duluan drpd status — glow
        // doang kurang kelihatan, jadi ditambah border hijau solid senada
        // (emerald-500, sama dgn warna .cover-new-glow-ring).
        isMangaNew
          ? 'border-[2.5px] border-emerald-500/70'
          : isEnded
          ? 'border-[2.5px] border-red-500/70'
          : isHiatus
          ? 'border-[2.5px] border-zinc-400/70 dark:border-zinc-500/70'
          : 'border border-transparent hover:border-primary/20'
      }`}>
        {/* Cover — poster penuh, rasio 2:3 (lihat catatan riset rasio cover di MangaCard.jsx) */}
        <a
          href={`/${manga.id}/`}
          onClick={(e) => { e.preventDefault(); onViewManga(manga); }}
          aria-label={manga.title}
          className="relative block w-full aspect-[0.7/1] shrink-0 cursor-pointer overflow-hidden"
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
          {/* Penanda di pojok cover — gantiin 2 badge yang tadinya nempel di
              chapter row (mode list) skaligus, karena grid gak punya chapter
              row di cover ini: "NEW" (ada update <24 jam) menang duluan drpd
              status Tamat/Hiatus (lebih actionable buat pembaca), status cuma
              tampil kalau lagi TIDAK ada update baru. "Menyatu" dgn border
              kartu: warna sama (emerald/red/zinc) & rounded-bl-lg dipotong pas
              oleh overflow-hidden Box 1 di corner kanan-atas. Ukuran
              diskalakan turun ke breakpoint terkecil (mobile 3 kolom) biar
              gak melebihi lebar cover sempit. */}
          {isMangaNew ? (
            <span
              aria-hidden="true"
              className="absolute top-0 right-0 px-1 py-0.5 sm:px-1.5 md:px-2 md:py-1 rounded-bl-lg font-label-sm text-[8px] sm:text-[9px] md:text-[10px] lg:text-xs font-black uppercase tracking-wide whitespace-nowrap text-white bg-emerald-600"
            >
              New
            </span>
          ) : (isEnded || isHiatus) && (
            <span
              aria-hidden="true"
              className={`absolute top-0 right-0 px-1 py-0.5 sm:px-1.5 md:px-2 md:py-1 rounded-bl-lg font-label-sm text-[8px] sm:text-[9px] md:text-[10px] lg:text-xs font-black uppercase tracking-wide whitespace-nowrap text-white ${
                isEnded ? 'bg-red-500' : 'bg-zinc-400 dark:bg-zinc-500'
              }`}
            >
              {isEnded ? 'End' : 'Hiatus'}
            </span>
          )}
        </a>

        <a
          href={`/${manga.id}/`}
          onClick={(e) => { e.preventDefault(); onViewManga(manga); }}
          className="block p-2 sm:p-2.5"
        >
          <h3 className="font-headline-md text-sm md:text-base lg:text-lg font-black leading-tight text-on-surface line-clamp-2 min-h-[2.5em] hover:text-primary transition-colors cursor-pointer">
            {manga.title}
          </h3>
        </a>
      </div>

      {isMangaNew && (
        <span aria-hidden="true" className="cover-new-glow-ring pointer-events-none absolute inset-0 rounded-xl" />
      )}
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
            <span className="font-body-md text-xs sm:text-sm md:text-base lg:text-lg font-bold">.</span>
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

        // Chapter yang jadi "penanda" tamat/hiatus (badge END/Hiatus di mode
        // list — lihat showStatusBadge di MangaCard.jsx). Grid gak punya
        // badge di sini, jadi diganti border berwarna di chapter box-nya.
        const targetChapter = manga.status === 'Tamat'
          ? manga.tamat_at_chapter
          : isOneshot
          ? ch.chapter_number
          : manga.hiatus_at_chapter;
        const showStatusBadge = !isUp && isFinished && (
          isOneshot ||
          (targetChapter != null && String(ch.chapter_number) === String(targetChapter))
        );

        return (
          <button
            type="button"
            key={ch.id}
            onClick={(e) => { e.stopPropagation(); onReadChapter(ch, manga.title, manga); }}
            className={`relative flex w-full min-w-0 items-center justify-between gap-0.5 sm:gap-1 text-left cursor-pointer group/ch bg-surface-container rounded-lg shadow-md transition-colors p-1.5 sm:p-2 ${
              // Chapter yang baru rilis (<24 jam, badge NEW-nya sekarang di
              // pojok cover) dikasih border hijau di sini juga — showStatusBadge
              // otomatis false selama isUp true, jadi gak akan bentrok.
              isUp
                ? 'border-2 border-emerald-500/70'
                : showStatusBadge
                ? (isEnded ? 'border-2 border-red-500/70' : 'border-2 border-zinc-400/70 dark:border-zinc-500/70')
                : 'border border-transparent hover:border-primary/20'
            }`}
          >
            <span className="flex min-w-0 items-center gap-0.5 sm:gap-1">
              {showAccessGate && <Lock className="h-3 w-3 sm:h-3.5 sm:w-3.5 shrink-0 text-amber-600 dark:text-amber-300" />}
              {/* Font row chapter 1 langkah lebih kecil di base (3 kolom mobile
                  sempit banget) drpd MangaCard list, biar "Ch. X" gak ketutupan
                  badge NEW + tanggal — md/lg tetap sama dgn list. */}
              <span className={`font-body-md text-xs sm:text-sm md:text-base lg:text-lg font-bold truncate transition-all ${isRead ? 'opacity-70' : ''} ${
                showAccessGate
                  ? 'text-amber-800 dark:text-amber-300'
                  : 'text-on-surface-variant group-hover/ch:text-primary'
              }`}>
                {chapterTitle}
              </span>
              {/* Badge "NEW" sekarang di pojok cover (isMangaNew), bukan di sini
                  lagi — chapter row di mobile 3 kolom kesempitan buat nampung
                  nomor chapter + badge + tanggal sekaligus (lihat riwayat
                  perubahan). */}
            </span>
            <span className={`font-label-sm text-[10px] sm:text-xs md:text-sm lg:text-base text-outline whitespace-nowrap shrink-0 transition-opacity ${isRead ? 'opacity-80' : ''}`}>
              {ch.date || timeAgoShort(ch.release_date)}
            </span>
            {/* Glow senada dgn border hijau chapter baru — sama seperti glow
                di Box 1 (lihat .cover-new-glow-ring di index.css). Button ini
                gak overflow-hidden jadi amannya sama: nongol dikit ke gap,
                gak kepotong. */}
            {isUp && (
              <span aria-hidden="true" className="cover-new-glow-ring pointer-events-none absolute inset-0 rounded-lg" />
            )}
          </button>
        );
      })}
    </div>
  );
}

// Placeholder invisible utk slot kosong di halaman terakhir pagination —
// strukturnya mirror MangaCardGrid (gap/padding/ukuran font sama persis) biar
// tingginya ngepas kartu asli. Tanpa ini, halaman terakhir yang kurang penuh
// jadi lebih pendek dan bikin baris pagination di bawahnya "ketarik naik".
export function MangaCardGridPlaceholder() {
  return (
    <div aria-hidden="true" className="invisible flex h-full flex-col gap-1.5 sm:gap-2">
      <div className="flex flex-col rounded-xl overflow-hidden">
        <div className="w-full aspect-[0.7/1] shrink-0" />
        <div className="p-2 sm:p-2.5">
          <div className="text-sm md:text-base lg:text-lg font-black leading-tight min-h-[2.5em]">.</div>
        </div>
      </div>
      {[0, 1].map((idx) => (
        <div key={idx} className="rounded-lg p-1.5 sm:p-2">
          <span className="font-body-md text-xs sm:text-sm md:text-base lg:text-lg font-bold">.</span>
        </div>
      ))}
    </div>
  );
}

export default memo(MangaCardGrid);
