// API client for communicating with the Bun backend
const apiPort = new URLSearchParams(location.search).get("apiPort");
export const API_BASE = apiPort ? `http://127.0.0.1:${apiPort}` : window.location.origin;

// Proxy remote image URLs through the server to avoid CORS issues
export function proxyImageUrl(url: string): string {
  if (!url) return "";
  try {
    const u = new URL(url);
    if (u.origin === window.location.origin) return url;
    const apiBase = apiPort ? `http://127.0.0.1:${apiPort}` : window.location.origin;
    return `${apiBase}/api/proxy-image?url=${encodeURIComponent(url)}`;
  } catch {
    return url;
  }
}

export type RPCMethod =
  | "search" | "cloudsearch" | "song_detail" | "song_url" | "song_url_v1"
  | "lyric" | "lyric_new"
  | "login_qr_key" | "login_qr_create" | "login_qr_check"
  | "login_status" | "logout" | "user_account" | "user_playlist"
  | "like" | "likelist" | "song_like_check"
  | "playlist_tracks" | "playlist_track_add" | "playlist_create"
  | "playlist_detail" | "playlist_track_all"
  | "personalized" | "personalized_playlist" | "recommend_resource" | "recommend_songs"
  | "artist_detail" | "artist_top_song" | "artist_songs"
  | "dj_detail" | "dj_program" | "dj_hot" | "dj_sublist" | "dj_search"
  | "user_audio" | "dj_paygift" | "record_recent_voice" | "sati_resource_sub_list"
  | "comment_music"
  | "saveCookie" | "getCookie" | "saveQQCookie" | "getQQCookie";

interface RPCRequest {
  method: RPCMethod;
  params?: Record<string, any>;
}

export async function rpc<T = any>(method: RPCMethod, params?: Record<string, any>): Promise<T> {
  const res = await fetch(`${API_BASE}/api/rpc`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ method, params } as RPCRequest),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data as T;
}

export async function checkHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/api/health`);
    const data = await res.json();
    return data.ok === true;
  } catch {
    return false;
  }
}

// ---- Legacy API endpoints (non-RPC) ----
async function legacyFetch(url: string, opts?: RequestInit) {
  const res = await fetch(`${API_BASE}${url}`, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  return res.json();
}

// QQ Music API
export const qqApi = {
  search(keywords: string, limit = 6) {
    return legacyFetch(`/api/qq/search?keywords=${encodeURIComponent(keywords)}&limit=${limit}`);
  },
  songUrl(mid: string, mediaMid?: string, level?: string) {
    let url = `/api/qq/song/url?mid=${encodeURIComponent(mid)}`;
    if (mediaMid) url += `&mediaMid=${encodeURIComponent(mediaMid)}`;
    if (level) url += `&level=${encodeURIComponent(level)}`;
    return legacyFetch(url);
  },
  lyric(mid: string, id?: string) {
    let url = `/api/qq/lyric?mid=${encodeURIComponent(mid)}`;
    if (id) url += `&id=${encodeURIComponent(id)}`;
    return legacyFetch(url);
  },
  userPlaylists() {
    return legacyFetch("/api/qq/user/playlists");
  },
  playlistTracks(id: string) {
    return legacyFetch(`/api/qq/playlist/tracks?id=${encodeURIComponent(id)}`);
  },
  artistDetail(mid: string, limit = 36) {
    return legacyFetch(`/api/qq/artist/detail?mid=${encodeURIComponent(mid)}&limit=${limit}`);
  },
  loginInfo() {
    return legacyFetch("/api/qq/login/info");
  },
  normalizeCookie(cookie: string) {
    return legacyFetch("/api/qq/cookie/normalize", {
      method: "POST",
      body: JSON.stringify({ cookie }),
    });
  },
};

// Legacy netease endpoints used by app.js
export const neteaseApi = {
  search(keywords: string, type = 1, limit = 30) {
    return legacyFetch(`/api/cloudsearch?keywords=${encodeURIComponent(keywords)}&type=${type}&limit=${limit}`);
  },
  songUrl(id: string, level = "standard") {
    return legacyFetch(`/api/song/url?id=${id}&level=${encodeURIComponent(level)}`);
  },
  lyric(id: string) {
    return legacyFetch(`/api/lyric?id=${id}`);
  },
};
