// Shared types for playlist search functionality

export interface PlaylistImage {
  url: string;
  height: number | null;
  width: number | null;
}

export interface PlaylistOwner {
  display_name: string;
  id: string;
  type: string;
  uri: string;
  external_urls: {
    spotify: string;
  };
}

export interface Playlist {
  id: string;
  name: string;
  description: string | null;
  owner: PlaylistOwner;
  public: boolean;
  collaborative: boolean;
  images: PlaylistImage[];
  tracks: {
    total: number;
    href: string;
  };
  external_urls: {
    spotify: string;
  };
  uri: string;
  type: string;
  snapshot_id: string;
}

export interface SearchResults {
  playlists: {
    items: Playlist[];
    total: number;
    limit: number;
    offset: number;
    next: string | null;
    previous: string | null;
  };
}

export interface TrackArtist {
  id: string;
  name: string;
  href: string;
  uri: string;
  external_urls: {
    spotify: string;
  };
}

export interface TrackAlbum {
  id: string;
  name: string;
  images: PlaylistImage[];
  release_date: string;
  total_tracks: number;
  artists: TrackArtist[];
  external_urls: {
    spotify: string;
  };
  uri: string;
}

export interface Track {
  id: string;
  name: string;
  duration_ms: number;
  explicit: boolean;
  popularity: number;
  preview_url: string | null;
  uri: string;
  artists: TrackArtist[];
  album: TrackAlbum;
  external_urls: {
    spotify: string;
  };
  is_local: boolean;
}

export interface PlaylistTrack {
  added_at: string;
  added_by: {
    id: string;
    display_name?: string;
  };
  is_local: boolean;
  track: Track | null;
}

export interface PlaylistDetails {
  id: string;
  name: string;
  description: string | null;
  owner: PlaylistOwner;
  public: boolean;
  collaborative: boolean;
  images: PlaylistImage[];
  external_urls: {
    spotify: string;
  };
  uri: string;
  type: string;
  snapshot_id: string;
  followers?: {
    total: number;
  };
  tracks: {
    total: number;
    limit: number;
    offset: number;
    next: string | null;
    previous: string | null;
    items: PlaylistTrack[];
  };
}

export interface AnalyticsData {
  topArtists: { name: string; count: number }[];
  topAlbums: { name: string; artist: string; count: number }[];
  yearDistribution: [string, number][];
  stats: {
    totalTracks: number;
    explicitCount: number;
    explicitPercentage: string;
    avgPopularity: string;
    totalDuration: string;
    totalDurationHours: string;
  };
}