interface TrackListSkeletonProps {
  count?: number;
}

export default function TrackListSkeleton({ count = 5 }: TrackListSkeletonProps) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="motion-safe:animate-pulse bg-zinc-900 rounded-lg p-4 flex items-center gap-4">
          {/* Track number */}
          <div className="w-8 h-4 bg-zinc-700 rounded flex-shrink-0"></div>
          
          {/* Album art */}
          <div className="w-12 h-12 bg-zinc-700 rounded flex-shrink-0"></div>
          
          {/* Track info */}
          <div className="flex-1 space-y-2 min-w-0">
            {/* Track name */}
            <div className="h-4 bg-zinc-700 rounded w-3/4"></div>
            {/* Artist and album */}
            <div className="h-3 bg-zinc-700 rounded w-1/2"></div>
          </div>
          
          {/* Action buttons placeholder */}
          <div className="flex gap-1 flex-shrink-0">
            <div className="w-8 h-8 bg-zinc-700 rounded-full"></div>
            <div className="w-6 h-6 bg-zinc-700 rounded-full"></div>
          </div>
          
          {/* Duration */}
          <div className="w-12 h-3 bg-zinc-700 rounded flex-shrink-0"></div>
        </div>
      ))}
    </div>
  );
}