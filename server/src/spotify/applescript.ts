import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class AppleScriptController {
  private async executeScript(script: string): Promise<string> {
    try {
      const { stdout, stderr } = await execAsync(`osascript -e '${script}'`);
      if (stderr) {
        throw new Error(`AppleScript error: ${stderr}`);
      }
      return stdout.trim();
    } catch (error: any) {
      if (error.message.includes('(-1728)')) {
        throw new Error('Spotify is not running. Please open Spotify first.');
      }
      throw error;
    }
  }

  async play(): Promise<void> {
    await this.executeScript('tell application "Spotify" to play');
  }

  async pause(): Promise<void> {
    await this.executeScript('tell application "Spotify" to pause');
  }


  async nextTrack(): Promise<void> {
    await this.executeScript('tell application "Spotify" to next track');
  }

  async previousTrack(): Promise<void> {
    await this.executeScript('tell application "Spotify" to previous track');
  }

  async setVolume(volume: number): Promise<void> {
    // Ensure volume is between 0 and 100
    const clampedVolume = Math.max(0, Math.min(100, volume));
    await this.executeScript(`tell application "Spotify" to set sound volume to ${clampedVolume}`);
  }

  async getVolume(): Promise<number> {
    const volume = await this.executeScript('tell application "Spotify" to get sound volume');
    return parseInt(volume, 10);
  }

  async getCurrentTrack(): Promise<{
    name: string;
    artist: string;
    album: string;
    duration: number;
    position: number;
    id: string;
  } | null> {
    try {
      const script = `
        tell application "Spotify"
          if player state is playing or player state is paused then
            set trackName to name of current track
            set trackArtist to artist of current track
            set trackAlbum to album of current track
            set trackDuration to duration of current track
            set trackPosition to player position
            set trackId to id of current track
            return trackName & "|" & trackArtist & "|" & trackAlbum & "|" & trackDuration & "|" & trackPosition & "|" & trackId
          else
            return ""
          end if
        end tell
      `;
      
      const result = await this.executeScript(script);
      if (!result) return null;
      
      const [name, artist, album, duration, position, id] = result.split('|');
      
      return {
        name,
        artist,
        album,
        duration: Math.floor(parseInt(duration) / 1000), // Convert to seconds
        position: Math.floor(parseFloat(position)), // Current position in seconds
        id
      };
    } catch (error) {
      return null;
    }
  }

  async getPlayerState(): Promise<'playing' | 'paused' | 'stopped'> {
    try {
      const state = await this.executeScript('tell application "Spotify" to get player state as string');
      return state.toLowerCase() as 'playing' | 'paused' | 'stopped';
    } catch (error) {
      return 'stopped';
    }
  }

  async isSpotifyRunning(): Promise<boolean> {
    try {
      const result = await this.executeScript('tell application "System Events" to (name of processes) contains "Spotify"');
      return result === 'true';
    } catch (error) {
      return false;
    }
  }

  async launchSpotify(): Promise<void> {
    await this.executeScript('tell application "Spotify" to activate');
    // Wait a bit for Spotify to fully launch
    await new Promise(resolve => setTimeout(resolve, 3000));
  }

  async setShuffling(enabled: boolean): Promise<void> {
    await this.executeScript(`tell application "Spotify" to set shuffling to ${enabled}`);
  }

  async setRepeating(enabled: boolean): Promise<void> {
    await this.executeScript(`tell application "Spotify" to set repeating to ${enabled}`);
  }

  async playTrack(uri: string): Promise<void> {
    // Spotify URIs are in format: spotify:track:ID
    await this.executeScript(`tell application "Spotify" to play track "${uri}"`);
  }
}