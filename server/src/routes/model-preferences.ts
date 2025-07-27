import { Router } from 'express';
import { ensureValidToken } from '../spotify/auth';
import { llmOrchestrator, OPENROUTER_MODELS } from '../llm/orchestrator';
import { verifyJWT, extractTokenFromHeader } from '../utils/jwt';

export const modelPreferencesRouter = Router();

// Redis client reference
let redisClient: any = null;

export function setRedisClient(client: any) {
  redisClient = client;
}

// Helper to get user ID from JWT
function getUserIdFromRequest(req: any): string | null {
  const authHeader = req.headers.authorization;
  const jwtToken = extractTokenFromHeader(authHeader);
  
  if (!jwtToken) return null;
  
  const payload = verifyJWT(jwtToken);
  if (!payload) return null;
  
  // Return the stable Spotify user ID from JWT
  return payload.sub || payload.spotify_user_id || null;
}

// Get model preference from Redis
async function getUserModelPreference(userId: string): Promise<string | null> {
  if (!redisClient) return null;
  
  try {
    const key = `user:${userId}:model_preference`;
    const preference = await redisClient.get(key);
    return preference;
  } catch (error) {
    console.error('Error getting model preference from Redis:', error);
    return null;
  }
}

// Set model preference in Redis
async function setUserModelPreference(userId: string, modelId: string): Promise<void> {
  if (!redisClient) return;
  
  try {
    const key = `user:${userId}:model_preference`;
    // Store for 90 days
    await redisClient.set(key, modelId, 'EX', 90 * 24 * 60 * 60);
  } catch (error) {
    console.error('Error setting model preference in Redis:', error);
  }
}

