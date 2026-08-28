export function Skeleton({ className = '', style, ...props }) {
  return (
    <div {...props} style={style} className={`animate-pulse bg-surface-container-high rounded-lg ${className}`} />
  );
}

export function MangaCardSkeleton() {
  return (
    // Struktur (strip badge + kartu) SAMA PERSIS dgn MangaCard.jsx (flex-col,
    // bukan margin-top angka tebakan) — biar tinggi total pas & gak geser
    // pas skeleton diganti kartu asli.
    <div className="flex flex-col items-start">
      <div className="w-[108px] sm:w-[120px] md:w-[135px] lg:w-[150px] h-[18px] sm:h-[21px] md:h-[24px] lg:h-[24px] rounded-t-lg bg-surface-container-high animate-pulse" />
      <div className="flex w-full h-[164px] sm:h-[194px] md:h-[209px] lg:h-[226px] bg-surface-container rounded-tl-none rounded-tr-lg rounded-br-lg rounded-bl-lg overflow-hidden border border-transparent">
        {/* Cover */}
        <div className="w-[108px] sm:w-[120px] md:w-[135px] lg:w-[150px] h-full bg-surface-container-high animate-pulse shrink-0" />
        {/* Content */}
        <div className="flex-1 p-3 sm:p-4 lg:p-5 flex flex-col">
          {/* Title */}
          <Skeleton className="h-4 sm:h-5 lg:h-6 w-3/4 mb-2" />
          {/* 3 chapter rows — flex-1 justify-between agar ngepas bawah cover */}
          <div className="flex flex-col flex-1 justify-between">
            <Skeleton className="h-7 sm:h-8 lg:h-9 w-full rounded-xl" />
            <Skeleton className="h-7 sm:h-8 lg:h-9 w-full rounded-xl" />
            <Skeleton className="h-7 sm:h-8 lg:h-9 w-full rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  );
}

// Versi grid dari MangaCardSkeleton — cover poster 2:3 di atas, judul + 2
// baris chapter di bawahnya (bandingkan dgn MangaCardGrid.jsx).
export function MangaCardGridSkeleton() {
  return (
    <div className="flex flex-col bg-surface-container rounded-xl overflow-hidden border border-transparent">
      <div className="w-full aspect-[2/3] bg-surface-container-high animate-pulse" />
      <div className="flex flex-col gap-1.5 p-2 sm:p-2.5">
        <Skeleton className="h-3.5 sm:h-4 w-full" />
        <Skeleton className="h-3.5 sm:h-4 w-2/3" />
        <div className="flex flex-col gap-1 mt-1">
          <Skeleton className="h-3 w-full rounded" />
          <Skeleton className="h-3 w-full rounded" />
        </div>
      </div>
    </div>
  );
}

// Placeholder halaman utama harus mengikuti empat sibling yang muncul setelah
// katalog selesai dimuat. Jika semuanya digabung menjadi satu blok pendek,
// Featured + banner akan mendorong List Bacaan dan menghasilkan CLS besar.
export function HomepageHeroSkeleton() {
  return (
    <>
      <div
        aria-hidden="true"
        className="h-[323px] w-auto -mx-3 animate-pulse border-y border-outline-variant/40 bg-surface-container sm:-mx-4 sm:h-[382px] md:-mx-5 md:h-[446px] lg:h-[494px]"
      />

      <div
        aria-hidden="true"
        className="w-auto -mx-3 border-t border-outline-variant -mt-2 sm:-mx-4 md:-mx-5 md:-mt-3 xl:-mt-4"
      />

      <div aria-hidden="true" className="flex flex-col gap-3">
        <div className="flex h-9 items-center justify-between gap-3 sm:h-10">
          <Skeleton className="h-7 w-44 sm:w-52" />
          <div className="flex gap-2">
            <Skeleton className="h-9 w-9 rounded-xl sm:h-10 sm:w-10" />
            <Skeleton className="h-9 w-10 rounded-xl sm:h-10" />
            <Skeleton className="h-9 w-9 rounded-xl sm:h-10 sm:w-10" />
          </div>
        </div>
        <Skeleton className="h-[190px] w-full rounded-xl sm:h-[220px] md:h-[255px] lg:h-[285px]" />
      </div>

      <Skeleton
        aria-hidden="true"
        className="mt-2 h-10 w-full rounded-xl sm:h-12"
      />
    </>
  );
}

export function MangaDetailSkeleton() {
  return (
    <div className="pt-[72px] w-full animate-pulse">
      {/* Hero Banner */}
      <div className="mx-3 sm:mx-4 md:mx-5 mt-4 rounded-2xl overflow-hidden border border-outline-variant bg-surface-container">
        <div className="w-full px-4 sm:px-6 md:px-8 py-4 sm:py-6 flex flex-col sm:flex-row gap-5 items-center sm:items-end">
          <div className="w-[200px] sm:w-[200px] md:w-[220px] aspect-[2/3] rounded-xl bg-surface-container-high shrink-0" />
          <div className="flex-1 flex flex-col gap-3 w-full pb-2">
            {/* Judul bisa 2 baris (line-clamp-2 di konten asli) — reservasi 2 baris
                agar tidak ada lompatan besar saat skeleton diganti judul panjang. */}
            <div className="flex flex-col gap-2">
              <Skeleton className="h-7 sm:h-9 md:h-11 w-3/4" />
              <Skeleton className="h-7 sm:h-9 md:h-11 w-1/2" />
            </div>
            <Skeleton className="h-4 sm:h-5 w-1/2" />
            {/* Ukuran mendekati tombol asli (h-9/10/11, rounded-xl) — bukan pill kecil */}
            <div className="flex flex-wrap gap-2 sm:gap-3 mt-1">
              <Skeleton className="h-9 sm:h-10 md:h-11 w-32 sm:w-36 rounded-xl" />
              <Skeleton className="h-9 sm:h-10 md:h-11 w-40 sm:w-44 rounded-xl" />
            </div>
          </div>
        </div>
      </div>

      {/* Trakteer banner */}
      <Skeleton className="w-full h-10 rounded-none mt-3" />

      {/* Tab switcher */}
      <div className="flex px-3 sm:px-4 md:px-5 mt-4 border-b border-outline-variant">
        <Skeleton className="h-10 w-28 rounded-none" />
        <Skeleton className="h-10 w-28 rounded-none ml-2" />
      </div>

      {/* Grid info + chapters */}
      <div className="mt-4 grid grid-cols-1 lg:grid-cols-12 lg:gap-5 lg:px-4">
        {/* Info column */}
        <div className="lg:col-span-5 flex flex-col gap-3 p-3 lg:border lg:border-outline-variant lg:rounded-2xl">
          <div className="grid grid-cols-3 gap-2">
            <Skeleton className="h-14 sm:h-16 rounded-xl" />
            <Skeleton className="h-14 sm:h-16 rounded-xl" />
            <Skeleton className="h-14 sm:h-16 rounded-xl" />
          </div>
          <Skeleton className="h-12 sm:h-14 rounded-xl" />
          <Skeleton className="h-12 sm:h-14 rounded-xl" />
          <div className="flex gap-2 flex-wrap">
            {[1,2,3,4].map(i => <Skeleton key={i} className="h-7 w-16 sm:w-20 rounded-lg" />)}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Skeleton className="h-9 sm:h-10 rounded-xl" />
            <Skeleton className="h-9 sm:h-10 rounded-xl" />
          </div>
          <Skeleton className="h-24 sm:h-28 rounded-xl" />
        </div>

        {/* Chapter list — hanya desktop */}
        <div className="lg:col-span-7 hidden lg:flex flex-col gap-2 p-3 border border-outline-variant rounded-2xl">
          <div className="flex justify-between items-center mb-2 pb-2 border-b border-outline-variant/40">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-16" />
          </div>
          {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-12 rounded-xl" />)}
        </div>
      </div>
    </div>
  );
}

// Skeleton saat membuka chapter (sebelum chunk reader siap). Layar penuh agar
// menutup halaman detail di belakang — cegah skeleton detail berkedip.
export function ReaderLoadingSkeleton() {
  return (
    <div className="fixed inset-0 z-[300] bg-surface overflow-hidden flex flex-col items-center">
      <div className="w-full h-12 md:h-14 border-b border-outline-variant/40 flex items-center px-3 gap-3 shrink-0">
        <Skeleton className="h-7 w-7 rounded-lg" />
        <Skeleton className="h-4 w-40 max-w-[50%]" />
      </div>
      <div className="w-full max-w-2xl flex flex-col gap-1 mt-1">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="w-full rounded-none" style={{ aspectRatio: '3/4' }} />
        ))}
      </div>
    </div>
  );
}
