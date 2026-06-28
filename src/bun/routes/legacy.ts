// Legacy API route handler — mirrors the original server.js endpoint paths
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
        return new Response(resp.body, { headers: respHeaders });
      }

      // ---- Cover proxy ----
      if (pathname === "/api/cover") {
        const coverUrl = url.searchParams.get("url") || "";
        if (!coverUrl) return json({ error: "URL_REQUIRED" }, 400);
        const resp = await fetch(coverUrl, {
          headers: { "User-Agent": "Mozilla/5.0", Referer: "https://y.qq.com/" },
        });
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
      if (pathname === "/api/beatmap/cache/status") return json({ enabled: false, dir: "", allowed: false, available: false, count: 0 });
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

      // ---- Weather stubs ----
      if (pathname === "/api/weather/ip-location") return json({ city: "上海", country: "China", lat: 31.23, lon: 121.47 });
      if (pathname === "/api/weather/radio") return json({ temperature: 22, condition: "晴", code: 0 });

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
