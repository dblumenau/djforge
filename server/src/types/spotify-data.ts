// Extended Spotify data types for dashboard

export interface SpotifyImage {
  url: string;
  width: number;
  height: number;
}

export interface SimplifiedArtist {
  id: string;
  name: string;
  uri: string;
  href: string;
}

export interface SpotifyArtist {
  id: string;
  name: string;
  genres: string[];
  images: SpotifyImage[];
  popularity: number;
  followers: {
    total: number;
  };
  uri: string;
  href: string;
  external_urls: {
    spotify: string;
  };
}

export interface SpotifyAlbum {
  id: string;
  name: string;
  artists: SimplifiedArtist[];
  images: SpotifyImage[];
  release_date: string;
  release_date_precision: 'year' | 'month' | 'day';
  total_tracks: number;
  album_type: 'album' | 'single' | 'compilation';
  uri: string;
  href: string;
  external_urls: {
    spotify: string;
  };
}

export interface SpotifyTrackExtended {
  id: string;
  name: string;
  artists: SimplifiedArtist[];
  album: SpotifyAlbum;
  duration_ms: number;
  popularity: number;
  uri: string;
  href: string;
  external_urls: {
    spotify: string;
  };
  preview_url?: string;
  explicit: boolean;
  track_number: number;
  disc_number: number;
}

export interface SavedTrack {
  added_at: string;
  track: SpotifyTrackExtended;
}

export interface SavedAlbum {
  added_at: string;
  album: SpotifyAlbum;
}

export interface RecentlyPlayedItem {
  track: SpotifyTrackExtended;
  played_at: string;
  context?: {
    type: 'artist' | 'playlist' | 'album' | 'show';
    uri: string;
    href: string;
  };
}

export interface SpotifyPlaylist {
  id: string;
  name: string;
  description: string;
  owner: {
    id: string;
    display_name: string;
  };
  images: SpotifyImage[];
  tracks: {
    total: number;
    href: string;
  };
  public: boolean;
  collaborative: boolean;
  uri: string;
  href: string;
  external_urls: {
    spotify: string;
  };
}

export interface UserProfile {
  id: string;
  display_name: string;
  email: string;
  images: SpotifyImage[];
  product: 'free' | 'premium';
  followers: {
    total: number;
  };
  country: string;
  uri: string;
  href: string;
  external_urls: {
    spotify: string;
  };
}

// Time range type for top items
export type TimeRange = 'short_term' | 'medium_term' | 'long_term';

// Pagination response wrapper
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
  next: string | null;
  previous: string | null;
}

// Dashboard data aggregation
export interface UserDashboardData {
  profile: UserProfile;
  topArtists: {
    short_term: SpotifyArtist[];
    medium_term: SpotifyArtist[];
    long_term: SpotifyArtist[];
  };
  topTracks: {
    short_term: SpotifyTrackExtended[];
    medium_term: SpotifyTrackExtended[];
    long_term: SpotifyTrackExtended[];
  };
  savedTracks: PaginatedResponse<SavedTrack>;
  savedAlbums: PaginatedResponse<SavedAlbum>;
  recentlyPlayed: RecentlyPlayedItem[];
  playlists: SpotifyPlaylist[];
}