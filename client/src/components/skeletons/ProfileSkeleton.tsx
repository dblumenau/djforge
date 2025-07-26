export default function ProfileSkeleton() {
  return (
    <div className="motion-safe:animate-pulse bg-zinc-900 rounded-lg p-6 flex items-center gap-6">
      {/* Avatar skeleton */}
      <div className="w-24 h-24 bg-zinc-700 rounded-full flex-shrink-0"></div>
      
      {/* Text content skeleton */}
      <div className="space-y-3 flex-1">
        {/* Name */}
        <div className="h-6 bg-zinc-700 rounded w-1/2"></div>
        {/* Email */}
        <div className="h-4 bg-zinc-700 rounded w-1/3"></div>
        {/* Status line */}
        <div className="h-3 bg-zinc-700 rounded w-2/3"></div>
      </div>
    </div>
  );
}