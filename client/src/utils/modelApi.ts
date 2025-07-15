import { authenticatedFetch } from './api';

export interface ModelInfo {
  id: string;
  name: string;
  description: string;
  supportsJSON: boolean;
  providerInfo?: {
    provider: string;
    isDirect: boolean;
    supportsGrounding: boolean;
  };
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
    supportsGrounding?: boolean;
    isDirect?: boolean;
  };
  providerInfo?: {
    provider: string;
    isDirect: boolean;
    supportsGrounding: boolean;
  };
}

export class ModelAPI {
  static async getModelPreferences(): Promise<ModelPreferencesResponse> {
    console.log('here fails?');
    const response = await authenticatedFetch('/api/preferences/models');
    console.log(response);
    console.log('no');
    if (!response.ok) {
      throw new Error('Failed to fetch model preferences');
    }
    
    return response.json();
  }

  static async setModelPreference(modelId: string): Promise<{ success: boolean; modelInfo: any }> {
    const response = await authenticatedFetch('/api/preferences/models', {
      method: 'POST',
      body: JSON.stringify({ modelId }),
    });
    
    if (!response.ok) {
      throw new Error('Failed to update model preference');
    }
    
    return response.json();
  }

  static async getModelCapabilities(modelId: string): Promise<ModelCapabilities> {
    const response = await authenticatedFetch(`/api/preferences/models/${modelId}/capabilities`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch model capabilities');
    }
    
    return response.json();
  }
}