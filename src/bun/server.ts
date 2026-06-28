import { search, cloudsearch, song_detail, song_url, song_url_v1, login_qr_key, login_qr_create, login_qr_check, login_status, logout, user_account, user_playlist, comment_music, artist_detail, artist_top_song, artist_songs, like as like_song, likelist, song_like_check, playlist_tracks, playlist_track_add, playlist_create, playlist_detail, playlist_track_all, personalized, recommend_resource, recommend_songs, dj_detail, dj_program, dj_hot, dj_sublist, user_audio, dj_paygift, record_recent_voice, sati_resource_sub_list, lyric, lyric_new } from "NeteaseCloudMusicApi";
import * as fs from "fs";
import * as path from "path";

const HOST = process.env.HOST || "0.0.0.0";
const PORT = parseInt(process.env.PORT || "3001");

// Resolve dist/ and public/ directories for both source-run and electrobun-build contexts
function resolveDistDir(): string {
  const candidates = [
    // Source-run mode: src/bun/ -> ../../dist
    path.resolve(import.meta.dir, "../../dist"),
    // Electrobun build mode: Resources/app/bun/ -> ../views/mainview
    path.resolve(import.meta.dir, "../views/mainview"),
    // Fallback: cwd/dist
    path.resolve(process.cwd(), "dist"),
  ];
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, "index.html"))) return dir;
  }
  return candidates[0];
}
function resolvePublicDir(): string {
  const candidates = [
    // Source-run mode: src/bun/ -> ../../public
    path.resolve(import.meta.dir, "../../public"),
    // Electrobun build mode: Resources/app/bun/ -> ../views
    path.resolve(import.meta.dir, "../views"),
    // Fallback: cwd/public
    path.resolve(process.cwd(), "public"),
  ];
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, "vendor"))) return dir;
  }
  return candidates[0];
}

const DIST_DIR = process.env.DIST_DIR || resolveDistDir();
const PUBLIC_DIR = process.env.PUBLIC_DIR || resolvePublicDir();

const COOKIE_FILE = process.env.COOKIE_FILE || path.join(process.cwd(), ".cookie");
const QQ_COOKIE_FILE = process.env.QQ_COOKIE_FILE || path.join(process.cwd(), ".qq-cookie");

let userCookie = "";
let qqCookie = "";
let serverPort = PORT;

try {
  if (fs.existsSync(COOKIE_FILE)) userCookie = fs.readFileSync(COOKIE_FILE, "utf8").trim();
  if (fs.existsSync(QQ_COOKIE_FILE)) qqCookie = fs.readFileSync(QQ_COOKIE_FILE, "utf8").trim();
} catch (e) {}

function saveCookie(c: string) {
  userCookie = c.trim();
  try { fs.writeFileSync(COOKIE_FILE, userCookie); } catch (e) {}
}
function saveQQCookie(c: string) {
  qqCookie = c.trim();
  try { fs.writeFileSync(QQ_COOKIE_FILE, qqCookie); } catch (e) {}
}

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".bin": "application/octet-stream",
};

function serveFile(resolvedPath: string): Response {
  const ext = path.extname(resolvedPath);
  try {
    const data = fs.readFileSync(resolvedPath);
    return new Response(data, {
      headers: { "Content-Type": MIME[ext] || "application/octet-stream" },
    });
  } catch {
    return new Response("Not Found", { status: 404 });
  }
}

async function handleRPC(body: any): Promise<Response> {
  const { method, params } = body;
  if (!method) return json({ error: "METHOD_REQUIRED" }, 400);

  const nc = () => userCookie;
  const qc = () => qqCookie;

  try {
    switch (method) {
      case "search": {
        const r = await search({ keywords: params?.keywords || "", type: params?.type || 1, limit: params?.limit || 30, cookie: nc() });
        return json(r.body);
      }
      case "cloudsearch": {
        const r = await cloudsearch({ keywords: params?.keywords || "", type: params?.type || 1, limit: params?.limit || 30, cookie: nc() });
        return json(r.body);
      }
      case "song_detail": {
        const r = await song_detail({ ids: params?.ids || "", cookie: nc() });
        return json(r.body);
      }
      case "song_url": {
        const r = await song_url({ id: params?.id || "", level: params?.level || "standard", cookie: nc() });
        return json(r.body);
      }
      case "song_url_v1": {
        const r = await song_url_v1({ id: params?.id || "", level: params?.level || "standard", cookie: nc() });
        return json(r.body);
      }
      case "lyric": {
        const r = await lyric({ id: params?.id || "", cookie: nc() });
        return json(r.body);
      }
      case "lyric_new": {
        const r = await lyric_new({ id: params?.id || "", cookie: nc() });
        return json(r.body);
      }
      case "login_qr_key": {
        const r = await login_qr_key({ cookie: nc() });
        return json(r.body);
      }
      case "login_qr_create": {
        const r = await login_qr_create({ key: params?.key || "", qrimg: true, cookie: nc() });
        return json(r.body);
      }
      case "login_qr_check": {
        const r = await login_qr_check({ key: params?.key || "", cookie: nc() });
        if (r.body.code === 803 || r.body.code === 800) {
          const c = r.headers.get("set-cookie") || "";
          saveCookie(c);
        }
        return json(r.body);
      }
      case "login_status": {
        const r = await login_status({ cookie: nc() });
        return json(r.body);
      }
      case "logout": {
        const r = await logout({ cookie: nc() });
        saveCookie("");
        return json(r.body);
      }
      case "user_account": {
        const r = await user_account({ cookie: nc() });
        return json(r.body);
      }
      case "user_playlist": {
        const r = await user_playlist({ uid: params?.uid || "", cookie: nc() });
        return json(r.body);
      }
      case "like": {
        const r = await like_song({ id: params?.id || "", like: params?.like !== false, cookie: nc() });
        return json(r.body);
      }
      case "likelist": {
        const r = await likelist({ uid: params?.uid || "", cookie: nc() });
        return json(r.body);
      }
      case "song_like_check": {
        const r = await song_like_check({ songId: params?.songId || "", cookie: nc() });
        return json(r.body);
      }
      case "playlist_tracks": {
        const r = await playlist_tracks({ id: params?.id || "", op: params?.op || "add", tracks: params?.tracks || "", cookie: nc() });
        return json(r.body);
      }
      case "playlist_track_add": {
        const r = await playlist_track_add({ id: params?.id || "", tracks: params?.tracks || "", cookie: nc() });
        return json(r.body);
      }
      case "playlist_create": {
        const r = await playlist_create({ name: params?.name || "", cookie: nc() });
        return json(r.body);
      }
      case "playlist_detail": {
        const r = await playlist_detail({ id: params?.id || "", cookie: nc() });
        return json(r.body);
      }
      case "playlist_track_all": {
        const r = await playlist_track_all({ id: params?.id || "", limit: params?.limit || 1000, offset: params?.offset || 0, cookie: nc() });
        return json(r.body);
      }
      case "personalized": {
        const r = await personalized({ limit: params?.limit || 30, cookie: nc() });
        return json(r.body);
      }
      case "recommend_resource": {
        const r = await recommend_resource({ cookie: nc() });
        return json(r.body);
      }
      case "recommend_songs": {
        const r = await recommend_songs({ cookie: nc() });
        return json(r.body);
      }
      case "artist_detail": {
        const r = await artist_detail({ id: params?.id || "", cookie: nc() });
        return json(r.body);
      }
      case "artist_top_song": {
        const r = await artist_top_song({ id: params?.id || "", cookie: nc() });
        return json(r.body);
      }
      case "artist_songs": {
        const r = await artist_songs({ id: params?.id || "", offset: params?.offset || 0, limit: params?.limit || 50, cookie: nc() });
        return json(r.body);
      }
      case "dj_detail": {
        const r = await dj_detail({ rid: params?.rid || "", cookie: nc() });
        return json(r.body);
      }
      case "dj_program": {
        const r = await dj_program({ rid: params?.rid || "", limit: params?.limit || 100, cookie: nc() });
        return json(r.body);
      }
      case "dj_hot": {
        const r = await dj_hot({ limit: params?.limit || 30, cookie: nc() });
        return json(r.body);
      }
      case "dj_sublist": {
        const r = await dj_sublist({ cookie: nc() });
        return json(r.body);
      }
      case "user_audio": {
        const r = await user_audio({ uid: params?.uid || "", cookie: nc() });
        return json(r.body);
      }
      case "dj_paygift": {
        const r = await dj_paygift({ limit: params?.limit || 30, cookie: nc() });
        return json(r.body);
      }
      case "record_recent_voice": {
        const r = await record_recent_voice({ limit: params?.limit || 100, cookie: nc() });
        return json(r.body);
      }
      case "sati_resource_sub_list": {
        const r = await sati_resource_sub_list({ cookie: nc() });
        return json(r.body);
      }
      case "comment_music": {
        const r = await comment_music({ id: params?.id || "", limit: params?.limit || 20, cookie: nc() });
        return json(r.body);
      }
      case "saveCookie": {
        saveCookie(params?.cookie || "");
        return json({ ok: true });
      }
      case "getCookie":
        return json({ cookie: nc() });
      case "saveQQCookie": {
        saveQQCookie(params?.cookie || "");
        return json({ ok: true });
      }
      case "getQQCookie":
        return json({ cookie: qc() });
      default:
        return json({ error: "UNKNOWN_METHOD" }, 400);
    }
  } catch (err: any) {
    console.error(`[RPC] ${method}:`, err.message);
    return json({ error: err.message || "INTERNAL_ERROR" }, 500);
  }
}

async function handleLegacyAPI(req: Request, url: URL, getNCookie: () => string, getQQCookie: () => string): Promise<Response> {
  const pathname = url.pathname;

  try {
    // Search
    if (pathname === "/api/search" || pathname === "/api/cloudsearch") {
      const keywords = url.searchParams.get("keywords") || "";
      const type = parseInt(url.searchParams.get("type") || "1");
      const limit = parseInt(url.searchParams.get("limit") || "30");
      const fn = pathname === "/api/cloudsearch" ? cloudsearch : search;
      const r = await fn({ keywords, type, limit, cookie: getNCookie() });
      return json(r.body);
    }

    // Song URL
    if (pathname === "/api/song/url") {
      const id = url.searchParams.get("id") || "";
      const level = url.searchParams.get("level") || "standard";
      const r = await song_url({ id, level, cookie: getNCookie() });
      return json(r.body);
    }

    // Lyric
    if (pathname === "/api/lyric") {
      const id = url.searchParams.get("id") || "";
      const r = await lyric({ id, cookie: getNCookie() });
      return json(r.body);
    }

    // Login QR
    if (pathname === "/api/login/qr/key") {
      const r = await login_qr_key({ cookie: getNCookie() });
      return json(r.body);
    }
    if (pathname === "/api/login/qr/create") {
      const key = url.searchParams.get("key") || "";
      const r = await login_qr_create({ key, qrimg: true, cookie: getNCookie() });
      return json(r.body);
    }
    if (pathname === "/api/login/qr/check") {
      const key = url.searchParams.get("key") || "";
      const r = await login_qr_check({ key, cookie: getNCookie() });
      if (r.body.code === 803 || r.body.code === 800) {
        const c = r.headers.get("set-cookie") || "";
        saveCookie(c);
      }
      return json(r.body);
    }
    if (pathname === "/api/login/cookie" && req.method === "POST") {
      const body = await req.json();
      saveCookie(body.cookie || "");
      return json({ ok: true, loggedIn: true });
    }

    // Login status
    if (pathname === "/api/login/status") {
      const r = await login_status({ cookie: getNCookie() });
      return json(r.body);
    }
    if (pathname === "/api/logout") {
      const r = await logout({ cookie: getNCookie() });
      saveCookie("");
      return json(r.body);
    }

    // Like
    if (pathname === "/api/song/like") {
      const id = url.searchParams.get("id") || "";
      const like = url.searchParams.get("like") !== "false";
      const r = await like_song({ id, like, cookie: getNCookie() });
      return json(r.body);
    }
    if (pathname === "/api/song/like/check") {
      const ids = url.searchParams.get("ids") || "";
      const r = await song_like_check({ songId: ids, cookie: getNCookie() });
      return json(r.body);
    }

    // User playlists
    if (pathname === "/api/user/playlists") {
      let uid = "";
      try {
        const acct = await user_account({ cookie: getNCookie() }).then(r => r.body);
        uid = acct.profile?.userId || "";
      } catch (e) {}
      if (uid) {
        const r = await user_playlist({ uid, cookie: getNCookie() });
        return json(r.body);
      }
      return json({ playlist: [] });
    }

    // Playlist
    if (pathname === "/api/playlist/tracks") {
      const id = url.searchParams.get("id") || "";
      if (req.method === "POST") {
        const body = await req.json();
        const r = await playlist_track_add({ id, tracks: body.songIds || "", cookie: getNCookie() });
        return json(r.body);
      }
      const r = await playlist_track_all({ id, limit: 1000, offset: 0, cookie: getNCookie() });
      return json(r.body);
    }
    if (pathname === "/api/playlist/create") {
      const name = url.searchParams.get("name") || "";
      const r = await playlist_create({ name, cookie: getNCookie() });
      return json(r.body);
    }
    if (pathname === "/api/playlist/add-song" && req.method === "POST") {
      const body = await req.json();
      const r = await playlist_track_add({ id: body.id, tracks: body.songIds || "", cookie: getNCookie() });
      return json(r.body);
    }

    // Artist
    if (pathname === "/api/artist/detail") {
      const id = url.searchParams.get("id") || "";
      const r = await artist_detail({ id, cookie: getNCookie() });
      return json(r.body);
    }

    // Likelist
    if (pathname === "/api/likelist") {
      const uid = url.searchParams.get("uid") || "";
      if (uid) {
        const r = await likelist({ uid, cookie: getNCookie() });
        return json(r.body);
      }
      return json({ ids: [] });
    }

    // Audio proxy
    if (pathname === "/api/audio") {
      const audioUrl = url.searchParams.get("url") || "";
      if (!audioUrl) return json({ error: "URL_REQUIRED" }, 400);
      const resp = await fetch(audioUrl);
      return new Response(resp.body, {
        headers: { "Content-Type": resp.headers.get("Content-Type") || "audio/mpeg", "Access-Control-Allow-Origin": "*" },
      });
    }

    // Cover proxy
    if (pathname === "/api/cover") {
      const coverUrl = url.searchParams.get("url") || "";
      if (!coverUrl) return json({ error: "URL_REQUIRED" }, 400);
      const resp = await fetch(coverUrl);
      return new Response(resp.body, {
        headers: { "Content-Type": resp.headers.get("Content-Type") || "image/jpeg", "Access-Control-Allow-Origin": "*", "Cache-Control": "public, max-age=86400" },
      });
    }

    // Update
    if (pathname === "/api/update/latest") {
      return json({ configured: false, updateAvailable: false, currentVersion: "1.0.0", latestVersion: "1.0.0", release: { tagName: "v1.0.0", name: "Mineradio v1.0.0", version: "1.0.0", summary: "当前版本", notes: ["Electrobun 迁移版本"] } });
    }

    // Discover
    if (pathname === "/api/discover/home") {
      const rec = await recommend_resource({ cookie: getNCookie() }).then(r => r.body).catch(() => ({}));
      return json({ playlists: [], recommended: rec, dailySongs: [], dailyPlaylists: [] });
    }

    // Beatmap cache stubs
    if (pathname === "/api/beatmap/cache/status") return json({ enabled: false, dir: "", allowed: false, available: false, count: 0 });
    if (pathname === "/api/beatmap/cache") return json({ ok: false, error: "NO_CACHE" });

    // Podcast stubs
    if (pathname === "/api/podcast/search") {
      const r = await dj_hot({ limit: 30, cookie: getNCookie() });
      return json(r.body);
    }
    if (pathname === "/api/podcast/hot") {
      const r = await dj_hot({ limit: 30, cookie: getNCookie() });
      return json(r.body);
    }
    if (pathname === "/api/podcast/programs") {
      const id = url.searchParams.get("id") || "";
      const r = await dj_program({ rid: id, limit: 100, cookie: getNCookie() });
      return json(r.body);
    }
    if (pathname === "/api/podcast/my") {
      const r = await dj_sublist({ cookie: getNCookie() });
      return json(r.body);
    }
    if (pathname === "/api/podcast/my/items") return json({ items: [] });

    // Weather stubs
    if (pathname === "/api/weather/ip-location") return json({ city: "上海", country: "China", lat: 31.23, lon: 121.47 });
    if (pathname === "/api/weather/radio") return json({ temperature: 22, condition: "晴", code: 0 });

  } catch (err: any) {
    console.error(`[LegacyAPI] ${pathname}:`, err.message);
    return json({ error: err.message || "INTERNAL_ERROR" }, 500);
  }

  return json({ error: "UNKNOWN_LEGACY_API" }, 404);
}

