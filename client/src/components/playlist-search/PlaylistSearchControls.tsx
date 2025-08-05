import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Zap, Search, Brain, Sparkles, ListMusic, Music2, LayoutGrid } from 'lucide-react';
import { Slider } from '../ui/slider';
import { cn } from '../../lib/utils';

interface PlaylistSearchControlsProps {
  playlistLimit: number;
  trackSampleSize: number;
  renderLimit: number;
  onPlaylistLimitChange: (value: number) => void;
  onTrackSampleSizeChange: (value: number) => void;
  onRenderLimitChange: (value: number) => void;
}

interface Preset {
  name: string;
  playlistLimit: number;
  trackSampleSize: number;
  renderLimit: number;
  icon: React.ReactNode;
}

const presets: Preset[] = [
  { name: 'Quick', playlistLimit: 10, trackSampleSize: 10, renderLimit: 3, icon: <Zap className="w-3 h-3" /> },
  { name: 'Standard', playlistLimit: 50, trackSampleSize: 30, renderLimit: 5, icon: <Search className="w-3 h-3" /> },
  { name: 'Deep', playlistLimit: 100, trackSampleSize: 50, renderLimit: 8, icon: <Brain className="w-3 h-3" /> },
  { name: 'Maximum', playlistLimit: 200, trackSampleSize: 100, renderLimit: 10, icon: <Sparkles className="w-3 h-3" /> },
];

// Custom slider component with gradient styling
const GradientSlider: React.FC<{
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  className?: string;
}> = ({ value, onChange, min, max, className }) => {
  const gradient = useMemo(() => {
    const percentage = ((value - min) / (max - min)) * 100;
    if (percentage <= 33) {
      return 'linear-gradient(to right, rgb(74 222 128), rgb(22 163 74))';
    } else if (percentage <= 66) {
      return 'linear-gradient(to right, rgb(250 204 21), rgb(202 138 4))';
    } else {
      return 'linear-gradient(to right, rgb(248 113 113), rgb(220 38 38))';
    }
  }, [value, min, max]);

  return (
    <div className={cn("relative", className)}>
      <Slider
        value={[value]}
        onValueChange={(values) => onChange(values[0])}
        min={min}
        max={max}
        step={1}
        className={cn(
          "w-full",
          // Custom styling for the range fill
          "[&_[data-slot=slider-range]]:bg-transparent"
        )}
      />
      {/* Custom gradient overlay for the range */}
      <div 
        className="absolute top-1/2 left-0 h-1.5 -translate-y-1/2 rounded-full pointer-events-none"
        style={{
          background: gradient,
          width: `${((value - min) / (max - min)) * 100}%`,
        }}
      />
    </div>
  );
};

const PlaylistSearchControls: React.FC<PlaylistSearchControlsProps> = ({
  playlistLimit,
  trackSampleSize,
  renderLimit,
  onPlaylistLimitChange,
  onTrackSampleSizeChange,
  onRenderLimitChange
}) => {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <div className="space-y-3">
      {/* Collapsible Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between w-full text-left group"
      >
        <span className="text-sm font-medium text-zinc-300 group-hover:text-white transition-colors">
          Advanced Options
        </span>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-zinc-400 group-hover:text-white transition-colors" />
        ) : (
          <ChevronDown className="w-4 h-4 text-zinc-400 group-hover:text-white transition-colors" />
        )}
      </button>
      
      {/* Collapsible Content */}
      <div className={`transition-all duration-300 overflow-hidden ${isExpanded ? 'max-h-96' : 'max-h-0'}`}>
        <div className="bg-zinc-900/50 rounded-lg p-4 space-y-4">
          {/* Preset Buttons */}
          <div className="flex flex-wrap gap-2">
            {presets.map((preset) => (
              <button
                key={preset.name}
                onClick={() => {
                  onPlaylistLimitChange(preset.playlistLimit);
                  onTrackSampleSizeChange(preset.trackSampleSize);
                  onRenderLimitChange(preset.renderLimit);
                }}
                className="flex items-center gap-1 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-600 rounded-md text-xs text-zinc-300 hover:text-white transition-all"
              >
                {preset.icon}
                {preset.name}
              </button>
            ))}
          </div>
          
          {/* Divider */}
          <div className="border-b border-zinc-800"></div>
          
          {/* Sliders Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Playlist Limit Slider */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-xs font-medium text-zinc-300">
                  <ListMusic className="w-3 h-3" />
                  Playlists to fetch
                </label>
                <span className="px-2 py-0.5 bg-zinc-700 rounded-full text-xs font-mono text-zinc-300">
                  {playlistLimit}
                </span>
              </div>
              <GradientSlider
                value={playlistLimit}
                onChange={onPlaylistLimitChange}
                min={1}
                max={200}
              />
              <div className="flex justify-between text-xs text-zinc-500">
                <span>1</span>
                <span>200</span>
              </div>
            </div>

            {/* Track Sample Size Slider */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-xs font-medium text-zinc-300">
                  <Music2 className="w-3 h-3" />
                  Songs to sample
                </label>
                <span className="px-2 py-0.5 bg-zinc-700 rounded-full text-xs font-mono text-zinc-300">
                  {trackSampleSize}
                </span>
              </div>
              <GradientSlider
                value={trackSampleSize}
                onChange={onTrackSampleSizeChange}
                min={10}
                max={100}
              />
              <div className="flex justify-between text-xs text-zinc-500">
                <span>10</span>
                <span>100</span>
              </div>
            </div>

            {/* Render Limit Slider */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-xs font-medium text-zinc-300">
                  <LayoutGrid className="w-3 h-3" />
                  Results to show
                </label>
                <span className="px-2 py-0.5 bg-zinc-700 rounded-full text-xs font-mono text-zinc-300">
                  {renderLimit}
                </span>
              </div>
              <GradientSlider
                value={renderLimit}
                onChange={onRenderLimitChange}
                min={1}
                max={10}
              />
              <div className="flex justify-between text-xs text-zinc-500">
                <span>1</span>
                <span>10</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlaylistSearchControls;