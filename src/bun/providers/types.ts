// Shared types for all music providers

export interface Song {
  id: string;
  name: string;
  artist: string;
  artists: { id?: number | string; name: string; mid?: string }[];
  artistId?: number | string;
  album: string;
  cover: string;
  duration: number;
  fee?: number;
  provider: string;
  source: string;
  type: string;
  playable?: boolean;
  [key: string]: any;
}

export interface Playlist {
  id: string;
  name: string;
  cover: string;
  trackCount: number;
  playCount?: number;
  creator?: string;
  provider: string;
  source: string;
  subscribed?: boolean;
  [key: string]: any;
}

export interface LoginInfo {
  provider: string;
  loggedIn: boolean;
  userId?: string;
  nickname?: string;
  avatar?: string;
  vipType?: number;
  vipLevel?: string;
  isVip?: boolean;
  isSvip?: boolean;
  [key: string]: any;
}

export interface SongUrlResult {
  provider: string;
  url: string | null;
  trial?: boolean;
  playable: boolean;
  level?: string;
  quality?: string;
  error?: string;
  restriction?: PlaybackRestriction;
  [key: string]: any;
}

export interface PlaybackRestriction {
  provider: string;
  category: string;
  action: string;
  message: string;
  [key: string]: any;
}

export interface LyricResult {
  provider: string;
  id?: string;
  mid?: string;
  lyric: string;
  tlyric?: string;
  yrc?: string;
  qrc?: string;
  roma?: string;
  [key: string]: any;
}

export interface SearchResult {
  songs: Song[];
  total?: number;
  [key: string]: any;
}

export interface ArtistResult {
  provider: string;
  artist: any | null;
  songs: Song[];
  total?: number;
  [key: string]: any;
}

export interface LoginQRResult {
  code: number;
  [key: string]: any;
}

export interface ProviderConfig {
  cookie: string;
  saveCookie: (cookie: string) => void;
}

export interface QQProviderConfig extends ProviderConfig {
  qqCookie: string;
  saveQQCookie: (cookie: string) => void;
}
