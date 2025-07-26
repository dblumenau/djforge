interface AlbumGridSkeletonProps {
  count?: number;
}

export default function AlbumGridSkeleton({ count = 12 }: AlbumGridSkeletonProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="motion-safe:animate-pulse bg-zinc-900 rounded-lg p-4">
          {/* Album cover */}
          <div className="aspect-square bg-zinc-700 rounded-lg mb-3"></div>
          
          {/* Album info */}
          <div className="space-y-2">
            {/* Album name */}
            <div className="h-4 bg-zinc-700 rounded"></div>
            {/* Artist name */}
            <div className="h-3 bg-zinc-700 rounded w-3/4"></div>
            {/* Additional info */}
            <div className="flex items-center justify-between">
              <div className="h-3 bg-zinc-700 rounded w-1/3"></div>
              <div className="h-3 bg-zinc-700 rounded w-1/4"></div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}