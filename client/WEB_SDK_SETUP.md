# Spotify Web SDK Setup Instructions

## Setup & Usage

The Spotify Web Playback SDK is fully integrated and works in both development and production environments.

## How to Use

1. **Select "Built In Player"** from the device selector
2. The Web SDK will initialize and create a device called "DJForge Web Player"
3. Play music using natural language commands or playback controls
4. The player will show the current track with full controls

## Features

- **Seamless Integration**: Works alongside other Spotify devices
- **Full Playback Control**: Play, pause, skip, seek, volume control
- **Real-time Updates**: Shows current track with album art
- **Progress Tracking**: Smooth progress bar with position tracking
- **Natural Language**: Control via chat commands
- **Device Switching**: Easy switching between Web Player and other devices

## Technical Details

1. The SpotifyPlayer component loads the Spotify Web Playback SDK
2. It authenticates using your Spotify access token
3. A new device called "DJForge Web Player" appears in your Spotify devices
4. You can control playback directly in the browser
5. Full integration with natural language commands

## Requirements

- **Spotify Premium**: Required for Web Playback SDK
- **Browser Support**: Works in Chrome, Firefox, Edge, and Safari
- **OAuth Scopes**: The "streaming" scope must be included (already configured)

## Troubleshooting

- **No audio**: Ensure you have Spotify Premium
- **Device not appearing**: Try refreshing the page
- **Playback issues**: Check browser console for errors