interface CommandHistorySkeletonProps {
  count?: number;
}

export default function CommandHistorySkeleton({ count = 3 }: CommandHistorySkeletonProps) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="motion-safe:animate-pulse border-b border-zinc-800 pb-4 last:border-0">
          {/* Command with badges */}
          <div className="flex items-start gap-2 mb-2">
            <div className="h-5 bg-zinc-700 rounded w-3/4"></div>
            <div className="flex gap-1">
              <div className="h-5 w-12 bg-zinc-700 rounded-full"></div>
              <div className="h-5 w-16 bg-zinc-700 rounded-full"></div>
            </div>
          </div>
          
          {/* Response content */}
          <div className="bg-zinc-900 rounded-lg p-3 space-y-2">
            <div className="h-4 bg-zinc-700 rounded w-full"></div>
            <div className="h-4 bg-zinc-700 rounded w-5/6"></div>
            <div className="h-4 bg-zinc-700 rounded w-4/6"></div>
          </div>
          
          {/* Metadata line */}
          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-2">
              <div className="h-3 bg-zinc-700 rounded w-16"></div>
              <div className="h-3 bg-zinc-700 rounded w-20"></div>
            </div>
            <div className="h-3 bg-zinc-700 rounded w-24"></div>
          </div>
        </div>
      ))}
    </div>
  );
}