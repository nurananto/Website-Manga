import { useEffect, useRef, useState } from 'react';
import { ExternalLink, Check, Play, Pause, Calendar, X, BookOpen, ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight } from 'lucide-react';
import ResponsiveCover from './ResponsiveCover';
import { useDialogFocus } from '../lib/useDialogFocus';

// Pagination — pola & jumlah baris per halaman SAMA dgn grid katalog utama
// (App.jsx: GRID_ROWS_PER_PAGE), cuma kolomnya ikut breakpoint grid Tracker
// sendiri (2/3/4/6/7, lihat className grid di bawah), bukan grid homepage.
const GRID_ROWS_PER_PAGE = 3;
function computeTrackerGridColumns() {
  if (typeof window === 'undefined') return 2;
  const w = window.innerWidth;
  if (w >= 1280) return 7;
  if (w >= 1024) return 6;
  if (w >= 768) return 4;
  if (w >= 640) return 3;
  return 2;
}

// Sort — SAMA PERSIS pilihan & default arah-nya dgn "List Bacaan" di
// halaman utama (App.jsx: SORT_OPTIONS/SORT_DEFAULT_DIR), default-nya Update
// (terbaru duluan, desc).
const SORT_OPTIONS = [
  { key: 'update',     label: 'Update' },
  { key: 'popularity', label: 'Popularitas' },
  { key: 'alphabet',   label: 'Alfabet' },
  { key: 'chapters',   label: 'Jumlah Chapter' },
];
const SORT_DEFAULT_DIR = { update: 'desc', popularity: 'desc', alphabet: 'asc', chapters: 'desc' };

// Field tracker (raw_source/update_frequency/raw_type/raw_system/
// final_raw_chapter) sekarang DATA ASLI — diisi manual di tiap meta.json
// manga (lihat komentar _write_manga_meta di generate_meta.py) dan
// diteruskan ke index.json lewat buildIndexEntry() di build-catalog.js.
// Manga yang belum diisi (raw_type kosong) otomatis disaring keluar di
// TrackerPage() di bawah.
//
// meta per-manga dibentuk dari field manga di index.json:
//   rawSource: manga.raw_source, updateFrequency: manga.update_frequency,
//   rawLink: manga.raw_url, rawType: manga.raw_type,
//   rawSystem: manga.raw_system, finalRawChapter: manga.final_raw_chapter.
// rawType: 'Free' | 'Paid' | 'Mixed' (Gratis / Berbayar / Campuran).
// rawSystem: sistem bayarnya ('Koin'/'Tiket'/'Koin dan Tiket') — cuma
// relevan kalau rawType bukan Free.
function metaFromManga(manga) {
  return {
    rawSource: manga.raw_source,
    updateFrequency: manga.update_frequency,
    rawLink: manga.raw_url,
    rawType: manga.raw_type,
    rawSystem: manga.raw_system,
    finalRawChapter: manga.final_raw_chapter,
  };
}

// Ongoing = ikon Play (masih "jalan"), Completed = ikon centang (selesai),
// Hiatus = ikon Pause (berhenti sementara).
const STATUS_BADGE = {
  Ongoing: { label: 'Ongoing',   icon: Play,  className: 'bg-emerald-600 text-white' },
  Tamat:   { label: 'Completed', icon: Check, className: 'bg-emerald-600 text-white' },
  Hiatus:  { label: 'Hiatus',    icon: Pause, className: 'bg-zinc-500/90 text-white' },
};

const RAW_TYPE_LABEL = { Paid: 'Berbayar', Free: 'Gratis', Mixed: 'Campuran' };

