// Legacy API route handler — mirrors the original server.js endpoint paths
import * as fs from "fs";
import * as path from "path";
import type { LoginInfo } from "../providers/types";
import { MusicProvider } from "../providers";

function json(data: any, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}

const BEATMAP_CACHE_DIR = process.env.MINERADIO_BEAT_CACHE_DIR || "D:\\MineradioCache\\beatmaps";

function beatCacheRootInfo() {
  const dir = BEATMAP_CACHE_DIR ? path.resolve(BEATMAP_CACHE_DIR) : "";
  const root = dir ? path.parse(dir).root : "";
  const drive = root ? root.replace(/[\\\/]+$/, "").toUpperCase() : "";
  const allowed = !!root && !/^C:$/i.test(drive);
  const available = allowed && fs.existsSync(root);
  return { dir, root, drive, allowed, available };
}

// ── Weather Radio helpers ──

function openMeteoWeatherLabel(code: number): string {
  if (code === 0) return "晴";
  if (code === 1 || code === 2) return "少云";
  if (code === 3) return "阴";
  if (code === 45 || code === 48) return "雾";
  if (code === 51 || code === 53 || code === 55) return "毛毛雨";
  if (code === 56 || code === 57) return "冻雨";
  if (code === 61 || code === 63 || code === 65) return "雨";
  if (code === 66 || code === 67) return "冻雨";
  if (code === 71 || code === 73 || code === 75 || code === 77) return "雪";
  if (code === 80 || code === 81 || code === 82) return "阵雨";
  if (code === 85 || code === 86) return "阵雪";
  if (code === 95 || code === 96 || code === 99) return "雷雨";
  return "天气";
}

async function fetchOpenMeteoWeather(params: { lat: number; lon: number; timezone: string }) {
  const u = new URL("https://api.open-meteo.com/v1/forecast");
  u.searchParams.set("latitude", String(params.lat));
  u.searchParams.set("longitude", String(params.lon));
  u.searchParams.set("current", "temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,is_day");
  u.searchParams.set("timezone", params.timezone || "auto");
  const resp = await fetch(u.toString());
  const data = await resp.json();
  const c = data?.current || {};
  return {
    temperature: Number(c.temperature_2m) || 22,
    apparentTemperature: Number(c.apparent_temperature) || Number(c.temperature_2m) || 22,
    humidity: Number(c.relative_humidity_2m) || 50,
    precipitation: Number(c.precipitation) || 0,
    weatherCode: Number(c.weather_code) || 0,
    windSpeed: Number(c.wind_speed_10m) || 0,
    isDay: Number(c.is_day) ?? 1,
    label: openMeteoWeatherLabel(Number(c.weather_code) || 0),
  };
}

