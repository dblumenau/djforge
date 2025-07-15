import React from 'react';
import { Link } from 'react-router-dom';

const NotFound: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 text-white flex items-center justify-center">
      <div className="text-center max-w-lg mx-auto px-6">
        {/* Logo */}
        <div className="flex items-center justify-center space-x-2 mb-8">
          <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center">
            <span className="text-black font-bold text-2xl">♪</span>
          </div>
          <h1 className="text-2xl font-bold">Spotify Claude</h1>
        </div>

        {/* 404 Content */}
        <div className="mb-8">
          <h1 className="text-8xl font-bold text-green-500 mb-4">404</h1>
          <h2 className="text-3xl font-bold mb-4">Track Not Found</h2>
          <p className="text-gray-300 text-lg mb-8">
            Looks like this page skipped to the next song. The page you're looking for doesn't exist.
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link 
            to="/"
            className="px-8 py-3 bg-green-500 hover:bg-green-400 text-black font-bold rounded-full text-lg transition-all transform hover:scale-105"
          >
            Go to App
          </Link>
          <Link 
            to="/landing"
            className="px-8 py-3 bg-zinc-800 hover:bg-zinc-700 text-white font-semibold rounded-full text-lg transition-all transform hover:scale-105"
          >
            Visit Landing Page
          </Link>
        </div>

        {/* Fun Music-themed Error Messages */}
        <div className="mt-8 text-gray-500 text-sm">
          <p>🎵 "The page you requested has left the building" 🎵</p>
        </div>
      </div>
    </div>
  );
};

export default NotFound;