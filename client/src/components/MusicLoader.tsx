import React from 'react';
import './MusicLoader.css';

interface MusicLoaderProps {
  modelName?: string;
}

const MusicLoader: React.FC<MusicLoaderProps> = ({ modelName = 'AI' }) => {
  // Extract a display name from the model ID
  const getDisplayName = (model: string): string => {
    if (model.includes('claude')) return 'Claude';
    if (model.includes('gpt') || model.includes('o1') || model.includes('o3')) return 'OpenAI';
    if (model.includes('gemini')) return 'Gemini';
    if (model.includes('llama')) return 'Llama';
    if (model.includes('mistral')) return 'Mistral';
    if (model.includes('grok')) return 'Grok';
    if (model.includes('deepseek')) return 'DeepSeek';
    if (model.includes('mixtral')) return 'Mixtral';
    if (model.includes('qwen')) return 'Qwen';
    if (model.includes('yi')) return 'Yi';
    // If no match, try to extract a clean name from the model ID
    const parts = model.split('/');
    const lastPart = parts[parts.length - 1];
    // Capitalize first letter
    return lastPart.charAt(0).toUpperCase() + lastPart.slice(1).toLowerCase();
  };

  const displayName = getDisplayName(modelName.toLowerCase());

  return (
    <div className="music-loader">
      <div className="thought-bubble">
        <div className="music-notes">
          <span className="note note-1">♪</span>
          <span className="note note-2">♫</span>
          <span className="note note-3">♪</span>
          <span className="note note-4">♬</span>
        </div>
        <div className="thinking-text">{displayName} is thinking...</div>
      </div>
    </div>
  );
};

export default MusicLoader;