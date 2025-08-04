import { useState } from 'react';
import { Disc3, Search, History } from 'lucide-react';
import { Toaster } from '@/components/ui/sonner';
import PlaylistDiscovery from '../components/dashboard/PlaylistDiscovery';
import PlaylistSearchHistory from '../components/dashboard/PlaylistSearchHistory';
import PlaylistSearch from './PlaylistSearch';

type Tab = 'discover' | 'search' | 'history';

export default function PlaylistTools() {
  const [activeTab, setActiveTab] = useState<Tab>('discover');

  const tabs = [
    { 
      id: 'discover' as Tab, 
      label: 'Discover Playlists', 
      icon: Disc3,
      description: 'Use AI to find playlists matching your preferences'
    },
    { 
      id: 'search' as Tab, 
      label: 'Search Playlists', 
      icon: Search,
      description: 'Search Spotify\'s playlist catalog'
    },
    { 
      id: 'history' as Tab, 
      label: 'Search History', 
      icon: History,
      description: 'View and reload past discovery searches'
    }
  ];

  return (
    <div className="min-h-screen bg-zinc-900 text-white">
      <Toaster />
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Playlist Tools</h1>
          <p className="text-zinc-400">
            Discover, search, and manage playlists with AI-powered tools
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="mb-8">
          <div className="border-b border-zinc-800">
            <nav className="-mb-px flex space-x-8">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                      activeTab === tab.id
                        ? 'border-green-500 text-green-400'
                        : 'border-transparent text-zinc-400 hover:text-zinc-300 hover:border-zinc-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Icon className="w-4 h-4" />
                      <span>{tab.label}</span>
                    </div>
                  </button>
                );
              })}
            </nav>
          </div>
          
          {/* Tab Description */}
          <div className="mt-4">
            <p className="text-sm text-zinc-500">
              {tabs.find(tab => tab.id === activeTab)?.description}
            </p>
          </div>
        </div>

        {/* Tab Content */}
        <div className="space-y-6">
          {activeTab === 'discover' && (
            <div>
              <PlaylistDiscovery />
            </div>
          )}

          {activeTab === 'search' && (
            <div>
              {/* Extract the main content from PlaylistSearch page */}
              <div className="space-y-6">
                <PlaylistSearchContent />
              </div>
            </div>
          )}

          {activeTab === 'history' && (
            <div>
              <PlaylistSearchHistory />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Extract the main content from PlaylistSearch for reuse
function PlaylistSearchContent() {
  // For now, render the full PlaylistSearch component
  // In a real implementation, you might want to extract just the search functionality
  // and remove the page wrapper, but this maintains all existing functionality
  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center gap-2">
          <Search className="w-6 h-6 text-green-500" />
          <h2 className="text-2xl font-bold text-white">Search Playlists</h2>
        </div>
        <p className="text-zinc-400 max-w-2xl mx-auto">
          Search Spotify's vast playlist catalog and explore detailed information
        </p>
      </div>
      
      {/* Embed the PlaylistSearch component but remove its page wrapper */}
      <div className="playlist-search-embed">
        <PlaylistSearchEmbed />
      </div>
    </div>
  );
}

// This component wraps PlaylistSearch but removes the page-level styling
function PlaylistSearchEmbed() {
  return (
    <div className="playlist-search-content">
      <style>{`
        .playlist-search-content .min-h-screen {
          min-height: auto !important;
        }
        .playlist-search-content .bg-zinc-900 {
          background-color: transparent !important;
        }
        .playlist-search-content .p-6 {
          padding: 0 !important;
        }
        .playlist-search-content .mb-8:first-child {
          display: none !important;
        }
      `}</style>
      <PlaylistSearch />
    </div>
  );
}