// API client for communicating with the Bun backend
// In HMR mode, the apiPort is passed as a query param from the dev server proxy.
// In production (non-HMR), API is served from the same origin as the page.
const apiPort = new URLSearchParams(location.search).get("apiPort");
export const API_BASE = apiPort ? `http://127.0.0.1:${apiPort}` : window.location.origin;

export type RPCMethod =
  | "search" | "cloudsearch" | "song_detail" | "song_url" | "song_url_v1"
  | "lyric" | "lyric_new"
  | "login_qr_key" | "login_qr_create" | "login_qr_check"
  | "login_status" | "logout" | "user_account" | "user_playlist"
  | "like" | "likelist" | "song_like_check"
  | "playlist_tracks" | "playlist_track_add" | "playlist_create"
  | "playlist_detail" | "playlist_track_all"
  | "personalized" | "recommend_resource" | "recommend_songs"
  | "artist_detail" | "artist_top_song" | "artist_songs"
  | "dj_detail" | "dj_program" | "dj_hot" | "dj_sublist"
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