function buildWeatherMood(weather: any) {
  const now = new Date();
  const hour = now.getHours();
  const code = Number(weather?.weatherCode) || 0;
  const temp = Number(weather?.temperature) || 22;
  const apparent = Number(weather?.apparentTemperature) || temp;
  const rain = Number(weather?.precipitation) || 0;
  const humidity = Number(weather?.humidity) || 50;
  const wind = Number(weather?.windSpeed) || 0;
  const isNight = weather?.isDay === 0 || hour < 6 || hour >= 20;
  const isMorning = hour >= 5 && hour < 11;
  const isDusk = hour >= 17 && hour < 20;
  const isRain = rain > 0 || [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99].includes(code);
  const isSnow = [71, 73, 75, 77, 85, 86].includes(code);
  const isCloud = [2, 3, 45, 48].includes(code);
  const isStorm = [95, 96, 99].includes(code);
  const feels = Number.isFinite(apparent) ? apparent : temp;

  let mood: any = {
    key: "clear",
    title: "晴朗电台",
    tagline: "让节奏亮一点，像窗边的光",
    energy: 0.62, warmth: 0.58, focus: 0.48, melancholy: 0.24,
    keywords: ["轻快 华语", "city pop", "indie pop", "chill pop", "阳光 歌单"],
  };

  if (isStorm) {
    mood = { key: "storm", title: "雷雨电台", tagline: "低频更厚，适合把世界关小一点", energy: 0.46, warmth: 0.34, focus: 0.66, melancholy: 0.62, keywords: ["暗色 R&B", "trip hop", "夜晚 电子", "氛围 摇滚", "雨夜 歌单"] };
  } else if (isRain) {
    mood = { key: "rain", title: "雨天电台", tagline: "留一点潮湿的空间给旋律", energy: 0.38, warmth: 0.42, focus: 0.64, melancholy: 0.66, keywords: ["雨天 R&B", "lofi rainy", "华语 慢歌", "dream pop", "雨夜 歌单"] };
  } else if (isSnow || feels <= 3) {
    mood = { key: "snow", title: "冷空气电台", tagline: "干净、慢速、带一点冬天的颗粒感", energy: 0.34, warmth: 0.28, focus: 0.72, melancholy: 0.54, keywords: ["冬天 民谣", "ambient piano", "日系 冬天", "indie folk", "安静 歌单"] };
  } else if (feels >= 31 || humidity >= 78) {
    mood = { key: "humid", title: "闷热电台", tagline: "降低密度，留出一点呼吸", energy: 0.48, warmth: 0.76, focus: 0.46, melancholy: 0.30, keywords: ["夏日 chill", "bossa nova", "city pop 夏天", "轻电子", "海边 歌单"] };
  } else if (isCloud) {
    mood = { key: "cloudy", title: "阴天电台", tagline: "不急着明亮，先让声音变软", energy: 0.40, warmth: 0.46, focus: 0.58, melancholy: 0.52, keywords: ["阴天 华语", "indie rock mellow", "neo soul", "chillhop", "独立 民谣"] };
  }

  if (isNight) {
    mood.key += "-night";
    mood.title = mood.key.startsWith("clear") ? "夜色电台" : mood.title.replace("电台", "夜听");
    mood.tagline = "音量放低一点，让夜色参与编曲";
    mood.energy = Math.min(mood.energy, 0.42);
    mood.focus = Math.max(mood.focus, 0.68);
    mood.melancholy = Math.max(mood.melancholy, 0.52);
    mood.keywords = ["夜晚 R&B", "late night jazz", "ambient", "lofi sleep", "夜跑 歌单"].concat(mood.keywords.slice(0, 3));
  } else if (isMorning) {
    mood.title = mood.key.startsWith("rain") ? "雨晨电台" : "早晨电台";
    mood.energy = Math.max(mood.energy, 0.52);
    mood.keywords = ["早晨 通勤", "morning acoustic", "清晨 indie", "轻快 华语"].concat(mood.keywords.slice(0, 3));
  } else if (isDusk) {
    mood.title = mood.key.startsWith("rain") ? "黄昏雨声" : "黄昏电台";
    mood.melancholy = Math.max(mood.melancholy, 0.48);
    mood.keywords = ["黄昏 city pop", "日落 歌单", "落日飞车", "soul pop"].concat(mood.keywords.slice(0, 3));
  }

  if (wind >= 28) {
    mood.energy = Math.max(mood.energy, 0.56);
    mood.keywords = ["公路 摇滚", "windy day playlist"].concat(mood.keywords.slice(0, 4));
  }
  mood.keywords = Array.from(new Set(mood.keywords)).slice(0, 7);
  return mood;
}

function weatherRadioSeedQueries(mood: any): string[] {
  const key = String(mood?.key || "");
  if (key.includes("rain") || key.includes("storm")) return ["陈奕迅 阴天快乐", "周杰伦 雨下一整晚", "孙燕姿 遇见", "林宥嘉 说谎", "毛不易 消愁"];
  if (key.includes("snow") || key.includes("cloudy")) return ["陈奕迅 好久不见", "莫文蔚 阴天", "李健 贝加尔湖畔", "朴树 平凡之路", "蔡健雅 达尔文"];
  if (key.includes("humid")) return ["落日飞车 My Jinji", "告五人 爱人错过", "夏日入侵企画 想去海边", "陈绮贞 旅行的意义", "王若琳 Lost in Paradise"];
  if (key.includes("night")) return ["方大同 特别的人", "陶喆 爱很简单", "Frank Ocean Pink + White", "林忆莲 夜太黑", "Norah Jones Don't Know Why"];
  return ["孙燕姿 天黑黑", "周杰伦 晴天", "五月天 温柔", "陈奕迅 稳稳的幸福", "王菲"];
}

