import { useState, useEffect, useRef } from 'react';
import { useMusicWebSocket, PlaybackUpdate } from '../hooks/useMusicWebSocket';
import { SpotifyTrack } from '../types/websocket.types';

interface MusicEvent {
  id: string;
  type: 'track' | 'queue' | 'command' | 'volume' | 'device' | 'state';
  title: string;
  description: string;
  timestamp: number;
  source: 'user' | 'ai' | 'auto' | 'keyboard_shortcut' | 'control_endpoint';
  track?: SpotifyTrack;
  confidence?: number;
  success?: boolean;
  endpoint?: string;
}

interface MusicEventLogProps {
  className?: string;
  maxEvents?: number;
  showToggle?: boolean;
}

function MusicEventLog({ 
  className = '', 
  maxEvents = 20, 
  showToggle = true 
}: MusicEventLogProps) {
  const [events, setEvents] = useState<MusicEvent[]>([]);
  const [isVisible, setIsVisible] = useState(false);
  const eventIdCounter = useRef(0);
  const logRef = useRef<HTMLDivElement>(null);

  // Generate unique event ID
  const generateEventId = (): string => {
    eventIdCounter.current += 1;
    return `event-${Date.now()}-${eventIdCounter.current}`;
  };

  // Add new event to the log
  const addEvent = (update: PlaybackUpdate) => {
    const event = formatEvent(update);
    if (event) {
      setEvents(prev => {
        const updated = [event, ...prev];
        return updated.slice(0, maxEvents);
      });
    }
  };

  // Format playback update into display event
  const formatEvent = (update: PlaybackUpdate): MusicEvent | null => {
    const { type, data, timestamp } = update;
    
    switch (type) {
      case 'state':
        const playPauseEndpoint = data.isPlaying ? '/play' : '/pause';
        return {
          id: generateEventId(),
          type: 'state',
          title: data.isPlaying ? 'Playback Started' : 'Playback Paused',
          description: data.source === 'keyboard_shortcut' ? 'Via keyboard shortcut' : 'Via control',
          timestamp,
          source: data.source || 'control_endpoint',
          endpoint: data.endpoint || playPauseEndpoint
        };
        
      case 'track':
        return {
          id: generateEventId(),
          type: 'track',
          title: `Now Playing: ${data.track?.name || data.current?.name || 'Unknown'}`,
          description: `by ${data.track?.artist || data.current?.artists || 'Unknown Artist'}`,
          timestamp,
          source: data.source || 'auto',
          track: data.track || data.current,
          endpoint: data.endpoint || (data.source === 'keyboard_shortcut' ? '/next or /previous' : undefined)
        };
        
      case 'queue':
        const actionText = data.action === 'added' ? 'Added to' : 
                          data.action === 'removed' ? 'Removed from' : 'Cleared';
        return {
          id: generateEventId(),
          type: 'queue',
          title: `${actionText} Queue`,
          description: data.action === 'cleared' ? 'Queue cleared' : 
                      `${data.totalItems || 0} tracks in queue`,
          timestamp,
          source: data.source || 'auto'
        };
        
      case 'volume':
        return {
          id: generateEventId(),
          type: 'volume',
          title: 'Volume Changed',
          description: `Set to ${data.volume}%${data.source === 'keyboard_shortcut' ? ' via keyboard' : ''}`,
          timestamp,
          source: data.source || 'user',
          endpoint: data.endpoint || '/volume'
        };
        
      case 'device':
        return {
          id: generateEventId(),
          type: 'device',
          title: 'Device Changed',
          description: `Switched to ${data.currentDevice}`,
          timestamp,
          source: 'user'
        };
        
      default:
        return null;
    }
  };

  // Handle command executed events separately
  const handleCommandExecuted = (data: any) => {
    // Special handling for shuffle command from keyboard
    const isShuffleKeyboard = data.intent === 'set_shuffle' && data.source === 'keyboard_shortcut';
    
    const event: MusicEvent = {
      id: generateEventId(),
      type: 'command',
      title: isShuffleKeyboard ? `Shuffle ${data.metadata?.enabled ? 'On' : 'Off'}` : 
             data.success ? 'Command Executed' : 'Command Failed',
      description: isShuffleKeyboard ? 'Via keyboard shortcut' :
                  data.confidence ? `${data.intent} (${Math.round(data.confidence * 100)}%)` : data.intent,
      timestamp: data.timestamp,
      source: data.source || 'ai',
      confidence: data.confidence,
      success: data.success,
      endpoint: data.endpoint || (isShuffleKeyboard ? '/shuffle' : '/llm/simple/command')
    };
    
    setEvents(prev => {
      const updated = [event, ...prev];
      return updated.slice(0, maxEvents);
    });
  };

  // Set up WebSocket connection
  const { connected, lastUpdate } = useMusicWebSocket(
    (data) => addEvent({ type: 'state', data, timestamp: Date.now() }), // Playback state changes
    (data) => addEvent({ type: 'track', data, timestamp: Date.now() }),
    (data) => addEvent({ type: 'queue', data, timestamp: Date.now() }),
    handleCommandExecuted
  );

  // Handle volume, device, and state updates
  useEffect(() => {
    if (lastUpdate) {
      if (lastUpdate.type === 'volume' || lastUpdate.type === 'device' || lastUpdate.type === 'state') {
        addEvent(lastUpdate);
      }
    }
  }, [lastUpdate]);

  // Auto-scroll to top when new events arrive
  useEffect(() => {
    if (isVisible && logRef.current) {
      logRef.current.scrollTop = 0;
    }
  }, [events.length, isVisible]);

  // Format timestamp for display
  const formatTime = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit'
    });
  };

  // Get icon for event type
  const getEventIcon = (event: MusicEvent): string => {
    // Special icon for keyboard shortcuts
    if (event.source === 'keyboard_shortcut') {
      return '⌨️';
    }
    
    switch (event.type) {
      case 'state': return event.title.includes('Started') ? '▶️' : '⏸️';
      case 'track': return '🎵';
      case 'queue': return '📄';
      case 'command': return event.success !== false ? '✅' : '❌';
      case 'volume': return '🔊';
      case 'device': return '📱';
      default: return '•';
    }
  };

  // Get color class for event source
  const getSourceColor = (source: string): string => {
    switch (source) {
      case 'ai': return 'text-blue-400';
      case 'user': return 'text-green-400';
      case 'keyboard_shortcut': return 'text-purple-400';
      case 'control_endpoint': return 'text-yellow-400';
      default: return 'text-gray-400';
    }
  };

  if (!showToggle && !isVisible) {
    return null;
  }

  return (
    <div className={`fixed bottom-4 left-4 z-50 ${className}`}>
      {/* Toggle Button */}
      {showToggle && (
        <button
          onClick={() => setIsVisible(!isVisible)}
          className={`mb-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
            connected 
              ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30' 
              : 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
          }`}
          title={connected ? 'Music events connected' : 'Music events disconnected'}
        >
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${
              connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'
            }`} />
            Music Events ({events.length})
          </div>
        </button>
      )}

      {/* Event Log Panel */}
      {isVisible && (
        <div className="w-80 h-96 bg-zinc-900/95 backdrop-blur-sm rounded-lg border border-zinc-700/50 shadow-xl animate-slideUp">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-zinc-700/50">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${
                connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'
              }`} />
              <h3 className="text-sm font-medium text-white">Live Music Events</h3>
            </div>
            {showToggle && (
              <button
                onClick={() => setIsVisible(false)}
                className="text-gray-400 hover:text-white transition-colors"
                title="Close"
              >
                ✕
              </button>
            )}
          </div>

          {/* Event List */}
          <div 
            ref={logRef}
            className="flex-1 overflow-y-auto p-2 space-y-2 max-h-80"
          >
            {events.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-gray-500 text-sm">
                {connected ? 'Waiting for music events...' : 'Not connected'}
              </div>
            ) : (
              events.map((event, index) => (
                <div
                  key={event.id}
                  className="p-3 bg-zinc-800/50 rounded-lg border border-zinc-700/30 hover:bg-zinc-800/70 transition-colors animate-slideIn"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className="flex items-start gap-3">
                    {/* Icon */}
                    <span className="text-lg flex-shrink-0 mt-0.5">
                      {getEventIcon(event)}
                    </span>
                    
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="text-sm font-medium text-white truncate">
                          {event.title}
                        </h4>
                        <span className="text-xs text-gray-500 flex-shrink-0">
                          {formatTime(event.timestamp)}
                        </span>
                      </div>
                      
                      <p className="text-xs text-gray-400 mt-1 line-clamp-2">
                        {event.description}
                      </p>
                      
                      {/* Source, endpoint and confidence */}
                      <div className="flex items-center gap-2 mt-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full bg-zinc-700/50 ${getSourceColor(event.source)}`}>
                          {event.source === 'keyboard_shortcut' ? 'keyboard' : 
                           event.source === 'control_endpoint' ? 'control' :
                           event.source}
                        </span>
                        
                        {event.endpoint && (
                          <span className="text-xs text-gray-500 font-mono">
                            {event.endpoint}
                          </span>
                        )}
                        
                        {event.confidence !== undefined && (
                          <span className="text-xs text-gray-500">
                            {Math.round(event.confidence * 100)}%
                          </span>
                        )}
                        
                        {event.success === false && (
                          <span className="text-xs text-red-400 bg-red-500/20 px-2 py-0.5 rounded-full">
                            Failed
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default MusicEventLog;