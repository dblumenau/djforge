import React from 'react';

interface HeartIconProps {
  filled: boolean;
  loading?: boolean;
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
  className?: string;
}

const HeartIcon: React.FC<HeartIconProps> = ({ 
  filled, 
  loading = false, 
  size = 'md', 
  onClick,
  className = '' 
}) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6'
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!loading && onClick) {
      onClick();
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className={`
        relative transition-all duration-200
        ${onClick ? 'hover:scale-110 cursor-pointer' : 'cursor-default'}
        ${loading ? 'opacity-50 cursor-wait' : ''}
        ${className}
      `}
      title={filled ? 'Remove from Liked Songs' : 'Save to Liked Songs'}
    >
      {filled ? (
        <svg 
          className={`${sizeClasses[size]} text-green-500`} 
          fill="currentColor" 
          viewBox="0 0 24 24"
        >
          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
        </svg>
      ) : (
        <svg 
          className={`${sizeClasses[size]} text-gray-400 hover:text-white`} 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
        </svg>
      )}
      
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className={`animate-spin rounded-full border-2 border-white border-t-transparent ${
            size === 'sm' ? 'w-3 h-3' : size === 'md' ? 'w-4 h-4' : 'w-5 h-5'
          }`} />
        </div>
      )}
    </button>
  );
};

export default HeartIcon;