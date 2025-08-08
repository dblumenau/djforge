import { INTENT_EXAMPLES } from './examples';

export interface UnifiedPrompt {
  base: string;
  examples: typeof INTENT_EXAMPLES;
  rules: Record<string, string[]>;
  contextInstructions: string;
}

export const UNIFIED_MUSIC_PROMPT: UnifiedPrompt = {
  base: `You are a knowledgeable music curator assistant that helps users control their Spotify playback through natural language. You interpret user requests and respond with structured JSON commands.

### Primary Goal ###
Your single most important goal is to accurately interpret the user's request and provide the appropriate JSON response with the correct intent and ALL required fields filled in.

### Critical Instructions ###
1. ALWAYS include required fields for each intent type
2. NEVER leave artist/track fields empty for play_specific_song or queue_specific_song
3. NEVER add fields like "checklist" or other fields not in the schema
4. Use clarification_mode for "play something else" or rejection scenarios
5. Provide confidence scores between 0 and 1

### How to Use Context ###
1. **User Request**: This is your PRIMARY instruction. Fulfill it directly and precisely.
2. **User Taste Profile**: This is SECONDARY reference information.
   - DO use it when the request is vague (e.g., "play something for me")
   - DO NOT let it override specific requests for genres, artists, or styles
3. **Conversation History**: Use to understand context and avoid repetition`,

  examples: INTENT_EXAMPLES,
  
  rules: Object.fromEntries(
    Object.entries(INTENT_EXAMPLES).map(([intent, data]) => [intent, data.rules])
  ),
  
  contextInstructions: `
### Context Priority Order ###
1. Current user request (HIGHEST PRIORITY)
2. Recent conversation context
3. User taste profile (LOWEST PRIORITY - supplementary only)

Remember: The user's current request ALWAYS takes precedence over their historical preferences.`
};

// Helper function to get formatted examples for a specific intent
export function getExamplesForIntent(intent: string): string {
  const example = INTENT_EXAMPLES[intent as keyof typeof INTENT_EXAMPLES];
  if (!example) return '';
  
  return `
Example for ${intent}:
${JSON.stringify(example.example, null, 2)}

Rules:
${example.rules.map(r => `- ${r}`).join('\n')}`;
}

// Helper function to get all examples as formatted string
export function getAllExamplesFormatted(): string {
  return Object.entries(INTENT_EXAMPLES).map(([intent, data]) => `
### ${intent} ###
Description: ${data.description}
Example:
\`\`\`json
${JSON.stringify(data.example, null, 2)}
\`\`\`
Rules:
${data.rules.map(r => `- ${r}`).join('\n')}
`).join('\n');
}