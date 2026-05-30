export function Skeleton({ className = '' }) {
  return (
    <div className={`animate-pulse bg-surface-container-high rounded-lg ${className}`} />
  );
}

export function MangaCardSkeleton() {
  return (
    <div className="flex h-[200px] bg-surface-container rounded-xl overflow-hidden border border-white/5">
      <div className="w-[130px] h-full bg-surface-container-high animate-pulse shrink-0" />
      <div className="flex-1 p-4 flex flex-col gap-3">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-3 w-1/3" />
        <div className="flex flex-col gap-2 mt-auto">
          <Skeleton className="h-7 w-full" />
          <Skeleton className="h-7 w-full" />
          <Skeleton className="h-7 w-full" />
        </div>
      </div>
    </div>
  );
}

export function MangaDetailSkeleton() {
  return (
    <div className="pt-[72px] w-full animate-pulse">
      {/* Hero — cover kiri, judul kanan */}
      <div className="px-4 sm:px-6 md:px-8 py-4 flex flex-col sm:flex-row gap-5 items-center sm:items-end">
        <div className="w-[200px] sm:w-[200px] md:w-[220px] aspect-[2/3] rounded-xl bg-surface-container-high shrink-0" />
        <div className="flex-1 flex flex-col gap-3 w-full">
          <Skeleton className="h-8 sm:h-10 w-3/4" />
          <Skeleton className="h-4 sm:h-5 w-1/2" />
        </div>
      </div>

      {/* Trakteer banner */}
      <Skeleton className="w-full h-10 rounded-none" />

      {/* Tab switcher mobile */}
      <div className="flex gap-2 px-4 sm:px-6 md:px-8 mt-4 lg:hidden">
        <Skeleton className="h-9 flex-1 rounded-lg" />
        <Skeleton className="h-9 flex-1 rounded-lg" />
      </div>

      {/* 2 kolom: info + chapter */}
      <div className="px-4 sm:px-6 md:px-8 mt-4 grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Info */}
        <div className="lg:col-span-5 flex flex-col gap-3 border border-white/10 rounded-2xl p-4">
          <div className="grid grid-cols-3 gap-2">
            <Skeleton className="h-16 rounded-xl" />
            <Skeleton className="h-16 rounded-xl" />
            <Skeleton className="h-16 rounded-xl" />
          </div>
          <Skeleton className="h-14 rounded-xl" />
          <Skeleton className="h-14 rounded-xl" />
          <div className="flex gap-2 flex-wrap">
            {[1,2,3,4].map(i => <Skeleton key={i} className="h-7 w-16 rounded-lg" />)}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Skeleton className="h-10 rounded-xl" />
            <Skeleton className="h-10 rounded-xl" />
          </div>
          <Skeleton className="h-20 rounded-xl" />
        </div>
        {/* Chapter list */}
        <div className="lg:col-span-7 flex-col gap-2 border border-white/10 rounded-2xl p-4 hidden lg:flex">
          {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-14 rounded-xl" />)}
        </div>
      </div>
    </div>
  );
}

export function ReaderPageSkeleton() {
  return (
    <div className="w-full animate-pulse">
      <Skeleton className="w-full rounded-none" style={{ aspectRatio: '3/4' }} />
    </div>
  );
}
