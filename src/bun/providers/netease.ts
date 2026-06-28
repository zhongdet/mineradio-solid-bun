// @ts-nocheck — NeteaseCloudMusicApi types are incomplete
import {
  search, cloudsearch, song_detail, song_url, song_url_v1,
  login_qr_key, login_qr_create, login_qr_check,
  login_status, logout, user_account, user_playlist,
  comment_music, artist_detail, artist_top_song, artist_songs,
  like as like_song, likelist, song_like_check,
  playlist_tracks, playlist_track_add, playlist_create,
  playlist_detail, playlist_track_all,
  personalized, recommend_resource, recommend_songs,
  dj_detail, dj_program, dj_hot, dj_sublist,
  user_audio, dj_paygift, record_recent_voice, sati_resource_sub_list,
  lyric, lyric_new,
} from "NeteaseCloudMusicApi";

import type { Song, Playlist, LoginInfo, SongUrlResult, LyricResult, SearchResult, ArtistResult, ProviderConfig, PlaybackRestriction } from "./types";

// ---- Quality helpers ----
const NETEASE_QUALITY_CANDIDATES = [
  { level: "jymaster", br: 1999000, label: "超清母带", svip: true },
  { level: "hires",    br: 1999000, label: "高清臻音" },
  { level: "lossless", br: 1411000, label: "无损" },
  { level: "exhigh",   br: 999000,  label: "极高" },
  { level: "standard", br: 128000,  label: "标准" },
];

function normalizeQuality(value: string): string {
  const raw = value.toLowerCase().trim();
  if (["jymaster","master","studio","svip"].includes(raw)) return "jymaster";
  if (["hires","hi-res","highres","zhenyin","spatial"].includes(raw)) return "hires";
  if (["lossless","flac","sq"].includes(raw)) return "lossless";
  if (["exhigh","high","320","320k","hq"].includes(raw)) return "exhigh";
  if (["standard","normal","128","128k","std"].includes(raw)) return "standard";
  return "hires";
}

function qualityCandidatesFrom(target: string) {
  target = normalizeQuality(target);
  let start = NETEASE_QUALITY_CANDIDATES.findIndex(q => q.level === target);
  if (start < 0) start = 0;
  return NETEASE_QUALITY_CANDIDATES.slice(start);
}

// ---- Data mappers ----
function mapSong(s: any): Song {
  s = s || {};
  const artists = (s.ar || s.artists || []).map((a: any) => ({ id: a?.id, name: a?.name || "" })).filter((a: any) => a.name);
  const album = s.al || s.album || {};
  return {
    provider: "netease", source: "netease", type: "song",
    id: String(s.id ?? ""),
    name: s.name ?? "",
    artist: artists.map((a: any) => a.name).join(" / "),
    artists,
    artistId: artists[0]?.id ?? "",
    album: album.name ?? "",
    cover: album.picUrl ?? album.coverUrl ?? "",
    duration: s.dt ?? s.duration ?? 0,
    fee: s.fee,
    playable: true,
  };
}

function mapPlaylist(pl: any, tag?: string): Playlist {
  pl = pl || {};
  const creator = pl.creator || pl.user || {};
  return {
    provider: "netease", source: "netease", type: "playlist",
    id: String(pl.id ?? pl.resourceId ?? pl.creativeId ?? ""),
    name: pl.name ?? pl.title ?? "",
    cover: pl.picUrl ?? pl.coverImgUrl ?? pl.coverUrl ?? pl.uiElement?.image?.imageUrl ?? "",
    trackCount: pl.trackCount ?? pl.songCount ?? pl.programCount ?? 0,
    playCount: pl.playCount ?? pl.playcount ?? 0,
    creator: creator.nickname ?? creator.name ?? "",
    tag: tag || pl.alg || "",
  };
}

function classifyPlaybackRestriction(lastData: any, loginInfo: any): PlaybackRestriction {
  const loggedIn = !!(loginInfo?.loggedIn);
  const fee = Number(lastData?.fee);
  const code = Number(lastData?.code);
  const freeTrial = lastData?.freeTrialInfo;
  if (!loggedIn) return { provider:"netease", category:"login_required", action:"login", message:"网易云需要登录后尝试获取完整播放地址", code, fee };
  if (freeTrial) return { provider:"netease", category:"trial_only", action:"upgrade", message:"网易云仅返回试听片段，完整播放需要会员或购买", code, fee };
  if (fee === 1) return { provider:"netease", category:"vip_required", action:"upgrade", message:"网易云歌曲需要 VIP 权限", code, fee };
  if (fee === 4 || fee === 8) return { provider:"netease", category:"paid_required", action:"purchase", message:"网易云歌曲需要购买", code, fee };
  if (code === 404 || code === 403) return { provider:"netease", category:"copyright_unavailable", action:"switch_source", message:"网易云版权暂不可播", code, fee };
  return { provider:"netease", category:"url_unavailable", action:loggedIn ? "switch_source" : "login", message:"网易云没有返回可播放地址", code, fee };
}

// ---- Provider class ----
export class NeteaseProvider {
  name = "netease";
  private cookie = "";
  private saveCookieFn: (c: string) => void = () => {};

  init(config: ProviderConfig) {
    this.cookie = config.cookie;
    this.saveCookieFn = config.saveCookie;
  }

  setCookie(c: string) { this.cookie = c; }

  private nc = () => this.cookie;

  // Search
  async search(keywords: string, type = 1, limit = 30): Promise<SearchResult> {
    const r = await search({ keywords, type, limit, cookie: this.nc() });
    const body = r.body as any;
    const songs = (body.result?.songs || []).map(mapSong);
    return { songs, total: body.result?.songCount };
  }

  async cloudsearch(keywords: string, type = 1, limit = 30): Promise<SearchResult> {
    const r = await cloudsearch({ keywords, type, limit, cookie: this.nc() });
    const body = r.body as any;
    const songs = (body.result?.songs || []).map(mapSong);
    return { songs, total: body.result?.songCount };
  }

  // Song
  async songDetail(ids: string): Promise<Song[]> {
    const r = await song_detail({ ids, cookie: this.nc() });
    const body = r.body as any;
    return (body.songs || []).map(mapSong);
  }

  async songUrl(id: string, qualityPreference?: string, loginInfo?: any): Promise<SongUrlResult> {
    const requestedQuality = normalizeQuality(qualityPreference || "standard");
    const svipReady = loginInfo?.vipLevel === "svip" || loginInfo?.isSvip;
    const qualities = qualityCandidatesFrom(requestedQuality).filter(q => !q.svip || svipReady);

    let trialFallback: SongUrlResult | null = null;
    let lastData: any = null;

    for (const q of qualities) {
      try {
        let result;
        try { result = await song_url_v1({ id, level: q.level, cookie: this.nc() }); }
        catch { result = await song_url({ id, br: q.br, cookie: this.nc() }); }
        const d = result.body?.data?.[0];
        if (d) lastData = d;
        const url = d?.url;
        const freeTrial = d?.freeTrialInfo;
        if (url && !freeTrial) {
          return { provider:"netease", url, trial:false, playable:true, level:q.level, quality:q.label, br:d.br, requestedQuality };
        }
        if (url && freeTrial && !trialFallback) {
          trialFallback = {
            provider:"netease", url, trial:true, playable:true, level:q.level, quality:q.label,
            br:d.br, requestedQuality, trialInfo: freeTrial,
            restriction: classifyPlaybackRestriction(d, loginInfo),
          };
        }
      } catch {}
    }
    if (trialFallback) return trialFallback;
    const restriction = classifyPlaybackRestriction(lastData, loginInfo);
    return {
      provider:"netease", url:null, trial:false, playable:false,
      reason: restriction.category, message: restriction.message, restriction,
      lastCode: lastData?.code, fee: lastData?.fee, requestedQuality,
    };
  }

  async songUrlV1(id: string, level = "standard") {
    const r = await song_url_v1({ id, level, cookie: this.nc() });
    return r.body;
  }

  // Lyric
  async lyric(id: string): Promise<LyricResult> {
    const r = await lyric({ id, cookie: this.nc() });
    const body = r.body as any;
    return { provider:"netease", id, lyric: body.lrc?.lyric || "", tlyric: body.tlyric?.lyric || "", yrc: body.yrc?.lyric || "" };
  }

  async lyricNew(id: string): Promise<LyricResult> {
    const r = await lyric_new({ id, cookie: this.nc() });
    const body = r.body as any;
    return { provider:"netease", id, lyric: body.lrc?.lyric || "", tlyric: body.tlyric?.lyric || "", yrc: body.yrc?.lyric || "" };
  }

  // Login
  async loginQRKey(): Promise<any> {
    const r = await login_qr_key({ cookie: this.nc() });
    return r.body;
  }

  async loginQRCreate(key: string): Promise<any> {
    const r = await login_qr_create({ key, qrimg: true, cookie: this.nc() });
    return r.body;
  }

  async loginQRCheck(key: string): Promise<{ body: any; cookie: string }> {
    const r = await login_qr_check({ key, cookie: this.nc() });
    if (r.body.code === 803 || r.body.code === 800) {
      const c = (r.headers as Headers).get("set-cookie") || "";
      this.saveCookieFn(c);
    }
    return { body: r.body, cookie: this.cookie };
  }

  async loginStatus(): Promise<any> {
    const r = await login_status({ cookie: this.nc() });
    return r.body;
  }

  async logout(): Promise<any> {
    const r = await logout({ cookie: this.nc() });
    this.saveCookieFn("");
    return r.body;
  }

  // User
  async userAccount(): Promise<any> {
    const r = await user_account({ cookie: this.nc() });
    return r.body;
  }

  async userPlaylist(uid: string): Promise<any> {
    const r = await user_playlist({ uid, cookie: this.nc() });
    return r.body;
  }

  // Like
  async like(id: string, like = true): Promise<any> {
    const r = await like_song({ id, like, cookie: this.nc() });
    return r.body;
  }

  async likelist(uid: string): Promise<any> {
    const r = await likelist({ uid, cookie: this.nc() });
    return r.body;
  }

  async songLikeCheck(songId: string): Promise<any> {
    const r = await song_like_check({ songId, cookie: this.nc() });
    return r.body;
  }

  // Playlist
  async playlistTracks(op: string, id: string, tracks: string): Promise<any> {
    const r = await playlist_tracks({ id, op, tracks, cookie: this.nc() });
    return r.body;
  }

  async playlistTrackAdd(id: string, tracks: string): Promise<any> {
    const r = await playlist_track_add({ id, tracks, cookie: this.nc() });
    return r.body;
  }

  async playlistCreate(name: string): Promise<any> {
    const r = await playlist_create({ name, cookie: this.nc() });
    return r.body;
  }

  async playlistDetail(id: string): Promise<any> {
    const r = await playlist_detail({ id, cookie: this.nc() });
    return r.body;
  }

  async playlistTrackAll(id: string, limit = 1000, offset = 0): Promise<any> {
    const r = await playlist_track_all({ id, limit, offset, cookie: this.nc() });
    return r.body;
  }

  // Discover
  async personalized(limit = 30): Promise<any> {
    const r = await personalized({ limit, cookie: this.nc() });
    return r.body;
  }

  async recommendResource(): Promise<any> {
    const r = await recommend_resource({ cookie: this.nc() });
    return r.body;
  }

  async recommendSongs(): Promise<any> {
    const r = await recommend_songs({ cookie: this.nc() });
    return r.body;
  }

  // Artist
  async artistDetail(id: string): Promise<any> {
    const r = await artist_detail({ id, cookie: this.nc() });
    return r.body;
  }

  async artistTopSong(id: string): Promise<any> {
    const r = await artist_top_song({ id, cookie: this.nc() });
    return r.body;
  }

  async artistSongs(id: string, offset = 0, limit = 50): Promise<any> {
    const r = await artist_songs({ id, offset, limit, cookie: this.nc() });
    return r.body;
  }

  // Comment
  async commentMusic(id: string, limit = 20): Promise<any> {
    const r = await comment_music({ id, limit, cookie: this.nc() });
    return r.body;
  }

  // DJ / Podcast
  async djDetail(rid: string): Promise<any> {
    const r = await dj_detail({ rid, cookie: this.nc() });
    return r.body;
  }

  async djProgram(rid: string, limit = 100): Promise<any> {
    const r = await dj_program({ rid, limit, cookie: this.nc() });
    return r.body;
  }

  async djHot(limit = 30): Promise<any> {
    const r = await dj_hot({ limit, cookie: this.nc() });
    return r.body;
  }

  async djSublist(): Promise<any> {
    const r = await dj_sublist({ cookie: this.nc() });
    return r.body;
  }

  async userAudio(uid: string): Promise<any> {
    const r = await user_audio({ uid, cookie: this.nc() });
    return r.body;
  }

  async djPaygift(limit = 30): Promise<any> {
    const r = await dj_paygift({ limit, cookie: this.nc() });
    return r.body;
  }

  async recordRecentVoice(limit = 100): Promise<any> {
    const r = await record_recent_voice({ limit, cookie: this.nc() });
    return r.body;
  }

  async satiResourceSubList(): Promise<any> {
    const r = await sati_resource_sub_list({ cookie: this.nc() });
    return r.body;
  }

  // Session
  getSessionInfo() {
    return { provider: "netease", hasCookie: !!this.cookie };
  }
}
