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

export function createRPCHandler(providers: MusicProvider) {
  return async (body: any): Promise<Response> => {
    const { method, params } = body || {};
    if (!method) return json({ error: "METHOD_REQUIRED" }, 400);

    try {
      switch (method) {
        // ---- Search ----
        case "search":
        case "cloudsearch": {
          const kw = params?.keywords || "";
          const type = params?.type || 1;
          const limit = params?.limit || 30;
          if (method === "search") {
            return json(await providers.netease.search(kw, type, limit));
          }
          return json(await providers.netease.cloudsearch(kw, type, limit));
        }

        // ---- Song ----
        case "song_detail": {
          const r = await providers.netease.songDetail(params?.ids || "");
          return json({ songs: r });
        }
        case "song_url": {
          const r = await providers.netease.songUrl(params?.id || "", params?.level || "standard");
          return json(r);
        }
        case "song_url_v1": {
          const r = await providers.netease.songUrlV1(params?.id || "", params?.level || "standard");
          return json(r);
        }

        // ---- Lyric ----
        case "lyric": {
          return json(await providers.netease.lyric(params?.id || ""));
        }
        case "lyric_new": {
          return json(await providers.netease.lyricNew(params?.id || ""));
        }

        // ---- Login (Netease) ----
        case "login_qr_key": {
          return json(await providers.netease.loginQRKey());
        }
        case "login_qr_create": {
          return json(await providers.netease.loginQRCreate(params?.key || ""));
        }
        case "login_qr_check": {
          return json(await providers.netease.loginQRCheck(params?.key || ""));
        }
        case "login_status": {
          return json(await providers.netease.loginStatus());
        }
        case "logout": {
          return json(await providers.netease.logout());
        }

        // ---- User ----
        case "user_account": {
          return json(await providers.netease.userAccount());
        }
        case "user_playlist": {
          return json(await providers.netease.userPlaylist(params?.uid || ""));
        }

        // ---- Like ----
        case "like": {
          return json(await providers.netease.like(params?.id || "", params?.like !== false));
        }
        case "likelist": {
          return json(await providers.netease.likelist(params?.uid || ""));
        }
        case "song_like_check": {
          return json(await providers.netease.songLikeCheck(params?.songId || ""));
        }

        // ---- Playlist ----
        case "playlist_tracks": {
          return json(await providers.netease.playlistTracks(params?.op || "add", params?.id || "", params?.tracks || ""));
        }
        case "playlist_track_add": {
          return json(await providers.netease.playlistTrackAdd(params?.id || "", params?.tracks || ""));
        }
        case "playlist_create": {
          return json(await providers.netease.playlistCreate(params?.name || ""));
        }
        case "playlist_detail": {
          return json(await providers.netease.playlistDetail(params?.id || ""));
        }
        case "playlist_track_all": {
          return json(await providers.netease.playlistTrackAll(params?.id || "", params?.limit || 1000, params?.offset || 0));
        }

        // ---- Discover ----
        case "personalized": {
          return json(await providers.netease.personalized(params?.limit || 30));
        }
        case "recommend_resource": {
          return json(await providers.netease.recommendResource());
        }
        case "recommend_songs": {
          return json(await providers.netease.recommendSongs());
        }

        // ---- Artist ----
        case "artist_detail": {
          return json(await providers.netease.artistDetail(params?.id || ""));
        }
        case "artist_top_song": {
          return json(await providers.netease.artistTopSong(params?.id || ""));
        }
        case "artist_songs": {
          return json(await providers.netease.artistSongs(params?.id || "", params?.offset || 0, params?.limit || 50));
        }

        // ---- DJ / Podcast ----
        case "dj_detail": {
          return json(await providers.netease.djDetail(params?.rid || ""));
        }
        case "dj_program": {
          return json(await providers.netease.djProgram(params?.rid || "", params?.limit || 100));
        }
        case "dj_hot": {
          return json(await providers.netease.djHot(params?.limit || 30));
        }
        case "dj_sublist": {
          return json(await providers.netease.djSublist());
        }
        case "user_audio": {
          return json(await providers.netease.userAudio(params?.uid || ""));
        }
        case "dj_paygift": {
          return json(await providers.netease.djPaygift(params?.limit || 30));
        }
        case "record_recent_voice": {
          return json(await providers.netease.recordRecentVoice(params?.limit || 100));
        }
        case "sati_resource_sub_list": {
          return json(await providers.netease.satiResourceSubList());
        }

        // ---- Comment ----
        case "comment_music": {
          return json(await providers.netease.commentMusic(params?.id || "", params?.limit || 20));
        }

        // ---- Cookie management ----
        case "saveCookie": {
          providers.setCookie(params?.cookie || "");
          providers.saveCookie(params?.cookie || "");
          return json({ ok: true });
        }
        case "getCookie":
          return json({ cookie: providers.getCookie() });
        case "saveQQCookie": {
          providers.setQQCookie(params?.cookie || "");
          providers.saveQQCookie(params?.cookie || "");
          return json({ ok: true });
        }
        case "getQQCookie":
          return json({ cookie: providers.getQQCookie() });

        default:
          return json({ error: "UNKNOWN_METHOD" }, 400);
      }
    } catch (err: any) {
      console.error(`[RPC] ${method}:`, err.message);
      return json({ error: err.message || "INTERNAL_ERROR" }, 500);
    }
  };
}
