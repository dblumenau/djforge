import { z } from 'zod';

// Configuration interface
export interface TestConfig {
  model: 'gpt-5' | 'gpt-5-mini' | 'gpt-5-nano';
  reasoning: {
    effort: 'low' | 'medium' | 'high';
  };
  verbose: boolean;
  useTools: boolean;
  streaming: boolean;
  temperature: number;
  maxOutputTokens?: number;
  structuredOutput?: boolean;
}

// Config validation schema for runtime validation
export const TestConfigSchema = z.object({
  model: z.enum(['gpt-5', 'gpt-5-mini', 'gpt-5-nano']),
  reasoning: z.object({
    effort: z.enum(['low', 'medium', 'high'])
  }),
  verbose: z.boolean(),
  useTools: z.boolean(),
  streaming: z.boolean(),
  temperature: z.number().min(0).max(2),
  maxOutputTokens: z.number().positive().optional(),
  structuredOutput: z.boolean().optional()
});

// Default configuration
export const defaultConfig: TestConfig = {
  model: 'gpt-5-nano',
  reasoning: { effort: 'low' },
  verbose: false,
  useTools: true,  // Tools enabled by default
  streaming: true,
  temperature: 1,
  structuredOutput: true
};