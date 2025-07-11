import React from 'react';
import './MusicLoader.css';

const MusicLoader: React.FC = () => {
  return (
    <div className="music-loader">
      <div className="thought-bubble">
        <div className="music-notes">
          <span className="note note-1">♪</span>
          <span className="note note-2">♫</span>
          <span className="note note-3">♪</span>
          <span className="note note-4">♬</span>
        </div>
        <div className="thinking-text">Claude is thinking...</div>
      </div>
    </div>
  );
};

export default MusicLoader;