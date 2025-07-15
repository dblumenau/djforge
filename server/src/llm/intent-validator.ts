/**
 * Intent Validator - The Keystone Component
 * 
 * This is the critical component that ensures both OpenRouter and Gemini Direct API
 * paths produce identical, valid intent objects. It serves as the contract between
 * the two systems and prevents schema drift.
 * 
 * Key responsibilities:
 * - Validate intent structure consistency
 * - Normalize outputs from both paths
 * - Provide detailed validation errors
 * - Support testing and comparison
 * - Detect schema drift between systems
 */

import {
  IntentType,
  IntentResponse,
  MusicCommandIntent,
  SpotifySearchEnhancement,
  MusicKnowledgeResponse,
  ErrorResponse,
  BatchCommand,
  MusicModifiers,
  isMusicCommandIntent,
  isSpotifySearchEnhancement,
  isMusicKnowledgeResponse,
  isErrorResponse,
  isBatchCommand,
  isValidIntent,
  isValidObscurityLevel,
  isValidVersionType,
  isValidSearchType,
  isValidExecutionOrder,
  VALID_INTENTS,
  VALID_OBSCURITY_LEVELS,
  VALID_VERSION_TYPES,
  VALID_SEARCH_TYPES,
  VALID_EXECUTION_ORDERS
} from './intent-types';

// Validation result interface
export interface ValidationResult {
  isValid: boolean;
  intentType: string;
  errors: string[];
  warnings: string[];
  normalizedIntent?: IntentResponse;
}

// Validation context for debugging
export interface ValidationContext {
  source: 'openrouter' | 'gemini-direct' | 'unknown';
  model: string;
  timestamp: number;
  rawResponse?: any;
}

// Deep validation options
export interface ValidationOptions {
  strict: boolean;  // Strict validation (fail on warnings)
  normalize: boolean;  // Normalize the output
  logErrors: boolean;  // Log validation errors
  context?: ValidationContext;
}

/**
 * Primary validation function - validates any intent response
 */
export function validateIntent(
  response: any,
  options: ValidationOptions = { strict: false, normalize: true, logErrors: true }
): ValidationResult {
  const result: ValidationResult = {
    isValid: false,
    intentType: 'unknown',
    errors: [],
    warnings: []
  };

  // Basic null/undefined checks
  if (!response || typeof response !== 'object') {
    result.errors.push('Response must be a non-null object');
    return logAndReturn(result, options);
  }

  // Determine intent type and validate accordingly
  // Use more permissive checks to route to specific validators
  if (looksLikeMusicCommandIntent(response)) {
    return validateMusicCommandIntent(response, options);
  } else if (looksLikeSpotifySearchEnhancement(response)) {
    return validateSpotifySearchEnhancement(response, options);
  } else if (looksLikeMusicKnowledgeResponse(response)) {
    return validateMusicKnowledgeResponse(response, options);
  } else if (looksLikeErrorResponse(response)) {
    return validateErrorResponse(response, options);
  } else if (looksLikeBatchCommand(response)) {
    return validateBatchCommand(response, options);
  } else {
    result.errors.push('Unknown intent type - does not match any supported schema');
    return logAndReturn(result, options);
  }
}

/**
 * Permissive routing functions - these check basic structure to route to specific validators
 * without strict validation, allowing detailed error messages from the specific validators
 */
function looksLikeMusicCommandIntent(obj: any): boolean {
  return (
    obj &&
    typeof obj === 'object' &&
    'intent' in obj
  );
}

function looksLikeSpotifySearchEnhancement(obj: any): boolean {
  return (
    obj &&
    typeof obj === 'object' &&
    'originalQuery' in obj &&
    'enhancedQuery' in obj &&
    !('intent' in obj) // Don't conflict with music command
  );
}

function looksLikeMusicKnowledgeResponse(obj: any): boolean {
  return (
    obj &&
    typeof obj === 'object' &&
    'query' in obj &&
    'answer' in obj &&
    !('intent' in obj) && // Don't conflict with music command
    !('originalQuery' in obj) // Don't conflict with search enhancement
  );
}

function looksLikeErrorResponse(obj: any): boolean {
  return (
    obj &&
    typeof obj === 'object' &&
    'error' in obj &&
    !('intent' in obj) // Don't conflict with music command
  );
}

function looksLikeBatchCommand(obj: any): boolean {
  return (
    obj &&
    typeof obj === 'object' &&
    'commands' in obj &&
    Array.isArray(obj.commands) &&
    !('intent' in obj) // Don't conflict with music command
  );
}

/**
 * Validate Music Command Intent
 */