export async function startCombinedServer() {
  // Listen on a free port
  const server = Bun.serve({
    hostname: HOST,
    port: PORT, // use configured port (default 3001)
    async fetch(req) {
      const url = new URL(req.url);
      const pathname = url.pathname;

      // CORS preflight
      if (req.method === "OPTIONS") {
        return new Response(null, {
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
          },
        });
      }

      // API health check — must be before the /api/ catch-all
      if (pathname === "/api/health") {
        return json({ ok: true, port: serverPort });
      }

      // API routes
      if (pathname === "/api/rpc" && req.method === "POST") {
        const body = await req.json();
        return handleRPC(body);
      }

      // Legacy API routes (called by the original JS)
      if (pathname.startsWith("/api/")) {
        return handleLegacyAPI(req, url, () => userCookie, () => qqCookie);
      }

      // Serve static files from dist/ first (built SPA)
      const distPath = path.join(DIST_DIR, pathname === "/" ? "index.html" : pathname);
      if (fs.existsSync(distPath) && fs.statSync(distPath).isFile()) {
        return serveFile(distPath);
      }

      // Fallback: serve from public/
      const publicPath = path.join(PUBLIC_DIR, pathname === "/" ? "index.html" : pathname);
      if (fs.existsSync(publicPath) && fs.statSync(publicPath).isFile()) {
        return serveFile(publicPath);
      }

      // SPA fallback: serve dist/index.html for any non-file route
      const spaPath = path.join(DIST_DIR, "index.html");
      if (fs.existsSync(spaPath)) {
        return serveFile(spaPath);
      }

      return new Response("Not Found", { status: 404 });
    },
  });

  serverPort = server.port;
  console.log(`[Mineradio] Combined server on http://${HOST}:${serverPort}`);
}

export function getPort(): number {
  return serverPort;
}
