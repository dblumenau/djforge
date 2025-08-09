import { z } from 'zod';
import { WeatherSchema, MusicSearchSchema, CodeExecutionSchema, MusicAlternativesSchema } from './schemas';

/**
 * Tool validation map for runtime validation
 * Maps function names to their corresponding Zod schemas
 */
export const toolValidators: Record<string, z.ZodSchema<any>> = {
  get_weather: WeatherSchema,
  search_music: MusicSearchSchema,
  execute_code: CodeExecutionSchema,
  provide_music_alternatives: MusicAlternativesSchema
};