function isLowSignalWeatherSong(song: any): boolean {
  const text = String([song?.name, song?.artist, song?.album].filter(Boolean).join(" ")).toLowerCase();
  if (!text) return true;
  if (/(^|[\s\-_/（(])ai(?:\s*(歌|歌曲|音乐|cover|翻唱|生成|作曲|演唱|女声|男声)|$|[\s\-_/）)])/i.test(text)) return true;
  if (/suno|udio|人工智能|生成歌曲|ai歌曲|虚拟歌手|测试音频|demo|beat\s*maker/i.test(text)) return true;
  if (/翻自|翻唱|cover|remix|伴奏|纯音乐|钢琴|dj|live\s*版|live版|唯美钢琴|karaoke|instrumental/i.test(text)) return true;
  if (/白噪音|雨声|睡眠|助眠|冥想|疗愈频率|环境音|自然声音|asmr/i.test(text)) return true;
  if (/[（(](r&b|lofi|jazz|dj|edm|trap|remix|伴奏|纯音乐|钢琴|电子|治愈|古风|女声|男声|英文|中文版|抖音|ai)[）)]/i.test(text)) return true;
  if (/^(纯音乐|轻音乐|治愈系|放松|睡眠|雨天|阴天|夜晚|夏日|海边)$/i.test(String(song?.name || "").trim())) return true;
  return false;
}

function scoreWeatherSong(song: any, mood: any): number {
  const text = String((song?.name || "") + " " + (song?.artist || "") + " " + (song?.album || "")).toLowerCase();
  let score = 0;
  if (song?.cover) score += 4;
  if (song?.duration) score += 2;
  if (/周杰伦|陈奕迅|孙燕姿|五月天|王菲|陶喆|方大同|林宥嘉|蔡健雅|莫文蔚|李健|毛不易|告五人|落日飞车|陈绮贞|朴树/.test(text)) score += 10;
  const key = String(mood?.key || "");
  if (key.includes("rain") && /雨|阴|夜|慢|r&b|soul|陈奕迅|林宥嘉|孙燕姿/.test(text)) score += 5;
  if (key.includes("humid") && /夏|海|city|pop|落日|告五人|方大同|陶喆/.test(text)) score += 5;
  if (key.includes("night") && /夜|moon|jazz|soul|r&b|方大同|陶喆|王菲/.test(text)) score += 5;
  if (key.includes("cloudy") && /阴|民谣|indie|陈绮贞|朴树|李健/.test(text)) score += 5;
  return score;
}

function uniqueSongsByKey(songs: any[]): any[] {
  const seen = new Set<string>();
  const out: any[] = [];
  for (const song of songs) {
    const key = String(song?.id || (song?.name + "|" + song?.artist) || "").trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(song);
  }
  return out;
}

