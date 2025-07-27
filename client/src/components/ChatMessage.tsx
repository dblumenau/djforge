import React from 'react';
import HeartIcon from './HeartIcon';
import ClarificationOptions from './ClarificationOptions';
import ModelIcon from './ModelIcon';

interface Alternative {
  name: string;
  artists: string;
  popularity: number;
  uri: string;
}

interface QueuedSong {
  name: string;
  artists: string;
  success: boolean;
  uri?: string;
  feedback?: 'loved' | 'disliked';
  feedbackLoading?: boolean;
}

interface MessageProps {
  command: string;
  response: string;
  confidence?: number;
  isEnhanced?: boolean;
  timestamp?: number;
  alternatives?: string[] | Alternative[];
  intent?: string;
  reasoning?: string;
  model?: string;
  queuedSongs?: QueuedSong[];
  isAIDiscovery?: boolean;
  trackUri?: string;
  trackName?: string;
  artist?: string;
  aiReasoning?: string;
  feedback?: 'loved' | 'disliked';
  feedbackLoading?: boolean;
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
  onFeedback: (trackUri: string, feedback: 'loved' | 'disliked') => void;
  onAlternativeClick: (alternative: Alternative, action: 'play' | 'queue') => void;
  onClarificationOption: (direction: string, followUpQuery?: string) => void;
  savedStatus: Map<string, boolean>;
  libraryLoading: Map<string, boolean>;
  onToggleSave: (trackId: string) => void;
  isProcessing: boolean;
}

