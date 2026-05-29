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
      {/* Hero */}
      <div className="relative w-full h-64 bg-surface-container-high" />
      <div className="px-4 sm:px-6 -mt-20 relative z-10 flex gap-6 pb-4">
        <div className="w-[150px] aspect-[2/3] rounded-xl bg-surface-container-high shrink-0" />
        <div className="flex-1 flex flex-col gap-3 pt-16">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-11 w-40 mt-2 rounded-xl" />
        </div>
      </div>
      {/* Info */}
      <div className="px-4 sm:px-6 mt-4 flex flex-col gap-3">
        <div className="grid grid-cols-3 gap-2">
          <Skeleton className="h-16 rounded-xl" />
          <Skeleton className="h-16 rounded-xl" />
          <Skeleton className="h-16 rounded-xl" />
        </div>
        <Skeleton className="h-16 rounded-xl" />
        <Skeleton className="h-16 rounded-xl" />
        <div className="flex gap-2 flex-wrap">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-7 w-16 rounded-lg" />)}
        </div>
        <Skeleton className="h-10 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
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
