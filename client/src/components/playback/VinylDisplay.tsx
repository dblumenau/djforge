import React from 'react';
import { Music } from 'lucide-react';

interface VinylDisplayProps {
  albumArt?: string | null;
  albumName?: string;
  rotation: number;
  size: 'sm' | 'md' | 'lg' | 'xl';
  showGlow?: boolean;
}

const VinylDisplay: React.FC<VinylDisplayProps> = ({ 
  albumArt, 
  albumName = 'Album', 
  rotation, 
  size = 'md',
  showGlow = false 
}) => {
  // Size configurations
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-48 h-48 md:w-56 md:h-56',
    lg: 'w-[650px] h-[650px] md:w-[750px] md:h-[750px]',
    xl: 'w-[650px] h-[650px] md:w-[750px] md:h-[750px] lg:w-[850px] lg:h-[850px]'
  };

  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-16 h-16 md:w-20 md:h-20',
    lg: 'w-48 h-48',
    xl: 'w-48 h-48'
  };

  return (
    <div className="relative flex-shrink-0">
      {/* Localized glow effect */}
      {showGlow && albumArt && (
        <div 
          className="absolute -inset-4 bg-cover bg-center filter blur-[30px] opacity-40 rounded-full"
          style={{ 
            backgroundImage: `url(${albumArt})`,
            transform: `rotate(${rotation}deg) translateZ(0)`,
            backfaceVisibility: 'hidden'
          }}
        />
      )}
      
      {/* Main vinyl disc */}
      {albumArt ? (
        size === 'sm' ? (
          // Small size uses img tag for mini display
          <img 
            src={albumArt} 
            alt={albumName}
            className={`${sizeClasses[size]} rounded-full shadow object-cover`}
            style={{ transform: `rotate(${rotation}deg)` }}
          />
        ) : (
          // Larger sizes use div with background for better performance
          <div 
            className={`${sizeClasses[size]} rounded-full shadow-2xl relative z-10 overflow-hidden`}
            style={{ 
              backgroundImage: `url(${albumArt})`,
              backgroundSize: '100% 100%',
              backgroundPosition: 'center',
              transform: `rotate(${rotation}deg)`,
              boxShadow: size === 'xl' 
                ? '0 0 80px rgba(0, 0, 0, 0.8), 0 0 120px rgba(0, 0, 0, 0.5)'
                : size === 'lg'
                ? '0 0 80px rgba(0, 0, 0, 0.8)'
                : undefined
            }}
          />
        )
      ) : (
        // Fallback with Music icon
        <div 
          className={`${sizeClasses[size]} rounded-full bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center ${size === 'sm' ? 'shadow' : 'shadow-2xl relative z-10'}`}
          style={{ 
            transform: `rotate(${rotation}deg)`,
            boxShadow: size === 'xl' 
              ? '0 0 80px rgba(0, 0, 0, 0.8)'
              : undefined
          }}
        >
          <Music className={`${iconSizes[size]} ${size === 'sm' ? 'text-gray-400' : 'text-gray-500'}`} />
        </div>
      )}
    </div>
  );
};

export default VinylDisplay;