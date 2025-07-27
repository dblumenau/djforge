import { EventEmitter } from 'events';

export interface PlaybackEvent {
  type: 'playback:started' | 'playback:queued' | 'playback:paused' | 
        'playback:resumed' | 'playback:skipped' | 'playback:previous' |
        'playback:volume' | 'playback:shuffle' | 'playback:repeat' |
        'playback:cleared' | 'playback:state_changed';
  timestamp: number;
  userId?: string;
  data?: {
    track?: string;
    artist?: string;
    action?: string;
    volume?: number;
    state?: boolean;
    mode?: string;
  };
}

class PlaybackEventService extends EventEmitter {
  private static instance: PlaybackEventService;

  private constructor() {
    super();
    this.setMaxListeners(100); // Allow many SSE connections
  }

  static getInstance(): PlaybackEventService {
    if (!PlaybackEventService.instance) {
      PlaybackEventService.instance = new PlaybackEventService();
    }
    return PlaybackEventService.instance;
  }

  emitPlaybackEvent(event: PlaybackEvent) {
    console.log('[PlaybackEvent] Emitting:', event.type, event.data);
    this.emit('playback-event', event);
  }

  // Convenience methods for common events
  emitTrackStarted(userId: string, track?: string, artist?: string) {
    this.emitPlaybackEvent({
      type: 'playback:started',
      timestamp: Date.now(),
      userId,
      data: { track, artist, action: 'play' }
    });
  }

  emitTrackQueued(userId: string, track?: string, artist?: string) {
    this.emitPlaybackEvent({
      type: 'playback:queued',
      timestamp: Date.now(),
      userId,
      data: { track, artist, action: 'queue' }
    });
  }

  emitPlaybackPaused(userId: string) {
    this.emitPlaybackEvent({
      type: 'playback:paused',
      timestamp: Date.now(),
      userId,
      data: { action: 'pause' }
    });
  }

  emitPlaybackResumed(userId: string) {
    this.emitPlaybackEvent({
      type: 'playback:resumed',
      timestamp: Date.now(),
      userId,
      data: { action: 'resume' }
    });
  }

  emitTrackSkipped(userId: string) {
    this.emitPlaybackEvent({
      type: 'playback:skipped',
      timestamp: Date.now(),
      userId,
      data: { action: 'skip' }
    });
  }

  emitTrackPrevious(userId: string) {
    this.emitPlaybackEvent({
      type: 'playback:previous',
      timestamp: Date.now(),
      userId,
      data: { action: 'previous' }
    });
  }

  emitVolumeChanged(userId: string, volume: number) {
    this.emitPlaybackEvent({
      type: 'playback:volume',
      timestamp: Date.now(),
      userId,
      data: { action: 'volume', volume }
    });
  }

  emitShuffleChanged(userId: string, state: boolean) {
    this.emitPlaybackEvent({
      type: 'playback:shuffle',
      timestamp: Date.now(),
      userId,
      data: { action: 'shuffle', state }
    });
  }

  emitRepeatChanged(userId: string, mode: string) {
    this.emitPlaybackEvent({
      type: 'playback:repeat',
      timestamp: Date.now(),
      userId,
      data: { action: 'repeat', mode }
    });
  }

  emitQueueCleared(userId: string) {
    this.emitPlaybackEvent({
      type: 'playback:cleared',
      timestamp: Date.now(),
      userId,
      data: { action: 'clear_queue' }
    });
  }

  emitStateChanged(userId: string) {
    this.emitPlaybackEvent({
      type: 'playback:state_changed',
      timestamp: Date.now(),
      userId,
      data: { action: 'state_change' }
    });
  }
}

export const playbackEventService = PlaybackEventService.getInstance();