export function Skeleton({ className = '' }) {
  return (
    <div className={`animate-pulse bg-surface-container-high rounded-lg ${className}`} />
  );
}

export function MangaCardSkeleton() {
  return (
    <div className="flex h-[160px] sm:h-[190px] md:h-[205px] lg:h-[220px] bg-surface-container rounded-xl overflow-hidden border border-white/5">
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
  );
}

export function MangaDetailSkeleton() {
  return (
    <div className="pt-[72px] w-full animate-pulse">
      {/* Hero Banner */}
      <div className="mx-3 sm:mx-4 md:mx-5 mt-4 rounded-2xl overflow-hidden border border-white/15 bg-surface-container">
        <div className="w-full px-4 sm:px-6 md:px-8 py-4 sm:py-6 flex flex-col sm:flex-row gap-5 items-center sm:items-end">
          <div className="w-[160px] sm:w-[200px] md:w-[220px] aspect-[2/3] rounded-xl bg-surface-container-high shrink-0" />
          <div className="flex-1 flex flex-col gap-3 w-full pb-2">
            <Skeleton className="h-7 sm:h-9 md:h-11 w-3/4" />
            <Skeleton className="h-4 sm:h-5 w-1/2" />
            <div className="flex gap-2 mt-1">
              <Skeleton className="h-7 w-20 rounded-full" />
              <Skeleton className="h-7 w-20 rounded-full" />
            </div>
          </div>
        </div>
      </div>

      {/* Trakteer banner */}
      <Skeleton className="w-full h-10 rounded-none mt-3" />

      {/* Tab switcher */}
      <div className="flex px-3 sm:px-4 md:px-5 mt-4 border-b border-white/10">
        <Skeleton className="h-10 w-28 rounded-none" />
        <Skeleton className="h-10 w-28 rounded-none ml-2" />
      </div>

      {/* Grid info + chapters */}
      <div className="mt-4 grid grid-cols-1 lg:grid-cols-12 lg:gap-5 lg:px-4">
        {/* Info column */}
        <div className="lg:col-span-5 flex flex-col gap-3 p-3 lg:border lg:border-white/10 lg:rounded-2xl">
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
        <div className="lg:col-span-7 hidden lg:flex flex-col gap-2 p-3 border border-white/10 rounded-2xl">
          <div className="flex justify-between items-center mb-2 pb-2 border-b border-white/5">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-16" />
          </div>
          {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-12 rounded-xl" />)}
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
