export default function StatCardSkeleton() {
  return (
    <div className="motion-safe:animate-pulse bg-zinc-900 rounded-lg p-6 text-center">
      {/* Number skeleton */}
      <div className="h-8 bg-zinc-700 rounded w-16 mx-auto mb-3"></div>
      {/* Label skeleton */}
      <div className="h-4 bg-zinc-700 rounded w-20 mx-auto"></div>
    </div>
  );
}