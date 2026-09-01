import { memo } from 'react';
import { nowTimestamp, timeAgoShort } from '../utils';
import { Lock } from 'lucide-react';
import ResponsiveCover from './ResponsiveCover';
import { canReadChapter, chapterAccessLevel } from '../lib/chapterAccess';

// Kartu versi poster untuk mode grid — cover dominan, judul 1 baris ellipsis
// di bawahnya, lalu 1 chapter TERBARU saja (beda dari MangaCard mode list yang
// tampilkan 3 chapter di samping cover). Prop & logic akses chapter sama
// persis dengan MangaCard.jsx supaya kedua mode konsisten — cuma layout yang beda.
//
// Border & glow kartu (status Tamat/Hiatus, "ada update baru") SENGAJA
// dihapus — kepenuhan/norak di layar sempit. Penanda status sekarang cuma
// badge teks: 1 di pojok cover ("Updated"/"End"/"Hiatus"), 1 lagi ngisi slot
// tanggal chapter kalau chapter itu baru rilis ("UP!") atau jadi chapter
// tamat/hiatus ("End"/nama status).
const EMPTY_READ_SET = new Set();

// Font judul chapter FIX satu ukuran buat semua kartu (bukan menyusut per
// panjang teks lagi) — biar gak ada kartu yang judulnya kelihatan lebih
// besar/kecil dari kartu sebelahnya cuma gara-gara nomor chapternya beda
// panjang. Ukurannya sendiri dikecilkan supaya "Ch. 205.1" tetap muat tanpa elipsis.
const CHAPTER_TITLE_SIZE_CLASS = 'text-[10.5px] sm:text-[11.5px] md:text-[13.5px] lg:text-[14.5px]';
const CHAPTER_ROW_SIZE_CLASS = 'h-9 sm:h-10 md:h-11 lg:h-12';

