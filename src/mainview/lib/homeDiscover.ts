// @ts-nocheck
import { useHome } from "../stores/homeStore";
import { useAuth } from "../stores/authStore";
import { useActionStore } from "../stores/actionStore";
import { hasAnyPlatformLogin } from "./platformLogin";

function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function coverUrlWithSize(url: string, size: number): string {
  if (!url || !/^https?:\/\//i.test(url)) return url || "";
  if (!size) return url;
  const param = "param=" + size + "y" + size;
  if (/[?&]param=\d+y\d+/i.test(url)) return url.replace(/([?&])param=\d+y\d+/i, "$1" + param);
  return url + (url.indexOf("?") >= 0 ? "&" : "?") + param;
}

function songCoverSrc(song: any, size: number): string {
  if (!song || !song.cover) return "";
  return coverUrlWithSize(song.cover, size);
}

function cssImageUrl(url: string): string {
  return String(url || "").replace(/\\/g, "\\\\").replace(/"/g, "%22");
}

function compactHomeCount(n: number): string {
  n = Number(n) || 0;
  if (n >= 100000000) return (n / 100000000).toFixed(1).replace(/\.0$/, "") + "亿";
  if (n >= 10000) return Math.round(n / 10000) + "万";
  return n ? String(n) : "";
}

function songSourceLabel(song: any): string {
  if (!song) return "";
  const src = song.source || song.provider || song.type || "";
  return src || "";
}

function homeTileCover(item: any): string {
  if (!item) return "";
  if (item.kind === "song" || item.kind === "weatherSong") return songCoverSrc(item.song, 220);
  return item.cover ? coverUrlWithSize(item.cover, 220) : "";
}

function homeToneForItem(item: any, index: number): string {
  if (!item) return "daily";
  if (item.kind === "weatherSong") return "daily";
  if (item.kind === "recent") return "search";
  if (item.kind === "profile") return "local";
  if (item.tone) return item.tone;
  if (item.kind === "song") return index % 2 ? "search" : "daily";
  if (item.kind === "playlist") return "playlist";
  if (item.kind === "podcast" || item.kind === "podcastSearch") return "podcast";
  if (item.kind === "local") return "local";
  if (item.kind === "guide") return "guide";
  if (item.kind === "login") return "library";
  if (item.kind === "search") return "search";
  return ["daily", "playlist", "local", "guide", "search"][index % 5];
}

function fallbackHomeTiles(): any[] {
  return [
    { kind: "login", title: "登录同步歌单", sub: "网易云 / QQ 音乐" },
    { kind: "search", title: "搜索一首歌", sub: "原唱优先", query: "" },
    { kind: "local", title: "导入本地音乐", sub: "本地文件也能可视化" },
    { kind: "podcastSearch", title: "搜索播客", sub: "长内容 / 电台" },
    { kind: "guide", title: "看看视觉舞台", sub: "粒子 / 歌词 / 封面" },
  ];
}

function renderHomeMosaic(tiles: any[]): void {
  const cells = document.querySelectorAll("#home-mosaic .home-mosaic-cell");
  if (!cells.length) return;
  const covers: string[] = [];
  (tiles || []).forEach(function (item) {
    const cover = homeTileCover(item);
    if (cover) covers.push(cover);
  });
  for (let i = 0; i < cells.length; i++) {
    const src = covers[i] || covers[(i + 1) % Math.max(1, covers.length)] || "";
    cells[i].style.backgroundImage = src ? 'url("' + cssImageUrl(src) + '")' : "";
    cells[i].classList.toggle("has-cover", !!src);
    cells[i].classList.toggle("home-skeleton", !src && homeDiscoverState.loading);
  }
}

let homeDiscoverState: ReturnType<typeof useHome>["state"]["homeDiscoverState"];
let homeWeatherRadioState: ReturnType<typeof useHome>["state"]["homeWeatherRadioState"];
let listenStatsState: ReturnType<typeof useHome>["state"]["listenStatsState"];

function homeListenSummary() {
  const home = useHome();
  const stats = home.state.listenStatsState;
  const recent = (stats.recentSongs && stats.recentSongs[0]) || null;
  let topSong = null;
  let topArtist = null;
  if (stats.favoriteArtist) topArtist = { name: stats.favoriteArtist, plays: stats.totalSongs };
  return { recent, topSong, topArtist, totalPlays: stats.totalSongs };
}

export function renderHomeTiles(): void {
  const home = useHome();
  homeDiscoverState = home.state.homeDiscoverState;
  homeWeatherRadioState = home.state.homeWeatherRadioState;
  listenStatsState = home.state.listenStatsState;

  const row = document.getElementById("home-tile-row");
  const title = document.getElementById("home-rail-title");
  const note = document.getElementById("home-rail-note");
  if (!row) return;

  const tiles: any[] = [];
  const loggedOutHome = !homeDiscoverState.loggedIn && !hasAnyPlatformLogin();
  const weatherSongs = homeWeatherRadioState.radio && homeWeatherRadioState.radio.songs || [];
  const summary = homeListenSummary();

  // 1. "Recent" tile (if available)
  if (summary.recent && tiles.length < 5) {
    tiles.push({
      kind: "recent",
      title: summary.recent.name || "继续听",
      sub: summary.recent.artist || summary.recent.source || "",
      cover: summary.recent.cover,
      record: summary.recent,
    });
  }
  // 2. "Top Artist" tile (if available)
  if (summary.topArtist && tiles.length < 5) {
    tiles.push({
      kind: "profile",
      title: summary.topArtist.name,
      sub: "常听歌手 · " + summary.topArtist.plays + " 次",
      query: summary.topArtist.name,
    });
  }
  // 3. Recommended songs (only if logged in)
  if (!loggedOutHome) {
    homeDiscoverState.songs
      .slice(0, Math.max(0, 4 - tiles.length))
      .forEach(function (song, i) {
        tiles.push({
          kind: "song",
          index: i,
          song: song,
          title: song.name || "今日歌曲",
          sub: song.artist || songSourceLabel(song),
        });
      });
    // 4. Recommended playlists
    homeDiscoverState.playlists
      .slice(0, Math.max(0, 5 - tiles.length))
      .forEach(function (pl, i) {
        tiles.push({
          kind: "playlist",
          index: i,
          title: pl.name || "推荐歌单",
          sub: (pl.trackCount ? pl.trackCount + " 首" : "Playlist") + (pl.playCount ? " · " + compactHomeCount(pl.playCount) + " 播放" : ""),
          cover: pl.cover,
        });
      });
    // 5. Recommended podcasts
    if (tiles.length < 5) {
      homeDiscoverState.podcasts
        .slice(0, 5 - tiles.length)
        .forEach(function (p, i) {
          tiles.push({
            kind: "podcast",
            index: i,
            title: p.name || "热门播客",
            sub: p.djName || p.category || "Podcast",
            cover: p.cover,
          });
        });
    }
  }
  // 6. Weather songs as fallback
  if (tiles.length < 5) {
    weatherSongs.slice(0, 5 - tiles.length).forEach(function (song, i) {
      tiles.push({
        kind: "weatherSong",
        index: i,
        song: song,
        title: song.name || "天气电台歌曲",
        sub: song.artist || songSourceLabel(song),
      });
    });
  }
  if (!tiles.length) tiles.push(...fallbackHomeTiles());
  tiles.splice(5);

  // Update title and note
  if (title) title.textContent = summary.recent ? "接着听" : loggedOutHome ? "先从这里开始" : "你的歌单与推荐";
  if (note) {
    const liveNote = homeDiscoverState.updatedAt ? "刚刚更新 · 点击即可播放" : "点击即可播放";
    note.textContent = homeDiscoverState.loading
      ? "正在整理推荐"
      : loggedOutHome && !weatherSongs.length
      ? "不会自动拉取外部推荐"
      : homeDiscoverState.error
      ? "离线精选"
      : liveNote;
  }

  // Render tile buttons
  row.innerHTML = tiles
    .map(function (item, i) {
      const cover = homeTileCover(item);
      const tone = homeToneForItem(item, i);
      const coverClass = "home-tile-cover" + (cover ? " has-cover" : "");
      const tileClass = !cover && homeDiscoverState.loading ? " home-skeleton" : "";
      return (
        '<button class="home-tile' +
        tileClass +
        '" data-home-tone="' +
        escHtml(tone) +
        '" type="button" onclick="handleHomeTileClick(' +
        i +
        ')"' +
        '>' +
        '<div class="' +
        coverClass +
        '" style="' +
        (cover ? 'background-image:url(&quot;' + escHtml(cssImageUrl(cover)) + '&quot;)' : "") +
        '"></div>' +
        '<div class="home-tile-title">' +
        escHtml(item.title || "") +
        "</div>" +
        '<div class="home-tile-sub">' +
        escHtml(item.sub || "") +
        "</div>" +
        "</button>"
      );
    })
    .join("");
  (row as any)._homeTiles = tiles;
  renderHomeMosaic(tiles);
}

export function handleHomeTileClick(index: number): void {
  const row = document.getElementById("home-tile-row");
  const tiles = (row as any)?._homeTiles;
  const item = tiles && tiles[index];
  if (!item) return;

  if (item.kind === "weatherSong") {
    // Dead code: no receiver for weather songs, play via homeSong fallback
    const home = useHome();
    const song = home.state.homeDiscoverState.songs[item.index];
    if (song) {
      useActionStore.getState().playHomeSong(item.index);
    }
  } else if (item.kind === "recent") {
    useActionStore.getState().playHomeRecent(item.record);
  } else if (item.kind === "profile") {
    if (item.query) {
      useActionStore.getState().homeSearch(item.query);
    }
  } else if (item.kind === "song") {
    useActionStore.getState().playHomeSong(item.index);
  } else if (item.kind === "login") {
    const auth = useAuth();
    if (!hasAnyPlatformLogin()) {
      auth.showLoginModal();
    } else {
      useActionStore.getState().playlistTab("playlists");
      useActionStore.getState().refreshPlaylists();
    }
  } else if (item.kind === "playlist") {
    // Dead code: no receiver for playlist clicks
  } else if (item.kind === "podcast") {
    // Dead code: no receiver for podcast clicks
  } else if (item.kind === "podcastSearch") {
    useActionStore.getState().setSearchMode("podcast");
    useActionStore.getState().podcastHot();
  } else if (item.kind === "local" || item.kind === "guide" || item.kind === "library") {
    // Dead code: no receivers for local/guide/library clicks
  } else {
    useActionStore.getState().homeSearch(item.query || item.title || "");
  }
}

export function renderHomeDiscover(): void {
  const home = useHome();
  const auth = useAuth();
  const state = home.state.homeDiscoverState;
  const weatherState = home.state.homeWeatherRadioState;
  const loggedOutHome = !state.loggedIn && !hasAnyPlatformLogin();
  const stats = home.state.listenStatsState;
  const hasRecent = stats.recentSongs && stats.recentSongs.length > 0;

  // Update rail title
  const railTitle = document.getElementById("home-rail-title");
  if (railTitle) {
    if (hasRecent) railTitle.textContent = "接着听";
    else if (loggedOutHome) railTitle.textContent = "先从这里开始";
    else railTitle.textContent = "你的歌单与推荐";
  }

  const railNote = document.getElementById("home-rail-note");
  if (railNote) {
    if (state.loading) railNote.textContent = "正在整理推荐";
    else if (loggedOutHome && !weatherState.weather) railNote.textContent = "不会自动拉取外部推荐";
    else railNote.textContent = state.updatedAt ? "刚刚更新 · 点击即可播放" : "点击即可播放";
  }

  const sub = document.getElementById("home-subtitle");
  if (sub) {
    if (loggedOutHome) sub.textContent = "登录后会把你的歌单、常听歌手和最近播放放在这里；也可以直接搜索或导入本地音乐。";
    else sub.textContent = "从你的歌单、最近播放和常听歌手开始，天气电台放在需要氛围的时候再开。";
  }

  const weatherTitle = document.getElementById("home-weather-title");
  const weatherKicker = document.getElementById("home-weather-kicker");
  if (weatherTitle) weatherTitle.textContent = "我的音乐库";
  if (weatherKicker) weatherKicker.textContent = "Mineradio · Your Library";

  const weatherMeta = document.getElementById("home-weather-meta");
  if (weatherMeta) {
    const meta: string[] = [];
    const weather = weatherState.weather;
    const weatherLocation = weather?.location?.name || weatherState.city || "上海";
    if (weather) {
      meta.push(weatherLocation);
      meta.push(weather.label + " · " + Math.round(weather.temperature || 0) + "°");
      meta.push("体感 " + Math.round(weather.apparentTemperature || weather.temperature || 0) + "°");
      if (isFinite(weather.humidity)) meta.push("湿度 " + Math.round(weather.humidity) + "%");
    } else {
      meta.push(weatherLocation);
      meta.push(weatherState.error ? "天气暂不可用" : "正在整理天气");
    }
    weatherMeta.innerHTML = meta.map((text) => '<span class="home-weather-pill">' + escHtml(text) + "</span>").join("");
  }

  const daily = state.songs[0] || null;
  const cardSongB = state.songs[1] || null;
  const cardSongC = state.songs[2] || null;
  const playlistItem = state.playlists[0] || null;

  const dailyTitle = document.getElementById("home-daily-title");
  const dailySub = document.getElementById("home-daily-sub");
  const privateTitle = document.getElementById("home-private-title");
  const privateSub = document.getElementById("home-private-sub");
  const libTitle = document.getElementById("home-library-title");
  const libSub = document.getElementById("home-library-sub");
  const continueTitle = document.getElementById("home-continue-title");
  const continueSub = document.getElementById("home-continue-sub");

  if (loggedOutHome) {
    if (dailyTitle) dailyTitle.textContent = "每日推荐";
    if (dailySub) dailySub.textContent = "登录后同步你的今日歌曲";
    if (privateTitle) privateTitle.textContent = "推荐歌曲";
    if (privateSub) privateSub.textContent = "登录后同步更多歌曲";
    if (libTitle) libTitle.textContent = "更多歌曲";
    if (libSub) libSub.textContent = "播放后会继续补全推荐";
  } else {
    if (dailyTitle) dailyTitle.textContent = daily ? daily.name : "每日推荐";
    if (dailySub) dailySub.textContent = daily ? ((daily.artist || "今日歌曲") + " · 点击播放今日队列") : "同步你的今日歌曲";
    if (privateTitle) privateTitle.textContent = cardSongB ? cardSongB.name : "私人雷达";
    if (privateSub) privateSub.textContent = cardSongB ? (cardSongB.artist || "推荐歌曲") : (state.songs.length + " 首 · 根据今日推荐与常听偏好");
    if (libTitle) libTitle.textContent = cardSongC ? cardSongC.name : "更多歌曲";
    if (libSub) libSub.textContent = cardSongC ? (cardSongC.artist || "推荐歌曲") : "播放几首后生成你的偏好";
  }
}

let homeWeatherLoadTimer: ReturnType<typeof setTimeout> | null = null;

export function scheduleHomeWeatherLoad(delay?: number) {
  if (homeWeatherLoadTimer) return;
  homeWeatherLoadTimer = setTimeout(() => {
    homeWeatherLoadTimer = null;
    const home = useHome();
    if (!home.state.emptyHomeActive) return;
    // Weather load is handled by useHomeDiscover hook
  }, delay || 760);
}