export function validateMusicCommandIntent(
  intent: any,
  options: ValidationOptions
): ValidationResult {
  const result: ValidationResult = {
    isValid: true,
    intentType: 'music_command',
    errors: [],
    warnings: []
  };

  // Required fields validation
  if (!intent.intent || typeof intent.intent !== 'string') {
    result.errors.push('Required field "intent" must be a string');
  } else if (!isValidIntent(intent.intent)) {
    result.errors.push(`Invalid intent "${intent.intent}". Must be one of: ${VALID_INTENTS.join(', ')}`);
  }

  if (typeof intent.confidence !== 'number') {
    result.errors.push('Required field "confidence" must be a number');
  } else if (intent.confidence < 0 || intent.confidence > 1) {
    result.errors.push('Field "confidence" must be between 0 and 1');
  }

  if (!intent.reasoning || typeof intent.reasoning !== 'string') {
    result.errors.push('Required field "reasoning" must be a non-empty string');
  }

  // Optional fields validation
  if (intent.query !== undefined && typeof intent.query !== 'string') {
    result.errors.push('Optional field "query" must be a string if provided');
  }

  if (intent.artist !== undefined && typeof intent.artist !== 'string') {
    result.errors.push('Optional field "artist" must be a string if provided');
  }

  if (intent.track !== undefined && typeof intent.track !== 'string') {
    result.errors.push('Optional field "track" must be a string if provided');
  }

  if (intent.album !== undefined && typeof intent.album !== 'string') {
    result.errors.push('Optional field "album" must be a string if provided');
  }

  if (intent.value !== undefined) {
    if (typeof intent.value !== 'number') {
      result.errors.push('Optional field "value" must be a number if provided');
    } else if (intent.value < 0 || intent.value > 100) {
      result.warnings.push('Field "value" should typically be between 0 and 100 for volume');
    }
  }

  if (intent.enhancedQuery !== undefined && typeof intent.enhancedQuery !== 'string') {
    result.errors.push('Optional field "enhancedQuery" must be a string if provided');
  }

  if (intent.alternatives !== undefined) {
    if (!Array.isArray(intent.alternatives)) {
      result.errors.push('Optional field "alternatives" must be an array if provided');
    } else if (!intent.alternatives.every((alt: any) => typeof alt === 'string')) {
      result.errors.push('All items in "alternatives" array must be strings');
    }
  }

  // Validate modifiers
  if (intent.modifiers !== undefined) {
    result.errors.push(...validateModifiers(intent.modifiers));
  }

  // Contextual validation
  if (intent.intent === 'volume' && intent.value === undefined) {
    result.warnings.push('Volume intent should typically include a "value" field');
  }

  if (['play_specific_song', 'queue_specific_song'].includes(intent.intent) && !intent.query) {
    result.warnings.push('Search intents should typically include a "query" field');
  }

  result.isValid = result.errors.length === 0;
  if (options.normalize && result.isValid) {
    result.normalizedIntent = normalizeModifiers(intent);
  }

  return logAndReturn(result, options);
}

/**
 * Validate Spotify Search Enhancement
 */
export function validateSpotifySearchEnhancement(
  enhancement: any,
  options: ValidationOptions
): ValidationResult {
  const result: ValidationResult = {
    isValid: true,
    intentType: 'spotify_search_enhancement',
    errors: [],
    warnings: []
  };

  // Required fields
  if (!enhancement.originalQuery || typeof enhancement.originalQuery !== 'string') {
    result.errors.push('Required field "originalQuery" must be a non-empty string');
  }

  if (!enhancement.enhancedQuery || typeof enhancement.enhancedQuery !== 'string') {
    result.errors.push('Required field "enhancedQuery" must be a non-empty string');
  }

  if (!enhancement.searchType || typeof enhancement.searchType !== 'string') {
    result.errors.push('Required field "searchType" must be a string');
  } else if (!isValidSearchType(enhancement.searchType)) {
    result.errors.push(`Invalid searchType "${enhancement.searchType}". Must be one of: ${VALID_SEARCH_TYPES.join(', ')}`);
  }

  if (!enhancement.explanation || typeof enhancement.explanation !== 'string') {
    result.errors.push('Required field "explanation" must be a non-empty string');
  }

  // Optional fields
  if (enhancement.filters !== undefined) {
    if (typeof enhancement.filters !== 'object') {
      result.errors.push('Optional field "filters" must be an object if provided');
    } else {
      const validFilterKeys = ['artist', 'album', 'year', 'genre', 'tag'];
      Object.keys(enhancement.filters).forEach(key => {
        if (!validFilterKeys.includes(key)) {
          result.warnings.push(`Unknown filter key "${key}"`);
        }
      });
    }
  }

  if (enhancement.popularity !== undefined) {
    if (typeof enhancement.popularity !== 'object') {
      result.errors.push('Optional field "popularity" must be an object if provided');
    } else {
      if (enhancement.popularity.min !== undefined && 
          (typeof enhancement.popularity.min !== 'number' || 
           enhancement.popularity.min < 0 || enhancement.popularity.min > 100)) {
        result.errors.push('Popularity "min" must be a number between 0 and 100');
      }
      if (enhancement.popularity.max !== undefined && 
          (typeof enhancement.popularity.max !== 'number' || 
           enhancement.popularity.max < 0 || enhancement.popularity.max > 100)) {
        result.errors.push('Popularity "max" must be a number between 0 and 100');
      }
    }
  }

  result.isValid = result.errors.length === 0;
  if (options.normalize && result.isValid) {
    result.normalizedIntent = enhancement;
  }

  return logAndReturn(result, options);
}

