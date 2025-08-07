/**
 * Normalizes LLM responses to handle the natural variation in how different models
 * structure their JSON outputs. This acts as a preprocessing layer before schema validation.
 */

export function normalizeLLMResponse(response: any): any {
  if (!response || typeof response !== 'object') {
    return response;
  }

  // Deep clone to avoid mutations
  const normalized = JSON.parse(JSON.stringify(response));

  // Remove null values from optional fields - convert to undefined
  function cleanNulls(obj: any, path: string[] = []): void {
    for (const key in obj) {
      const currentPath = [...path, key];
      
      if (obj[key] === null) {
        // Delete null values - Zod handles undefined better than null for optional fields
        delete obj[key];
      } else if (Array.isArray(obj[key])) {
        // Clean array elements but keep empty arrays
        obj[key] = obj[key].filter((item: any) => item !== null);
      } else if (typeof obj[key] === 'object') {
        cleanNulls(obj[key], currentPath);
        
        // Remove empty objects from certain paths
        if (Object.keys(obj[key]).length === 0 && 
            (currentPath.includes('filters') || currentPath.includes('popularity'))) {
          delete obj[key];
        }
      }
    }
  }

  cleanNulls(normalized);

  // Ensure modifiers object exists with proper defaults
  if (normalized.modifiers) {
    normalized.modifiers = {
      obscurity: normalized.modifiers.obscurity || undefined,
      version: normalized.modifiers.version || undefined,
      mood: normalized.modifiers.mood || undefined,
      era: normalized.modifiers.era || undefined,
      genre: normalized.modifiers.genre || undefined,
      exclude: Array.isArray(normalized.modifiers.exclude) ? normalized.modifiers.exclude : []
    };
  }

  // Handle alternatives - accept both strings and objects
  if (normalized.alternatives) {
    if (!Array.isArray(normalized.alternatives)) {
      normalized.alternatives = [];
    } else {
      // Process each alternative - keep both strings and valid objects
      normalized.alternatives = normalized.alternatives
        .map((alt: any) => {
          if (typeof alt === 'string') {
            return alt; // Keep strings as-is
          } else if (typeof alt === 'object' && alt !== null) {
            // For objects, ensure they have valid structure
            // If it has a name field (legacy), convert to string
            if (alt.name && !alt.intent && !alt.query && !alt.theme) {
              return alt.name;
            }
            // Otherwise keep the full object for GPT-5 style alternatives
            return alt;
          }
          return null;
        })
        .filter(Boolean); // Remove null values
    }
  }

  return normalized;
}

/**
 * Extracts essential fields from an LLM response even if full validation fails
 */
export function extractEssentialFields(response: any): {
  intent?: string;
  query?: string;
  artist?: string;
  track?: string;
  confidence?: number;
} {
  if (!response || typeof response !== 'object') {
    return {};
  }

  return {
    intent: response.intent || 'unknown',
    query: response.query || response.search || response.searchQuery,
    artist: response.artist || response.artist_name,
    track: response.track || response.song || response.track_name,
    confidence: typeof response.confidence === 'number' ? response.confidence : 0.5
  };
}

/**
 * Builds a precise Spotify search query from interpreted components
 */
export function buildSpotifySearchQuery(interpretation: {
  query?: string;
  artist?: string;
  track?: string;
  album?: string;
  modifiers?: any;
}): string {
  // If we have both artist and track, use precise search syntax
  if (interpretation.artist && interpretation.track) {
    return `artist:"${interpretation.artist}" track:"${interpretation.track}"`;
  }
  
  // If we have artist and album
  if (interpretation.artist && interpretation.album) {
    return `artist:"${interpretation.artist}" album:"${interpretation.album}"`;
  }
  
  // If we just have artist
  if (interpretation.artist && !interpretation.track) {
    return `artist:"${interpretation.artist}"`;
  }
  
  // If we just have track
  if (interpretation.track && !interpretation.artist) {
    return `track:"${interpretation.track}"`;
  }
  
  // Otherwise use the general query
  return interpretation.query || '';
}