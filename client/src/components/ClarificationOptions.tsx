import React from 'react';

interface ClarificationOption {
  direction: string;
  description: string;
  example: string;
  icon: string;
  followUpQuery?: string;
}

interface ClarificationResponse {
  intent: 'clarification_mode';
  options: ClarificationOption[];
  responseMessage: string;
  currentContext?: {
    rejected: string;
    rejectionType: string;
  };
  uiType?: string;
}

interface ClarificationOptionsProps {
  response: ClarificationResponse;
  onOptionSelect: (direction: string, followUpQuery?: string) => void;
}

export const ClarificationOptions: React.FC<ClarificationOptionsProps> = ({ 
  response, 
  onOptionSelect 
}) => {
  const handleOptionClick = (option: ClarificationOption) => {
    // Use followUpQuery if provided, otherwise create a queue multiple songs command
    const query = option.followUpQuery || `queue up several ${option.description.toLowerCase()} songs`;
    onOptionSelect(option.direction, query);
  };

  return (
    <div className="clarification-container bg-zinc-800/50 rounded-lg p-4 my-3 border border-zinc-700/50">
      <div className="clarification-message mb-3">
        {response.currentContext && (
          <p className="text-zinc-400 text-xs mb-2">
            Not feeling {response.currentContext.rejected} right now
          </p>
        )}
      </div>
      
      <div className="options-grid grid grid-cols-1 sm:grid-cols-2 gap-2">
        {response.options.map((option) => (
          <button
            key={option.direction}
            className="option-card bg-zinc-700/50 border border-zinc-600/50 rounded-lg p-3 hover:bg-zinc-600/50 hover:border-zinc-500/50 transition-all duration-200 text-left group cursor-pointer"
            onClick={() => handleOptionClick(option)}
          >
            <div className="flex items-start space-x-3">
              <span 
                className="option-icon text-lg flex-shrink-0 mt-0.5"
                role="img"
                aria-label={option.description}
              >
                {option.icon}
              </span>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-medium text-white group-hover:text-green-400 transition-colors">
                  {option.description}
                </h4>
                <p className="text-xs text-zinc-400 mt-1">
                  {option.example}
                </p>
              </div>
            </div>
          </button>
        ))}
      </div>
      
      <div className="mt-3 pt-3 border-t border-zinc-700/50">
        <p className="text-xs text-zinc-500 text-center">
          Choose a direction above or type your own request
        </p>
      </div>
    </div>
  );
};

export default ClarificationOptions;