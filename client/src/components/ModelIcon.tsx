import React from 'react';

interface ModelIconProps {
  model?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const ModelIcon: React.FC<ModelIconProps> = ({ model, size = 'md', className = '' }) => {
  const sizeClasses = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8', 
    lg: 'w-10 h-10'
  };

  const getModelProvider = (modelName?: string): string => {
    if (!modelName) return 'generic';
    
    const name = modelName.toLowerCase();
    
    if (name.includes('gemini') || name.includes('google')) return 'gemini';
    if (name.includes('claude') || name.includes('anthropic')) return 'claude';
    if (name.includes('deepseek')) return 'deepseek';
    if (name.includes('openai') || name.includes('gpt') || name.includes('o1') || name.includes('o3')) return 'openai';
    if (name.includes('llama') || name.includes('meta')) return 'meta';
    if (name.includes('mistral')) return 'mistral';
    
    return 'generic';
  };

  const provider = getModelProvider(model);

  const renderIcon = () => {
    switch (provider) {
      case 'gemini':
        return (
          <img
            src="/gemini_icon.png"
            alt="Gemini"
            className={`${sizeClasses[size]} rounded-full object-cover ${className}`}
          />
        );
        
      case 'claude':
        return (
          <img
            src="/claude_app_icon.png"
            alt="Claude"
            className={`${sizeClasses[size]} rounded-full object-cover ${className}`}
          />
        );
        
      case 'deepseek':
        return (
          <img
            src="/deepseek_icon.webp"
            alt="DeepSeek"
            className={`${sizeClasses[size]} rounded-full object-cover ${className}`}
          />
        );
        
      case 'openai':
        return (
          <div className={`${sizeClasses[size]} rounded-full bg-gradient-to-r from-green-400 to-blue-500 flex items-center justify-center ${className}`}>
            <svg viewBox="0 0 24 24" className="w-4 h-4 text-white" fill="currentColor">
              <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.078 6.078 0 0 0 6.469 2.839A5.991 5.991 0 0 0 12 22.35a6.023 6.023 0 0 0 3.258-.955 5.99 5.99 0 0 0 4.007-2.84 6.056 6.056 0 0 0-.753-7.112Z" />
            </svg>
          </div>
        );
        
      case 'meta':
        return (
          <div className={`${sizeClasses[size]} rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center ${className}`}>
            <span className="text-white font-bold text-xs">M</span>
          </div>
        );
        
      case 'mistral':
        return (
          <div className={`${sizeClasses[size]} rounded-full bg-gradient-to-r from-orange-500 to-red-600 flex items-center justify-center ${className}`}>
            <span className="text-white font-bold text-xs">🌪️</span>
          </div>
        );
        
      default:
        return (
          <div className={`${sizeClasses[size]} rounded-full bg-zinc-700 flex items-center justify-center ${className}`}>
            <span className="text-white font-bold text-xs">AI</span>
          </div>
        );
    }
  };

  return renderIcon();
};

export default ModelIcon;