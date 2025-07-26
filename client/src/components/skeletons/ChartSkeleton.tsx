interface ChartSkeletonProps {
  height?: string;
  title?: boolean;
}

export default function ChartSkeleton({ height = "h-64", title = true }: ChartSkeletonProps) {
  return (
    <div className="motion-safe:animate-pulse bg-zinc-900 rounded-lg p-6">
      {/* Chart title skeleton */}
      {title && (
        <div className="mb-6">
          <div className="h-5 bg-zinc-700 rounded w-1/3 mb-2"></div>
          <div className="h-3 bg-zinc-700 rounded w-1/2"></div>
        </div>
      )}
      
      {/* Chart area skeleton */}
      <div className={`${height} bg-zinc-800 rounded-lg flex items-end justify-center gap-2 p-4`}>
        {/* Bars for bar chart skeleton */}
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className="bg-zinc-700 rounded-t w-4"
            style={{ 
              height: `${Math.random() * 60 + 20}%` 
            }}
          ></div>
        ))}
      </div>
      
      {/* Legend skeleton */}
      <div className="mt-4 flex justify-center gap-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="w-3 h-3 bg-zinc-700 rounded-full"></div>
            <div className="h-3 bg-zinc-700 rounded w-16"></div>
          </div>
        ))}
      </div>
    </div>
  );
}