// Model display information
const MODEL_DISPLAY_INFO: Record<string, { name: string; provider: string; description: string }> = {
  // Claude Models
  [OPENROUTER_MODELS.CLAUDE_OPUS_4]: { 
    name: 'Claude Opus 4', 
    provider: 'Anthropic',
    description: 'Most capable Claude model (JSON via tool calling)'
  },
  [OPENROUTER_MODELS.CLAUDE_SONNET_4]: { 
    name: 'Claude Sonnet 4', 
    provider: 'Anthropic',
    description: 'Balanced performance and speed (Default, JSON via tool calling)'
  },
  [OPENROUTER_MODELS.CLAUDE_HAIKU_4]: { 
    name: 'Claude Haiku 4', 
    provider: 'Anthropic',
    description: 'Fast and efficient (JSON via tool calling)'
  },

  [OPENROUTER_MODELS.GPT_4O]: { 
    name: 'GPT-4 Omni', 
    provider: 'OpenAI',
    description: 'Multimodal model with vision and JSON support'
  },
  [OPENROUTER_MODELS.GPT_4O_MINI]: { 
    name: 'GPT-4 Omni Mini', 
    provider: 'OpenAI',
    description: 'Efficient multimodal model with fast responses'
  },
  [OPENROUTER_MODELS.O3_PRO]: { 
    name: 'O3 Pro', 
    provider: 'OpenAI',
    description: 'Most intelligent reasoning model with extended thinking'
  },
  [OPENROUTER_MODELS.O3]: { 
    name: 'O3', 
    provider: 'OpenAI',
    description: 'Advanced reasoning with tool use capabilities'
  },
  // [OPENROUTER_MODELS.O3_DEEP_RESEARCH]: { 
  //   name: 'O3 Deep Research', 
  //   provider: 'OpenAI',
  //   description: 'Optimized for complex research and analysis tasks'
  // },
  [OPENROUTER_MODELS.O3_PRO_2025_06_10]: { 
    name: 'O3 Pro (2025-06-10)', 
    provider: 'OpenAI',
    description: 'Latest O3 Pro with enhanced capabilities'
  },
  [OPENROUTER_MODELS.O4_MINI]: { 
    name: 'O4 Mini', 
    provider: 'OpenAI',
    description: 'Fast reasoning optimized for math, coding, and visual tasks'
  },
  
  // Google Models
  [OPENROUTER_MODELS.GEMINI_2_5_PRO]: { 
    name: 'Gemini 2.5 Pro', 
    provider: 'Google',
    description: 'Google\'s most capable model with native search grounding (Direct API when available)'
  },
  [OPENROUTER_MODELS.GEMINI_2_5_FLASH]: { 
    name: 'Gemini 2.5 Flash', 
    provider: 'Google',
    description: 'Fast and reliable with native search grounding (Direct API when available)'
  },
  
  // Mistral Models
  [OPENROUTER_MODELS.MISTRAL_MEDIUM_3]: { 
    name: 'Mistral Medium 3', 
    provider: 'Mistral',
    description: 'Balanced open-source model'
  },
  
  // DeepSeek Models
  [OPENROUTER_MODELS.DEEPSEEK_R1_0528]: { 
    name: 'DeepSeek R1', 
    provider: 'DeepSeek',
    description: 'Cost-effective with good performance'
  },
  
  // Grok Models
  [OPENROUTER_MODELS.GROK_4]: { 
    name: 'Grok 4', 
    provider: 'X.AI',
    description: 'Latest Grok model'
  },
  // [OPENROUTER_MODELS.GROK_3]: { 
  //   name: 'Grok 3', 
  //   provider: 'X.AI',
  //   description: 'Powerful reasoning capabilities'
  // },
  // [OPENROUTER_MODELS.GROK_3_MINI]: { 
  //   name: 'Grok 3 Mini', 
  //   provider: 'X.AI',
  //   description: 'Lightweight and fast'
  // },
  
  // Additional models
  // [OPENROUTER_MODELS.CODEX_MINI]: { 
  //   name: 'Codex Mini', 
  //   provider: 'OpenAI',
  //   description: 'Code-optimized model (Native JSON support)'
  // },
  [OPENROUTER_MODELS.LLAMA_GUARD_4_12B]: { 
    name: 'Llama Guard 4', 
    provider: 'Meta',
    description: 'Safety-focused model'
  },
  [OPENROUTER_MODELS.MAGISTRAL_MEDIUM_2506]: { 
    name: 'Magistral Medium', 
    provider: 'Mistral',
    description: 'Balanced general purpose'
  },
  [OPENROUTER_MODELS.MISTRAL_SMALL_3_2]: { 
    name: 'Mistral Small 3.2', 
    provider: 'Mistral',
    description: '24B parameter model'
  },
  [OPENROUTER_MODELS.DEEPSEEK_R1_DISTILL]: { 
    name: 'DeepSeek R1 Distill', 
    provider: 'DeepSeek',
    description: 'Distilled efficient model'
  },
  [OPENROUTER_MODELS.DEEPSEEK_R1_QWEN3_8B]: { 
    name: 'DeepSeek R1 Qwen3', 
    provider: 'DeepSeek',
    description: '8B parameter model'
  },
  [OPENROUTER_MODELS.QWEN3_235B]: { 
    name: 'Qwen3 235B', 
    provider: 'Qwen',
    description: 'Largest Qwen model'
  },
  [OPENROUTER_MODELS.QWEN3_32B]: { 
    name: 'Qwen3 32B', 
    provider: 'Qwen',
    description: 'Large general purpose'
  },
  [OPENROUTER_MODELS.QWEN3_14B]: { 
    name: 'Qwen3 14B', 
    provider: 'Qwen',
    description: 'Medium-sized model'
  },
  [OPENROUTER_MODELS.QWEN3_8B]: { 
    name: 'Qwen3 8B', 
    provider: 'Qwen',
    description: 'Efficient small model'
  },
  [OPENROUTER_MODELS.QWEN3_4B]: { 
    name: 'Qwen3 4B', 
    provider: 'Qwen',
    description: 'Compact and fast'
  },
};

