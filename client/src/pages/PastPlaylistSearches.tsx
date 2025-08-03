import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import PlaylistSearchHistory from '../components/dashboard/PlaylistSearchHistory';

export default function PastPlaylistSearches() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-black to-zinc-900">
      {/* Header */}
      <div className="border-b border-zinc-800/50 bg-black/20 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link
                to="/dashboard"
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-800/50 hover:bg-zinc-700/50 text-zinc-300 hover:text-white transition-all duration-200"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="text-sm font-medium">Back to Dashboard</span>
              </Link>
              
              <div className="h-6 w-px bg-zinc-700" />
              
              <h1 className="text-xl font-semibold text-white">
                Past Playlist Searches
              </h1>
            </div>

            {/* Quick actions */}
            <div className="flex items-center gap-2">
              <Link
                to="/playlist-discovery"
                className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-medium transition-colors"
              >
                New Search
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PlaylistSearchHistory />
      </main>
    </div>
  );
}