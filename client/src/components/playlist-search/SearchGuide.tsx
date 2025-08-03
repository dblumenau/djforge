interface SearchGuideProps {
  setSearchQuery: (query: string) => void;
  performSearch: (query: string) => Promise<void>;
}

export default function SearchGuide({ setSearchQuery, performSearch }: SearchGuideProps) {
  return (
    <div className="space-y-6">
      {/* Quick Start */}
      <div className="bg-zinc-800 border border-zinc-700 rounded-lg p-8 text-center">
        <svg className="w-16 h-16 mx-auto mb-4 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <h3 className="text-lg font-semibold mb-2">Start Searching</h3>
        <p className="text-zinc-400 mb-4">
          Enter a search query above to explore Spotify playlist data
        </p>
      </div>

      {/* Comprehensive Search Guide */}
      <div className="bg-zinc-800 border border-zinc-700 rounded-lg overflow-hidden">
        <div className="bg-zinc-700/50 px-6 py-4 border-b border-zinc-700">
          <h3 className="text-lg font-semibold text-white">Comprehensive Search Guide</h3>
          <p className="text-sm text-zinc-400 mt-1">All the ways you can search Spotify playlists</p>
        </div>
        
        <div className="p-6 space-y-6">
          {/* Basic Text Search */}
          <div>
            <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
              <span className="text-spotify-green">1.</span> Basic Text Search
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex gap-3">
                <code className="bg-zinc-900 px-2 py-1 rounded text-zinc-300 flex-shrink-0">summer vibes</code>
                <span className="text-zinc-400">Search playlist names and descriptions</span>
              </div>
              <div className="flex gap-3">
                <code className="bg-zinc-900 px-2 py-1 rounded text-zinc-300 flex-shrink-0">"exact phrase"</code>
                <span className="text-zinc-400">Use quotes for exact phrase matching</span>
              </div>
            </div>
          </div>

          {/* Wildcards */}
          <div>
            <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
              <span className="text-spotify-green">2.</span> Wildcards & Pattern Matching
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex gap-3">
                <code className="bg-zinc-900 px-2 py-1 rounded text-zinc-300 flex-shrink-0">love*</code>
                <span className="text-zinc-400">Matches love, loves, lover, lovely, etc.</span>
              </div>
              <div className="flex gap-3">
                <code className="bg-zinc-900 px-2 py-1 rounded text-zinc-300 flex-shrink-0">*vibes</code>
                <span className="text-zinc-400">Matches anything ending with "vibes"</span>
              </div>
              <div className="flex gap-3">
                <code className="bg-zinc-900 px-2 py-1 rounded text-zinc-300 flex-shrink-0">chill*2024</code>
                <span className="text-zinc-400">Combine wildcards with text</span>
              </div>
            </div>
          </div>

          {/* Boolean Operators */}
          <div>
            <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
              <span className="text-spotify-green">3.</span> Boolean Operators
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex gap-3">
                <code className="bg-zinc-900 px-2 py-1 rounded text-zinc-300 flex-shrink-0">rock OR metal</code>
                <span className="text-zinc-400">Playlists with either rock OR metal</span>
              </div>
              <div className="flex gap-3">
                <code className="bg-zinc-900 px-2 py-1 rounded text-zinc-300 flex-shrink-0">jazz AND smooth</code>
                <span className="text-zinc-400">Must contain both jazz AND smooth</span>
              </div>
              <div className="flex gap-3">
                <code className="bg-zinc-900 px-2 py-1 rounded text-zinc-300 flex-shrink-0">happy NOT sad</code>
                <span className="text-zinc-400">Include happy but exclude sad</span>
              </div>
              <div className="flex gap-3">
                <code className="bg-zinc-900 px-2 py-1 rounded text-zinc-300 flex-shrink-0">NOT explicit</code>
                <span className="text-zinc-400">Exclude playlists with "explicit"</span>
              </div>
            </div>
          </div>

          {/* Field Filters */}
          <div>
            <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
              <span className="text-spotify-green">4.</span> Field Filters
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex gap-3">
                <code className="bg-zinc-900 px-2 py-1 rounded text-zinc-300 flex-shrink-0">genre:rock</code>
                <span className="text-zinc-400">Filter by music genre</span>
              </div>
              <div className="flex gap-3">
                <code className="bg-zinc-900 px-2 py-1 rounded text-zinc-300 flex-shrink-0">year:2024</code>
                <span className="text-zinc-400">Playlists created/updated in 2024</span>
              </div>
              <div className="flex gap-3">
                <code className="bg-zinc-900 px-2 py-1 rounded text-zinc-300 flex-shrink-0">year:2020-2024</code>
                <span className="text-zinc-400">Year range filtering</span>
              </div>
              <div className="flex gap-3">
                <code className="bg-zinc-900 px-2 py-1 rounded text-zinc-300 flex-shrink-0">tag:summer</code>
                <span className="text-zinc-400">Search by playlist tags</span>
              </div>
            </div>
          </div>

          {/* Advanced Combinations */}
          <div>
            <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
              <span className="text-spotify-green">5.</span> Advanced Combinations
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex gap-3">
                <code className="bg-zinc-900 px-2 py-1 rounded text-zinc-300 flex-shrink-0">genre:indie year:2024</code>
                <span className="text-zinc-400">Indie playlists from 2024</span>
              </div>
              <div className="flex gap-3">
                <code className="bg-zinc-900 px-2 py-1 rounded text-zinc-300 flex-shrink-0">(rock OR metal) NOT classical</code>
                <span className="text-zinc-400">Rock or metal, but not classical</span>
              </div>
              <div className="flex gap-3">
                <code className="bg-zinc-900 px-2 py-1 rounded text-zinc-300 flex-shrink-0">workout* year:2023-2024</code>
                <span className="text-zinc-400">Recent workout playlists</span>
              </div>
              <div className="flex gap-3">
                <code className="bg-zinc-900 px-2 py-1 rounded text-zinc-300 flex-shrink-0">"road trip" genre:rock</code>
                <span className="text-zinc-400">Exact phrase + genre filter</span>
              </div>
            </div>
          </div>

          {/* Special Searches */}
          <div>
            <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
              <span className="text-spotify-green">6.</span> Special Search Types
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex gap-3">
                <code className="bg-zinc-900 px-2 py-1 rounded text-zinc-300 flex-shrink-0">owner:spotify</code>
                <span className="text-zinc-400">Official Spotify playlists</span>
              </div>
              <div className="flex gap-3">
                <code className="bg-zinc-900 px-2 py-1 rounded text-zinc-300 flex-shrink-0">owner:"user name"</code>
                <span className="text-zinc-400">Playlists by specific user</span>
              </div>
              <div className="flex gap-3">
                <code className="bg-zinc-900 px-2 py-1 rounded text-zinc-300 flex-shrink-0">followers:&gt;1000</code>
                <span className="text-zinc-400">Popular playlists (theoretical)</span>
              </div>
            </div>
          </div>

          {/* Understanding API Response */}
          <div className="bg-zinc-900/50 rounded-lg p-4 border border-zinc-700">
            <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
              <span className="text-spotify-green">🔍</span> Understanding the API Response
            </h4>
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-zinc-300 font-medium mb-2">Search Response Fields:</p>
                <ul className="space-y-1 text-zinc-400 ml-4">
                  <li>• <code className="text-zinc-300">id</code> - Unique playlist identifier</li>
                  <li>• <code className="text-zinc-300">name</code> - Playlist title</li>
                  <li>• <code className="text-zinc-300">description</code> - User-written description (often very detailed!)</li>
                  <li>• <code className="text-zinc-300">owner</code> - Creator's profile info</li>
                  <li>• <code className="text-zinc-300">tracks.total</code> - Number of tracks (but not the actual tracks)</li>
                  <li>• <code className="text-zinc-300">images</code> - Cover art in multiple sizes</li>
                  <li>• <code className="text-zinc-300">public/collaborative</code> - Playlist visibility</li>
                </ul>
              </div>
              
              <div className="border-t border-zinc-700 pt-3">
                <p className="text-zinc-300 font-medium mb-2">The <code className="bg-zinc-800 px-1 rounded">href</code> Field:</p>
                <p className="text-zinc-400 mb-2">Each playlist has an <code className="text-zinc-300">href</code> URL like:</p>
                <code className="block bg-zinc-800 p-2 rounded text-xs text-zinc-300 mb-2">
                  https://api.spotify.com/v1/playlists/6d4qjaFWS01Gj6S4Sfu19S
                </code>
                <p className="text-zinc-400 mb-2">Calling this endpoint returns the FULL playlist with:</p>
                <ul className="space-y-1 text-zinc-400 ml-4">
                  <li>• <span className="text-green-400">All tracks with complete metadata</span> (artist, album, duration, etc.)</li>
                  <li>• <span className="text-green-400">Track audio features</span> (via additional calls)</li>
                  <li>• <span className="text-green-400">Added dates</span> for each track</li>
                  <li>• <span className="text-green-400">Who added each track</span> (for collaborative playlists)</li>
                  <li>• <span className="text-green-400">Follower count</span> (if public)</li>
                  <li>• <span className="text-green-400">Pagination info</span> for playlists with 100+ tracks</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Pro Tips */}
          <div className="bg-zinc-900/50 rounded-lg p-4 border border-zinc-700">
            <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
              <span className="text-spotify-green">💡</span> Pro Tips
            </h4>
            <ul className="space-y-2 text-sm text-zinc-400">
              <li>• Search is case-insensitive (rock = Rock = ROCK)</li>
              <li>• Playlist descriptions often contain rich metadata about mood, activities, and occasions</li>
              <li>• Search returns basic info - use the <code className="text-zinc-300">href</code> to get full track listings</li>
              <li>• Combine multiple operators for precise results</li>
              <li>• Use quotes to search for exact phrases in names or descriptions</li>
              <li>• Wildcards (*) can be placed anywhere in your search term</li>
              <li>• The API returns max 50 results per query - refine your search for better results</li>
            </ul>
          </div>

          {/* Example Searches */}
          <div className="bg-zinc-900/50 rounded-lg p-4 border border-zinc-700">
            <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
              <span className="text-spotify-green">🎵</span> Example Searches to Try
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
              <code className="bg-zinc-800 px-3 py-2 rounded text-zinc-300 hover:bg-zinc-700 cursor-pointer transition-colors"
                    onClick={() => {
                      setSearchQuery('chill* NOT sleep');
                      performSearch('chill* NOT sleep');
                    }}>
                chill* NOT sleep
              </code>
              <code className="bg-zinc-800 px-3 py-2 rounded text-zinc-300 hover:bg-zinc-700 cursor-pointer transition-colors"
                    onClick={() => {
                      setSearchQuery('genre:electronic year:2024');
                      performSearch('genre:electronic year:2024');
                    }}>
                genre:electronic year:2024
              </code>
              <code className="bg-zinc-800 px-3 py-2 rounded text-zinc-300 hover:bg-zinc-700 cursor-pointer transition-colors"
                    onClick={() => {
                      setSearchQuery('"morning motivation"');
                      performSearch('"morning motivation"');
                    }}>
                "morning motivation"
              </code>
              <code className="bg-zinc-800 px-3 py-2 rounded text-zinc-300 hover:bg-zinc-700 cursor-pointer transition-colors"
                    onClick={() => {
                      setSearchQuery('(jazz OR blues) AND smooth');
                      performSearch('(jazz OR blues) AND smooth');
                    }}>
                (jazz OR blues) AND smooth
              </code>
              <code className="bg-zinc-800 px-3 py-2 rounded text-zinc-300 hover:bg-zinc-700 cursor-pointer transition-colors"
                    onClick={() => {
                      setSearchQuery('workout* genre:hip-hop');
                      performSearch('workout* genre:hip-hop');
                    }}>
                workout* genre:hip-hop
              </code>
              <code className="bg-zinc-800 px-3 py-2 rounded text-zinc-300 hover:bg-zinc-700 cursor-pointer transition-colors"
                    onClick={() => {
                      setSearchQuery('owner:spotify rock');
                      performSearch('owner:spotify rock');
                    }}>
                owner:spotify rock
              </code>
            </div>
            <p className="text-xs text-zinc-500 mt-3">Click any example to try it!</p>
          </div>
        </div>
      </div>
    </div>
  );
}