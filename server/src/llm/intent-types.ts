/**
 * Shared intent types for both OpenRouter and Gemini Direct API paths
 * 
 * This file serves as the canonical definition of intent structures
 * that must be produced by both:
 * - OpenRouter models (via prompt engineering + Zod schemas)
 * - Gemini models (via native responseSchema)
 * 
 * Any changes to intent structure MUST be reflected in both:
 * - schemas.ts (for OpenRouter prompt engineering)
 * - gemini-schemas.ts (for Gemini native structured output)
 */

// Core intent types that all models must support
export type IntentType = 
  | 'play_specific_song'
  | 'queue_specific_song'
  | 'queue_multiple_songs'
  | 'play_playlist'
  | 'queue_playlist'
  | 'play'
  | 'pause'
  | 'skip'
  | 'previous'
  | 'volume'
  | 'set_volume'
  | 'resume'
  | 'next'
  | 'back'
  | 'get_current_track'
  | 'set_shuffle'
  | 'set_repeat'
  | 'clear_queue'
  | 'get_devices'
  | 'get_playlists'
  | 'get_recently_played'
  | 'search'
  | 'get_playback_info'
  | 'chat'
  | 'ask_question'
  | 'explain_reasoning'
  | 'unknown';

// Obscurity levels for track requests
export type ObscurityLevel = 'popular' | 'obscure' | 'rare' | 'deep_cut' | 'hidden';

// Track version preferences
export type VersionType = 'original' | 'remix' | 'acoustic' | 'live' | 'demo' | 'remaster';

// Search type for Spotify queries
export type SearchType = 'track' | 'artist' | 'album' | 'playlist';

// Execution order for batch commands
export type ExecutionOrder = 'sequential' | 'parallel';

// Modifiers for music commands
export interface MusicModifiers {
  obscurity?: ObscurityLevel | string | null;
  version?: VersionType | string | null;
  mood?: string | null;
  era?: string | null;
  genre?: string | null;
  exclude?: string[];
}

// Core music command interface
export interface MusicCommandIntent {
  intent: IntentType;
  query?: string;
  artist?: string;
  track?: string;
  album?: string;
  value?: number;
  volume_level?: number;
  enabled?: boolean;
  modifiers?: MusicModifiers;
  confidence: number;
  reasoning: string;
  alternatives?: (string | {
    intent?: string;
    query?: string;
    theme?: string;
    enhancedQuery?: string;
    isAIDiscovery?: boolean;
    aiReasoning?: string;
  })[];
  enhancedQuery?: string;
}

// Spotify search enhancement interface
export interface SpotifySearchEnhancement {
  originalQuery: string;
  enhancedQuery: string;
  searchType: SearchType;
  filters?: {
    artist?: string;
    album?: string;
    year?: string;
    genre?: string;
    tag?: string[];
  };
  popularity?: {
    min?: number;
    max?: number;
  };
  explanation: string;
}

// Music recommendation interface
export interface MusicRecommendation {
  artist: string;
  track: string;
  reason: string;
  spotifyQuery: string;
}

// Music knowledge response interface
export interface MusicKnowledgeResponse {
  query: string;
  answer: string;
  recommendations?: MusicRecommendation[];
  context?: {
    genre?: string;
    era?: string;
    mood?: string;
    cultural_references?: string[];
  };
  confidence: number;
}

// Error response interface
export interface ErrorResponse {
  error: string;
  suggestion?: string;
  fallback?: string;
}

// Batch command interface
export interface BatchCommand {
  commands: MusicCommandIntent[];
  executionOrder: ExecutionOrder;
  context?: string;
}

// Union type for all possible response types
export type IntentResponse = 
  | MusicCommandIntent
  | SpotifySearchEnhancement
  | MusicKnowledgeResponse
  | ErrorResponse
  | BatchCommand;

// Type guards for intent validation
export function isMusicCommandIntent(obj: any): obj is MusicCommandIntent {
  return (
    obj &&
    typeof obj === 'object' &&
    typeof obj.intent === 'string' &&
    typeof obj.confidence === 'number' &&
    typeof obj.reasoning === 'string' &&
    obj.confidence >= 0 &&
    obj.confidence <= 1
  );
}

export function isSpotifySearchEnhancement(obj: any): obj is SpotifySearchEnhancement {
  return (
    obj &&
    typeof obj === 'object' &&
    typeof obj.originalQuery === 'string' &&
    typeof obj.enhancedQuery === 'string' &&
    typeof obj.searchType === 'string' &&
    typeof obj.explanation === 'string'
  );
}

export function isMusicKnowledgeResponse(obj: any): obj is MusicKnowledgeResponse {
  return (
    obj &&
    typeof obj === 'object' &&
    typeof obj.query === 'string' &&
    typeof obj.answer === 'string' &&
    typeof obj.confidence === 'number' &&
    obj.confidence >= 0 &&
    obj.confidence <= 1
  );
}

export function isErrorResponse(obj: any): obj is ErrorResponse {
  return (
    obj &&
    typeof obj === 'object' &&
    typeof obj.error === 'string'
  );
}

export function isBatchCommand(obj: any): obj is BatchCommand {
  return (
    obj &&
    typeof obj === 'object' &&
    Array.isArray(obj.commands) &&
    typeof obj.executionOrder === 'string' &&
    obj.commands.every(isMusicCommandIntent)
  );
}

// Constants for validation
export const VALID_INTENTS: IntentType[] = [
  'play_specific_song',
  'queue_specific_song',
  'queue_multiple_songs',
  'play_playlist',
  'queue_playlist',
  'play',
  'pause',
  'skip',
  'previous',
  'volume',
  'set_volume',
  'resume',
  'next',
  'back',
  'get_current_track',
  'set_shuffle',
  'set_repeat',
  'clear_queue',
  'get_devices',
  'get_playlists',
  'get_recently_played',
  'search',
  'get_playback_info',
  'chat',
  'ask_question',
  'explain_reasoning',
  'unknown'
];

export const VALID_OBSCURITY_LEVELS: ObscurityLevel[] = [
  'popular',
  'obscure',
  'rare',
  'deep_cut',
  'hidden'
];

export const VALID_VERSION_TYPES: VersionType[] = [
  'original',
  'remix',
  'acoustic',
  'live',
  'demo',
  'remaster'
];

export const VALID_SEARCH_TYPES: SearchType[] = [
  'track',
  'artist',
  'album',
  'playlist'
];

export const VALID_EXECUTION_ORDERS: ExecutionOrder[] = [
  'sequential',
  'parallel'
];

// Validation functions
export function isValidIntent(intent: string): intent is IntentType {
  return VALID_INTENTS.includes(intent as IntentType);
}

export function isValidObscurityLevel(level: string): level is ObscurityLevel {
  return VALID_OBSCURITY_LEVELS.includes(level as ObscurityLevel);
}

export function isValidVersionType(version: string): version is VersionType {
  return VALID_VERSION_TYPES.includes(version as VersionType);
}

export function isValidSearchType(type: string): type is SearchType {
  return VALID_SEARCH_TYPES.includes(type as SearchType);
}

export function isValidExecutionOrder(order: string): order is ExecutionOrder {
  return VALID_EXECUTION_ORDERS.includes(order as ExecutionOrder);
}