/**
 * Validate Music Knowledge Response
 */
export function validateMusicKnowledgeResponse(
  knowledge: any,
  options: ValidationOptions
): ValidationResult {
  const result: ValidationResult = {
    isValid: true,
    intentType: 'music_knowledge',
    errors: [],
    warnings: []
  };

  // Required fields
  if (!knowledge.query || typeof knowledge.query !== 'string') {
    result.errors.push('Required field "query" must be a non-empty string');
  }

  if (!knowledge.answer || typeof knowledge.answer !== 'string') {
    result.errors.push('Required field "answer" must be a non-empty string');
  }

  if (typeof knowledge.confidence !== 'number') {
    result.errors.push('Required field "confidence" must be a number');
  } else if (knowledge.confidence < 0 || knowledge.confidence > 1) {
    result.errors.push('Field "confidence" must be between 0 and 1');
  }

  // Optional fields
  if (knowledge.recommendations !== undefined) {
    if (!Array.isArray(knowledge.recommendations)) {
      result.errors.push('Optional field "recommendations" must be an array if provided');
    } else {
      knowledge.recommendations.forEach((rec: any, index: number) => {
        if (!rec.artist || typeof rec.artist !== 'string') {
          result.errors.push(`Recommendation ${index}: "artist" must be a non-empty string`);
        }
        if (!rec.track || typeof rec.track !== 'string') {
          result.errors.push(`Recommendation ${index}: "track" must be a non-empty string`);
        }
        if (!rec.reason || typeof rec.reason !== 'string') {
          result.errors.push(`Recommendation ${index}: "reason" must be a non-empty string`);
        }
        if (!rec.spotifyQuery || typeof rec.spotifyQuery !== 'string') {
          result.errors.push(`Recommendation ${index}: "spotifyQuery" must be a non-empty string`);
        }
      });
    }
  }

  result.isValid = result.errors.length === 0;
  if (options.normalize && result.isValid) {
    result.normalizedIntent = knowledge;
  }

  return logAndReturn(result, options);
}

/**
 * Validate Error Response
 */
export function validateErrorResponse(
  error: any,
  options: ValidationOptions
): ValidationResult {
  const result: ValidationResult = {
    isValid: true,
    intentType: 'error',
    errors: [],
    warnings: []
  };

  if (!error.error || typeof error.error !== 'string') {
    result.errors.push('Required field "error" must be a non-empty string');
  }

  if (error.suggestion !== undefined && typeof error.suggestion !== 'string') {
    result.errors.push('Optional field "suggestion" must be a string if provided');
  }

  if (error.fallback !== undefined && typeof error.fallback !== 'string') {
    result.errors.push('Optional field "fallback" must be a string if provided');
  }

  result.isValid = result.errors.length === 0;
  if (options.normalize && result.isValid) {
    result.normalizedIntent = error;
  }

  return logAndReturn(result, options);
}

/**
 * Validate Batch Command
 */
export function validateBatchCommand(
  batch: any,
  options: ValidationOptions
): ValidationResult {
  const result: ValidationResult = {
    isValid: true,
    intentType: 'batch',
    errors: [],
    warnings: []
  };

  if (!Array.isArray(batch.commands)) {
    result.errors.push('Required field "commands" must be an array');
  } else {
    batch.commands.forEach((cmd: any, index: number) => {
      const cmdResult = validateMusicCommandIntent(cmd, { ...options, logErrors: false });
      if (!cmdResult.isValid) {
        result.errors.push(`Command ${index}: ${cmdResult.errors.join(', ')}`);
      }
    });
  }

  if (!batch.executionOrder || typeof batch.executionOrder !== 'string') {
    result.errors.push('Required field "executionOrder" must be a string');
  } else if (!isValidExecutionOrder(batch.executionOrder)) {
    result.errors.push(`Invalid executionOrder "${batch.executionOrder}". Must be one of: ${VALID_EXECUTION_ORDERS.join(', ')}`);
  }

  result.isValid = result.errors.length === 0;
  if (options.normalize && result.isValid) {
    result.normalizedIntent = batch;
  }

  return logAndReturn(result, options);
}