const ChatMessage: React.FC<MessageProps> = ({
  command,
  response,
  confidence,
  isEnhanced,
  timestamp,
  alternatives,
  intent,
  reasoning,
  model,
  queuedSongs,
  isAIDiscovery,
  trackUri,
  feedback,
  feedbackLoading,
  clarificationOptions,
  currentContext,
  uiType,
  onFeedback,
  onAlternativeClick,
  onClarificationOption,
  savedStatus,
  libraryLoading,
  onToggleSave,
  isProcessing
}) => {
  return (
    <div className="group hover:bg-zinc-900/30 rounded-lg transition-colors p-4">
      {/* User Command */}
      <div className="flex items-start gap-3 mb-3">
        <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
          <span className="text-xs font-bold text-black">U</span>
        </div>
        <div className="flex-1">
          <div className="flex items-baseline gap-2">
            <span className="font-medium text-green-400">{command}</span>
            {timestamp && (
              <span className="text-xs text-gray-500">{new Date(timestamp).toLocaleTimeString()}</span>
            )}
          </div>
          {/* Badges */}
          <div className="flex items-center gap-2 mt-1">
            {isEnhanced && (
              <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full">
                Enhanced
              </span>
            )}
            {model && (
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                model === 'direct-action' 
                  ? 'bg-blue-500/20 text-blue-400' 
                  : 'bg-gray-600/30 text-gray-400'
              }`} title={model}>
                {model === 'direct-action' 
                  ? 'Direct' 
                  : model.split('/').pop()?.split('-')[0] || model}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* AI Response */}
      <div className="flex items-start gap-3">
        <ModelIcon model={model} size="md" className="flex-shrink-0" />
        <div className="flex-1 space-y-2">
          {/* Intent and confidence */}
          {(intent || confidence !== undefined) && (
            <div className="flex items-center gap-3 flex-wrap">
              {intent && (
                <span className={`text-xs px-2 py-1 rounded ${
                  intent === 'play_specific_song' ? 'bg-purple-500/20 text-purple-400' :
                  intent === 'queue_specific_song' ? 'bg-green-500/20 text-green-400' :
                  intent === 'play_playlist' ? 'bg-blue-500/20 text-blue-400' :
                  intent === 'queue_playlist' ? 'bg-cyan-500/20 text-cyan-400' :
                  intent === 'pause' ? 'bg-yellow-500/20 text-yellow-400' :
                  intent === 'skip' ? 'bg-orange-500/20 text-orange-400' :
                  intent === 'set_volume' ? 'bg-pink-500/20 text-pink-400' :
                  intent === 'get_playback_info' ? 'bg-indigo-500/20 text-indigo-400' :
                  intent === 'chat' ? 'bg-blue-500/20 text-blue-400' :
                  intent === 'clarification_mode' ? 'bg-purple-500/20 text-purple-400' :
                  'bg-gray-500/20 text-gray-400'
                }`}>
                  Intent: {intent.replace(/_/g, ' ')}
                </span>
              )}
              {confidence !== undefined && (
                <div className="flex items-center gap-1">
                  <span className="text-xs text-gray-500">Confidence:</span>
                  <div className="w-16 h-2 bg-zinc-700 rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all ${
                        confidence >= 0.8 ? 'bg-green-500' : 
                        confidence >= 0.6 ? 'bg-yellow-500' : 
                        'bg-orange-500'
                      }`}
                      style={{ width: `${confidence * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-400">{Math.round(confidence * 100)}%</span>
                </div>
              )}
            </div>
          )}

          {/* Reasoning */}
          {reasoning && (
            <div className="bg-zinc-900/50 border-l-2 border-purple-500/30 px-3 py-2 rounded">
              <p className="text-xs text-purple-300 italic">
                💭 {reasoning}
              </p>
            </div>
          )}

          {/* Response text */}
          <div className="text-gray-300 whitespace-pre-line">
            {response.split(/(\*\*[^*]+\*\*)/).map((part, index) => {
              if (part.startsWith('**') && part.endsWith('**')) {
                return <strong key={index} className="font-bold text-white">{part.slice(2, -2)}</strong>;
              }
              return part;
            })}
          </div>

          {/* Clarification Options */}
          {intent === 'clarification_mode' && clarificationOptions && (
            <div className="mt-3">
              <ClarificationOptions
                response={{
                  intent: 'clarification_mode',
                  options: clarificationOptions,
                  responseMessage: response,
                  currentContext: currentContext,
                  uiType: uiType
                }}
                onOptionSelect={onClarificationOption}
              />
            </div>
          )}

          {/* Feedback Buttons for AI Discoveries */}
          {isAIDiscovery && trackUri && (
            <div className="flex gap-2 mt-3 items-center">
              {(() => {
                const trackId = trackUri.split(':')[2];
                return trackId ? (
                  <HeartIcon
                    filled={savedStatus.get(trackId) || false}
                    loading={libraryLoading.get(trackId) || false}
                    size="md"
                    onClick={() => onToggleSave(trackId)}
                  />
                ) : null;
              })()}
              <button
                onClick={() => onFeedback(trackUri, 'loved')}
                className={`px-3 py-1 rounded-lg transition-all ${
                  feedback === 'loved' 
                    ? 'bg-green-600 text-white' 
                    : 'bg-zinc-800 hover:bg-green-900 text-zinc-300'
                }`}
                disabled={feedbackLoading}
              >
                👍
              </button>
              <button
                onClick={() => onFeedback(trackUri, 'disliked')}
                className={`px-3 py-1 rounded-lg transition-all ${
                  feedback === 'disliked' 
                    ? 'bg-red-600 text-white' 
                    : 'bg-zinc-800 hover:bg-red-900 text-zinc-300'
                }`}
                disabled={feedbackLoading}
              >
                👎
              </button>
            </div>
          )}

          {/* Alternatives */}
          {alternatives && alternatives.length > 0 && (
            <div className="mt-3">
              {typeof alternatives[0] === 'object' ? (
                <div className="space-y-2">
                  <span className="text-xs text-gray-500 font-medium">Similar songs:</span>
                  <div className="space-y-1">
                    {(alternatives as Alternative[]).map((alt, altIndex) => {
                      const trackId = alt.uri ? alt.uri.split(':')[2] : '';
                      return (
                        <div key={altIndex} className="flex items-center justify-between bg-zinc-900/50 rounded p-2 text-xs">
                          <div className="flex-1 text-gray-300">
                            <span className="font-medium">{alt.name}</span>
                            <span className="text-gray-500"> by {alt.artists}</span>
                          </div>
                          <div className="flex gap-1 items-center">
                            {trackId && (
                              <HeartIcon
                                filled={savedStatus.get(trackId) || false}
                                loading={libraryLoading.get(trackId) || false}
                                size="sm"
                                onClick={() => onToggleSave(trackId)}
                              />
                            )}
                            <button
                              onClick={() => onAlternativeClick(alt, 'play')}
                              disabled={isProcessing}
                              className="px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                              Play
                            </button>
                            <button
                              onClick={() => onAlternativeClick(alt, 'queue')}
                              disabled={isProcessing}
                              className="px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                              Queue
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="text-xs text-gray-500">
                  <span className="font-medium">Also tried:</span> {(alternatives as string[]).join(', ')}
                </div>
              )}
            </div>
          )}

          {/* Queued Songs */}
          {queuedSongs && queuedSongs.length > 0 && (
            <div className="mt-3 space-y-2">
              <span className="text-xs text-gray-500 font-medium">Songs queued:</span>
              <div className="space-y-1">
                {queuedSongs.map((song, songIndex) => (
                  <div key={songIndex} className="flex items-center bg-zinc-900/50 rounded p-2 text-xs">
                    <span className="text-blue-400 mr-2">♪</span>
                    <div className="flex-1 text-gray-300">
                      <span className="font-medium">{song.name}</span>
                      <span className="text-gray-500"> by {song.artists}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      {song.success && song.uri && (
                        <>
                          <button
                            onClick={() => onFeedback(song.uri!, 'loved')}
                            className={`px-2 py-0.5 rounded transition-all text-xs ${
                              song.feedback === 'loved'
                                ? 'bg-green-600 text-white' 
                                : 'bg-zinc-700 hover:bg-green-900 text-zinc-300'
                            }`}
                            disabled={song.feedbackLoading}
                          >
                            👍
                          </button>
                          <button
                            onClick={() => onFeedback(song.uri!, 'disliked')}
                            className={`px-2 py-0.5 rounded transition-all text-xs ${
                              song.feedback === 'disliked'
                                ? 'bg-red-600 text-white' 
                                : 'bg-zinc-700 hover:bg-red-900 text-zinc-300'
                            }`}
                            disabled={song.feedbackLoading}
                          >
                            👎
                          </button>
                        </>
                      )}
                      {song.success && !song.uri && (
                        <span className="text-green-400 text-xs">✓</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatMessage;