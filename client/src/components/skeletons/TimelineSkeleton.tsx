interface TimelineSkeletonProps {
  dateGroups?: number;
  tracksPerGroup?: number;
}

export default function TimelineSkeleton({ dateGroups = 3, tracksPerGroup = 4 }: TimelineSkeletonProps) {
  return (
    <div className="relative">
      {/* Timeline line */}
      <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-zinc-700"></div>

      {/* Grouped tracks skeleton */}
      {Array.from({ length: dateGroups }).map((_, groupIndex) => (
        <div key={groupIndex} className="mb-8">
          {/* Date header skeleton */}
          <div className="flex items-center mb-4">
            <div className="w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center border-4 border-zinc-950">
              <div className="motion-safe:animate-pulse w-8 h-3 bg-zinc-700 rounded"></div>
            </div>
            <div className="ml-4 motion-safe:animate-pulse h-5 bg-zinc-700 rounded w-24"></div>
          </div>

          {/* Tracks for this date skeleton */}
          <div className="ml-20 space-y-3">
            {Array.from({ length: tracksPerGroup }).map((_, trackIndex) => (
              <div 
                key={trackIndex}
                className="motion-safe:animate-pulse relative bg-zinc-900 rounded-lg p-4"
              >
                {/* Time dot */}
                <div className="absolute -left-[46px] top-6 w-3 h-3 bg-zinc-700 rounded-full ring-4 ring-zinc-950"></div>

                <div className="flex items-center gap-4">
                  {/* Album art skeleton */}
                  <div className="w-14 h-14 bg-zinc-700 rounded flex-shrink-0"></div>

                  {/* Track info skeleton */}
                  <div className="flex-1 space-y-2 min-w-0">
                    {/* Track name */}
                    <div className="h-4 bg-zinc-700 rounded w-3/4"></div>
                    {/* Artist and album */}
                    <div className="h-3 bg-zinc-700 rounded w-1/2"></div>
                  </div>

                  {/* Time and duration skeleton */}
                  <div className="text-right space-y-1 flex-shrink-0">
                    <div className="h-3 bg-zinc-700 rounded w-16"></div>
                    <div className="h-3 bg-zinc-700 rounded w-12"></div>
                    <div className="h-3 bg-zinc-700 rounded w-10"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}