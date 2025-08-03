import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import OverviewTab from './PlaylistModalTabs/OverviewTab';
import TracksTab from './PlaylistModalTabs/TracksTab';
import AnalyticsTab from './PlaylistModalTabs/AnalyticsTab';
import JsonTab from './PlaylistModalTabs/JsonTab';
import type { PlaylistDetails, AnalyticsData } from '../../@types/playlist-search';

interface PlaylistDetailsModalProps {
  showModal: boolean;
  onClose: () => void;
  selectedPlaylist: PlaylistDetails | null;
  loadingDetails: boolean;
  modalTab: 'overview' | 'tracks' | 'analytics' | 'json';
  onTabChange: (tab: 'overview' | 'tracks' | 'analytics' | 'json') => void;
  copiedItem: string | null;
  onCopyToClipboard: (text: string, itemId: string) => void;
  calculateAnalytics: () => AnalyticsData | null;
  formatDuration: (ms: number) => string;
  formatDate: (dateString: string) => string;
}

export default function PlaylistDetailsModal({
  showModal,
  onClose,
  selectedPlaylist,
  loadingDetails,
  modalTab,
  onTabChange,
  copiedItem,
  onCopyToClipboard,
  calculateAnalytics,
  formatDuration,
  formatDate
}: PlaylistDetailsModalProps) {
  if (!showModal) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative min-h-screen flex items-center justify-center p-4">
        <div className="relative bg-zinc-900 rounded-xl border border-zinc-700 w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
          {/* Modal Header */}
          <div className="flex items-center justify-between p-6 border-b border-zinc-700">
            <div>
              <h2 className="text-2xl font-bold text-white">
                {loadingDetails ? 'Loading...' : selectedPlaylist?.name || 'Playlist Details'}
              </h2>
              {selectedPlaylist && (
                <p className="text-sm text-zinc-400 mt-1">
                  by {selectedPlaylist.owner?.display_name || 'Unknown'} • {selectedPlaylist.tracks?.total || 0} tracks
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Tab Navigation */}
          {!loadingDetails && selectedPlaylist && (
            <div className="flex border-b border-zinc-700">
              {(['overview', 'tracks', 'analytics', 'json'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => onTabChange(tab)}
                  className={`px-6 py-3 text-sm font-medium transition-colors capitalize ${
                    modalTab === tab
                      ? 'text-spotify-green border-b-2 border-spotify-green'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          )}

          {/* Modal Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {loadingDetails ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-spotify-green"></div>
              </div>
            ) : selectedPlaylist ? (
              <>
                {/* Overview Tab */}
                {modalTab === 'overview' && (
                  <OverviewTab 
                    playlist={selectedPlaylist}
                    copiedItem={copiedItem}
                    onCopyToClipboard={onCopyToClipboard}
                  />
                )}

                {/* Tracks Tab */}
                {modalTab === 'tracks' && (
                  <TracksTab 
                    playlist={selectedPlaylist}
                    copiedItem={copiedItem}
                    onCopyToClipboard={onCopyToClipboard}
                    formatDuration={formatDuration}
                    formatDate={formatDate}
                  />
                )}

                {/* Analytics Tab */}
                {modalTab === 'analytics' && (
                  <AnalyticsTab analytics={calculateAnalytics()} />
                )}

                {/* JSON Tab */}
                {modalTab === 'json' && (
                  <JsonTab 
                    playlist={selectedPlaylist}
                    copiedItem={copiedItem}
                    onCopyToClipboard={onCopyToClipboard}
                  />
                )}
              </>
            ) : (
              <div className="text-center py-12 text-zinc-400">
                Failed to load playlist details
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}