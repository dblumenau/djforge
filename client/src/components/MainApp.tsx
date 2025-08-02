import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import MusicLoader from './MusicLoader';
import PlaybackControls from './PlaybackControls';
import WebPlayerControls from './WebPlayerControls';
import CommandHistorySkeleton from './skeletons/CommandHistorySkeleton';
import ChatMessage from './ChatMessage';
import ChatInput from './ChatInput';
import QueueDisplay from './QueueDisplay';
import WebPlayerAutoInit from './WebPlayerAutoInit';
import MusicEventLog from './MusicEventLog';
import { useAuth } from '../contexts/AuthContext';
import { useTrackLibrary } from '../hooks/useTrackLibrary';
import { useIOSKeyboardFix } from '../hooks/useIOSKeyboardFix';
import { useWebPlayer } from '../hooks/useWebPlayer';
import { apiEndpoint } from '../config/api';
import { authenticatedFetch, api } from '../utils/temp-auth';
import { useModel } from '../contexts/ModelContext';
// import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";

// Helper component for clickable example lists
const ExampleList: React.FC<{ examples: string[]; onSelectExample: (example: string) => void }> = ({ examples, onSelectExample }) => {
  const handleClick = (text: string) => {
    onSelectExample(text);
  };
  
  return (
    <ul className="space-y-2 text-gray-400 text-sm">
      {examples.map((example, index) => (
        <li 
          key={index}
          className="hover:text-green-400 cursor-pointer transition-colors"
          onClick={() => handleClick(example)}
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
  const typeAnimationRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useIOSKeyboardFix();
  const { currentModel } = useModel();
  const [showExamplesModal, setShowExamplesModal] = useState(false);
  const [showQueue, setShowQueue] = useState(false);
  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [checking, setChecking] = useState(true);
  const [command, setCommand] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
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
  const [devicePreference, setDevicePreference] = useState<string>('auto');
  const [userProfile, setUserProfile] = useState<{ images?: Array<{ url: string }> } | null>(null);
  const [showWebPlayer, setShowWebPlayer] = useState(false);
  // Note: Access token is now handled internally by the auth service
  
  // Authentication
  const { isAuthenticated, loading: authLoading } = useAuth();
  
  // Track device preference from localStorage
  useEffect(() => {
    const checkDevicePreference = () => {
      const savedPreference = localStorage.getItem('spotifyDevicePreference') || 'auto';
      console.log('[MainApp] Checking device preference - saved:', savedPreference);
      setDevicePreference(savedPreference);
    };
    
    // Check initially
    checkDevicePreference();
    
    // Listen for storage changes (from DeviceSelector in header)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'spotifyDevicePreference') {
        console.log('[MainApp] Device preference changed via storage event');
        checkDevicePreference();
      }
    };
    
    // Listen for custom device change events (from DeviceSelector in same tab)
    const handleDeviceChange = (e: CustomEvent) => {
      console.log('[MainApp] Device changed via custom event:', e.detail);
      checkDevicePreference();
    };
    
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('device-changed', handleDeviceChange as EventListener);
    window.addEventListener('devicePreferenceChanged', checkDevicePreference);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('device-changed', handleDeviceChange as EventListener);
      window.removeEventListener('devicePreferenceChanged', checkDevicePreference);
    };
  }, []); // Empty dependency array means this effect only runs once
  
  // Initialize web player on mount and handle device preference changes
  useEffect(() => {
    // Initialize web player on mount (but don't transfer playback)
    if (isAuthenticated) {
      console.log('[MainApp] Initializing web player service...');
      // Import dynamically to avoid circular dependency
      import('../services/webPlayer.service').then(({ webPlayerService }) => {
        webPlayerService.initialize().catch(err => {
          console.error('[MainApp] Failed to initialize web player on mount:', err);
        });
      });
    }
  }, [isAuthenticated]);

  // Update showWebPlayer based on device preference
  useEffect(() => {
    const shouldShowWebPlayer = devicePreference === 'web-player';
    console.log('[MainApp] Device preference effect:', {
      devicePreference,
      shouldShowWebPlayer,
      currentShowWebPlayer: showWebPlayer
    });
    
    // Force immediate state update
    setShowWebPlayer(shouldShowWebPlayer);
    
    if (!shouldShowWebPlayer) {
      // Import dynamically to avoid circular dependency
      import('../services/webPlayer.service').then(({ webPlayerService }) => {
        if (webPlayerService.isReady()) {
          console.log('[MainApp] Device preference changed away from web-player, disconnecting...');
          webPlayerService.disconnect();
        }
      });
    }
  }, [devicePreference]);
  
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

  // Memoize callbacks to prevent infinite loops - MUST be defined before any conditional returns
  const handleWebPlayerReady = useCallback((deviceId: string) => {
    console.log('[MainApp] Web Player device ready:', deviceId);
    console.log('[MainApp] Web Player ready!');
    // You could update UI state or perform other actions when the web player is ready
  }, []);

  // Initialize web player with device ready callback
  const { playerState: webPlayerState } = useWebPlayer(handleWebPlayerReady);
  
  // Handle player state changes
  useEffect(() => {
    // Only log significant changes to avoid console spam
    if (webPlayerState.currentTrack?.uri) {
      // Track changed
    }
  }, [webPlayerState.currentTrack?.uri]);

  // Cleanup animation on unmount
  useEffect(() => {
    return () => {
      if (typeAnimationRef.current) {
        clearTimeout(typeAnimationRef.current);
      }
    };
  }, []);

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

  // Authentication is now handled by useAuth hook automatically

  // Function to scroll to bottom
  const scrollToBottom = () => {
    // Find the chat-messages container
    const scrollElement = document.querySelector('.chat-messages');
    const chatInput = document.querySelector('.chat-input-container');
    
    if (scrollElement && chatInput) {
      // Get the actual height of the chat input container
      const inputHeight = chatInput.getBoundingClientRect().height;
      
      // Set a CSS variable for the actual input height
      document.documentElement.style.setProperty('--chat-input-height', `${inputHeight}px`);
      
      // Scroll to the bottom
      scrollElement.scrollTop = scrollElement.scrollHeight;
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

  // Monitor chat input height changes
  useEffect(() => {
    const chatInput = document.querySelector('.chat-input-container');
    if (!chatInput) return;

    const resizeObserver = new ResizeObserver(() => {
      const inputHeight = chatInput.getBoundingClientRect().height;
      document.documentElement.style.setProperty('--chat-input-height', `${inputHeight}px`);
    });

    resizeObserver.observe(chatInput);

    return () => {
      resizeObserver.disconnect();
    };
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

  // Load user profile when authenticated
  useEffect(() => {
    const loadUserProfile = async () => {
      if (!isAuthenticated) return;
      
      // Check if profile is already cached in localStorage
      const cachedProfile = localStorage.getItem('spotify_user_profile');
      if (cachedProfile) {
        try {
          const profile = JSON.parse(cachedProfile);
          setUserProfile(profile);
          console.log('👤 Loaded user profile from cache');
          return;
        } catch (e) {
          // Invalid cache, continue to fetch
        }
      }
      
      try {
        const response = await authenticatedFetch(apiEndpoint('/api/user-data/dashboard'));
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data?.profile) {
            setUserProfile(data.data.profile);
            // Cache the profile data for future page loads
            localStorage.setItem('spotify_user_profile', JSON.stringify(data.data.profile));
            console.log('👤 Loaded user profile with avatar and cached it');
          }
        }
      } catch (error) {
        console.error('❌ Error loading user profile:', error);
      }
    };
    loadUserProfile();
  }, [isAuthenticated]);

  // Keyboard shortcuts for playback control
  useEffect(() => {
    if (!isAuthenticated) return;

    const handleKeyPress = async (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in input fields
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      // Debug logging
      if (e.key === ' ') {
        console.log('[Keyboard] Spacebar pressed, target:', e.target);
      }

      let endpoint = '';
      let method = 'POST';
      
      switch(e.key) {
        case ' ': // Spacebar - Play/Pause
          e.preventDefault(); // Prevent page scroll
          console.log('[Keyboard] Triggering play/pause');
          endpoint = 'PLAY_PAUSE_TOGGLE';
          break;
        case 'MediaPlayPause':
          e.preventDefault();
          endpoint = 'PLAY_PAUSE_TOGGLE';
          break;
        case 'MediaStop':
          e.preventDefault();
          endpoint = '/api/control/pause';
          break;
        case 'MediaTrackNext':
          e.preventDefault();
          endpoint = '/api/control/next';
          break;
        case 'ArrowRight':
          if (e.shiftKey) {
            e.preventDefault();
            endpoint = '/api/control/next';
          }
          break;
        case 'MediaTrackPrevious':
          e.preventDefault();
          endpoint = '/api/control/previous';
          break;
        case 'ArrowLeft':
          if (e.shiftKey) {
            e.preventDefault();
            endpoint = '/api/control/previous';
          }
          break;
        case 'ArrowUp':
          if (e.shiftKey) {
            endpoint = '/api/control/volume';
            method = 'POST';
            // Volume up by 10%
            break;
          }
          return;
        case 'ArrowDown':
          if (e.shiftKey) {
            endpoint = '/api/control/volume';
            method = 'POST';
            // Volume down by 10%
            break;
          }
          return;
        case 's':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            endpoint = '/api/control/shuffle';
          }
          break;
        case 'm':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            endpoint = '/api/control/mute';
          }
          break;
        case '?':
        case '/':
          if (e.shiftKey || e.key === '?') {
            e.preventDefault();
            setShowKeyboardShortcuts(true);
            return;
          }
          break;
        default:
          return;
      }

      if (!endpoint) return;

      try {
        // Special handling for play/pause toggle
        if (endpoint === 'PLAY_PAUSE_TOGGLE') {
          // Get current playback state
          const stateResponse = await authenticatedFetch(apiEndpoint('/api/control/current-track'));
          if (stateResponse.ok) {
            const data = await stateResponse.json();
            const isPlaying = data.isPlaying || false;
            const toggleEndpoint = isPlaying ? '/api/control/pause' : '/api/control/play';
            
            console.log('[Keyboard] Current playing state:', isPlaying, '-> Using endpoint:', toggleEndpoint);
            
            await authenticatedFetch(apiEndpoint(toggleEndpoint), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ source: 'keyboard_shortcut' })
            });
          } else {
            console.error('[Keyboard] Failed to get current track state');
          }
        } else if (endpoint === '/api/control/volume') {
          // Get current volume first
          const stateResponse = await authenticatedFetch(apiEndpoint('/api/control/current-track'));
          if (stateResponse.ok) {
            const data = await stateResponse.json();
            const currentVolume = data.volume || 50;
            const newVolume = e.key === 'ArrowUp' 
              ? Math.min(100, currentVolume + 10)
              : Math.max(0, currentVolume - 10);
            
            console.log('[Keyboard] Volume change:', currentVolume, '->', newVolume);
            
            await authenticatedFetch(apiEndpoint('/api/control/volume'), {
              method,
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ volume: newVolume, source: 'keyboard_shortcut' })
            });
          }
        } else if (endpoint === '/api/control/mute') {
          // Mute toggles volume to 0 or restores to previous
          const stateResponse = await authenticatedFetch(apiEndpoint('/api/control/current-track'));
          if (stateResponse.ok) {
            const data = await stateResponse.json();
            const currentVolume = data.volume || 50;
            const newVolume = currentVolume > 0 ? 0 : 50; // Toggle between 0 and 50
            
            console.log('[Keyboard] Mute toggle:', currentVolume, '->', newVolume);
            
            await authenticatedFetch(apiEndpoint('/api/control/volume'), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ volume: newVolume, source: 'keyboard_shortcut' })
            });
          }
        } else if (endpoint === '/api/control/shuffle') {
          // Get current shuffle state and toggle it
          const stateResponse = await authenticatedFetch(apiEndpoint('/api/control/current-track'));
          if (stateResponse.ok) {
            const data = await stateResponse.json();
            const currentShuffle = data.shuffleState || false;
            const newShuffle = !currentShuffle;
            
            console.log('[Keyboard] Shuffle toggle:', currentShuffle, '->', newShuffle);
            
            await authenticatedFetch(apiEndpoint('/api/control/shuffle'), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ enabled: newShuffle, source: 'keyboard_shortcut' })
            });
          }
        } else {
          // Regular playback control commands (next, previous)
          await authenticatedFetch(apiEndpoint(endpoint), {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ source: 'keyboard_shortcut' })
          });
        }
        
        // Trigger a playback state refresh after action
        window.dispatchEvent(new CustomEvent('playback-action'));
      } catch (error) {
        console.error('Keyboard shortcut error:', error);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => {
      window.removeEventListener('keydown', handleKeyPress);
    };
  }, [isAuthenticated, setShowKeyboardShortcuts]);

  // Show "Everything is ready!" toast when app is fully loaded
  // useEffect(() => {
  //   if (isAuthenticated && !commandHistoryLoading && !checking && !authLoading) {
  //     // Small delay to ensure everything is rendered
  //     const timer = setTimeout(() => {
  //       toast.success("Everything is ready for you! 🎵");
  //       
  //       // TEST: Show all toast types
  //       setTimeout(() => toast.error("This is an error toast"), 500);
  //       setTimeout(() => toast.warning("This is a warning toast"), 1000);
  //       setTimeout(() => toast.info("This is an info toast"), 1500);
  //       setTimeout(() => toast("This is a default toast"), 2000);
  //     }, 1000);
  //     
  //     return () => clearTimeout(timer);
  //   }
  // }, [isAuthenticated, commandHistoryLoading, checking, authLoading]);

  // Redirect to landing page if not authenticated (but not if they have expired tokens)
  useEffect(() => {
    console.log('🔄 MainApp: Auth redirect check -', { checking, authLoading, isAuthenticated });
    if (!checking && !authLoading && !isAuthenticated) {
      console.log('⚠️ MainApp: Redirecting to landing page');
      navigate('/landing');
    }
  }, [checking, authLoading, isAuthenticated, navigate]);

  // Listen for device change events
  useEffect(() => {
    const handleDeviceChanged = (event: CustomEvent) => {
      const { success, device, error } = event.detail;
      
      if (success) {
        console.log('[MainApp] Device changed to:', device);
      } else {
        console.error('[MainApp] Failed to change device:', error);
      }
    };

    window.addEventListener('device-changed', handleDeviceChanged as EventListener);
    return () => {
      window.removeEventListener('device-changed', handleDeviceChanged as EventListener);
    };
  }, []);

  // Typing animation function
  const animateTyping = (text: string, onComplete?: () => void) => {
    // Clear any existing animation
    if (typeAnimationRef.current) {
      clearTimeout(typeAnimationRef.current);
    }
    
    // Clear the input first
    setCommand('');
    
    let currentIndex = 0;
    const typeNextChar = () => {
      if (currentIndex < text.length) {
        setCommand(text.slice(0, currentIndex + 1));
        currentIndex++;
        typeAnimationRef.current = setTimeout(typeNextChar, 40); // 40ms per character
      } else {
        // Typing complete
        typeAnimationRef.current = null;
        onComplete?.();
      }
    };
    
    // Start typing
    typeNextChar();
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
        
        console.log(
          newFeedback === 'remove' 
            ? 'Feedback removed' 
            : 'Thanks for the feedback!'
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
        
        console.log(
          newFeedback === 'remove' 
            ? 'Feedback removed' 
            : 'Thanks for the feedback!'
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

  if (!isAuthenticated) {
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
      {/* Auto-initialize Web Player SDK (invisible) */}
      {isAuthenticated && <WebPlayerAutoInit />}
      
      
      {/* Chat Messages Container */}
      <div className="chat-messages">
        {/* Auth errors are now handled by redirect to /landing */}

        {/* Playback Controls or Web Player - Floating on desktop, in menu on mobile */}
        <div className="hidden md:block fixed top-20 left-1/2 -translate-x-1/2 z-10" style={{ maxWidth: '600px', width: '90%' }}>
          {showWebPlayer ? (
            <WebPlayerControls
              key="web-player-controls"
              className="w-full"
            />
          ) : (
            <PlaybackControls 
              key="playback-controls"
              onShowQueue={() => setShowQueue(true)} 
              devicePreference={devicePreference}
            />
          )}
        </div>

        {/* Messages Content */}
        <div 
          className="px-3 md:px-4"
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

          {/* Messages */}
          <div className="space-y-4 mb-1 md:mb-32">
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
                  userAvatar={userProfile?.images?.[0]?.url}
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
      <ChatInput
        value={command}
        onChange={setCommand}
        onSubmit={handleSubmit}
        isProcessing={isProcessing}
        onShowExamples={() => setShowExamplesModal(true)}
        onShowKeyboardShortcuts={() => setShowKeyboardShortcuts(true)}
        currentModel={currentModel}
      />

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
                <ExampleList 
                  onSelectExample={(example) => {
                    setShowExamplesModal(false);
                    setTimeout(() => {
                      animateTyping(example);
                    }, 100);
                  }}
                  examples={[
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
                <ExampleList 
                  onSelectExample={(example) => {
                    setShowExamplesModal(false);
                    setTimeout(() => {
                      animateTyping(example);
                    }, 100);
                  }}
                  examples={[
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
                <ExampleList 
                  onSelectExample={(example) => {
                    setShowExamplesModal(false);
                    setTimeout(() => {
                      animateTyping(example);
                    }, 100);
                  }}
                  examples={[
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
                <ExampleList 
                  onSelectExample={(example) => {
                    setShowExamplesModal(false);
                    setTimeout(() => {
                      animateTyping(example);
                    }, 100);
                  }}
                  examples={[
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
                <ExampleList 
                  onSelectExample={(example) => {
                    setShowExamplesModal(false);
                    setTimeout(() => {
                      animateTyping(example);
                    }, 100);
                  }}
                  examples={[
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
                <ExampleList 
                  onSelectExample={(example) => {
                    setShowExamplesModal(false);
                    setTimeout(() => {
                      animateTyping(example);
                    }, 100);
                  }}
                  examples={[
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
                <ExampleList 
                  onSelectExample={(example) => {
                    setShowExamplesModal(false);
                    setTimeout(() => {
                      animateTyping(example);
                    }, 100);
                  }}
                  examples={[
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
                <ExampleList 
                  onSelectExample={(example) => {
                    setShowExamplesModal(false);
                    setTimeout(() => {
                      animateTyping(example);
                    }, 100);
                  }}
                  examples={[
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
                <ExampleList 
                  onSelectExample={(example) => {
                    setShowExamplesModal(false);
                    setTimeout(() => {
                      animateTyping(example);
                    }, 100);
                  }}
                  examples={[
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
                Click any example to use it as your command
              </p>
            </div>
          </div>
        </div>
      )}


      {/* Keyboard Shortcuts Modal */}
      {showKeyboardShortcuts && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-800 rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">Keyboard Shortcuts</h2>
              <button 
                onClick={() => setShowKeyboardShortcuts(false)}
                className="text-gray-400 hover:text-white text-xl"
              >
                ×
              </button>
            </div>
            
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-3 text-green-400">Playback Control</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Play/Pause</span>
                    <kbd className="px-2 py-1 bg-zinc-700 rounded text-white">Space</kbd>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Next Track</span>
                    <kbd className="px-2 py-1 bg-zinc-700 rounded text-white">Shift + →</kbd>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Previous Track</span>
                    <kbd className="px-2 py-1 bg-zinc-700 rounded text-white">Shift + ←</kbd>
                  </div>
                </div>
              </div>
              
              <div>
                <h3 className="text-lg font-semibold mb-3 text-green-400">Volume Control</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Volume Up (+10%)</span>
                    <kbd className="px-2 py-1 bg-zinc-700 rounded text-white">Shift + ↑</kbd>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Volume Down (-10%)</span>
                    <kbd className="px-2 py-1 bg-zinc-700 rounded text-white">Shift + ↓</kbd>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Mute/Unmute</span>
                    <div>
                      <kbd className="px-2 py-1 bg-zinc-700 rounded text-white">Cmd/Ctrl</kbd>
                      <span className="mx-1">+</span>
                      <kbd className="px-2 py-1 bg-zinc-700 rounded text-white">M</kbd>
                    </div>
                  </div>
                </div>
              </div>
              
              <div>
                <h3 className="text-lg font-semibold mb-3 text-green-400">Playback Modes</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Toggle Shuffle</span>
                    <div>
                      <kbd className="px-2 py-1 bg-zinc-700 rounded text-white">Cmd/Ctrl</kbd>
                      <span className="mx-1">+</span>
                      <kbd className="px-2 py-1 bg-zinc-700 rounded text-white">S</kbd>
                    </div>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Toggle Repeat</span>
                    <span className="text-gray-500 italic">Use playback controls</span>
                  </div>
                </div>
              </div>
              
              <div>
                <h3 className="text-lg font-semibold mb-3 text-green-400">Help</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Show Keyboard Shortcuts</span>
                    <kbd className="px-2 py-1 bg-zinc-700 rounded text-white">?</kbd>
                  </div>
                </div>
              </div>
              
              <div className="mt-6 p-4 bg-zinc-700 rounded-lg">
                <p className="text-xs text-gray-400">
                  <strong>Note:</strong> Media keys (if available on your keyboard) are also supported for playback control.
                  Shortcuts are disabled when typing in input fields.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Queue Display Modal - Rendered at root level to avoid z-index issues */}
      {showQueue && <QueueDisplay onClose={() => setShowQueue(false)} />}
      
      {/* Music Event Log - Show real-time music events */}
      <MusicEventLog />
      
      {/* Toast Notifications */}
      <Toaster />
    </div>
  );
};

export default MainApp;