import { apiEndpoint } from '../config/api';

export interface ModelInfo {
  id: string;
  name: string;
  description: string;
  supportsJSON: boolean;
}

export interface GroupedModels {
  [provider: string]: ModelInfo[];
}

export interface ModelPreferencesResponse {
  models: GroupedModels;
  currentModel: string;
  defaultModel: string;
}

export interface ModelCapabilities {
  modelId: string;
  name: string;
  provider: string;
  description: string;
  capabilities: {
    supportsJSON: boolean;
    contextWindow: string;
  };
}

export class ModelAPI {
  static async getModelPreferences(): Promise<ModelPreferencesResponse> {
    const response = await fetch(apiEndpoint('/api/preferences/models'), {
      credentials: 'include',
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch model preferences');
    }
    
    return response.json();
  }

  static async setModelPreference(modelId: string): Promise<{ success: boolean; modelInfo: any }> {
    const response = await fetch(apiEndpoint('/api/preferences/models'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ modelId }),
    });
    
    if (!response.ok) {
      throw new Error('Failed to update model preference');
    }
    
    return response.json();
  }

  static async getModelCapabilities(modelId: string): Promise<ModelCapabilities> {
    const response = await fetch(apiEndpoint(`/api/preferences/models/${modelId}/capabilities`), {
      credentials: 'include',
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch model capabilities');
    }
    
    return response.json();
  }
}