function MangaCardGrid({ manga, onReadChapter, onViewManga, isLoggedIn, isSupporter, coverPriority = false, readChapterIds }) {
  const readChapters = readChapterIds || EMPTY_READ_SET;
  const now = nowTimestamp();

  const isOneshot = manga.status === 'Oneshot';
  const isEnded = manga.status === 'Tamat' || isOneshot;
  const isHiatus = manga.status === 'Hiatus';
  const isFinished = isEnded || isHiatus;
  const latestReleaseAge = manga.latest_release_date ? now - new Date(manga.latest_release_date).getTime() : NaN;
  const isMangaNew = Number.isFinite(latestReleaseAge) && latestReleaseAge >= 0 && latestReleaseAge < 24 * 60 * 60 * 1000;

  // Cuma 1 chapter terbaru yang ditampilkan (bukan 2) — lebih lega buat badge
  // di slot tanggal, dan chapter row gak sesak di mobile 3 kolom.
  const ch = manga.chapters[0];

  let chapterBody = (
    <div aria-hidden="true" className={`invisible flex w-full items-center justify-between gap-1 rounded-lg p-1 sm:p-2 ${CHAPTER_ROW_SIZE_CLASS}`}>
      <span className="font-body-md text-[12px] sm:text-[13px] md:text-[15px] lg:text-[17px] font-bold">.</span>
    </div>
  );

  if (ch) {
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
    // list — lihat showStatusBadge di MangaCard.jsx).
    const targetChapter = manga.status === 'Tamat'
      ? manga.tamat_at_chapter
      : isOneshot
      ? ch.chapter_number
      : manga.hiatus_at_chapter;
    const showStatusBadge = !isUp && isFinished && (
      isOneshot ||
      (targetChapter != null && String(ch.chapter_number) === String(targetChapter))
    );

    // Slot tanggal (kanan) diisi badge kalau ada yang perlu ditandai — "UP!"
    // menang duluan (lebih actionable drpd status), baru status Tamat/Hiatus.
    // Kalau gak ada satu pun, tampilkan tanggal seperti biasa. Icon Lock
    // TIDAK di sini — balik ke sebelah kiri judul chapter (lihat chapterBody).
    const dateBadge = isUp
      ? { text: 'UP!', className: 'badge-updated-glow text-white' }
      : showStatusBadge
      ? {
          text: isEnded ? 'End' : manga.status,
          className: isEnded
            ? 'bg-red-500/15 text-red-700 dark:text-red-400 border border-red-500/30'
            : 'bg-zinc-500/15 text-zinc-700 dark:text-zinc-400 border border-zinc-500/30',
        }
      : null;

    chapterBody = (
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onReadChapter(ch, manga.title, manga); }}
        className={`flex w-full min-w-0 items-center justify-between gap-0.5 sm:gap-1 text-left cursor-pointer group/ch bg-surface-container rounded-lg shadow-md transition-colors p-1 sm:p-2 border border-transparent hover:border-primary/20 ${CHAPTER_ROW_SIZE_CLASS}`}
      >
        <span className="flex min-w-0 items-center gap-1 sm:gap-1.5">
          {/* Icon Lock — balik ke sebelah KIRI judul chapter (squircle amber,
              icon-only). Badge di slot tanggal (kanan) tetap independen. */}
          {showAccessGate && (
            <span
              aria-hidden="true"
              className="flex h-4 w-4 sm:h-[18px] sm:w-[18px] md:h-5 md:w-5 lg:h-[22px] lg:w-[22px] shrink-0 items-center justify-center rounded-[5px] border border-amber-400/60 bg-amber-500/20"
            >
              {/* -translate-y-px: bounding box SVG-nya sendiri sudah center
                  matematis (rect y11-22 + shackle y2-11 → tengah persis y12
                  dari viewBox 24), tapi shackle cuma garis tipis vs badan rect
                  solid bikin bobot visualnya keliatan berat ke bawah — nudge
                  optik halus ke atas biar keliatan seimbang di mata. */}
              <Lock className="h-2.5 w-2.5 sm:h-3 sm:w-3 md:h-3.5 md:w-3.5 lg:h-4 lg:w-4 -translate-y-px text-amber-600 dark:text-amber-300 stroke-[2.5]" />
            </span>
          )}
          <span className={`font-body-md ${CHAPTER_TITLE_SIZE_CLASS} font-bold leading-none truncate transition-all ${isRead ? 'opacity-70' : ''} ${
            showAccessGate
              ? 'text-amber-800 dark:text-amber-300'
              : 'text-on-surface-variant group-hover/ch:text-primary'
          }`}>
            {chapterTitle}
          </span>
        </span>
        {dateBadge ? (
          <span className={`shrink-0 font-label-sm leading-none px-1 py-0.5 sm:px-1.5 rounded text-[8px] sm:text-[9px] md:text-[10px] lg:text-xs font-black uppercase tracking-wide whitespace-nowrap ${dateBadge.className}`}>
            {dateBadge.text}
          </span>
        ) : (
          <span className={`font-label-sm leading-none text-[8px] sm:text-[9px] md:text-[11px] lg:text-[13px] text-outline whitespace-nowrap shrink-0 transition-opacity ${isRead ? 'opacity-80' : ''}`}>
            {ch.date || timeAgoShort(ch.release_date)}
          </span>
        )}
      </button>
    );
  }

  // Badge di pojok cover — "Updated!" (ada rilis <24 jam) menang duluan drpd
  // status Tamat/Hiatus/Ongoing (lebih actionable buat pembaca). Selalu ada
  // 1 badge (gak pernah null lagi) — sama kayak MangaCard.jsx (list) yang
  // juga selalu nampilin status, termasuk Ongoing.
  const cornerBadge = isMangaNew
    ? { text: 'Updated!', className: 'badge-updated-glow text-white' }
    : isEnded
    ? { text: 'Completed', className: 'bg-red-500 text-white' }
    : isHiatus
    ? { text: 'Hiatus', className: 'bg-zinc-400 dark:bg-zinc-500 text-white' }
    : { text: 'Ongoing', className: 'bg-emerald-600 text-white' };

  return (
    <div className="flex h-full flex-col gap-1.5 sm:gap-2">
      {/* Box 1: badge (kalau ada) DI ATAS cover+judul, flow biasa (bukan
          absolute overlap di dalam cover kayak sebelumnya) — sama pendekatan
          kayak badge status di MangaCard.jsx (list): browser sendiri yang
          nentuin tingginya, gak perlu tebak px lagi. items-end: badge nempel
          kanan, sejajar sudut kanan Box1 di bawahnya. Sudut kanan-atas Box1
          SENGAJA rounded-tr-none KALAU ada badge (ketemu sudut kanan-bawah
          badge yang juga siku) — kalau gak ada badge, tetap rounded normal. */}
      <div className="flex flex-col items-end">
        {/* px ditambah (dulu 0, teks mepet penuh ke lebar badge — bikin
            keliatan "lebih gede" dari badge chapter walau font-sizenya sama
            persis) + lebar dinaikin dikit biar tetap muat "Completed"/"Updated!" */}
        <span
          aria-hidden="true"
          className={`w-[72px] sm:w-[80px] md:w-[92px] lg:w-[104px] px-1 sm:px-1.5 py-0.5 sm:py-1 rounded-t-lg text-center font-label-sm text-[8px] sm:text-[9px] md:text-[10px] lg:text-xs font-black uppercase tracking-wide whitespace-nowrap ${cornerBadge.className}`}
        >
          {cornerBadge.text}
        </span>
        {/* border-outline-variant (bukan transparent) — biar keliatan jelas
            badge di atas ini "milik" kartu yang mana, sama kayak border
            kartu di MangaCard.jsx (list). */}
        <div className="flex w-full flex-col bg-surface-container overflow-hidden group rounded-tl-xl rounded-tr-none rounded-br-xl rounded-bl-xl border border-outline-variant hover:border-primary/40 shadow-md transition-colors">
          {/* Cover — poster penuh, rasio ~0.70 (samain dgn mode list, lihat
              catatan riset rasio cover di MangaCard.jsx) */}
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
          </a>

          <a
            href={`/${manga.id}/`}
            onClick={(e) => { e.preventDefault(); onViewManga(manga); }}
            className="block p-2 sm:p-2.5"
          >
            <h3 className="font-headline-md text-sm md:text-base lg:text-lg font-black leading-tight text-on-surface truncate hover:text-primary transition-colors cursor-pointer">
              {manga.title}
            </h3>
          </a>
        </div>
      </div>

      {chapterBody}
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
      <div className="flex flex-col items-end">
        {/* Strip badge — ikut ada di sini juga (invisible) krn di kartu asli
            badge nambah tinggi ke Box 1 (flow, bukan overlay lagi). */}
        <span className="w-[72px] sm:w-[80px] md:w-[92px] lg:w-[104px] px-1 sm:px-1.5 py-0.5 sm:py-1 text-[8px] sm:text-[9px] md:text-[10px] lg:text-xs font-black">.</span>
        <div className="flex w-full flex-col rounded-xl overflow-hidden border border-outline-variant">
          <div className="w-full aspect-[0.7/1] shrink-0" />
          <div className="p-2 sm:p-2.5">
            <div className="font-headline-md text-sm md:text-base lg:text-lg font-black leading-tight">.</div>
          </div>
        </div>
      </div>
          <div className={`rounded-lg p-1 sm:p-2 ${CHAPTER_ROW_SIZE_CLASS}`}>
        <span className="font-body-md text-[12px] sm:text-[13px] md:text-[15px] lg:text-[17px] font-bold">.</span>
      </div>
    </div>
  );
}

export default memo(MangaCardGrid);