// 2 baris — nama frekuensinya (baris 1, bold) + penjelasan bahasa Indonesia
// (baris 2, lebih kecil/redup), dipakai di kartu grid (lihat TrackerCard).
const UPDATE_FREQ_LABEL = {
  Daily:     { main: 'Daily',      sub: 'setiap hari' },
  Weekly:    { main: 'Weekly',     sub: '1 minggu sekali' },
  Biweekly:  { main: 'Bi Weekly',  sub: '2 minggu sekali' },
  Monthly:   { main: 'Monthly',    sub: 'sebulan sekali' },
  Irregular: { main: 'Tidak Menentu', sub: 'jadwal tidak pasti' },
};

// Manga Oneshot gak punya jadwal update (cuma 1 chapter) — tampilkan
// "Chapter Oneshot" di kotak yang sama, bukan Weekly/Biweekly/dst.
function freqDisplay(manga, meta) {
  if (manga.status === 'Oneshot') return { main: 'Chapter Oneshot', sub: null };
  return UPDATE_FREQ_LABEL[meta.updateFrequency] || null;
}

// "Chapter diterjemahkan terakhir" — DATA ASLI, chapter terbaru yang sudah
// kita rilis (chapters[0], katalog sudah terurut terbaru→lama).
function lastTranslatedLabel(manga) {
  const ch = (manga.chapters || [])[0];
  return ch ? ch.title : '—';
}

// "Chapter Tamat" — chapter TERAKHIR di versi RAW (bukan terjemahan kita).
function finalRawChapterLabel(meta) {
  return meta.finalRawChapter != null ? `Ch. ${meta.finalRawChapter}` : '—';
}

function StatusBadge({ manga, className = '' }) {
  const status = STATUS_BADGE[manga.status];
  if (!status) return null;
  const StatusIcon = status.icon;
  return (
    <span className={`flex w-fit items-center gap-1 px-2 py-1 rounded-lg shadow-sm font-label-sm text-[10px] sm:text-xs font-black uppercase tracking-wide whitespace-nowrap ${status.className} ${className}`}>
      <StatusIcon className="h-3 w-3 shrink-0" fill="currentColor" />
      {status.label}
    </span>
  );
}

