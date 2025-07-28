import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import MusicLoader from './MusicLoader';
import PlaybackControls from './PlaybackControls';
import CommandHistorySkeleton from './skeletons/CommandHistorySkeleton';
import ChatMessage from './ChatMessage';
import ChatInput from './ChatInput';
import QueueDisplay from './QueueDisplay';
import { AuthTestPanel } from './AuthTestPanel';
import { useSpotifyAuth } from '../hooks/useSpotifyAuth';
import { useTrackLibrary } from '../hooks/useTrackLibrary';
import { useIOSKeyboardFix } from '../hooks/useIOSKeyboardFix';
import { apiEndpoint } from '../config/api';
import { authenticatedFetch, api } from '../utils/api';
import { useModel } from '../contexts/ModelContext';

// Helper component for clickable example lists
const ExampleList: React.FC<{ examples: string[] }> = ({ examples }) => {
  const copyToClipboard = (text: string) => {
    // Remove bullet point and quotes
    const cleanText = text.replace(/^[•"] /, '').replace(/"$/, '');
    navigator.clipboard.writeText(cleanText);
  };
  
  return (
    <ul className="space-y-2 text-gray-400 text-sm">
      {examples.map((example, index) => (
        <li 
          key={index}
          className="hover:text-green-400 cursor-pointer transition-colors"
          onClick={() => copyToClipboard(example)}
        >
          • "{example}"
        </li>
      ))}
    </ul>
  );
};

const MainApp: React.FC = () => {
  const navigate = useNavigate();
  const chatContainerRef = useRef<HTMLDivElement>(null);
  useIOSKeyboardFix();
  const { currentModel } = useModel();
  const [showExamplesModal, setShowExamplesModal] = useState(false);
  const [showQueue, setShowQueue] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [checking, setChecking] = useState(true);
  const [command, setCommand] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [commandHistory, setCommandHistory] = useState<Array<{
    command: string;
    response: string;
    confidence?: number;
    isEnhanced?: boolean;
    timestamp?: number;
    alternatives?: string[] | Array<{ name: string; artists: string; popularity: number; uri: string }>;
    intent?: string;
    reasoning?: string;
    model?: string;
    interpretation?: any; // Full interpretation object for debugging
    queuedSongs?: Array<{ 
      name: string; 
      artists: string; 
      success: boolean; 
      uri?: string;
      feedback?: 'loved' | 'disliked';
      feedbackLoading?: boolean;
    }>;
    isAIDiscovery?: boolean;
    trackUri?: string;
    trackName?: string;
    artist?: string;
    aiReasoning?: string;
    feedback?: 'loved' | 'disliked';
    feedbackLoading?: boolean;
    // Clarification mode fields
    clarificationOptions?: Array<{
      direction: string;
      description: string;
      example: string;
      icon: string;
      followUpQuery?: string;
    }>;
    currentContext?: {
      rejected: string;
      rejectionType: string;
    };
    uiType?: string;
  }>>([]);
  const [commandHistoryLoading, setCommandHistoryLoading] = useState(false);
  // @ts-ignore - Will be used for device preference persistence
  const [devicePreference, setDevicePreference] = useState<string>('auto');
  
  // Extract all track IDs from alternatives and main tracks in command history
  const allTrackIds = commandHistory.reduce((ids: string[], item) => {
    const trackIds: string[] = [];
    
    // Add main track ID if it exists
    if (item.trackUri) {
      const mainTrackId = item.trackUri.split(':')[2];
      if (mainTrackId) trackIds.push(mainTrackId);
    }
    
    // Add alternative track IDs
    if (item.alternatives && typeof item.alternatives[0] === 'object') {
      const alternativeIds = (item.alternatives as Array<{ uri: string }>)
        .map(alt => alt.uri ? alt.uri.split(':')[2] : null)
        .filter((id): id is string => Boolean(id));
      trackIds.push(...alternativeIds);
    }
    
    return [...ids, ...trackIds];
  }, []);

  // Track library hook for managing saved status
  const { savedStatus, loading: libraryLoading, toggleSave } = useTrackLibrary({
    trackIds: allTrackIds
  });
  
  // Authentication
  const { isAuthenticated, loading: authLoading, checkAuthStatus, error: authError, login } = useSpotifyAuth();

  // Check server connection
  useEffect(() => {
    const checkConnection = async () => {
      try {
        const response = await fetch(apiEndpoint('/api/health'));
        if (response.ok) {
          setIsConnected(true);
        } else {
          setIsConnected(false);
        }
      } catch (error) {
        setIsConnected(false);
      } finally {
        setChecking(false);
      }
    };

    checkConnection();
    
    // Check connection every 30 seconds
    const interval = setInterval(checkConnection, 30000);
    
    return () => clearInterval(interval);
  }, []);

  // Check authentication when component mounts
  useEffect(() => {
    if (isConnected && !checking) {
      checkAuthStatus();
    }
  }, [isConnected, checking, checkAuthStatus]);

  // Function to scroll to bottom
  const scrollToBottom = () => {
    if (chatContainerRef.current) {
      const scrollElement = chatContainerRef.current.parentElement;
      if (scrollElement) {
        scrollElement.scrollTop = scrollElement.scrollHeight;
      }
    }
  };

  // Auto-scroll to bottom when new messages are added
  useEffect(() => {
    scrollToBottom();
  }, [commandHistory]);

  // Auto-scroll to bottom when history finishes loading
  useEffect(() => {
    if (!commandHistoryLoading) {
      // Use a small timeout to ensure DOM is fully updated
      setTimeout(scrollToBottom, 100);
    }
  }, [commandHistoryLoading]);

  // Auto-scroll on initial mount
  useEffect(() => {
    // Give the page time to fully render
    setTimeout(scrollToBottom, 500);
  }, []);

  // Load command history from Redis when authenticated
  useEffect(() => {
    const loadCommandHistory = async () => {
      if (!isAuthenticated) return;
      
      setCommandHistoryLoading(true);
      console.log('🔍 Loading command history from backend...');
      try {
        const response = await authenticatedFetch(apiEndpoint('/api/llm/simple/history'));
        if (response.ok) {
          const data = await response.json();
          if (data.history && Array.isArray(data.history)) {
            console.log(`📋 Loaded ${data.history.length} history entries from backend`);
            // Look for entries with feedback
            const entriesWithFeedback = data.history.filter((entry: any) => 
              entry.feedback || (entry.queuedSongs && entry.queuedSongs.some((song: any) => song.feedback))
            );
            console.log(`👍 Found ${entriesWithFeedback.length} entries with feedback data`);
            
            // History from server is already in chronological order (oldest first)
            // No need to reverse here since we reverse when displaying
            setCommandHistory(data.history);
          }
        }
      } catch (error) {
        console.error('Failed to load command history:', error);
      } finally {
        setCommandHistoryLoading(false);
      }
    };

    loadCommandHistory();
  }, [isAuthenticated]);

  // Redirect to landing page if not authenticated (but not if they have expired tokens)
  useEffect(() => {
    console.log('🔄 MainApp: Auth redirect check -', { checking, authLoading, isAuthenticated, authError });
    if (!checking && !authLoading && !isAuthenticated && !authError) {
      console.log('⚠️ MainApp: Redirecting to landing page');
      navigate('/landing');
    }
  }, [checking, authLoading, isAuthenticated, authError, navigate]);

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  };

  const handleFeedback = async (trackUri: string, feedback: 'loved' | 'disliked') => {
    // First check if this is a main track
    const messageIndex = commandHistory.findIndex(m => m.trackUri === trackUri);
    
    if (messageIndex !== -1) {
      // Handle main track feedback
      setCommandHistory(prev => prev.map((msg, idx) => 
        idx === messageIndex ? { ...msg, feedbackLoading: true } : msg
      ));

      try {
        const currentFeedback = commandHistory[messageIndex].feedback;
        const newFeedback = currentFeedback === feedback ? 'remove' : feedback;
        
        await api.recordFeedback(trackUri, newFeedback);
        
        setCommandHistory(prev => prev.map((msg, idx) => 
          idx === messageIndex 
            ? { 
                ...msg, 
                feedback: newFeedback === 'remove' ? undefined : feedback,
                feedbackLoading: false 
              } 
            : msg
        ));
        
        showToast(
          newFeedback === 'remove' 
            ? 'Feedback removed' 
            : `Thanks for the feedback!`
        );
      } catch (error) {
        console.error('Failed to record feedback:', error);
        setCommandHistory(prev => prev.map((msg, idx) => 
          idx === messageIndex ? { ...msg, feedbackLoading: false } : msg
        ));
      }
    } else {
      // Handle queued song feedback
      const historyItemIndex = commandHistory.findIndex(h => 
        h.queuedSongs?.some(s => s.uri === trackUri)
      );
      
      if (historyItemIndex === -1) return;
      
      const songIndex = commandHistory[historyItemIndex].queuedSongs!.findIndex(
        s => s.uri === trackUri
      );
      
      // Set loading state for queued song
      setCommandHistory(prev => prev.map((msg, idx) => {
        if (idx === historyItemIndex && msg.queuedSongs) {
          const updatedSongs = [...msg.queuedSongs];
          updatedSongs[songIndex] = { ...updatedSongs[songIndex], feedbackLoading: true };
          return { ...msg, queuedSongs: updatedSongs };
        }
        return msg;
      }));

      try {
        const currentSong = commandHistory[historyItemIndex].queuedSongs![songIndex];
        const currentFeedback = currentSong.feedback;
        const newFeedback = currentFeedback === feedback ? 'remove' : feedback;
        
        await api.recordFeedback(trackUri, newFeedback);
        
        // Update feedback for queued song
        setCommandHistory(prev => prev.map((msg, idx) => {
          if (idx === historyItemIndex && msg.queuedSongs) {
            const updatedSongs = [...msg.queuedSongs];
            updatedSongs[songIndex] = { 
              ...updatedSongs[songIndex], 
              feedback: newFeedback === 'remove' ? undefined : feedback,
              feedbackLoading: false 
            };
            return { ...msg, queuedSongs: updatedSongs };
          }
          return msg;
        }));
        
        showToast(
          newFeedback === 'remove' 
            ? 'Feedback removed' 
            : `Thanks for the feedback!`
        );
      } catch (error) {
        console.error('Failed to record feedback:', error);
        // Reset loading state on error
        setCommandHistory(prev => prev.map((msg, idx) => {
          if (idx === historyItemIndex && msg.queuedSongs) {
            const updatedSongs = [...msg.queuedSongs];
            updatedSongs[songIndex] = { ...updatedSongs[songIndex], feedbackLoading: false };
            return { ...msg, queuedSongs: updatedSongs };
          }
          return msg;
        }));
      }
    }
  };

  const handleAlternativeClick = async (alternative: { name: string; artists: string; popularity: number; uri: string }, action: 'play' | 'queue') => {
    if (isProcessing) return;
    
    try {
      setIsProcessing(true);
      
      // Use direct action endpoint to bypass LLM for known URIs
      const response = await authenticatedFetch(apiEndpoint('/api/direct/song'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          uri: alternative.uri,
          action: action,
          name: alternative.name,
          artists: alternative.artists
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      await response.json();
      
      // Don't add to command history - these are just quick actions
      // The response is already shown in the UI feedback
      
    } catch (error) {
      console.error('Alternative click error:', error);
      // Could show a toast notification here if needed
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!command.trim() || isProcessing) return;

    setIsProcessing(true);
    const userCommand = command.trim();
    setCommand('');

    try {
      const response = await authenticatedFetch(apiEndpoint('/api/llm/simple/command'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          command: userCommand
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      
      if (data.success) {
        const newMessage = {
          command: userCommand,
          response: data.response || data.message,
          confidence: data.interpretation?.confidence,
          isEnhanced: data.isEnhanced,
          timestamp: Date.now(),
          alternatives: data.interpretation?.alternatives,
          intent: data.interpretation?.intent,
          reasoning: data.interpretation?.reasoning,
          model: data.interpretation?.model || currentModel,
          interpretation: data.interpretation, // Store the full interpretation object
          queuedSongs: data.queuedSongs,
          isAIDiscovery: data.interpretation?.isAIDiscovery || false,
          trackUri: data.track?.uri,
          trackName: data.track?.name,
          artist: data.track?.artists?.map((a: any) => a.name).join(', '),
          aiReasoning: data.interpretation?.aiReasoning,
          // Clarification mode data
          clarificationOptions: data.clarificationOptions,
          currentContext: data.currentContext,
          uiType: data.uiType
        };
        
        setCommandHistory(prev => [...prev, newMessage]);
      } else {
        setCommandHistory(prev => [...prev, {
          command: userCommand,
          response: data.error || data.message || 'An error occurred',
          timestamp: Date.now(),
          confidence: data.interpretation?.confidence,
          intent: data.interpretation?.intent,
          reasoning: data.interpretation?.reasoning,
          model: data.interpretation?.model || currentModel,
          interpretation: data.interpretation, // Store the full interpretation object
          queuedSongs: data.queuedSongs
        }]);
      }
    } catch (error) {
      console.error('Command error:', error);
      setCommandHistory(prev => [...prev, {
        command: userCommand,
        response: 'Network error. Please try again.',
        timestamp: Date.now()
      }]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClearHistory = async () => {
    try {
      // Clear Redis conversation history
      const response = await authenticatedFetch(apiEndpoint('/api/claude/clear-history'), {
        method: 'POST'
      });
      
      if (response.ok) {
        // Clear local state only if Redis clear was successful
        setCommandHistory([]);
        console.log('Conversation history cleared successfully');
      } else {
        console.error('Failed to clear conversation history on server');
      }
    } catch (error) {
      console.error('Error clearing conversation history:', error);
      // Still clear local state even if server request fails
      setCommandHistory([]);
    }
  };

  const handleClarificationOption = async (direction: string, followUpQuery?: string) => {
    // Use the followUpQuery or construct one from direction
    const commandToSend = followUpQuery || `play ${direction} music`;
    
    // Set the command and trigger submit
    setCommand(commandToSend);
    setIsProcessing(true);
    
    try {
      const response = await authenticatedFetch(apiEndpoint('/api/llm/simple/command'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          command: commandToSend
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.success) {
        const newMessage = {
          command: commandToSend,
          response: data.response || data.message,
          confidence: data.interpretation?.confidence,
          isEnhanced: data.isEnhanced,
          timestamp: Date.now(),
          alternatives: data.interpretation?.alternatives,
          intent: data.interpretation?.intent,
          reasoning: data.interpretation?.reasoning,
          model: data.interpretation?.model || currentModel,
          interpretation: data.interpretation,
          queuedSongs: data.queuedSongs,
          isAIDiscovery: data.interpretation?.isAIDiscovery || false,
          trackUri: data.track?.uri,
          trackName: data.track?.name,
          artist: data.track?.artists?.map((a: any) => a.name).join(', '),
          aiReasoning: data.interpretation?.aiReasoning,
          clarificationOptions: data.clarificationOptions,
          currentContext: data.currentContext,
          uiType: data.uiType
        };
        
        setCommandHistory(prev => [...prev, newMessage]);
      } else {
        setCommandHistory(prev => [...prev, {
          command: commandToSend,
          response: data.error || data.message || 'An error occurred',
          timestamp: Date.now(),
          confidence: data.interpretation?.confidence,
          intent: data.interpretation?.intent,
          reasoning: data.interpretation?.reasoning,
          model: data.interpretation?.model || currentModel,
          interpretation: data.interpretation,
          queuedSongs: data.queuedSongs
        }]);
      }
    } catch (error) {
      console.error('Clarification command error:', error);
      setCommandHistory(prev => [...prev, {
        command: commandToSend,
        response: 'Network error. Please try again.',
        timestamp: Date.now()
      }]);
    } finally {
      setCommand(''); // Clear the input
      setIsProcessing(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 flex items-center justify-center">
        <div className="text-center">
          <MusicLoader modelName="System" />
          <p className="text-white mt-4">Connecting to server...</p>
        </div>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-white mb-4">⚠️ Connection Error</h1>
          <p className="text-gray-300 mb-8">Cannot connect to the DJ Forge backend server.</p>
          <button 
            onClick={() => window.location.reload()} 
            className="px-6 py-3 bg-green-500 text-black font-bold rounded-full hover:bg-green-400 transition-all transform hover:scale-105"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  if (!isAuthenticated && !authError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 flex items-center justify-center">
        <div className="text-center">
          <MusicLoader modelName="System" />
          <p className="text-white mt-4">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-container">
      {/* Chat Messages Container */}
      <div className="chat-messages">
        {/* Auth Error Message */}
        {authError && (
          <div className="mx-4 mt-4 bg-yellow-900/50 border border-yellow-600 rounded-lg p-4" style={{ maxWidth: '1440px', marginLeft: 'auto', marginRight: 'auto' }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <span className="text-yellow-400 mr-2">⚠️</span>
                <span className="text-yellow-200">{authError}</span>
              </div>
              <button 
                onClick={login}
                className="px-4 py-2 bg-yellow-600 text-black font-semibold rounded-full hover:bg-yellow-500 transition-colors text-sm"
              >
                Re-authenticate
              </button>
            </div>
          </div>
        )}

        {/* Playback Controls - Floating on desktop, in menu on mobile */}
        <div className="hidden md:block fixed top-20 left-1/2 -translate-x-1/2 z-10" style={{ maxWidth: '600px', width: '90%' }}>
          <div className="bg-zinc-900/95 backdrop-blur-sm border border-zinc-700 rounded-lg shadow-lg">
            <PlaybackControls onShowQueue={() => setShowQueue(true)} />
          </div>
        </div>

        {/* Messages Content */}
        <div 
          className="px-4"
          style={{ maxWidth: '1440px', margin: '0 auto', width: '100%' }}
        >
          <div ref={chatContainerRef}>
          {/* Clear History Button */}
          {commandHistory.length > 0 && (
            <div className="flex justify-end mb-4">
              <button
                onClick={handleClearHistory}
                className="text-xs text-gray-400 hover:text-red-400 transition-colors"
              >
                Clear History
              </button>
            </div>
          )}

          {/* Auth Test Panel - Only in development */}
          {process.env.NODE_ENV === 'development' && (
            <div className="mb-4">
              <AuthTestPanel />
            </div>
          )}

          {/* Messages */}
          <div className="space-y-4 pb-4">
            {commandHistoryLoading ? (
              <CommandHistorySkeleton count={3} />
            ) : commandHistory.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500 text-lg mb-4">No commands yet. Try sending a command!</p>
                <button
                  onClick={() => setShowExamplesModal(true)}
                  className="text-green-400 hover:text-green-300 text-sm font-medium"
                >
                  View Examples
                </button>
              </div>
            ) : (
              commandHistory.map((item, index) => (
                <ChatMessage
                  key={index}
                  {...item}
                  onFeedback={handleFeedback}
                  onAlternativeClick={handleAlternativeClick}
                  onClarificationOption={handleClarificationOption}
                  savedStatus={savedStatus}
                  libraryLoading={libraryLoading}
                  onToggleSave={toggleSave}
                  isProcessing={isProcessing}
                />
              ))
            )}
          </div>
          </div>
        </div>
      </div>

      {/* Chat Input */}
      <div className="chat-input-container">
        <ChatInput
        value={command}
        onChange={setCommand}
        onSubmit={handleSubmit}
        isProcessing={isProcessing}
        onShowExamples={() => setShowExamplesModal(true)}
        currentModel={currentModel}
        />
      </div>

      {/* Examples Modal */}
      {showExamplesModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-800 rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">Command Examples</h2>
              <button 
                onClick={() => setShowExamplesModal(false)}
                className="text-gray-400 hover:text-white text-xl"
              >
                ×
              </button>
            </div>
            
            <div className="grid md:grid-cols-3 gap-6">
              <div>
                <h3 className="text-lg font-semibold mb-3 text-green-400">Basic Playback</h3>
                <ExampleList examples={[
                  "Play",
                  "Pause",
                  "Resume",
                  "Stop the music",
                  "Skip this song",
                  "Next track",
                  "Previous song",
                  "Go back",
                  "Restart this song",
                  "Set volume to 50%",
                  "Volume up",
                  "Volume down",
                  "Mute",
                  "Turn on shuffle",
                  "Turn off repeat",
                  "What's playing?",
                  "What song is this?"
                ]} />
              </div>
              
              <div>
                <h3 className="text-lg font-semibold mb-3 text-green-400">Search & Play Specific</h3>
                <ExampleList examples={[
                  "Play Bohemian Rhapsody by Queen",
                  "Play Like a Rolling Stone by Bob Dylan",
                  "Play the Beatles",
                  "Play Taylor Swift",
                  "Play some Pink Floyd",
                  "Play Radiohead's OK Computer album",
                  "Play my Discover Weekly playlist",
                  "Play my Release Radar",
                  "Play my Daily Mix 1",
                  "Play my liked songs",
                  "Play my saved tracks",
                  "Play that song from Inception",
                  "Play the Interstellar soundtrack",
                  "Play the Friends theme song",
                  "Play Happy Birthday",
                  "Play the song that goes 'na na na hey hey goodbye'"
                ]} />
              </div>
              
              <div>
                <h3 className="text-lg font-semibold mb-3 text-green-400">Queue Management</h3>
                <ExampleList examples={[
                  "Add Hotel California to the queue",
                  "Queue some rock music",
                  "Add Taylor Swift to the queue",
                  "Queue the entire Dark Side of the Moon album",
                  "Add some Beatles to queue",
                  "Queue up some party music",
                  "Clear the queue",
                  "Show me the queue",
                  "What's in my queue?",
                  "Remove the last song from queue",
                  "Skip to the next song in queue"
                ]} />
              </div>
            </div>
            
            <div className="grid md:grid-cols-3 gap-6 mt-6">
              <div>
                <h3 className="text-lg font-semibold mb-3 text-green-400">Mood & Genre</h3>
                <ExampleList examples={[
                  "Play some jazz",
                  "Play classical music",
                  "Play some blues",
                  "Play 80s rock",
                  "Play 90s hip hop",
                  "Play modern pop",
                  "Play indie rock",
                  "Play electronic music",
                  "Play some house music",
                  "Play reggae",
                  "Play some funk",
                  "Play country music",
                  "Play metal",
                  "Play some punk rock",
                  "Play K-pop",
                  "Play Latin music"
                ]} />
              </div>
              
              <div>
                <h3 className="text-lg font-semibold mb-3 text-green-400">Activity & Context</h3>
                <ExampleList examples={[
                  "Play workout music",
                  "Play music for studying",
                  "Play relaxing music",
                  "Play meditation music",
                  "Play party music",
                  "Play dinner party music",
                  "Play music for coding",
                  "Play music for sleeping",
                  "Play energetic music",
                  "Play music for running",
                  "Play background music",
                  "Play music for reading",
                  "Play coffee shop music",
                  "Play road trip music",
                  "Play music for cleaning",
                  "Play Friday night music"
                ]} />
              </div>
              
              <div>
                <h3 className="text-lg font-semibold mb-3 text-green-400">Discovery & Obscure</h3>
                <ExampleList examples={[
                  "Play something new",
                  "Play something I might like",
                  "Play obscure Beatles tracks",
                  "Play deep cuts by Pink Floyd",
                  "Play lesser known Radiohead songs",
                  "Play Bob Dylan B-sides",
                  "Play rare Led Zeppelin tracks",
                  "Play underground hip hop",
                  "Play something nobody knows",
                  "Play hidden gems from the 70s",
                  "Play forgotten 80s hits",
                  "Play indie artists I should know",
                  "Play the most obscure Taylor Swift song",
                  "Play underrated jazz albums",
                  "Play cult classic songs",
                  "Surprise me with something good"
                ]} />
              </div>
            </div>
            
            <div className="grid md:grid-cols-3 gap-6 mt-6">
              <div>
                <h3 className="text-lg font-semibold mb-3 text-green-400">Time-Based</h3>
                <ExampleList examples={[
                  "Play music from the 60s",
                  "Play 70s rock",
                  "Play 80s hits",
                  "Play 90s alternative",
                  "Play early 2000s pop",
                  "Play music from 2010",
                  "Play this year's hits",
                  "Play last year's top songs",
                  "Play summer hits from 2020",
                  "Play Christmas music",
                  "Play Halloween songs",
                  "Play music from my birth year",
                  "Play throwback Thursday music",
                  "Play music from high school",
                  "Play nostalgic 2000s music",
                  "Play vintage jazz"
                ]} />
              </div>
              
              <div>
                <h3 className="text-lg font-semibold mb-3 text-green-400">Similarity & Vibes</h3>
                <ExampleList examples={[
                  "Play something like Bohemian Rhapsody",
                  "Play artists similar to Radiohead",
                  "Play music that sounds like rain",
                  "Play songs with a similar vibe",
                  "Play more like this",
                  "Play something completely different",
                  "Play music like what's playing but slower",
                  "Play upbeat versions of sad songs",
                  "Play acoustic versions",
                  "Play live versions",
                  "Play remixes of this song",
                  "Play covers of Beatles songs",
                  "Play the original version not remastered",
                  "Play music that sounds like the ocean",
                  "Play songs that remind me of summer",
                  "Play music with no lyrics"
                ]} />
              </div>
              
              <div>
                <h3 className="text-lg font-semibold mb-3 text-green-400">Smart & Complex</h3>
                <ExampleList examples={[
                  "Play that song from the desert scene in Breaking Bad",
                  "Play the song from the Stranger Things finale",
                  "Play upbeat 80s music but not the hits",
                  "Play melancholy music for a rainy day",
                  "Play something my ex would hate",
                  "Play music to match the weather outside",
                  "Play songs about New York City",
                  "Play breakup songs but make them happy",
                  "Play songs with amazing guitar solos",
                  "Play one hit wonders from the 90s",
                  "Play songs that are exactly 3 minutes long",
                  "Play music in 3/4 time",
                  "Play songs produced by Rick Rubin",
                  "Play collaborations between unlikely artists",
                  "Play songs that sample classical music",
                  "Play music that tells a story"
                ]} />
              </div>
            </div>
            
            <div className="mt-6 text-center">
              <p className="text-gray-400 text-sm">
                Click any example to copy it to your clipboard
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-4 right-4 bg-zinc-800 text-white px-4 py-2 rounded-lg shadow-lg animate-[slideIn_0.3s_ease-out]">
          {toast}
        </div>
      )}

      {/* Queue Display Modal - Rendered at root level to avoid z-index issues */}
      {showQueue && <QueueDisplay onClose={() => setShowQueue(false)} />}
    </div>
  );
};

export default MainApp;