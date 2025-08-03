import type { AnalyticsData } from '../../../@types/playlist-search';

interface AnalyticsTabProps {
  analytics: AnalyticsData | null;
}

export default function AnalyticsTab({ analytics }: AnalyticsTabProps) {
  if (!analytics) {
    return <div>No data available</div>;
  }

  return (
    <div className="space-y-6">
      {/* Overall Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-zinc-800 rounded-lg p-4">
          <p className="text-sm text-zinc-400">Total Tracks</p>
          <p className="text-2xl font-bold text-white">{analytics.stats.totalTracks}</p>
        </div>
        <div className="bg-zinc-800 rounded-lg p-4">
          <p className="text-sm text-zinc-400">Total Duration</p>
          <p className="text-2xl font-bold text-white">{analytics.stats.totalDurationHours}h</p>
        </div>
        <div className="bg-zinc-800 rounded-lg p-4">
          <p className="text-sm text-zinc-400">Avg Popularity</p>
          <p className="text-2xl font-bold text-white">{analytics.stats.avgPopularity}</p>
        </div>
        <div className="bg-zinc-800 rounded-lg p-4">
          <p className="text-sm text-zinc-400">Explicit</p>
          <p className="text-2xl font-bold text-white">{analytics.stats.explicitPercentage}%</p>
        </div>
      </div>

      {/* Top Artists */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-3">Top Artists</h3>
        <div className="space-y-2">
          {analytics.topArtists.map((artist, index) => (
            <div key={index} className="flex items-center justify-between bg-zinc-800 rounded-lg p-3">
              <span className="text-white">{artist.name}</span>
              <span className="text-zinc-400">{artist.count} tracks</span>
            </div>
          ))}
        </div>
      </div>

      {/* Top Albums */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-3">Top Albums</h3>
        <div className="space-y-2">
          {analytics.topAlbums.map((album, index) => (
            <div key={index} className="flex items-center justify-between bg-zinc-800 rounded-lg p-3">
              <div>
                <p className="text-white">{album.name}</p>
                <p className="text-sm text-zinc-400">{album.artist}</p>
              </div>
              <span className="text-zinc-400">{album.count} tracks</span>
            </div>
          ))}
        </div>
      </div>

      {/* Year Distribution */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-3">Release Year Distribution</h3>
        <div className="flex flex-wrap gap-2">
          {analytics.yearDistribution.map(([year, count]) => (
            <div key={year} className="bg-zinc-800 rounded-lg px-3 py-2">
              <span className="text-white">{year}: </span>
              <span className="text-zinc-400">{count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}