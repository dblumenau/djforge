import { Music, Globe, Lock, Copy, CheckCircle, ExternalLink } from 'lucide-react';
import type { PlaylistDetails } from '../../../@types/playlist-search';

interface OverviewTabProps {
  playlist: PlaylistDetails;
  copiedItem: string | null;
  onCopyToClipboard: (text: string, itemId: string) => void;
}

export default function OverviewTab({ playlist, copiedItem, onCopyToClipboard }: OverviewTabProps) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Playlist Image */}
        <div>
          {playlist.images?.[0]?.url ? (
            <img 
              src={playlist.images[0].url} 
              alt={playlist.name}
              className="w-full aspect-square object-cover rounded-lg"
            />
          ) : (
            <div className="w-full aspect-square bg-zinc-800 rounded-lg flex items-center justify-center">
              <Music className="w-24 h-24 text-zinc-600" />
            </div>
          )}
        </div>

        {/* Playlist Info */}
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-medium text-zinc-400 mb-1">Description</h3>
            <p className="text-white">
              {playlist.description || 'No description available'}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <h3 className="text-sm font-medium text-zinc-400 mb-1">Visibility</h3>
              <p className="text-white flex items-center gap-1">
                {playlist.public ? (
                  <><Globe className="w-4 h-4 text-green-400" /> Public</>
                ) : (
                  <><Lock className="w-4 h-4 text-zinc-400" /> Private</>
                )}
              </p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-zinc-400 mb-1">Collaborative</h3>
              <p className="text-white">
                {playlist.collaborative ? 'Yes' : 'No'}
              </p>
            </div>
          </div>

          {playlist.followers && (
            <div>
              <h3 className="text-sm font-medium text-zinc-400 mb-1">Followers</h3>
              <p className="text-white">
                {playlist.followers.total.toLocaleString()}
              </p>
            </div>
          )}

          <div>
            <h3 className="text-sm font-medium text-zinc-400 mb-1">Snapshot ID</h3>
            <code className="text-xs text-zinc-300 bg-zinc-800 px-2 py-1 rounded">
              {playlist.snapshot_id}
            </code>
          </div>

          <div className="space-y-2">
            <button
              onClick={() => onCopyToClipboard(playlist.uri, 'uri')}
              className="w-full px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm flex items-center justify-center gap-2"
            >
              {copiedItem === 'uri' ? <CheckCircle className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
              Copy Playlist URI
            </button>
            <button
              onClick={() => onCopyToClipboard(playlist.id, 'id')}
              className="w-full px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm flex items-center justify-center gap-2"
            >
              {copiedItem === 'id' ? <CheckCircle className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
              Copy Playlist ID
            </button>
            <a
              href={playlist.external_urls?.spotify}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full px-4 py-2 bg-spotify-green hover:bg-green-600 text-black font-medium rounded-lg text-sm flex items-center justify-center gap-2"
            >
              <ExternalLink className="w-4 h-4" />
              Open in Spotify
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}