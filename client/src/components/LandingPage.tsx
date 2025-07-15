import React, { useState, useEffect } from 'react';
import { apiEndpoint } from '../config/api';

const LandingPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error' | ''>('');
  const [authError, setAuthError] = useState<string | null>(null);

  // Check for auth error in URL params
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const error = urlParams.get('error');
    if (error) {
      setAuthError(decodeURIComponent(error));
      // Clean URL
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, []);

  const handleLogin = () => {
    window.location.href = apiEndpoint('/api/auth/login');
  };

  const handleWaitlistSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    
    try {
      const response = await fetch('/api/waitlist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        setMessageType('success');
        setMessage('Successfully added to waitlist! We\'ll notify you when available.');
        setEmail('');
      } else {
        setMessageType('error');
        setMessage(data.message || 'Failed to join waitlist');
      }
    } catch (error) {
      setMessageType('error');
      setMessage('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 text-white">
      {/* Navigation */}
      <nav className="relative z-10 p-6">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
              <span className="text-black font-bold text-lg">♪</span>
            </div>
            <h1 className="text-xl font-bold">Spotify Claude</h1>
          </div>
          <button 
            onClick={handleLogin}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
          >
            Login
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative px-6 py-20 text-center">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-5xl md:text-7xl font-bold mb-6 bg-linear-to-r from-green-400 to-green-600 bg-clip-text text-transparent">
            Control Spotify
            <br />
            With Your Voice
          </h1>
          <p className="text-xl md:text-2xl text-zinc-300 mb-8 max-w-2xl mx-auto">
            Just say "play some jazz" or "skip to the next song" - powered by Claude AI, 
            your Spotify becomes as natural as conversation.
          </p>
          
          {/* Auth Error Display */}
          {authError && (
            <div className="mb-6 p-4 bg-red-900 text-red-100 border border-red-700 rounded-lg max-w-md mx-auto">
              <p className="font-semibold">Authentication Error:</p>
              <p className="text-sm">{authError}</p>
            </div>
          )}
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button 
              onClick={handleLogin}
              className="px-8 py-4 bg-green-500 hover:bg-green-400 text-black font-bold rounded-full text-lg transition-all transform hover:scale-105"
            >
              Try It Now
            </button>
            <a 
              href="#waitlist" 
              className="px-8 py-4 bg-zinc-800 hover:bg-zinc-700 text-white font-semibold rounded-full text-lg transition-all transform hover:scale-105"
            >
              Join Waitlist
            </a>
          </div>
        </div>
      </section>

      {/* Demo Interface Section */}
      <section id="demo" className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold mb-4">Natural Language Control</h2>
            <p className="text-zinc-300 text-lg max-w-2xl mx-auto">
              No more fumbling with buttons. Just speak naturally and let Claude understand your intent.
            </p>
          </div>
          
          {/* Mock Interface */}
          <div className="bg-zinc-900 rounded-xl p-8 shadow-2xl border border-zinc-800">
            <div className="grid lg:grid-cols-2 gap-8">
              {/* Chat Interface */}
              <div className="space-y-4">
                <div className="flex items-center space-x-2 mb-6">
                  <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                  <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span className="text-sm text-zinc-500 ml-4">Spotify Claude Controller</span>
                </div>
                
                {/* Example Conversations */}
                <div className="space-y-4 h-64 overflow-y-auto">
                  <div className="flex justify-end">
                    <div className="bg-green-500 text-black px-4 py-2 rounded-lg max-w-xs">
                      Play some relaxing jazz music
                    </div>
                  </div>
                  <div className="flex justify-start">
                    <div className="bg-zinc-800 text-white px-4 py-2 rounded-lg max-w-xs">
                      🎵 Playing Jazz Vibes playlist. Enjoy the smooth sounds!
                    </div>
                  </div>
                  
                  <div className="flex justify-end">
                    <div className="bg-green-500 text-black px-4 py-2 rounded-lg max-w-xs">
                      Skip this song, I don't like it
                    </div>
                  </div>
                  <div className="flex justify-start">
                    <div className="bg-zinc-800 text-white px-4 py-2 rounded-lg max-w-xs">
                      ⏭️ Skipped to next track: "Take Five" by Dave Brubeck
                    </div>
                  </div>
                  
                  <div className="flex justify-end">
                    <div className="bg-green-500 text-black px-4 py-2 rounded-lg max-w-xs">
                      Turn the volume down to 30%
                    </div>
                  </div>
                  <div className="flex justify-start">
                    <div className="bg-zinc-800 text-white px-4 py-2 rounded-lg max-w-xs">
                      🔉 Volume set to 30%
                    </div>
                  </div>
                </div>
                
                <div className="flex space-x-2">
                  <input 
                    type="text" 
                    placeholder="Type your command..."
                    className="flex-1 px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-green-500 transition-colors"
                    disabled
                  />
                  <button 
                    className="px-6 py-3 bg-green-500 text-black font-bold rounded-lg hover:bg-green-400 transition-colors"
                    disabled
                  >
                    Send
                  </button>
                </div>
              </div>
              
              {/* Now Playing */}
              <div className="bg-zinc-800 rounded-lg p-6">
                <h3 className="text-lg font-semibold mb-4">Now Playing</h3>
                <div className="flex items-center space-x-4 mb-4">
                  <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                    <span className="text-2xl">♪</span>
                  </div>
                  <div>
                    <h4 className="font-semibold">Take Five</h4>
                    <p className="text-zinc-400">Dave Brubeck</p>
                    <p className="text-sm text-zinc-500">Time Out • 1959</p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2 mb-4">
                  <span className="text-sm text-zinc-400">2:14</span>
                  <div className="flex-1 bg-zinc-700 rounded-full h-2">
                    <div className="bg-green-500 h-2 rounded-full w-2/5"></div>
                  </div>
                  <span className="text-sm text-zinc-400">5:24</span>
                </div>
                
                <div className="flex items-center justify-center space-x-4">
                  <button className="p-2 text-zinc-400 hover:text-white transition-colors">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M8.445 14.832A1 1 0 0010 14v-2.798l5.445 3.63A1 1 0 0017 14V6a1 1 0 00-1.555-.832L10 8.798V6a1 1 0 00-1.555-.832l-6 4a1 1 0 000 1.664l6 4z"/>
                    </svg>
                  </button>
                  <button className="p-3 bg-white text-black rounded-full hover:bg-zinc-200 transition-colors">
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd"/>
                    </svg>
                  </button>
                  <button className="p-2 text-zinc-400 hover:text-white transition-colors">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M4.555 5.168A1 1 0 003 6v8a1 1 0 001.555.832L10 11.202V14a1 1 0 001.555.832l6-4a1 1 0 000-1.664l-6-4A1 1 0 0010 6v2.798l-5.445-3.63z"/>
                    </svg>
                  </button>
                </div>
                
                <div className="mt-4 flex items-center space-x-2">
                  <svg className="w-4 h-4 text-zinc-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM15.657 6.343a1 1 0 011.414 0A9.972 9.972 0 0119 12a9.972 9.972 0 01-1.929 5.657 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 12a7.971 7.971 0 00-1.343-4.243 1 1 0 010-1.414z" clipRule="evenodd"/>
                  </svg>
                  <div className="flex-1 bg-zinc-700 rounded-full h-1">
                    <div className="bg-green-500 h-1 rounded-full w-1/3"></div>
                  </div>
                  <span className="text-sm text-zinc-400">30%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-6 bg-zinc-900">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold mb-4">Why Choose Spotify Claude?</h2>
            <p className="text-zinc-300 text-lg max-w-2xl mx-auto">
              Experience the future of music control with AI-powered natural language understanding.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-black" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd"/>
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2">Natural Voice Control</h3>
              <p className="text-zinc-400">
                Speak naturally - no need to memorize commands. Just say what you want and let Claude figure it out.
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-black" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.381z" clipRule="evenodd"/>
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2">Lightning Fast</h3>
              <p className="text-zinc-400">
                Instant responses powered by Claude AI. No delays, no confusion - just immediate music control.
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-black" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 00-.613 3.58 2.64 2.64 0 01-.945-1.067c-.328-.68-.398-1.534-.398-2.654A1 1 0 005.05 6.05 6.981 6.981 0 003 11a7 7 0 1011.95-4.95c-.592-.591-.98-.985-1.348-1.467-.363-.476-.724-1.063-1.207-2.03zM12.12 15.12A3 3 0 017 13s.879.5 2.5.5c0-1 .5-4 1.25-4.5.5 1 .786 1.293 1.371 1.879A2.99 2.99 0 0113 13a2.99 2.99 0 01-.879 2.121z" clipRule="evenodd"/>
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2">Smart Understanding</h3>
              <p className="text-zinc-400">
                Claude understands context and intent, making your music experience more intuitive than ever.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Waitlist Section */}
      <section id="waitlist" className="py-20 px-6">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-4xl font-bold mb-4">Join the Waitlist</h2>
          <p className="text-zinc-300 text-lg mb-8">
            Be among the first to experience the future of music control. 
            We'll notify you as soon as Spotify Claude is ready for early access.
          </p>
          
          <form onSubmit={handleWaitlistSubmit} className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email address"
                required
                className="flex-1 px-6 py-4 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-green-500 transition-colors"
              />
              <button
                type="submit"
                disabled={loading}
                className="px-8 py-4 bg-green-500 hover:bg-green-400 disabled:bg-green-600 disabled:cursor-not-allowed text-black font-bold rounded-lg text-lg transition-all transform hover:scale-105 disabled:scale-100"
              >
                {loading ? 'Joining...' : 'Join Waitlist'}
              </button>
            </div>
            
            {message && (
              <div className={`p-4 rounded-lg ${
                messageType === 'success' 
                  ? 'bg-green-900 text-green-100 border border-green-700' 
                  : 'bg-red-900 text-red-100 border border-red-700'
              }`}>
                {message}
              </div>
            )}
          </form>
          
          <p className="text-sm text-zinc-500 mt-4">
            No spam, just updates on early access and launch notifications.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 bg-zinc-900 border-t border-zinc-800">
        <div className="max-w-4xl mx-auto text-center">
          <div className="flex items-center justify-center space-x-2 mb-4">
            <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
              <span className="text-black font-bold">♪</span>
            </div>
            <span className="text-lg font-semibold">Spotify Claude</span>
          </div>
          <p className="text-zinc-400 text-sm">
            Powered by Claude AI • Made with ❤️ for music lovers
          </p>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;