// Group models by provider
function getGroupedModels() {
  const grouped: Record<string, Array<{ 
    id: string; 
    name: string; 
    description: string; 
    supportsJSON: boolean;
    providerInfo: { provider: string; isDirect: boolean; supportsGrounding: boolean };
  }>> = {};
  
  Object.entries(MODEL_DISPLAY_INFO).forEach(([id, info]) => {
    if (!grouped[info.provider]) {
      grouped[info.provider] = [];
    }
    
    const providerInfo = llmOrchestrator.getProviderInfo(id);
    
    grouped[info.provider].push({
      id,
      name: info.name,
      description: info.description,
      supportsJSON: llmOrchestrator.isJSONCapable(id),
      providerInfo
    });
  });
  
  // Reorder providers to put Google first (preferred due to grounding support)
  const providerOrder = ['Google', 'Anthropic', 'OpenAI', 'Mistral', 'DeepSeek', 'X.AI', 'Meta', 'Qwen'];
  const orderedGrouped: Record<string, Array<{ 
    id: string; 
    name: string; 
    description: string; 
    supportsJSON: boolean;
    providerInfo: { provider: string; isDirect: boolean; supportsGrounding: boolean };
  }>> = {};
  
  // Add providers in the specified order
  providerOrder.forEach(provider => {
    if (grouped[provider]) {
      orderedGrouped[provider] = grouped[provider];
    }
  });
  
  // Add any remaining providers that weren't in the order list
  Object.keys(grouped).forEach(provider => {
    if (!orderedGrouped[provider]) {
      orderedGrouped[provider] = grouped[provider];
    }
  });
  
  return orderedGrouped;
}

// Get available models and current preference
modelPreferencesRouter.get('/models', ensureValidToken, async (req, res) => {
  try {
    const availableModels = getGroupedModels();
    
    // Get user preference from Redis
    const userId = getUserIdFromRequest(req);
    let currentPreference = OPENROUTER_MODELS.GEMINI_2_5_FLASH;
    
    if (userId) {
      const savedPreference = await getUserModelPreference(userId);
      if (savedPreference && MODEL_DISPLAY_INFO[savedPreference]) {
        currentPreference = savedPreference;
      }
    }
    
    res.json({
      models: availableModels,
      currentModel: currentPreference,
      defaultModel: OPENROUTER_MODELS.GEMINI_2_5_FLASH
    });
  } catch (error) {
    console.error('Error fetching model preferences:', error);
    res.status(500).json({ 
      error: 'Failed to fetch model preferences',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Update user's preferred model
modelPreferencesRouter.post('/models', ensureValidToken, async (req, res) => {
  try {
    const { modelId } = req.body;
    
    // Validate model ID
    if (!modelId || !MODEL_DISPLAY_INFO[modelId]) {
      return res.status(400).json({ 
        error: 'Invalid model ID',
        availableModels: Object.keys(MODEL_DISPLAY_INFO)
      });
    }
    
    // Get user ID and save preference to Redis
    const userId = getUserIdFromRequest(req);
    if (userId) {
      await setUserModelPreference(userId, modelId);
    }
    
    res.json({
      success: true,
      modelId,
      modelInfo: MODEL_DISPLAY_INFO[modelId]
    });
  } catch (error) {
    console.error('Error updating model preference:', error);
    res.status(500).json({ 
      error: 'Failed to update model preference',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get model capabilities (for display purposes)
modelPreferencesRouter.get('/models/:modelId/capabilities', ensureValidToken, async (req, res) => {
  try {
    const { modelId } = req.params;
    
    if (!MODEL_DISPLAY_INFO[modelId]) {
      return res.status(404).json({ error: 'Model not found' });
    }
    
    const isJSONCapable = llmOrchestrator.isJSONCapable(modelId);
    
    const providerInfo = llmOrchestrator.getProviderInfo(modelId);
    
    res.json({
      modelId,
      ...MODEL_DISPLAY_INFO[modelId],
      capabilities: {
        supportsJSON: isJSONCapable,
        contextWindow: getContextWindow(modelId),
        supportsGrounding: providerInfo.supportsGrounding,
        isDirect: providerInfo.isDirect
      },
      providerInfo
    });
  } catch (error) {
    console.error('Error fetching model capabilities:', error);
    res.status(500).json({ 
      error: 'Failed to fetch model capabilities',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Helper function to get context window size
function getContextWindow(modelId: string): string {
  // This is approximate based on the model
  if (modelId.includes('claude')) return '200K tokens';
  if (modelId.includes('gemini')) return '1M tokens';
  if (modelId.includes('gpt-4.1')) return '1M tokens';
  if (modelId.includes('gpt-4o')) return '128K tokens';
  if (modelId.includes('o1') || modelId.includes('o3') || modelId.includes('o4')) return '200K tokens';
  if (modelId.includes('mistral')) return '32K tokens';
  if (modelId.includes('deepseek')) return '64K tokens';
  if (modelId.includes('grok')) return '100K tokens';
  return 'Standard';
}