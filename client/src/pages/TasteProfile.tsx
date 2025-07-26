import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authenticatedFetch } from '../utils/api';

const TasteProfile: React.FC = () => {
  const [profile, setProfile] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchTasteProfile();
  }, []);

  const fetchTasteProfile = async () => {
    try {
      setLoading(true);
      const response = await authenticatedFetch('/api/user-data/taste-profile');
      
      if (!response.ok) {
        throw new Error(`Failed to fetch taste profile: ${response.status}`);
      }
      
      const data = await response.json();
      setProfile(data.profile);
    } catch (err) {
      console.error('Error fetching taste profile:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch taste profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-green-400">Your Music Taste Profile</h1>
          <button
            onClick={() => navigate('/')}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
          >
            Back to Player
          </button>
        </div>

        {loading && (
          <div className="text-center py-12">
            <div className="text-xl">Loading your taste profile...</div>
          </div>
        )}

        {error && (
          <div className="bg-red-900/20 border border-red-500 rounded-lg p-4 mb-8">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {!loading && !error && profile && (
          <div className="bg-zinc-900 rounded-lg p-6">
            <pre className="whitespace-pre-wrap font-mono text-sm text-zinc-300">
              {profile}
            </pre>
            
            <div className="mt-6 pt-6 border-t border-zinc-800">
              <button
                onClick={fetchTasteProfile}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
              >
                Refresh Profile
              </button>
              <p className="text-xs text-zinc-500 mt-2">
                Profile is cached for 1 hour. Click refresh to update with latest data.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TasteProfile;