function weatherTitleKey(song: any): string {
  return String(song?.name || "").toLowerCase().replace(/[（(][^）)]*[）)]/g, "").replace(/[\s._\-·'""「」《》:：/\\|]+/g, "").trim();
}

function uniqueWeatherTitles(sorted: any[]): any[] {
  const seen = new Set<string>();
  const out: any[] = [];
  for (const song of sorted) {
    const key = weatherTitleKey(song);
    if (key && seen.has(key)) continue;
    if (key) seen.add(key);
    out.push(song);
  }
  return out;
}

function diversifyWeatherSongs(sorted: any[], artistLimit: number): any[] {
  const primary: any[] = [];
  const deferred: any[] = [];
  const counts = new Map<string, number>();
  for (const song of sorted) {
    const raw = String(song?.artist || song?.name || "").split(/\s*\/\s*|、|,|&/)[0] || "";
    const key = raw.trim().toLowerCase() || "unknown";
    const count = counts.get(key) || 0;
    if (count < artistLimit) {
      primary.push(song);
      counts.set(key, count + 1);
    } else {
      deferred.push(song);
    }
  }
  return primary.length >= 8 ? primary : primary.concat(deferred.slice(0, 8 - primary.length));
}

function orderWeatherSongs(songs: any[], mood: any): any[] {
  const sorted = uniqueSongsByKey(songs)
    .filter((s) => s?.name && s?.id && !isLowSignalWeatherSong(s))
    .sort((a, b) => scoreWeatherSong(b, mood) - scoreWeatherSong(a, mood));
  return diversifyWeatherSongs(uniqueWeatherTitles(sorted), 2);
}

async function buildWeatherRadio(params: { lat: number; lon: number; timezone: string }, providers: MusicProvider) {
  let weather: any;
  try {
    weather = await fetchOpenMeteoWeather(params);
  } catch (e: any) {
    console.warn("[WeatherRadio] weather provider failed:", e?.message);
    weather = { temperature: 22, apparentTemperature: 22, humidity: 60, precipitation: 0, weatherCode: 0, windSpeed: 0, isDay: 1, label: "天气" };
  }
  const mood = buildWeatherMood(weather);
  const queries = weatherRadioSeedQueries(mood);
  let songs: any[] = [];
  // Search each seed query via Netease
  const results = await Promise.allSettled(
    queries.slice(0, 4).map((q) => providers.netease.search(q, 1, 6))
  );
  for (const r of results) {
    if (r.status === "fulfilled" && Array.isArray((r.value as any)?.songs)) {
      songs = songs.concat((r.value as any).songs);
    }
  }
  // Fallback: search mood keywords if few songs
  if (songs.length < 10 && Array.isArray(mood.keywords)) {
    const more = await Promise.allSettled(
      mood.keywords.slice(0, 2).map((q: string) => providers.netease.search(q, 1, 6))
    );
    for (const r of more) {
      if (r.status === "fulfilled" && Array.isArray((r.value as any)?.songs)) {
        songs = songs.concat((r.value as any).songs);
      }
    }
  }
  const ordered = orderWeatherSongs(songs, mood);
  return {
    ok: true,
    weather: {
      temperature: weather.temperature,
      apparentTemperature: weather.apparentTemperature,
      humidity: weather.humidity,
      weatherCode: weather.weatherCode,
      label: weather.label,
      city: params.lat === 31.23 && params.lon === 121.47 ? "上海" : "",
    },
    radio: {
      title: mood.title,
      subtitle: mood.tagline,
      seedQueries: queries.slice(0, 4),
      songs: ordered.slice(0, 18),
      updatedAt: Date.now(),
    },
  };
}

export function createLegacyAPIHandler(providers: MusicProvider) {
  return async (req: Request, url: URL): Promise<Response> => {
    const pathname = url.pathname;

    try {
      // ---- Netease Search ----
      if (pathname === "/api/search" || pathname === "/api/cloudsearch") {
        const keywords = url.searchParams.get("keywords") || "";
        const type = parseInt(url.searchParams.get("type") || "1");
        const limit = parseInt(url.searchParams.get("limit") || "30");
        const fn = pathname === "/api/cloudsearch" ? providers.netease.cloudsearch.bind(providers.netease) : providers.netease.search.bind(providers.netease);
        return json(await fn(keywords, type, limit));
      }

      // ---- QQ Search ----
      if (pathname === "/api/qq/search") {
        const keywords = url.searchParams.get("keywords") || "";
        const limit = parseInt(url.searchParams.get("limit") || "6");
        return json(await providers.qq.search(keywords, limit));
      }

      // ---- Song URL (Netease) ----
      if (pathname === "/api/song/url" || pathname === "/api/netease/song/url") {
        const id = url.searchParams.get("id") || "";
        const level = url.searchParams.get("level") || "standard";
        let loginInfo: LoginInfo = { provider:"netease", loggedIn:false };
        try { loginInfo = await providers.netease.userAccount(); } catch {}
        return json(await providers.netease.songUrl(id, level, loginInfo));
      }

      // ---- Song URL (QQ) ----
      if (pathname === "/api/qq/song/url") {
        const mid = url.searchParams.get("mid") || "";
        const mediaMid = url.searchParams.get("mediaMid") || "";
        const level = url.searchParams.get("level") || "hires";
        return json(await providers.qq.songUrl(mid, mediaMid, level));
      }

      // ---- Lyric (Netease) ----
      if (pathname === "/api/lyric" || pathname === "/api/netease/lyric") {
        const id = url.searchParams.get("id") || "";
        return json(await providers.netease.lyric(id));
      }

      // ---- Lyric (QQ) ----
      if (pathname === "/api/qq/lyric") {
        const mid = url.searchParams.get("mid") || "";
        const id = url.searchParams.get("id") || "";
        return json(await providers.qq.lyric(mid, id));
      }

      // ---- Login QR (Netease) ----
      if (pathname === "/api/login/qr/key") {
        return json(await providers.netease.loginQRKey());
      }
      if (pathname === "/api/login/qr/create") {
        const key = url.searchParams.get("key") || "";
        return json(await providers.netease.loginQRCreate(key));
      }
      if (pathname === "/api/login/qr/check") {
        const key = url.searchParams.get("key") || "";
        return json(await providers.netease.loginQRCheck(key));
      }
      if (pathname === "/api/login/cookie" && req.method === "POST") {
        const body = await req.json();
        providers.setCookie(body.cookie || "");
        providers.saveCookie(body.cookie || "");
        return json({ ok: true, loggedIn: true });
      }

      // ---- Login Status ----
      if (pathname === "/api/login/status") {
        return json(await providers.netease.loginStatus());
      }
      if (pathname === "/api/logout") {
        return json(await providers.netease.logout());
      }

      // ---- Like ----
      if (pathname === "/api/song/like") {
        const id = url.searchParams.get("id") || "";
        const like = url.searchParams.get("like") !== "false";
        return json(await providers.netease.like(id, like));
      }
      if (pathname === "/api/song/like/check") {
        const ids = url.searchParams.get("ids") || "";
        return json(await providers.netease.songLikeCheck(ids));
      }

      // ---- User playlists (Netease) ----
      if (pathname === "/api/user/playlists") {
        let uid = "";
        try {
          const acct = await providers.netease.userAccount() as any;
          uid = acct.profile?.userId || "";
        } catch {}
        if (uid) return json(await providers.netease.userPlaylist(uid));
        return json({ playlist: [] });
      }

      // ---- User playlists (QQ) ----
      if (pathname === "/api/qq/user/playlists") {
        return json(await providers.qq.userPlaylists());
      }

      // ---- Playlist (Netease) ----
      if (pathname === "/api/playlist/tracks") {
        const id = url.searchParams.get("id") || "";
        if (req.method === "POST") {
          const body = await req.json();
          return json(await providers.netease.playlistTrackAdd(id, body.songIds || ""));
        }
        return json(await providers.netease.playlistTrackAll(id));
      }
      if (pathname === "/api/playlist/create") {
        const name = url.searchParams.get("name") || "";
        return json(await providers.netease.playlistCreate(name));
      }
      if (pathname === "/api/playlist/add-song" && req.method === "POST") {
        const body = await req.json();
        return json(await providers.netease.playlistTrackAdd(body.id, body.songIds || ""));
      }

      // ---- QQ Playlist detail ----
      if (pathname === "/api/qq/playlist/tracks") {
        const id = url.searchParams.get("id") || "";
        return json(await providers.qq.playlistTracks(id));
      }

      // ---- Artist ----
      if (pathname === "/api/artist/detail") {
        const id = url.searchParams.get("id") || "";
        return json(await providers.netease.artistDetail(id));
      }
      if (pathname === "/api/artist/songs") {
        const id = url.searchParams.get("id") || "";
        const offset = parseInt(url.searchParams.get("offset") || "0");
        const limit = parseInt(url.searchParams.get("limit") || "50");
        return json(await providers.netease.artistSongs(id, offset, limit));
      }

      // ---- QQ Artist ----
      if (pathname === "/api/qq/artist/detail") {
        const mid = url.searchParams.get("mid") || "";
        const limit = parseInt(url.searchParams.get("limit") || "36");
        return json(await providers.qq.artistDetail(mid, limit));
      }

      // ---- QQ Song Comments ----
      if (pathname === "/api/qq/song/comments") {
        const mid = url.searchParams.get("mid") || "";
        const id = url.searchParams.get("id") || "";
        const limit = parseInt(url.searchParams.get("limit") || "18");
        return json(await providers.qq.commentMusic(mid, id, limit));
      }

      // ---- Likelist ----
      if (pathname === "/api/likelist") {
        const uid = url.searchParams.get("uid") || "";
        if (uid) return json(await providers.netease.likelist(uid));
        return json({ ids: [] });
      }

      // ---- Audio proxy ----
      if (pathname === "/api/audio") {
        const audioUrl = url.searchParams.get("url") || "";
        if (!audioUrl) return json({ error: "URL_REQUIRED" }, 400);
        const headers: Record<string, string> = { "User-Agent": "Mozilla/5.0" };
        try {
          const host = new URL(audioUrl).hostname.toLowerCase();
          if (host.includes("qq.com") || host.includes("qpic.cn")) headers["Referer"] = "https://y.qq.com/";
          else headers["Referer"] = "https://music.163.com/";
        } catch {}
        const range = req.headers.get("range");
        if (range) headers["Range"] = range;
        const resp = await fetch(audioUrl, { headers });
        const respHeaders: Record<string, string> = {
          "Content-Type": resp.headers.get("Content-Type") || "audio/mpeg",
          "Access-Control-Allow-Origin": "*",
          "Accept-Ranges": "bytes",
        };
        if (resp.headers.get("Content-Range")) respHeaders["Content-Range"] = resp.headers.get("Content-Range")!;
        if (resp.headers.get("Content-Length")) respHeaders["Content-Length"] = resp.headers.get("Content-Length")!;
        // Forward original status (206 for Range, 200 otherwise) so the browser
        // correctly interprets partial-content responses — otherwise the audio
        // buffer gets confused, stutters, and resets to 00:00.
        const status = resp.status;
        return new Response(resp.body, { status, headers: respHeaders });
      }

      // ---- Cover proxy ----
      if (pathname === "/api/cover") {
        const coverUrl = url.searchParams.get("url") || "";
        if (!coverUrl) return json({ error: "URL_REQUIRED" }, 400);
        // Use per-domain Referer so Netease CDN doesn't block the request
        const coverHeaders: Record<string, string> = { "User-Agent": "Mozilla/5.0" };
        try {
          const host = new URL(coverUrl).hostname.toLowerCase();
          if (host.includes("qq.com") || host.includes("qpic.cn")) coverHeaders["Referer"] = "https://y.qq.com/";
          else coverHeaders["Referer"] = "https://music.163.com/";
        } catch {}
        const resp = await fetch(coverUrl, { headers: coverHeaders });
        return new Response(resp.body, {
          headers: {
            "Content-Type": resp.headers.get("Content-Type") || "image/jpeg",
            "Access-Control-Allow-Origin": "*",
            "Cache-Control": "public, max-age=86400",
          },
        });
      }

      // ---- QQ Login info ----
      if (pathname === "/api/qq/login/info") {
        return json(await providers.qq.getLoginInfo());
      }

      // ---- QQ Login status (legacy alias) ----
      if (pathname === "/api/qq/login/status") {
        return json(await providers.qq.getLoginInfo());
      }

      // ---- QQ Login by cookie (legacy) ----
      if (pathname === "/api/qq/login/cookie" && req.method === "POST") {
        const body = await req.json();
        try {
          const normalized = providers.qq.normalizeQQCookieInput(body.cookie || "");
          providers.setQQCookie(normalized);
          providers.saveQQCookie(normalized);
          const info = await providers.qq.getLoginInfo();
          return json({ ok: true, loggedIn: !!info.loggedIn, info });
        } catch (e: any) {
          return json({ ok: false, loggedIn: false, error: e.message }, 400);
        }
      }

      // ---- QQ Cookie normalize ----
      if (pathname === "/api/qq/cookie/normalize" && req.method === "POST") {
        const body = await req.json();
        try {
          const normalized = providers.qq.normalizeQQCookieInput(body.cookie || "");
          providers.setQQCookie(normalized);
          providers.saveQQCookie(normalized);
          const info = await providers.qq.getLoginInfo();
          return json({ ok: true, cookie: normalized, info });
        } catch (e: any) {
          return json({ ok: false, error: e.message }, 400);
        }
      }

      // ---- Update ----
      if (pathname === "/api/update/latest") {
        return json({
          configured: false, updateAvailable: false, currentVersion: "1.0.0", latestVersion: "1.0.0",
          release: { tagName: "v1.0.0", name: "Mineradio v1.0.0", version: "1.0.0", summary: "当前版本", notes: ["Electrobun 迁移版本"] },
        });
      }

      // ---- Discover ----
      if (pathname === "/api/discover/home") {
        let rec = {};
        try { rec = await providers.netease.recommendResource(); } catch {}
        return json({ playlists: [], recommended: rec, dailySongs: [], dailyPlaylists: [] });
      }

      // ---- Beatmap cache stubs ----
      if (pathname === "/api/beatmap/cache/status") {
        const info = beatCacheRootInfo();
        return json({
          enabled: info.allowed && info.available,
          dir: info.dir,
          drive: info.drive,
          reason: !info.allowed ? "C_DRIVE_DISABLED" : (!info.available ? "TARGET_DRIVE_UNAVAILABLE" : ""),
          mode: info.allowed && info.available ? "disk" : "memory-only",
        });
      }
      if (pathname === "/api/beatmap/cache") return json({ ok: false, error: "NO_CACHE" });

      // ---- Podcast (Netease) ----
      if (pathname === "/api/podcast/search" || pathname === "/api/podcast/hot") {
        return json(await providers.netease.djHot(30));
      }
      if (pathname === "/api/podcast/programs") {
        const id = url.searchParams.get("id") || "";
        return json(await providers.netease.djProgram(id, 100));
      }
      if (pathname === "/api/podcast/my") {
        return json(await providers.netease.djSublist());
      }
      if (pathname === "/api/podcast/my/items") return json({ items: [] });

      // ---- Weather: IP-based location ----
      if (pathname === "/api/weather/ip-location") {
        try {
          const resp = await fetch("http://ip-api.com/json/?fields=status,country,regionName,city,lat,lon,timezone,query&lang=zh-CN");
          const body = await resp.json();
          if (body.status === "success" && Number.isFinite(Number(body.lat))) {
            return json({
              city: body.city || "上海",
              country: body.country || "China",
              region: body.regionName || "",
              lat: Number(body.lat),
              lon: Number(body.lon),
              timezone: body.timezone || "auto",
            });
          }
        } catch {}
        return json({ city: "上海", country: "China", lat: 31.23, lon: 121.47, timezone: "Asia/Shanghai" });
      }

      // ---- Weather: Radio (Open-Meteo + song search) ----
      if (pathname === "/api/weather/radio") {
        try {
          const lat = url.searchParams.get("lat") || "31.23";
          const lon = url.searchParams.get("lon") || "121.47";
          const tz = url.searchParams.get("timezone") || "Asia/Shanghai";
          const result = await buildWeatherRadio({ lat: Number(lat), lon: Number(lon), timezone: tz }, providers);
          return json(result);
        } catch (e: any) {
          return json({ ok: false, error: e?.message || "WEATHER_RADIO_FAILED" });
        }
      }

      // ---- App version ----
      if (pathname === "/api/app/version") {
        return json({ name: "mineradio", productName: "Mineradio", version: "1.0.0" });
      }

    } catch (err: any) {
      console.error(`[LegacyAPI] ${pathname}:`, err.message);
      return json({ error: err.message || "INTERNAL_ERROR" }, 500);
    }

    return json({ error: "UNKNOWN_LEGACY_API" }, 404);
  };
}
