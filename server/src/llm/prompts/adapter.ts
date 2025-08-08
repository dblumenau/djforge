import { UnifiedPrompt, UNIFIED_MUSIC_PROMPT, getAllExamplesFormatted, getExamplesForIntent } from './unified-prompt';
import { INTENT_EXAMPLES } from './examples';

export class PromptAdapter {
  /**
   * Format prompt for OpenRouter/Claude (text-based with JSON examples)
   */
  static forOpenRouter(
    userRequest: string,
    tasteProfile?: string,
    conversationContext?: string
  ): string {
    const prompt = UNIFIED_MUSIC_PROMPT;
    
    let formattedPrompt = `${prompt.base}

IMPORTANT: You must respond with valid JSON that matches one of the intent schemas below.

${getAllExamplesFormatted()}

${prompt.contextInstructions}

### User Request (PRIMARY - HIGHEST PRIORITY) ###
${userRequest}`;

    if (conversationContext) {
      formattedPrompt += `

### Recent Conversation Context ###
${conversationContext}`;
    }

    if (tasteProfile) {
      formattedPrompt += `

### User Taste Profile (SECONDARY REFERENCE ONLY) ###
${tasteProfile}
Note: This is background information. Only use if the user request is vague. NEVER let this override specific requests.`;
    }

    formattedPrompt += `

REMINDER: Respond with valid JSON matching one of the intent schemas shown above. Include ALL required fields.`;

    return formattedPrompt;
  }

  /**
   * Format prompt for OpenAI/GPT models (structured output aware)
   */
  static forOpenAI(
    userRequest: string,
    tasteProfile?: string,
    conversationContext?: string
  ): string {
    const prompt = UNIFIED_MUSIC_PROMPT;
    
    // OpenAI with structured output needs cleaner prompt without JSON formatting instructions
    let formattedPrompt = `${prompt.base}

# CRITICAL FIELD REQUIREMENTS

${Object.entries(prompt.rules).map(([intent, rules]) => `
## For ${intent}:
${rules.map(r => `- ${r}`).join('\n')}`).join('\n')}

${prompt.contextInstructions}

# CONTEXT SECTIONS

## User Request (PRIMARY - HIGHEST PRIORITY)
${userRequest}`;

    if (conversationContext) {
      formattedPrompt += `

## Recent Conversation Context
${conversationContext}`;
    }

    if (tasteProfile) {
      formattedPrompt += `

## User Taste Profile (SECONDARY REFERENCE ONLY)
${tasteProfile}
Note: Only use this if the user request is vague. NEVER let this override specific requests.`;
    }

    // Add condensed examples for GPT to understand patterns
    formattedPrompt += `

# INTENT EXAMPLES

${Object.entries(INTENT_EXAMPLES).slice(0, 5).map(([intent, data]: [string, any]) => `
${intent}: ${data.description}
Required fields: ${Object.keys(data.example).filter(k => k !== 'confidence' && k !== 'reasoning' && k !== 'modifiers' && k !== 'alternatives').join(', ')}`).join('\n')}

CRITICAL REMINDERS:
- Fill in ALL required fields for the chosen intent
- NEVER leave artist/track empty for song intents
- Use clarification_mode for "play something else" scenarios
- Do NOT add extra fields like "checklist"`;

    return formattedPrompt;
  }

  /**
   * Format prompt for Gemini (uses native structured output)
   */
  static forGemini(
    userRequest: string,
    tasteProfile?: string,
    conversationContext?: string
  ): string {
    const prompt = UNIFIED_MUSIC_PROMPT;
    
    // Gemini handles structure through responseSchema, so focus on intent selection
    let formattedPrompt = `${prompt.base}

Your response will be structured according to a predefined schema. Focus on:
1. Selecting the correct intent
2. Filling in all required fields for that intent
3. Providing accurate confidence scores

${prompt.contextInstructions}

### User Request (PRIMARY) ###
${userRequest}`;

    if (conversationContext) {
      formattedPrompt += `

### Recent Conversation ###
${conversationContext}`;
    }

    if (tasteProfile) {
      formattedPrompt += `

### User Preferences (Reference Only) ###
${tasteProfile}`;
    }

    return formattedPrompt;
  }

  /**
   * Get a simple, intent-focused prompt for testing
   */
  static forTesting(userRequest: string, expectedIntent?: string): string {
    if (expectedIntent) {
      return `Interpret this request as ${expectedIntent} intent: ${userRequest}
      
${getExamplesForIntent(expectedIntent)}`;
    }
    
    return `Interpret this music command: ${userRequest}

Respond with the appropriate intent and required fields.`;
  }
}