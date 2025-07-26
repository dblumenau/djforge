# Spotify Listening History & Data Analysis Guide

This guide explores what listening history data is available through Spotify's Web API and how to leverage it for deeper insights into user music preferences.

## Overview of Available Data

While Spotify's recently played endpoint is limited to just 50 tracks, several other endpoints provide valuable historical data:

### 1. Recently Played Tracks
- **Endpoint**: `/v1/me/player/recently-played`
- **Limit**: Hard limit of 50 tracks total (not per request)
- **Requirements**: Tracks must be played for >30 seconds
- **Time parameters**: `before` and `after` (Unix timestamps)

### 2. Top Artists & Tracks
- **Endpoints**: `/v1/me/top/artists` and `/v1/me/top/tracks`
- **Time ranges**: 
  - `short_term`: ~4 weeks
  - `medium_term`: ~6 months
  - `long_term`: all time
- **Limit**: Up to 50 items per time range

### 3. Saved Tracks Library
- **Endpoint**: `/v1/me/tracks`
- **Key feature**: `added_at` timestamp for each saved track
- **History depth**: Goes back to when you first saved each track
- **Pagination**: Required to get full history (50 tracks per page)

### 4. Audio Features
- **Endpoint**: `/v1/audio-features` (batch) or `/v1/audio-features/{id}` (single)
- **Batch limit**: Up to 100 tracks per request
- **Provides**: Detailed track characteristics for analysis

## Practical Examples

### Get Complete Saved Tracks History

```bash
#!/bin/bash
# get_all_saved_tracks.sh
TOKEN="YOUR_ACCESS_TOKEN"
OFFSET=0
LIMIT=50

while true; do
  RESPONSE=$(curl -s -X GET "https://api.spotify.com/v1/me/tracks?limit=$LIMIT&offset=$OFFSET" \
    -H "Authorization: Bearer $TOKEN")
  
  # Extract tracks with timestamps
  echo "$RESPONSE" | jq -r '.items[] | "\(.added_at) - \(.track.name) by \(.track.artists[0].name)"'
  
  TOTAL=$(echo "$RESPONSE" | jq -r '.total')
  OFFSET=$((OFFSET + LIMIT))
  
  if [ $OFFSET -ge $TOTAL ]; then
    break
  fi
done
```

### Analyze Audio Features of Saved Tracks

```bash
# Get first 50 saved tracks
TRACKS=$(curl -s -X GET "https://api.spotify.com/v1/me/tracks?limit=50" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN")

# Extract track IDs
TRACK_IDS=$(echo "$TRACKS" | jq -r '.items[].track.id' | tr '\n' ',' | sed 's/,$//')

# Get audio features
curl -X GET "https://api.spotify.com/v1/audio-features?ids=$TRACK_IDS" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" | jq
```

### Create Music Taste Timeline

```bash
#!/bin/bash
# analyze_taste_evolution.sh
TOKEN="YOUR_ACCESS_TOKEN"
OUTPUT_FILE="music_timeline.json"

# Function to get tracks for a specific year
get_tracks_by_year() {
  local YEAR=$1
  local START_DATE="${YEAR}-01-01T00:00:00Z"
  local END_DATE="${YEAR}-12-31T23:59:59Z"
  
  curl -s -X GET "https://api.spotify.com/v1/me/tracks?limit=50" \
    -H "Authorization: Bearer $TOKEN" | \
    jq --arg start "$START_DATE" --arg end "$END_DATE" \
    '[.items[] | select(.added_at >= $start and .added_at <= $end)]'
}

# Process multiple years
for YEAR in 2020 2021 2022 2023 2024; do
  echo "Processing $YEAR..."
  get_tracks_by_year $YEAR > "tracks_${YEAR}.json"
done
```

## Audio Features Explained

Each track has these measurable characteristics:

| Feature | Range | Description |
|---------|-------|-------------|
| **acousticness** | 0.0-1.0 | Confidence the track is acoustic |
| **danceability** | 0.0-1.0 | How suitable for dancing |
| **energy** | 0.0-1.0 | Intensity and activity level |
| **instrumentalness** | 0.0-1.0 | Likelihood of no vocals |
| **liveness** | 0.0-1.0 | Presence of live audience |
| **loudness** | -60 to 0 dB | Overall loudness |
| **speechiness** | 0.0-1.0 | Presence of spoken words |
| **tempo** | BPM | Beats per minute |
| **valence** | 0.0-1.0 | Musical positivity (happy vs sad) |

