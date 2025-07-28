import React from 'react';
import MusicLoader from './MusicLoader';

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  isProcessing: boolean;
  onShowExamples: () => void;
  currentModel: string;
}

const ChatInput: React.FC<ChatInputProps> = ({
  value,
  onChange,
  onSubmit,
  isProcessing,
  onShowExamples,
  currentModel
}) => {
  return (
    <div className="chat-input-container">
      <div className="container mx-auto px-4 pt-4 pb-2" style={{ maxWidth: '1440px' }}>
        <form onSubmit={onSubmit} className="relative">
          <div className="flex items-center gap-3">
            <div className="flex-1 relative">
              <input
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder="Type your command..."
                disabled={isProcessing}
                className="w-full px-4 py-3 pr-20 bg-zinc-800 border border-zinc-700 rounded-full text-white placeholder-gray-500 focus:outline-none focus:border-green-500 transition-colors"
                inputMode="text"
                enterKeyHint="send"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2">
                <button
                  type="submit"
                  disabled={isProcessing || !value.trim()}
                  className="px-4 py-1.5 bg-green-500 text-black font-bold rounded-full hover:bg-green-400 disabled:bg-gray-600 disabled:text-gray-400 transition-all transform hover:scale-105 disabled:scale-100"
                >
                  {isProcessing ? '...' : 'Send'}
                </button>
              </div>
            </div>
          </div>
          {isProcessing && (
            <div className="absolute -top-20 left-1/2 -translate-x-1/2">
              <MusicLoader modelName={currentModel} />
            </div>
          )}
        </form>
        
        {/* Controls section below input */}
        <div className="mt-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={onShowExamples}
              className="px-3 py-1.5 bg-zinc-700 text-gray-300 text-sm font-medium rounded-lg hover:bg-zinc-600 hover:text-white transition-all"
            >
              Examples
            </button>
            
            {/* Dummy toggle for future features */}
            <label className="flex items-center gap-2 cursor-pointer">
              <span className="text-gray-400 text-sm">Enhanced Mode</span>
              <div className="relative">
                <input type="checkbox" className="sr-only peer" />
                <div className="w-11 h-6 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
              </div>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatInput;