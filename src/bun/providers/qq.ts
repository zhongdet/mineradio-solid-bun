// @ts-nocheck — QQ Music provider — direct API calls to y.qq.com
import type { Song, Playlist, LoginInfo, SongUrlResult, LyricResult, SearchResult, ProviderConfig, PlaybackRestriction } from "./types";

const QQ_MUSICU_URL = "https://u.y.qq.com/cgi-bin/musicu.fcg";
const QQ_SMARTBOX_URL = "https://c.y.qq.com/splcloud/fcgi-bin/smartbox_new.fcg";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const QQ_HEADERS = { Referer: "https://y.qq.com/", "User-Agent": UA };

// ---- Quality templates ----
const QQ_QUALITY_CANDIDATES = [
  { prefix: "RS01", ext: ".flac", level: "hires", label: "Hi-Res FLAC" },
  { prefix: "F000", ext: ".flac", level: "lossless", label: "无损 FLAC" },
  { prefix: "M800", ext: ".mp3", level: "exhigh", label: "320k MP3" },
  { prefix: "M500", ext: ".mp3", level: "standard", label: "128k MP3" },
  { prefix: "C400", ext: ".m4a", level: "aac", label: "AAC/M4A" },
];

function normalizeQuality(value: string): string {
  const raw = String(value || "").toLowerCase().trim();
  if (["jymaster","master","studio","svip"].includes(raw)) return "jymaster";
  if (["hires","hi-res","highres","zhenyin","spatial"].includes(raw)) return "hires";
  if (["lossless","flac","sq"].includes(raw)) return "lossless";
  if (["exhigh","high","320","320k","hq"].includes(raw)) return "exhigh";
  if (["standard","normal","128","128k","std"].includes(raw)) return "standard";
  return "hires";
}

function qualityCandidatesFrom(target: string) {
  target = normalizeQuality(target);
  let start = QQ_QUALITY_CANDIDATES.findIndex(q => q.level === target);
  if (start < 0) start = 0;
  return QQ_QUALITY_CANDIDATES.slice(start);
}

// ---- HTTP helpers ----
async function requestText(targetUrl: string, opts?: any, body?: string): Promise<string> {
  opts = opts || {};
  const resp = await fetch(targetUrl, {
    method: opts.method || "GET",
    headers: opts.headers || {},
    body,
  });
  if (!resp.ok) {
    const err = new Error("HTTP " + resp.status);
    (err as any).statusCode = resp.status;
    (err as any).body = await resp.text();
    throw err;
  }
  return resp.text();
}

async function requestJson(targetUrl: string, opts?: any, body?: string): Promise<any> {
  const text = await requestText(targetUrl, opts, body);
  return JSON.parse(text);
}

function parseCookieString(cookieText: string): Record<string, string> {
  const obj: Record<string, string> = {};
  String(cookieText || "").split(";").forEach(part => {
    const idx = part.indexOf("=");
    if (idx > 0) {
      const key = part.slice(0, idx).trim();
      const val = part.slice(idx + 1).trim();
      if (key && val) obj[key] = val;
    }
  });
  return obj;
}

function serializeCookieObject(obj: Record<string, string>): string {
  return Object.entries(obj)
    .filter(([k, v]) => k && v)
    .map(([k, v]) => k + "=" + v)
    .join("; ");
}

function normalizeQQUin(raw: any): string {
  const digits = String(raw || "").replace(/\D/g, "");
  return digits.replace(/^0+/, "") || digits;
}

function decodeQQCookieValue(value: string): string {
  try { return decodeURIComponent(String(value).replace(/\+/g, "%20")).trim(); }
  catch { return String(value || "").trim(); }
}

// ---- Mappers ----
function mapQQArtists(raw: any[]): { id?: any; mid?: string; name: string }[] {
  return (raw || []).map((a: any) => ({
    id: a?.id,
    mid: a?.mid,
    name: (a?.name || a?.title) || "",
  })).filter(a => a.name);
}

function qqAlbumCover(albumMid: string, size = 300): string {
  if (!albumMid) return "";
  return `https://y.qq.com/music/photo_new/T002R${size}x${size}M000${albumMid}.jpg?max_age=2592000`;
}

function qqSingerAvatar(singerMid: string, size = 300): string {
  if (!singerMid) return "";
  return `https://y.qq.com/music/photo_new/T001R${size}x${size}M000${singerMid}.jpg?max_age=2592000`;
}

function mapQQPlaylist(pl: any, kind: string): Playlist {
  pl = pl || {};
  const id = pl.dissid || pl.tid || pl.dirid || pl.id || pl.diss_id;
  return {
    provider: "qq", source: "qq",
    id: id ? String(id) : "",
    name: pl.diss_name || pl.name || pl.title || "",
    cover: pl.diss_cover || pl.logo || pl.picurl || pl.cover || "",
    trackCount: pl.song_cnt || pl.songnum || pl.total_song_num || pl.song_count || 0,
    playCount: pl.listen_num || pl.visitnum || pl.play_count || 0,
    creator: pl.hostname || pl.nick || pl.creator || "QQ 音乐",
    subscribed: kind === "collect",
  };
}

function mapQQPlaylistTrack(raw: any): Song {
  raw = raw || {};
  const track = raw.songid || raw.songmid || raw.mid || raw.name ? raw : (raw.track_info || raw.songInfo || raw.songinfo || raw.song || {});
  const album = track.album || {};
  const artists = mapQQArtists(track.singer || track.singers || []);
  const mid = track.mid || track.songmid || raw.mid || raw.songmid || "";
  const albumMid = album.mid || track.albummid || raw.albummid || "";
  return {
    provider: "qq", source: "qq", type: "qq",
    id: mid || String(track.id || track.songid || raw.id || raw.songid || ""),
    name: track.name || track.songname || raw.songname || "",
    artist: artists.map(a => a.name).join(" / ") || track.singername || raw.singername || "",
    artists,
    artistId: artists[0]?.id || artists[0]?.mid || "",
    album: album.name || album.title || track.albumname || raw.albumname || "",
    cover: qqAlbumCover(albumMid, 300),
    duration: (Number(track.interval || raw.interval) || 0) * 1000,
    fee: track.pay && Number(track.pay.pay_play) ? 1 : 0,
    playable: false,
    qqId: track.id || track.songid || raw.id || raw.songid || "",
    mid,
    songmid: mid,
    mediaMid: (track.file?.media_mid) || track.strMediaMid || track.media_mid || raw.strMediaMid || "",
    albumMid,
    artistMid: artists[0]?.mid,
  };
}

function mapQQTrack(track: any, fallback?: any): Song {
  track = track || {};
  fallback = fallback || {};
  const album = track.album || {};
  const artists = mapQQArtists(track.singer || []);
  const mid = track.mid || fallback.mid || fallback.songmid || "";
  const albumMid = album.mid || album.pmid || "";
  return {
    provider: "qq", source: "qq", type: "qq",
    id: mid,
    name: track.name || track.title || fallback.name || "",
    artist: artists.map(a => a.name).join(" / ") || fallback.artist || "",
    artists: artists.length ? artists : (fallback.artists || []),
    artistId: artists[0]?.id || artists[0]?.mid,
    album: album.name || album.title || fallback.album || "",
    cover: qqAlbumCover(albumMid, 300) || fallback.cover || "",
    duration: (Number(track.interval) || 0) * 1000,
    fee: track.pay && Number(track.pay.pay_play) ? 1 : 0,
    playable: false,
    qqId: track.id || fallback.qqId || fallback.id || "",
    mid,
    songmid: mid,
    mediaMid: (track.file?.media_mid) || track.strMediaMid || "",
    albumMid,
    artistMid: artists[0]?.mid,
  };
}

function mapQQSmartSong(item: any): Song {
  item = item || {};
  const mid = item.mid || item.songmid || item.id || "";
  return {
    provider: "qq", source: "qq", type: "qq",
    id: mid,
    name: item.name || item.title || "",
    artist: item.singer || "",
    artists: item.singer ? [{ name: item.singer }] : [],
    album: "", cover: "", duration: 0, fee: 0, playable: false,
    qqId: item.id || item.docid || "",
    mid, songmid: mid,
  };
}

function classifyQQPlaybackRestriction(info: any, hasSession: boolean, hasPlaybackKey: boolean): PlaybackRestriction {
  const rawMsg = String((info?.msg || info?.tips || info?.errmsg || info?.message) || "").trim();
  const code = Number((info?.result || info?.code || info?.errtype) || 0);
  if (!hasSession) return { provider:"qq", category:"login_required", action:"login", message:"QQ 音乐需要登录或授权后才能获取播放地址", code, rawMessage:rawMsg };
  if (!hasPlaybackKey && code === 104003) return { provider:"qq", category:"login_required", action:"login", message:"QQ 音乐缺少播放授权", code, rawMessage:rawMsg, missingPlaybackKey:true };
  if (code === 104003) return { provider:"qq", category:"copyright_unavailable", action:"switch_source", message:"QQ 音乐没有返回播放地址", code, rawMessage:rawMsg };
  if (/vip|会员|付费|购买|数字专辑|专辑|pay/.test(rawMsg.toLowerCase())) return { provider:"qq", category:"paid_required", action:"upgrade", message:"QQ 音乐歌曲需要会员", code, rawMessage:rawMsg };
  if (code && code !== 0) return { provider:"qq", category:"copyright_unavailable", action:"switch_source", message:rawMsg || "QQ 音乐版权暂不可播", code, rawMessage:rawMsg };
  return { provider:"qq", category:"url_unavailable", action:"switch_source", message:"QQ 音乐没有返回可播放地址", code, rawMessage:rawMsg };
}

function decodeHtmlEntities(text: string): string {
  return String(text || "")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">").replace(/&amp;/g, "&").replace(/&nbsp;/g, " ");
}

function decodeQQLyricText(text: string): string {
  let raw = decodeHtmlEntities(String(text || "").trim());
  if (!raw) return "";
  const compact = raw.replace(/\s+/g, "");
  const looksBase64 = compact.length >= 8 && compact.length % 4 === 0 && /^[A-Za-z0-9+/]+={0,2}$/.test(compact);
  if (looksBase64 && !/^\s*\[/.test(raw)) {
    try {
      const decoded = Buffer.from(compact, "base64").toString("utf8").replace(/^\uFEFF/, "");
      if (decoded && (decoded.includes("[") || /[\u4e00-\u9fa5]/.test(decoded))) raw = decoded;
    } catch {}
  }
  return decodeHtmlEntities(raw).replace(/\r\n/g, "\n").trim();
}

function isQzoneBackgroundPlaylist(pl: any): boolean {
  const name = String(pl?.name || pl?.diss_name || pl?.title || "").toLowerCase();
  return /qzone|空间背景音乐|背景音乐/.test(name);
}

function isQQFavoritePlaylist(pl: any): boolean {
  return !!(pl && (pl.isFav || pl.is_fav || pl.favorite));
}

// ---- Provider class ----
export class QQProvider {
  name = "qq";
  private cookie = "";
  private saveCookieFn: (c: string) => void = () => {};

  init(config: ProviderConfig & { saveQQCookie?: (c: string) => void }) {
    this.cookie = config.cookie;
    if (config.saveQQCookie) this.saveCookieFn = config.saveQQCookie;
  }

  setCookie(c: string) { this.cookie = c; }
  private qc = () => this.cookie;

  private cookieObject(): Record<string, string> {
    return parseCookieString(this.cookie);
  }

  private cookieUin(obj?: Record<string, string>): string {
    obj = obj || this.cookieObject();
    const raw = Number(obj.login_type) === 2
      ? (obj.wxuin || obj.uin || obj.p_uin)
      : (obj.uin || obj.qqmusic_uin || obj.wxuin || obj.p_uin);
    return normalizeQQUin(raw);
  }

  private cookieMusicKey(obj?: Record<string, string>): string {
    obj = obj || this.cookieObject();
    return obj.qm_keyst || obj.qqmusic_key || obj.music_key || obj.p_skey || obj.skey ||
      obj.psrf_qqaccess_token || obj.psrf_qqrefresh_token || obj.wxrefresh_token || obj.wxskey || "";
  }

  private cookiePlaybackKey(obj?: Record<string, string>): string {
    obj = obj || this.cookieObject();
    return obj.qm_keyst || obj.qqmusic_key || obj.music_key || obj.wxskey || "";
  }

  private cookieNickname(obj?: Record<string, string>, uin?: string): string {
    obj = obj || this.cookieObject();
    uin = normalizeQQUin(uin || this.cookieUin(obj));
    const padded = uin ? "0" + uin : "";
    const keys = [
      uin && ("ptnick_" + uin),
      padded && ("ptnick_" + padded),
      "ptnick", "nick", "nickname", "qq_nickname",
    ].filter(Boolean);
    for (const key of keys) {
      if (key && obj[key]) {
        const nick = decodeQQCookieValue(obj[key]);
        if (nick) return nick;
      }
    }
    const ptnickKey = Object.keys(obj).find(k => /^ptnick_/i.test(k) && obj[k]);
    return ptnickKey ? decodeQQCookieValue(obj[ptnickKey]) : "";
  }

  private cookieAvatar(obj?: Record<string, string>, uin?: string): string {
    obj = obj || this.cookieObject();
    const direct = obj.qqmusic_avatar || obj.avatar || obj.avatarUrl || obj.headpic || "";
    if (direct) return decodeQQCookieValue(direct);
    uin = normalizeQQUin(uin || this.cookieUin(obj));
    return uin ? `https://q1.qlogo.cn/g?b=qq&nk=${encodeURIComponent(uin)}&s=100` : "";
  }

  normalizeQQCookieInput(cookieText: string): string {
    const obj = parseCookieString(cookieText);
    if (Number(obj.login_type) === 2 && obj.wxuin && !obj.uin) obj.uin = obj.wxuin;
    if (!obj.uin && (obj.qqmusic_uin || obj.p_uin)) obj.uin = obj.qqmusic_uin || obj.p_uin;
    if (obj.uin) obj.uin = normalizeQQUin(obj.uin);
    return serializeCookieObject(obj);
  }

  // ---- Internal HTTP ----
  private async qqMusicRequest(payload: any, opts?: any): Promise<any> {
    opts = opts || {};
    const body = JSON.stringify(payload);
    const headers: Record<string, string> = {
      ...QQ_HEADERS,
      "Content-Type": "application/json;charset=UTF-8",
    };
    if (opts.cookie && this.cookie) headers["Cookie"] = this.cookie;
    return requestJson(QQ_MUSICU_URL, { method: "POST", headers }, body);
  }

  private async qqGetJSON(targetUrl: string, params?: Record<string, any>, opts?: any): Promise<any> {
    opts = opts || {};
    const u = new URL(targetUrl);
    Object.entries(params || {}).forEach(([k, v]) => {
      if (v != null) u.searchParams.set(k, String(v));
    });
    const headers: Record<string, string> = { ...QQ_HEADERS, ...(opts.headers || {}) };
    if (opts.cookie !== false && this.cookie) headers["Cookie"] = this.cookie;
    return requestJson(u.toString(), { headers });
  }

  // ---- Profile / Login ----
  normalizeQQProfile(body: any, cookieObj?: Record<string, string>): LoginInfo {
    cookieObj = cookieObj || this.cookieObject();
    const uin = this.cookieUin(cookieObj);
    const data = (body?.data || body?.profile || body?.creator || body?.result) || {};
    const creator = (data.creator || data.user || data.profile || data) || {};
    const vipInfo = data.vipInfo || data.vipinfo || data.vip || creator.vipInfo || creator.vipinfo || {};
    const profileNick = creator.nick || creator.nickname || creator.name || creator.hostname || creator.title || "";
    const profileAvatar = creator.headpic || creator.avatar || creator.avatarUrl || creator.logo || "";
    const cookieNick = this.cookieNickname(cookieObj, uin);
    const nick = profileNick || cookieNick || "";
    const avatar = profileAvatar || this.cookieAvatar(cookieObj, uin);
    let vipType = Number(
      cookieObj.vipType || cookieObj.vip_type ||
      data.vipType || data.vip_type || data.viptype || data.music_vip_level || data.green_vip_level || data.luxury_vip_level ||
      creator.vipType || creator.vip_type || creator.music_vip_level || creator.green_vip_level || creator.luxury_vip_level ||
      vipInfo.vipType || vipInfo.vip_type || vipInfo.music_vip_level || vipInfo.green_vip_level || vipInfo.luxury_vip_level || 0
    ) || 0;
    if (!vipType) {
      const vipFlag = data.isVip || data.is_vip || data.vipFlag || data.vipflag || creator.isVip || creator.is_vip || vipInfo.isVip || vipInfo.is_vip || vipInfo.vipFlag;
      if (vipFlag === true || Number(vipFlag) > 0 || String(vipFlag || "").toLowerCase() === "true") vipType = 1;
    }
    return {
      provider: "qq",
      loggedIn: !!(uin && this.cookieMusicKey(cookieObj)),
      userId: uin,
      nickname: nick || (uin ? ("QQ " + uin) : "QQ 音乐"),
      avatar,
      vipType,
      hasCookie: !!this.cookie,
      playbackKeyReady: !!this.cookiePlaybackKey(cookieObj),
      profileSource: profileNick || profileAvatar ? "qq-profile" : (cookieNick || avatar ? "cookie" : "fallback"),
    };
  }

  async getLoginInfo(): Promise<LoginInfo> {
    const cookieObj = this.cookieObject();
    const uin = this.cookieUin(cookieObj);
    const musicKey = this.cookieMusicKey(cookieObj);
    if (!uin || !musicKey) return { provider:"qq", loggedIn:false, hasCookie:!!this.cookie };
    const fallback = this.normalizeQQProfile(null as any, cookieObj);
    try {
      const u = new URL("https://c.y.qq.com/rsc/fcgi-bin/fcg_get_profile_homepage.fcg");
      u.searchParams.set("cid", "205360838");
      u.searchParams.set("userid", uin);
      u.searchParams.set("reqfrom", "1");
      u.searchParams.set("g_tk", "5381");
      u.searchParams.set("loginUin", uin);
      u.searchParams.set("hostUin", "0");
      u.searchParams.set("format", "json");
      u.searchParams.set("inCharset", "utf8");
      u.searchParams.set("outCharset", "utf-8");
      u.searchParams.set("notice", "0");
      u.searchParams.set("platform", "yqq.json");
      u.searchParams.set("needNewCode", "0");
      const text = await requestText(u.toString(), {
        headers: { ...QQ_HEADERS, Cookie: this.cookie },
      });
      const body = JSON.parse(text);
      const info = this.normalizeQQProfile(body, cookieObj);
      if (body && (body.code === 1000 || body.result === 301)) {
        return { ...fallback, profileUnavailable: true } as LoginInfo;
      }
      return info;
    } catch (e: any) {
      console.warn("[QQLogin] profile check failed:", e.message);
      return { ...fallback, profileUnavailable: true } as LoginInfo;
    }
  }

  // ---- Search ----
  private async qqSmartboxSearch(keywords: string, limit: number): Promise<Song[]> {
    const u = new URL(QQ_SMARTBOX_URL);
    u.searchParams.set("format", "json");
    u.searchParams.set("key", keywords);
    u.searchParams.set("g_tk", "5381");
    u.searchParams.set("loginUin", "0");
    u.searchParams.set("hostUin", "0");
    u.searchParams.set("inCharset", "utf8");
    u.searchParams.set("outCharset", "utf-8");
    u.searchParams.set("notice", "0");
    u.searchParams.set("platform", "yqq.json");
    u.searchParams.set("needNewCode", "0");
    const json = await requestJson(u.toString(), { headers: QQ_HEADERS });
    const items = json?.data?.song?.itemlist;
    return (Array.isArray(items) ? items : []).slice(0, Math.max(1, Math.min(limit || 6, 10))).map(mapQQSmartSong);
  }

  private async qqSongDetail(mid: string, fallback?: Song): Promise<Song> {
    if (!mid) return fallback!;
    const json = await this.qqMusicRequest({
      comm: { ct: 24, cv: 0 },
      songinfo: { module: "music.pf_song_detail_svr", method: "get_song_detail_yqq", param: { song_mid: mid } },
    });
    const data = json?.songinfo?.data;
    return mapQQTrack(data?.track_info, fallback);
  }

  async search(keywords: string, limit = 6): Promise<SearchResult> {
    const kw = String(keywords || "").trim();
    if (!kw) return { songs: [], total: 0 };
    const base = await this.qqSmartboxSearch(kw, limit);
    const detailed = await Promise.all(base.map(async item => {
      try { return await this.qqSongDetail(item.mid, item); }
      catch { return item; }
    }));
    const seen = new Set<string>();
    const songs = detailed.filter(song => {
      const key = song && (song.mid || song.id || (song.name + "|" + song.artist));
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return !!song.name;
    });
    return { songs, total: songs.length };
  }

  // ---- Song URL ----
  async songUrl(mid: string, mediaMid?: string, qualityPreference?: string): Promise<SongUrlResult> {
    const songmid = String(mid || "").trim();
    if (!songmid) return { provider:"qq", url:"", playable:false, error:"MISSING_MID" };
    const guid = String(10000000 + Math.floor(Math.random() * 90000000));
    const cookieObj = this.cookieObject();
    const uin = this.cookieUin(cookieObj) || "0";
    const musicKey = this.cookieMusicKey(cookieObj);
    const playbackKey = this.cookiePlaybackKey(cookieObj);
    const fileMediaMid = String(mediaMid || "").trim();
    const requestedQuality = normalizeQuality(qualityPreference || "standard");
    const mediaIds: string[] = [];
    if (fileMediaMid) mediaIds.push(fileMediaMid);
    if (songmid && !mediaIds.includes(songmid)) mediaIds.push(songmid);
    const fileCandidates = mediaIds.flatMap(mediaId =>
      qualityCandidatesFrom(requestedQuality).map(item => ({ ...item, mediaId, filename: item.prefix + mediaId + item.ext }))
    );
    const filenames = fileCandidates.map(item => item.filename);
    const param: Record<string, any> = {
      guid,
      songmid: filenames.length ? filenames.map(() => songmid) : [songmid],
      songtype: filenames.length ? filenames.map(() => 0) : [0],
      uin, loginflag: 1, platform: "20",
    };
    if (filenames.length) param.filename = filenames;
    const comm: Record<string, any> = { uin, format: "json", ct: musicKey ? 19 : 24, cv: 0 };
    if (musicKey) comm.authst = musicKey;
    const json = await this.qqMusicRequest({
      comm,
      req_0: { module: "vkey.GetVkeyServer", method: "CgiGetVkey", param },
    }, { cookie: true });
    const data = json?.req_0?.data;
    const infos: any[] = (data && Array.isArray(data.midurlinfo)) ? data.midurlinfo : [];
    const info = infos.find((i: any) => i?.purl) || infos[0];
    const purl = info?.purl;
    if (purl) {
      const sip = (data.sip && data.sip[0]) || "https://ws.stream.qqmusic.qq.com/";
      const fileMeta = fileCandidates.find(i => i.filename === info.filename) || {};
      return {
        provider:"qq", url: sip + purl, trial:false, playable:true,
        level: fileMeta.level || info.filename || "",
        quality: fileMeta.label || info.filename || "",
        filename: info.filename || "", requestedQuality,
      };
    }
    const restriction = classifyQQPlaybackRestriction(info, !!(uin && musicKey), !!(uin && playbackKey));
    return {
      provider:"qq", url: "", playable: false, error: "QQ_URL_UNAVAILABLE",
      loggedIn: !!(uin && musicKey), playbackKeyReady: !!(uin && playbackKey),
      restriction, reason: restriction.category, message: restriction.message,
      qqCode: info?.result || info?.code || info?.errtype,
      rawMessage: info?.msg || info?.tips || info?.errmsg || "",
      tried: fileCandidates.map(i => i.label + " · " + i.filename),
      requestedQuality,
    };
  }

  // ---- Lyric ----
  async lyric(mid: string, id?: string): Promise<LyricResult> {
    const songMID = String(mid || "").trim();
    let songID = 0;
    const idStr = String(id || "").replace(/\D/g, "");
    if (idStr) songID = parseInt(idStr, 10);
    if (!songMID && !songID) return { provider:"qq", error:"Missing QQ song mid or id", lyric:"" };

    let lyricText = "", transText = "", qrcText = "", romaText = "";
    let source = "qq-musicu";

    try {
      const param: Record<string, any> = {};
      if (songMID) param.songMID = songMID;
      if (songID) param.songID = songID;
      const json = await this.qqMusicRequest({
        comm: { ct: 24, cv: 0 },
        lyric: { module: "music.musichallSong.PlayLyricInfo", method: "GetPlayLyricInfo", param },
      }, { cookie: true });
      const data = json?.lyric?.data;
      lyricText = decodeQQLyricText(data?.lyric);
      transText = decodeQQLyricText(data?.trans);
      qrcText = decodeQQLyricText(data?.qrc);
      romaText = decodeQQLyricText(data?.roma);
    } catch (e: any) {
      console.warn("[QQLyric] musicu failed:", e.message);
    }

    if (!lyricText && songMID) {
      try {
        const u = new URL("https://c.y.qq.com/lyric/fcgi-bin/fcg_query_lyric_new.fcg");
        u.searchParams.set("songmid", songMID);
        u.searchParams.set("songtype", "0");
        u.searchParams.set("format", "json");
        u.searchParams.set("nobase64", "1");
        u.searchParams.set("g_tk", "5381");
        u.searchParams.set("loginUin", this.cookieUin() || "0");
        u.searchParams.set("hostUin", "0");
        u.searchParams.set("inCharset", "utf8");
        u.searchParams.set("outCharset", "utf-8");
        u.searchParams.set("notice", "0");
        u.searchParams.set("platform", "yqq.json");
        u.searchParams.set("needNewCode", "0");
        const body = await this.qqGetJSON(u.toString(), {}, { headers: { Referer: "https://y.qq.com/portal/player.html" } });
        lyricText = decodeQQLyricText(body?.lyric);
        transText = decodeQQLyricText(body?.trans || body?.tlyric) || transText;
        source = "qq-legacy";
      } catch (e: any) {
        console.warn("[QQLyric] legacy failed:", e.message);
      }
    }

    return {
      provider:"qq", id: String(songID || ""), mid: songMID,
      lyric: lyricText, tlyric: transText, yrc: "", qrc: qrcText, roma: romaText,
      source: lyricText ? source : "qq-empty",
    };
  }

  // ---- Playlists ----
  async userPlaylists(): Promise<{ loggedIn: boolean; provider: string; playlists: Playlist[] }> {
    const info = await this.getLoginInfo();
    if (!info.loggedIn || !info.userId) return { loggedIn: false, provider: "qq", playlists: [] };
    const uin = info.userId;

    const createdReq = this.qqGetJSON("https://c.y.qq.com/rsc/fcgi-bin/fcg_user_created_diss", {
      hostUin: 0, hostuin: uin, sin: 0, size: 200, g_tk: 5381, loginUin: uin,
      format: "json", inCharset: "utf8", outCharset: "utf-8", notice: 0,
      platform: "yqq.json", needNewCode: 0,
    }, { headers: { Referer: "https://y.qq.com/portal/profile.html" } });

    const collectReq = this.qqGetJSON("https://c.y.qq.com/fav/fcgi-bin/fcg_get_profile_order_asset.fcg", {
      ct: 20, cid: 205360956, userid: uin, reqtype: 3, sin: 0, ein: 80,
    }, { headers: { Referer: "https://y.qq.com/portal/profile.html" } });

    const [createdRaw, collectRaw] = await Promise.allSettled([createdReq, collectReq]);
    const created = createdRaw.status === "fulfilled" && createdRaw.value?.data?.disslist
      ? createdRaw.value.data.disslist.map((pl: any) => mapQQPlaylist(pl, "created")) : [];
    const collected = collectRaw.status === "fulfilled" && collectRaw.value?.data?.cdlist
      ? collectRaw.value.data.cdlist.map((pl: any) => mapQQPlaylist(pl, "collect")) : [];

    const seen = new Set<string>();
    const playlists = created.concat(collected).filter((pl: any) => {
      if (!pl.id || !pl.name || seen.has(pl.id)) return false;
      if (isQzoneBackgroundPlaylist(pl)) return false;
      seen.add(pl.id);
      return true;
    }).sort((a: any, b: any) => Number(isQQFavoritePlaylist(b)) - Number(isQQFavoritePlaylist(a)));

    return { loggedIn: true, provider: "qq", userId: uin, playlists };
  }

  async playlistTracks(id: string): Promise<{ loggedIn: boolean; provider: string; playlist?: any; tracks: Song[] }> {
    const info = await this.getLoginInfo();
    if (!info.loggedIn || !info.userId) return { loggedIn: false, provider: "qq", tracks: [] };
    const pid = String(id || "").trim();
    if (!pid) return { loggedIn: true, provider: "qq", error: "Missing QQ playlist id", tracks: [] };

    const result = await this.qqGetJSON("https://c.y.qq.com/qzone/fcg-bin/fcg_ucc_getcdinfo_byids_cp.fcg", {
      type: 1, utf8: 1, disstid: pid, loginUin: info.userId,
      format: "json", inCharset: "utf8", outCharset: "utf-8", notice: 0,
      platform: "yqq.json", needNewCode: 0,
    }, { headers: { Referer: "https://y.qq.com/n/yqq/playlist" } });

    const detail = result?.cdlist?.[0] || {};
    const rawTracks: any[] = Array.isArray(detail.songlist) ? detail.songlist : [];
    const tracks = rawTracks.map(mapQQPlaylistTrack).filter((s: any) => s.name && (s.mid || s.id));
    return {
      loggedIn: true, provider: "qq",
      playlist: { provider:"qq", id:pid, name:detail.dissname || detail.diss_name || detail.name || "", cover:detail.logo || detail.diss_cover || "", trackCount: tracks.length },
      tracks,
    };
  }

  // ---- Artist ----
  async artistDetail(mid: string, limit = 36): Promise<any> {
    const singerMid = String(mid || "").trim();
    const num = Math.max(10, Math.min(80, parseInt(String(limit), 10) || 36));
    if (!singerMid) return { provider:"qq", error:"MISSING_SINGER_MID", artist:null, songs:[] };

    const json = await this.qqMusicRequest({
      comm: { ct: 24, cv: 0 },
      singer: { module: "music.web_singer_info_svr", method: "get_singer_detail_info", param: { sort:5, singermid:singerMid, sin:0, num } },
    }, { cookie: true });

    const block = json?.singer;
    if (!block || Number(block.code || 0) !== 0) {
      return { provider:"qq", error: block?.message || block?.msg || block?.code || "QQ_ARTIST_DETAIL_FAILED", artist:null, songs:[] };
    }
    const data = block.data || {};
    const info = data.singer_info || data.singerInfo || {};
    const rawSongs: any[] = Array.isArray(data.songlist) ? data.songlist : [];
    const songs = rawSongs
      .map((raw: any) => mapQQTrack(raw?.track_info || raw?.songInfo || raw?.songinfo || raw?.song || raw, {}))
      .filter((s: any) => s?.name && (s.mid || s.id));
    const matchedSongArtist = songs[0]?.artists?.find((a: any) => a?.mid === singerMid);
    const artistMid = info.mid || singerMid;
    const artistName = info.name || info.title || matchedSongArtist?.name || "";
    return {
      provider:"qq",
      artist: { provider:"qq", id:info.id || "", mid:artistMid, name:artistName, avatar:info.pic || info.avatar || qqSingerAvatar(artistMid, 300), fans:Number(info.fans||0)||0, musicSize:Number(data.total_song||data.song_count||0)||songs.length },
      total: Number(data.total_song||data.song_count||0) || songs.length,
      songs,
    };
  }

  // ---- Comment ----
  async commentMusic(mid: string, id?: string, limit = 20, offset = 0): Promise<any> {
    let topid = String(id || "").replace(/\D/g, "");
    if (!topid && mid) {
      try {
        const detail = await this.qqSongDetail(mid);
        topid = String(detail?.qqId || detail?.id || "").replace(/\D/g, "");
      } catch {}
    }
    if (!topid) return { provider:"qq", error:"Missing QQ song id", comments:[] };
    const page = Math.max(0, Math.floor((offset || 0) / Math.max(1, limit || 20)));
    const uin = this.cookieUin() || "0";
    const body = await this.qqGetJSON("https://c.y.qq.com/base/fcgi-bin/fcg_global_comment_h5.fcg", {
      g_tk:"5381", loginUin:uin, hostUin:"0", format:"json", inCharset:"utf8",
      outCharset:"utf-8", notice:"0", platform:"yqq.json", needNewCode:"0",
      cid:"205360772", reqtype:"2", biztype:"1", topid, cmd:"8",
      needmusiccrit:"0", pagenum:String(page), pagesize:String(limit || 20),
    }, { headers: { Referer: "https://y.qq.com/n/ryqq/songDetail/" + encodeURIComponent(mid || topid) } });
    const hotList = body?.hot_comment?.commentlist;
    const normalList = body?.comment?.commentlist;
    const raw = (offset === 0 && Array.isArray(hotList) && hotList.length) ? hotList : (normalList || []);
    const comments = (raw || []).map((c: any) => ({
      id: c.commentid || c.commentId || c.id || "",
      content: c.rootcommentcontent || c.content || c.comment || "",
      likedCount: Number(c.praisenum || c.praise_num || c.likedCount || 0) || 0,
      time: (c.time || 0) < 10000000000 ? (c.time || 0) * 1000 : (c.time || 0),
      user: { id: c.encrypt_uin || c.uin || "", nickname: c.nick || c.nickname || "", avatar: c.avatarurl || c.avatar || "" },
    })).filter((c: any) => c.content);
    const total = Number(body?.comment?.commenttotal || body?.comment?.comment_total) || comments.length;
    return { provider:"qq", id:topid, total, comments, hot:!!(offset === 0 && Array.isArray(hotList) && hotList.length) };
  }

  // ---- Session ----
  getSessionInfo() {
    const cookieObj = this.cookieObject();
    const uin = this.cookieUin(cookieObj);
    const musicKey = this.cookieMusicKey(cookieObj);
    return {
      provider: "qq",
      loggedIn: !!(uin && musicKey),
      hasCookie: !!this.cookie,
      uin,
      playbackKeyReady: !!(uin && this.cookiePlaybackKey(cookieObj)),
    };
  }
}
