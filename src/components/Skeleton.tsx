interface SkeletonProps {
  className?: string;
}

export const Skeleton = ({ className = "" }: SkeletonProps) => (
  <div className={`tanabrew-skeleton rounded-lg ${className}`} />
);

export const CardSkeleton = ({ lines = 3 }: { lines?: number }) => (
  <div className="rounded-xl border border-border bg-card p-4">
    <Skeleton className="mb-3 h-4 w-2/5" />
    <div className="space-y-2">
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton key={index} className={`h-3 ${index % 2 === 0 ? "w-full" : "w-4/5"}`} />
      ))}
    </div>
  </div>
);
