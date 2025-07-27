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
    <div className="fixed bottom-0 left-0 right-0 bg-zinc-900/95 backdrop-blur-sm border-t border-zinc-800 z-20">
      <div className="container mx-auto px-4 py-4" style={{ maxWidth: '1440px' }}>
        <form onSubmit={onSubmit} className="relative">
          <div className="flex items-center gap-3">
            <div className="flex-1 relative">
              <input
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder="Type your command..."
                disabled={isProcessing}
                className="w-full px-4 py-3 pr-32 bg-zinc-800 border border-zinc-700 rounded-full text-white placeholder-gray-500 focus:outline-none focus:border-green-500 transition-colors"
                autoFocus
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                inputMode="text"
                enterKeyHint="send"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={onShowExamples}
                  className="text-gray-400 hover:text-gray-300 text-sm px-2 py-1 hover:bg-zinc-700 rounded transition-all"
                >
                  Examples
                </button>
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
      </div>
    </div>
  );
};

export default ChatInput;