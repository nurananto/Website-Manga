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
    <div aria-hidden="true" className="invisible flex w-full items-center justify-between gap-1 rounded-lg p-1.5 sm:p-2">
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

    // Slot tanggal (kanan) diisi badge kalau ada yang perlu ditandai — "Locked"
    // menang PALING duluan (chapter yang gak bisa dibaca lebih penting drpd
    // info lain), baru "UP!" (lebih actionable drpd status), baru status
    // Tamat/Hiatus. Kalau gak ada satu pun, tampilkan tanggal seperti biasa.
    // Icon Lock dipindah dari sebelah judul (kepenuhan/mepet di layar sempit)
    // ke sini — konsisten dgn badge lain yang juga di slot ini. Icon-only
    // (tanpa teks) kalau cuma locked doang, warna amber — tapi chapter
    // TERBARU yang locked itu kasus umum (chapter early-access buat
    // supporter), jadi kalau kebetulan locked SEKALIGUS baru rilis, badge-nya
    // ikut warna hijau UP! biasa (bukan amber) + teks "UP!", ikon Lock-nya
    // ikut warna teks (currentColor) jadi otomatis putih. Ukuran box & ikon
    // tetap sama persis dgn badge UP!/Locked lainnya (classes sizing gak
    // dibedain per varian).
    const dateBadge = showAccessGate
      ? isUp
        ? { icon: Lock, text: 'UP!', className: 'bg-emerald-700 text-white' }
        : { icon: Lock, className: 'bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-400/60' }
      : isUp
      ? { text: 'UP!', className: 'bg-emerald-700 text-white' }
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
        className="flex w-full min-w-0 items-center justify-between gap-0.5 sm:gap-1 text-left cursor-pointer group/ch bg-surface-container rounded-lg shadow-md transition-colors p-1.5 sm:p-2 border border-transparent hover:border-primary/20"
      >
        <span className="flex min-w-0 items-center gap-0.5 sm:gap-1">
          {/* Font chapter di antara ukuran awal (list) & versi kepenuhan
              sebelumnya — dinaikkan dikit dari versi paling kecil, tapi
              masih dijaga gak sebesar mode list biar gak ketutupan badge
              di slot tanggal pas mobile 3 kolom. */}
          <span className={`font-body-md text-[12px] sm:text-[13px] md:text-[15px] lg:text-[17px] font-bold truncate transition-all ${isRead ? 'opacity-70' : ''} ${
            showAccessGate
              ? 'text-amber-800 dark:text-amber-300'
              : 'text-on-surface-variant group-hover/ch:text-primary'
          }`}>
            {chapterTitle}
          </span>
        </span>
        {dateBadge ? (
          <span className={`flex items-center gap-0.5 shrink-0 font-label-sm px-1 py-0.5 sm:px-1.5 rounded text-[8px] sm:text-[9px] md:text-[10px] lg:text-xs font-black uppercase tracking-wide whitespace-nowrap ${dateBadge.className}`}>
            {/* Icon Lock (kalau ada) dipindah ke sini dari sebelah judul —
                di layar sempit judul+icon suka kepenuhan/mepet. Icon-only,
                gak ada teks "Locked" di sebelahnya — biar gak makin sempit. */}
            {dateBadge.icon && <dateBadge.icon className="h-2.5 w-2.5 md:h-3 md:w-3 shrink-0 stroke-[3]" />}
            {dateBadge.text}

          </span>
        ) : (
          <span className={`font-label-sm text-[10px] sm:text-xs md:text-sm lg:text-base text-outline whitespace-nowrap shrink-0 transition-opacity ${isRead ? 'opacity-80' : ''}`}>
            {ch.date || timeAgoShort(ch.release_date)}
          </span>
        )}
      </button>
    );
  }

  return (
    <div className="flex h-full flex-col gap-1.5 sm:gap-2">
      {/* Box 1: cover + judul */}
      <div className="flex flex-col bg-surface-container rounded-xl overflow-hidden group border border-transparent hover:border-primary/20 shadow-md transition-colors">
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
          {/* Penanda di pojok cover — pengganti badge END/Hiatus/NEW yang di
              mode list nempel di chapter row. "Updated" (ada update <24 jam)
              menang duluan drpd status Tamat/Hiatus (lebih actionable buat
              pembaca), status cuma tampil kalau lagi TIDAK ada update baru.
              rounded-bl-lg dipotong pas oleh overflow-hidden Box 1 di corner
              kanan-atas. Ukuran diskalakan turun ke breakpoint terkecil
              (mobile 3 kolom) biar gak melebihi lebar cover sempit. */}
          {isMangaNew ? (
            <span
              aria-hidden="true"
              className="absolute top-0 right-0 px-1 py-0.5 sm:px-1.5 md:px-2 md:py-1 rounded-bl-lg font-label-sm text-[8px] sm:text-[9px] md:text-[10px] lg:text-xs font-black uppercase tracking-wide whitespace-nowrap text-white bg-emerald-600"
            >
              Updated
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
          <h3 className="font-headline-md text-sm md:text-base lg:text-lg font-black leading-tight text-on-surface truncate hover:text-primary transition-colors cursor-pointer">
            {manga.title}
          </h3>
        </a>
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
      <div className="flex flex-col rounded-xl overflow-hidden">
        <div className="w-full aspect-[0.7/1] shrink-0" />
        <div className="p-2 sm:p-2.5">
          <div className="text-sm md:text-base lg:text-lg font-black leading-tight">.</div>
        </div>
      </div>
      <div className="rounded-lg p-1.5 sm:p-2">
        <span className="font-body-md text-[12px] sm:text-[13px] md:text-[15px] lg:text-[17px] font-bold">.</span>
      </div>
    </div>
  );
}

export default memo(MangaCardGrid);