// Kartu GRID ringkas — cover, judul, badge status, frekuensi update, & 2
// tombol (Buka Raw + Info Lanjut buat detail lengkap). Field lain (sumber
// raw, tipe raw, tipe bayar, diterjemahkan, tamat/hiatus raw) dipindah ke
// modal detail (lihat DetailModal) — biar kartu grid-nya tetap ringkas &
// gak kepenuhan/wrap/elipsis kayak percobaan2 sebelumnya.
function TrackerCard({ manga, meta, onOpenDetail, onViewManga }) {
  const freq = freqDisplay(manga, meta);
  return (
    <div className="flex h-full flex-col bg-surface-container rounded-xl overflow-hidden border border-outline-variant hover:border-primary/40 shadow-md transition-colors">
      {/* Cover — rasio 0.7 (samain dgn MangaCard/MangaCardGrid). */}
      <a
        href={`/${manga.id}/`}
        onClick={(e) => { e.preventDefault(); onViewManga?.(manga); }}
        aria-label={manga.title}
        className="relative block w-full aspect-[0.7/1] shrink-0 cursor-pointer overflow-hidden"
      >
        <ResponsiveCover
          manga={manga}
          alt={manga.title}
          loading="lazy"
          className="h-full w-full object-cover bg-surface-container-high"
        />
      </a>

      <div className="flex flex-1 flex-col items-center gap-2 p-3 text-center">
      <h3 className="w-full font-headline-md text-sm sm:text-base font-black leading-tight text-on-surface truncate">
        {manga.title}
      </h3>

      <StatusBadge manga={manga} />

      {freq && (
        <div className="flex w-full flex-col items-center gap-0.5 rounded-lg border border-outline-variant bg-surface-container-high px-3 py-1.5 font-body-md text-on-surface-variant">
          <div className="flex items-center gap-1.5 text-xs sm:text-sm font-bold text-on-surface">
            <Calendar className="h-3.5 w-3.5 shrink-0" />
            {freq.main}
          </div>
          {freq.sub && <span className="text-[10px] sm:text-xs">{freq.sub}</span>}
        </div>
      )}

      <div className="mt-auto flex w-full flex-col gap-1.5 pt-1">
        {meta.rawLink && (
          <a
            href={meta.rawLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 rounded-lg border border-primary/50 text-primary hover:bg-primary/10 transition-colors px-2 py-1.5 font-label-sm text-[10px] sm:text-xs font-black uppercase tracking-wide"
          >
            <ExternalLink className="h-3.5 w-3.5 shrink-0" />
            Buka Raw
          </a>
        )}
        <button
          type="button"
          onClick={() => onOpenDetail({ manga, meta })}
          className="flex items-center justify-center gap-1.5 rounded-lg bg-primary text-on-primary hover:brightness-110 transition-all active:scale-95 cursor-pointer px-2 py-1.5 font-label-sm text-[10px] sm:text-xs font-black uppercase tracking-wide"
        >
          Info Lanjut
        </button>
      </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }) {
  if (value == null || value === '') return null;
  return (
    <p className="font-body-md text-xs sm:text-sm text-on-surface-variant">
      {label}: <span className="font-bold text-on-surface">{value}</span>
    </p>
  );
}

// Modal detail — muncul pas tombol "Lanjut" di kartu grid diklik. Isinya
// semua field yang gak muat di kartu ringkas: cover, sumber raw, tipe raw,
// tipe bayar, waktu update, diterjemahkan, tamat/hiatus (raw). Pola modal
// (backdrop + useDialogFocus + animasi) disamain dgn DmcaModal.jsx dkk.
function DetailModal({ entry, onClose, onViewManga }) {
  const dialogRef = useRef(null);
  useDialogFocus(dialogRef, onClose);
  const { manga, meta } = entry;
  const freq = freqDisplay(manga, meta);

  return (
    <div
      className="fixed inset-0 z-[300] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-[fadeIn_0.2s_ease-out]"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tracker-detail-title"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="bg-surface-container border-2 border-outline-variant rounded-2xl w-full max-w-sm max-h-[85vh] overflow-y-auto hide-scrollbar shadow-2xl animate-[slideUpFade_0.3s_cubic-bezier(0.22,1,0.36,1)]"
      >
        <div className="flex items-start justify-between gap-2 px-4 pt-4">
          <h2 id="tracker-detail-title" className="font-headline-md text-base font-black text-on-surface leading-tight line-clamp-2">
            {manga.title}
          </h2>
          <button
            type="button"
            aria-label="Tutup detail"
            onClick={onClose}
            className="w-8 h-8 shrink-0 rounded-xl bg-surface-container-high hover:bg-surface-container-highest flex items-center justify-center text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-col gap-3 p-4">
          <div className="flex gap-3">
            <div className="relative w-[84px] aspect-[0.7/1] shrink-0 rounded-lg overflow-hidden">
              <ResponsiveCover
                manga={manga}
                alt={manga.title}
                loading="lazy"
                className="h-full w-full object-cover bg-surface-container-high"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <StatusBadge manga={manga} />
              <InfoRow label="Sumber Raw" value={meta.rawSource} />
              <InfoRow label="Tipe Raw" value={RAW_TYPE_LABEL[meta.rawType]} />
              {meta.rawType !== 'Free' && <InfoRow label="Tipe Bayar" value={meta.rawSystem} />}
            </div>
          </div>

          <div className="flex flex-col gap-1 border-t border-outline-variant/50 pt-3">
            <InfoRow label="Waktu Update" value={freq ? (freq.sub ? `${freq.main} (${freq.sub})` : freq.main) : null} />
            <InfoRow label="Diterjemahkan" value={lastTranslatedLabel(manga)} />
            <InfoRow label={manga.status === 'Hiatus' ? 'Hiatus (raw)' : 'Tamat (raw)'} value={finalRawChapterLabel(meta)} />
          </div>

          {meta.rawLink && (
            <a
              href={meta.rawLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 rounded-lg border border-primary/50 text-primary hover:bg-primary/10 transition-colors px-3 py-2 font-label-sm text-xs font-black uppercase tracking-wide"
            >
              <ExternalLink className="h-4 w-4 shrink-0" />
              Buka Raw
            </a>
          )}

          {/* Mulai Baca — ke halaman detail manga di situs kita sendiri
              (bukan raw), lewat onViewManga yang sama dgn klik cover. */}
          <a
            href={`/${manga.id}/`}
            onClick={(e) => { e.preventDefault(); onViewManga?.(manga); onClose(); }}
            className="flex items-center justify-center gap-1.5 rounded-lg bg-primary text-on-primary hover:brightness-110 transition-all px-3 py-2 font-label-sm text-xs font-black uppercase tracking-wide"
          >
            <BookOpen className="h-4 w-4 shrink-0" />
            Mulai Baca
          </a>
        </div>
      </div>
    </div>
  );
}

export default function TrackerPage({ mangaList, onViewManga }) {
  const [detailEntry, setDetailEntry] = useState(null);
  const [sortBy, setSortBy] = useState('update');
  const [sortDir, setSortDir] = useState('desc');
  const [isSortOpen, setIsSortOpen] = useState(false);
  const sortMenuRef = useRef(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [gridColumns, setGridColumns] = useState(computeTrackerGridColumns);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (sortMenuRef.current && !sortMenuRef.current.contains(event.target)) {
        setIsSortOpen(false);
      }
    };
    const handleEscape = (event) => { if (event.key === 'Escape') setIsSortOpen(false); };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  // Kolom grid ikut breakpoint layar — cuma re-render pas breakpoint dilewati,
  // sama pola dgn gridColumns homepage (App.jsx).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mqls = [640, 768, 1024, 1280].map((bp) => window.matchMedia(`(min-width: ${bp}px)`));
    const handler = () => setGridColumns(computeTrackerGridColumns());
    mqls.forEach((mql) => mql.addEventListener('change', handler));
    return () => mqls.forEach((mql) => mql.removeEventListener('change', handler));
  }, []);

  const itemsPerPage = gridColumns * GRID_ROWS_PER_PAGE;

  const handleSortClick = (key) => {
    if (sortBy === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(key);
      setSortDir(SORT_DEFAULT_DIR[key]);
    }
    setCurrentPage(1);
  };

  const entries = (mangaList || [])
    .filter((m) => m.raw_type)
    .map((m) => ({ manga: m, meta: metaFromManga(m) }))
    .sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      switch (sortBy) {
        case 'popularity':
          return dir * ((a.manga.total_views ?? 0) - (b.manga.total_views ?? 0));
        case 'alphabet':
          return dir * a.manga.title.localeCompare(b.manga.title);
        case 'chapters':
          return dir * ((a.manga.chapter_count ?? a.manga.chapters?.length ?? 0) - (b.manga.chapter_count ?? b.manga.chapters?.length ?? 0));
        case 'update':
        default: {
          const av = a.manga.latest_release_date ? new Date(a.manga.latest_release_date).getTime() : 0;
          const bv = b.manga.latest_release_date ? new Date(b.manga.latest_release_date).getTime() : 0;
          return dir * (av - bv);
        }
      }
    });

  const totalPages = Math.max(1, Math.ceil(entries.length / itemsPerPage));
  // Halaman aktif bisa "kelebihan" kalau kolom grid berubah (ganti breakpoint)
  // atau hasil sort/filter jadi lebih sedikit — samain pola dgn App.jsx.
  if (currentPage > totalPages) setCurrentPage(totalPages);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedEntries = entries.slice(startIndex, startIndex + itemsPerPage);

  return (
    <main className="pt-4 md:pt-6 xl:pt-8 pb-4 md:pb-6 xl:pb-8 px-3 sm:px-4 md:px-5 flex flex-col gap-4 md:gap-6 w-full flex-1">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className="h-7 w-1 rounded-full bg-primary shrink-0" aria-hidden="true" />
          <h1 className="font-headline-md text-xl sm:text-2xl font-black text-on-surface truncate">Manga Tracker / Schedule</h1>
        </div>

        {/* Sort — sama persis pilihan & gayanya dgn tombol Sort di List
            Bacaan halaman utama (App.jsx), default Update (terbaru duluan). */}
        <div className="relative shrink-0" ref={sortMenuRef}>
          <button
            type="button"
            onClick={() => setIsSortOpen((v) => !v)}
            className={`h-9 w-9 flex items-center justify-center rounded-2xl border transition-all active:scale-95 cursor-pointer ${
              isSortOpen
                ? 'border-primary text-primary bg-surface-container-high'
                : 'border-outline-variant text-outline hover:border-primary/50 hover:text-primary hover:bg-surface-container-high'
            }`}
            title="Urutkan manga"
          >
            <ArrowUpDown className="w-4 h-4" />
          </button>

          {isSortOpen && (
            <div className="absolute right-0 top-11 w-52 bg-surface-container border border-outline-variant/40 rounded-xl shadow-2xl py-1.5 z-50 animate-[fadeIn_0.15s_ease-out]">
              {SORT_OPTIONS.map((opt) => {
                const active = sortBy === opt.key;
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => { handleSortClick(opt.key); }}
                    className={`w-full flex items-center justify-between gap-2 px-4 py-2.5 text-sm font-body-md transition-colors cursor-pointer ${
                      active ? 'text-primary bg-surface-container-high' : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
                    }`}
                  >
                    <span>{opt.label}</span>
                    {active && (
                      sortDir === 'asc'
                        ? <ArrowUp className="w-3.5 h-3.5 shrink-0" />
                        : <ArrowDown className="w-3.5 h-3.5 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <hr className="border-t border-outline-variant/60" />

      {entries.length === 0 ? (
        <p className="text-sm text-outline font-body-md">Belum ada manga dengan data tracker.</p>
      ) : (
        <>
          {/* Grid — minimal 2 kolom di mobile. */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 gap-3 sm:gap-4">
            {paginatedEntries.map((entry) => (
              <TrackerCard
                key={entry.manga.id}
                manga={entry.manga}
                meta={entry.meta}
                onOpenDetail={setDetailEntry}
                onViewManga={onViewManga}
              />
            ))}
          </div>

          {/* Pagination — gaya sama persis dgn katalog utama (App.jsx). */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                disabled={currentPage === 1}
                className="px-3 sm:px-4 h-9 sm:h-10 rounded-xl border border-outline-variant bg-surface-container hover:bg-surface-container-high text-on-surface disabled:opacity-35 disabled:cursor-not-allowed flex items-center gap-1 justify-center font-label-sm text-xs sm:text-sm font-bold active:scale-95 transition-all cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
                Previous
              </button>

              <div className="min-w-10 h-9 sm:h-10 px-2 rounded-xl border border-outline-variant bg-surface-container text-on-surface flex items-center justify-center font-label-sm text-xs sm:text-sm font-black tabular-nums">
                {currentPage} | {totalPages}
              </div>

              <button
                onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="px-3 sm:px-4 h-9 sm:h-10 rounded-xl border border-outline-variant bg-surface-container hover:bg-surface-container-high text-on-surface disabled:opacity-35 disabled:cursor-not-allowed flex items-center gap-1 justify-center font-label-sm text-xs sm:text-sm font-bold active:scale-95 transition-all cursor-pointer"
              >
                Next
                <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>
          )}
        </>
      )}

      {detailEntry && (
        <DetailModal entry={detailEntry} onClose={() => setDetailEntry(null)} onViewManga={onViewManga} />
      )}
    </main>
  );
}