/**
 * Validate modifiers object
 */
function validateModifiers(modifiers: any): string[] {
  const errors: string[] = [];

  if (typeof modifiers !== 'object' || modifiers === null) {
    errors.push('Modifiers must be an object');
    return errors;
  }

  if (modifiers.obscurity !== undefined && 
      modifiers.obscurity !== null && 
      typeof modifiers.obscurity === 'string' && 
      !isValidObscurityLevel(modifiers.obscurity)) {
    errors.push(`Invalid obscurity level "${modifiers.obscurity}". Must be one of: ${VALID_OBSCURITY_LEVELS.join(', ')}`);
  }

  if (modifiers.version !== undefined && 
      modifiers.version !== null && 
      typeof modifiers.version === 'string' && 
      !isValidVersionType(modifiers.version)) {
    errors.push(`Invalid version type "${modifiers.version}". Must be one of: ${VALID_VERSION_TYPES.join(', ')}`);
  }

  if (modifiers.exclude !== undefined && 
      modifiers.exclude !== null && 
      !Array.isArray(modifiers.exclude)) {
    errors.push('Modifiers exclude must be an array');
  }

  return errors;
}

/**
 * Normalize modifiers (ensure default values)
 */
function normalizeModifiers(intent: any): MusicCommandIntent {
  const normalized = { ...intent };
  
  if (!normalized.modifiers) {
    normalized.modifiers = {};
  }
  
  if (!normalized.modifiers.exclude) {
    normalized.modifiers.exclude = [];
  }
  
  if (!normalized.alternatives) {
    normalized.alternatives = [];
  }
  
  return normalized;
}

/**
 * Log validation results and return
 */
function logAndReturn(result: ValidationResult, options: ValidationOptions): ValidationResult {
  if (options.logErrors && !result.isValid) {
    console.error('Intent validation failed:', {
      type: result.intentType,
      errors: result.errors,
      warnings: result.warnings,
      context: options.context
    });
  }

  if (options.strict && result.warnings.length > 0) {
    result.isValid = false;
    result.errors.push(...result.warnings);
  }

  return result;
}

/**
 * Compare two intent responses for equality (for testing)
 */
export function compareIntents(intent1: any, intent2: any): {
  isEqual: boolean;
  differences: string[];
} {
  const differences: string[] = [];

  // Basic type comparison
  if (typeof intent1 !== typeof intent2) {
    differences.push(`Type mismatch: ${typeof intent1} vs ${typeof intent2}`);
    return { isEqual: false, differences };
  }

  // Recursive comparison for objects
  if (typeof intent1 === 'object' && intent1 !== null && intent2 !== null) {
    const keys1 = Object.keys(intent1).sort();
    const keys2 = Object.keys(intent2).sort();

    if (keys1.length !== keys2.length) {
      differences.push(`Different number of keys: ${keys1.length} vs ${keys2.length}`);
    }

    keys1.forEach(key => {
      if (!(key in intent2)) {
        differences.push(`Key "${key}" missing in second intent`);
      } else {
        const comparison = compareIntents(intent1[key], intent2[key]);
        if (!comparison.isEqual) {
          differences.push(`Key "${key}": ${comparison.differences.join(', ')}`);
        }
      }
    });

    keys2.forEach(key => {
      if (!(key in intent1)) {
        differences.push(`Key "${key}" missing in first intent`);
      }
    });
  } else if (intent1 !== intent2) {
    differences.push(`Value mismatch: ${intent1} vs ${intent2}`);
  }

  return {
    isEqual: differences.length === 0,
    differences
  };
}

/**
 * Test helper: Generate a valid test intent
 */
export function createTestIntent(overrides: Partial<MusicCommandIntent> = {}): MusicCommandIntent {
  const defaultIntent: MusicCommandIntent = {
    intent: 'play_specific_song',
    query: 'test song',
    confidence: 0.8,
    reasoning: 'Test intent for validation',
    alternatives: [],
    modifiers: {
      exclude: []
    }
  };

  return { ...defaultIntent, ...overrides };
}

/**
 * Batch validation for testing multiple intents
 */
export function validateIntents(
  intents: any[],
  options: ValidationOptions = { strict: false, normalize: true, logErrors: false }
): ValidationResult[] {
  return intents.map(intent => validateIntent(intent, options));
}