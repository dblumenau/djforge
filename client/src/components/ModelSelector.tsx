import React, { useState, useEffect } from 'react';
import { ModelAPI, ModelPreferencesResponse, ModelInfo } from '../utils/modelApi';

interface ModelSelectorProps {
  onModelChange?: (modelId: string) => void;
  compact?: boolean;
  fullWidth?: boolean;
}

const ModelSelector: React.FC<ModelSelectorProps> = ({ onModelChange, compact = false, fullWidth = false }) => {
  const [models, setModels] = useState<ModelPreferencesResponse | null>(null);
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    loadModelPreferences();
  }, []);

  const loadModelPreferences = async () => {
    try {
      setIsLoading(true);
      const prefs = await ModelAPI.getModelPreferences();
      setModels(prefs);
      setSelectedModel(prefs.currentModel);
      if (onModelChange) {
        onModelChange(prefs.currentModel);
      }
    } catch (err) {
      setError('Failed to load model preferences');
      console.error('Error loading models:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleModelSelect = async (modelId: string) => {
    try {
      setIsSaving(true);
      setSaveSuccess(false);
      await ModelAPI.setModelPreference(modelId);
      setSelectedModel(modelId);
      setShowDropdown(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
      if (onModelChange) {
        onModelChange(modelId);
      }
    } catch (err) {
      setError('Failed to save model preference');
      console.error('Error saving model:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const getSelectedModelInfo = (): ModelInfo | null => {
    if (!models) return null;
    
    for (const provider in models.models) {
      const model = models.models[provider].find(m => m.id === selectedModel);
      if (model) return model;
    }
    return null;
  };

  const selectedModelInfo = getSelectedModelInfo();

  if (isLoading) {
    return (
      <div className="flex items-center space-x-2 text-gray-400">
        <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
        <span className="text-sm">Loading models...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-red-400 text-sm">
        {error}
      </div>
    );
  }

  return (
    <div className={`relative ${fullWidth ? 'w-full' : ''}`}>
      {/* Model Selector Button */}
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className={`
          flex items-center space-x-2 ${compact ? 'px-3 py-1.5' : 'px-4 py-2'} rounded-lg
          bg-gray-800 border border-gray-700 hover:border-green-500
          transition-all duration-200 text-sm
          ${showDropdown ? 'border-green-500' : ''}
          ${fullWidth ? 'w-full justify-between' : ''}
        `}
      >
        <svg className="w-4 h-4 text-green-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
        <span className={`text-gray-300 truncate ${compact ? 'max-w-[100px]' : 'max-w-[150px] md:max-w-none'}`}>
          {selectedModelInfo ? selectedModelInfo.name : 'Select Model'}
        </span>
        {!compact && (
          <>
            {/* {selectedModelInfo?.supportsJSON && (
              <span className="hidden sm:inline text-xs text-green-400 bg-green-900/30 px-2 py-0.5 rounded">
                JSON
              </span>
            )} */}
            {/* {selectedModelInfo?.providerInfo?.supportsGrounding && (
              <span className="hidden sm:inline text-xs text-blue-400 bg-blue-900/30 px-2 py-0.5 rounded">
                🔍 Grounding
              </span>
            )} */}
            {/* {selectedModelInfo?.providerInfo?.isDirect && (
              <span className="hidden sm:inline text-xs text-yellow-400 bg-yellow-900/30 px-2 py-0.5 rounded">
                Direct
              </span>
            )} */}
          </>
        )}
        <svg 
          className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${showDropdown ? 'rotate-180' : ''}`} 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Save Success Indicator */}
      {saveSuccess && (
        <div className="absolute top-0 right-0 -mt-8 bg-green-900/50 text-green-400 px-3 py-1 rounded text-xs">
          ✓ Model preference saved
        </div>
      )}

      {/* Dropdown Menu */}
      {showDropdown && models && (
        <div className="model-selector-dropdown absolute top-full left-0 mt-1 w-80 md:w-96 lg:w-[28rem] xl:w-[32rem] max-h-[32rem] overflow-y-auto bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50">
          {Object.entries(models.models).map(([provider, providerModels]) => (
            <div key={provider} className="border-b border-gray-700 last:border-0">
              <div className="px-3 md:px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                {provider}
              </div>
              {providerModels.map((model) => (
                <button
                  key={model.id}
                  onClick={() => handleModelSelect(model.id)}
                  disabled={isSaving}
                  className={`
                    w-full text-left px-3 md:px-4 py-2 md:py-3 hover:bg-gray-700 transition-colors
                    ${model.id === selectedModel ? 'bg-gray-700/50' : ''}
                    ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}
                  `}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-medium text-gray-200 text-sm md:text-base">
                          {model.name}
                        </span>
                        {model.id === models.defaultModel && (
                          <span className="text-xs text-blue-400 bg-blue-900/30 px-2 py-0.5 rounded">
                            Default
                          </span>
                        )}
                        {model.id === selectedModel && (
                          <span className="text-xs text-green-400">
                            ✓ Current
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 mt-1 line-clamp-2 md:line-clamp-none">
                        {model.description}
                      </p>
                    </div>
                    <div className="ml-2 md:ml-4 hidden sm:flex items-center space-x-2">
                      {model.supportsJSON ? (
                        <div className="flex items-center text-green-400" title="Supports JSON output mode">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          <span className="text-xs ml-1">JSON</span>
                        </div>
                      ) : (
                        <div className="flex items-center text-gray-500" title="No JSON output mode">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                          <span className="text-xs ml-1">JSON</span>
                        </div>
                      )}
                      
                      {model.providerInfo?.supportsGrounding && (
                        <div className="flex items-center text-blue-400" title="Supports native Google Search grounding">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                          </svg>
                          <span className="text-xs ml-1">Search</span>
                        </div>
                      )}
                      
                      {model.providerInfo?.isDirect && (
                        <div className="flex items-center text-yellow-400" title="Uses direct API (not OpenRouter)">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                          <span className="text-xs ml-1">Direct</span>
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Click outside to close */}
      {showDropdown && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowDropdown(false)}
        />
      )}
    </div>
  );
};

export default ModelSelector;