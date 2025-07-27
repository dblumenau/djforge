import React from 'react';

interface QueueSkeletonProps {
  trackCount?: number;
}

const QueueSkeleton: React.FC<QueueSkeletonProps> = ({ trackCount = 6 }) => {
  return (
    <div className="flex-1 overflow-y-auto">
      {/* Now Playing Section - exact same structure as real content */}
      <div className="mb-4">
        <h3 className="text-sm font-medium text-gray-400 mb-2">Now Playing</h3>
        <div className="bg-zinc-800 rounded-lg p-3 border border-green-500/30">
          <div className="text-white font-medium">
            <span className="inline-block bg-zinc-700 rounded h-5 w-3/4 animate-pulse"></span>
          </div>
          <div className="text-sm text-gray-400">
            <span className="inline-block bg-zinc-600 rounded h-4 w-1/2 animate-pulse"></span>
          </div>
        </div>
      </div>

      {/* Up Next Section - exact same structure */}
      <div>
        <h3 className="text-sm font-medium text-gray-400 mb-2">Up Next</h3>
        <div className="space-y-2">
          {Array.from({ length: trackCount }).map((_, index) => (
            <div key={index} className="bg-zinc-800 rounded-lg p-3">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0 mr-3">
                  <div className="text-white font-medium truncate">
                    <span className="inline-block bg-zinc-700 rounded h-5 w-2/3 animate-pulse"></span>
                  </div>
                  <div className="text-sm text-gray-400 truncate">
                    <span className="inline-block bg-zinc-600 rounded h-4 w-1/2 animate-pulse"></span>
                  </div>
                </div>
                <div className="text-sm text-gray-500">
                  <span className="inline-block bg-zinc-600 rounded h-4 w-10 animate-pulse"></span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default QueueSkeleton;