## Implementation Ideas

### 1. Music Mood Timeline
Track how your music mood changes over time:
```javascript
// Calculate average valence by month
const moodByMonth = savedTracks.reduce((acc, track) => {
  const month = new Date(track.added_at).toISOString().slice(0, 7);
  if (!acc[month]) acc[month] = { total: 0, count: 0 };
  acc[month].total += track.audio_features.valence;
  acc[month].count++;
  return acc;
}, {});
```

### 2. Energy Patterns
Analyze when you save high vs low energy music:
```javascript
// Group by time of day
const energyByHour = savedTracks.map(track => ({
  hour: new Date(track.added_at).getHours(),
  energy: track.audio_features.energy
}));
```

### 3. Genre Evolution
Track how your genre preferences change:
```javascript
// Aggregate genres over time periods
const genresByYear = topArtists.reduce((acc, timeRange) => {
  timeRange.artists.forEach(artist => {
    artist.genres.forEach(genre => {
      acc[genre] = (acc[genre] || 0) + 1;
    });
  });
  return acc;
}, {});
```

## Limitations & Workarounds

### What You Can't Get
- ❌ Complete play history beyond 50 tracks
- ❌ Play counts for individual songs
- ❌ Exact timestamps for plays (except recent 50)
- ❌ Historical data before feature introduction

### Workarounds
1. **Regular data collection**: Set up scheduled jobs to collect recently played data
2. **GDPR data request**: Request full data export from Spotify (includes 1 year of streaming history)
3. **Combine multiple endpoints**: Use saved tracks + top items + recent plays for richer insights

## Best Practices

1. **Cache aggressively**: These endpoints have rate limits
2. **Batch requests**: Use batch endpoints for audio features
3. **Paginate carefully**: Some users have thousands of saved tracks
4. **Handle missing data**: Not all tracks have audio features
5. **Respect rate limits**: Implement exponential backoff

## Example: Complete Analysis Script

```python
import requests
import pandas as pd
from datetime import datetime

class SpotifyHistoryAnalyzer:
    def __init__(self, access_token):
        self.token = access_token
        self.headers = {"Authorization": f"Bearer {access_token}"}
    
    def get_all_saved_tracks(self):
        """Retrieve complete saved tracks history"""
        tracks = []
        offset = 0
        
        while True:
            response = requests.get(
                f"https://api.spotify.com/v1/me/tracks?limit=50&offset={offset}",
                headers=self.headers
            ).json()
            
            tracks.extend(response['items'])
            
            if len(response['items']) < 50:
                break
            offset += 50
        
        return tracks
    
    def get_audio_features_batch(self, track_ids):
        """Get audio features for up to 100 tracks"""
        ids_param = ','.join(track_ids[:100])
        response = requests.get(
            f"https://api.spotify.com/v1/audio-features?ids={ids_param}",
            headers=self.headers
        ).json()
        
        return response['audio_features']
    
    def analyze_taste_evolution(self):
        """Analyze how music taste evolved over time"""
        tracks = self.get_all_saved_tracks()
        
        # Group by month
        monthly_data = {}
        
        for track in tracks:
            month = track['added_at'][:7]  # YYYY-MM
            track_id = track['track']['id']
            
            if month not in monthly_data:
                monthly_data[month] = []
            
            monthly_data[month].append(track_id)
        
        # Get audio features for each month
        monthly_features = {}
        
        for month, track_ids in monthly_data.items():
            features = []
            for i in range(0, len(track_ids), 100):
                batch = self.get_audio_features_batch(track_ids[i:i+100])
                features.extend(batch)
            
            # Calculate averages
            df = pd.DataFrame(features)
            monthly_features[month] = {
                'avg_valence': df['valence'].mean(),
                'avg_energy': df['energy'].mean(),
                'avg_danceability': df['danceability'].mean(),
                'track_count': len(track_ids)
            }
        
        return monthly_features
```

## Conclusion

While Spotify's API has limitations on recent listening history, creative use of saved tracks, top items, and audio features can provide rich insights into music preferences over time. The key is combining multiple endpoints and building your own historical dataset through regular collection.