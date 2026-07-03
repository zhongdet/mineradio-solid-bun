import { createEffect, onCleanup } from "solid-js";
import { useSearch } from "../stores/searchStore";
import { usePlayback } from "../stores/playbackStore";
import { rpc, qqApi } from "../lib/api";

export function useSearchHook() {
  const search = useSearch();
  const playback = usePlayback();

  let searchTimer: ReturnType<typeof setTimeout> | null = null;
  let searchRequestSeq = 0;

  // Initialize search history
  createEffect(() => {
    search.loadSearchHistory();
  });

  // Listen for search events from SearchArea and homeActions
  let searchEventHandler: ((e: Event) => void) | null = null;
  let podcastHotHandler: ((e: Event) => void) | null = null;
  createEffect(() => {
    searchEventHandler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.query != null) {
        if (detail.mode) search.setSearchMode(detail.mode);
        doSearch(detail.query);
      }
    };
    podcastHotHandler = () => loadPodcastHot();
    window.addEventListener("mineradio-search", searchEventHandler);
    window.addEventListener("mineradio-podcast-hot", podcastHotHandler);
  });
  onCleanup(() => {
    if (searchEventHandler) window.removeEventListener("mineradio-search", searchEventHandler);
    if (podcastHotHandler) window.removeEventListener("mineradio-podcast-hot", podcastHotHandler);
  });

  async function doSearch(query: string, opts: { autoPlayFirst?: boolean } = {}) {
    if (!query.trim()) return;

    const seq = ++searchRequestSeq;
    const mode = search.state.mode;

    search.setSearchLoading(true);
    search.setQuery(query);
    search.addToSearchHistory(query);

    try {
      if (mode === "podcast") {
        await searchPodcast(query, seq);
      } else {
        await searchSongs(query, mode, seq, opts);
      }
    } catch (err) {
      console.error("Search failed:", err);
      if (seq === searchRequestSeq) {
        search.setSearchError("搜索失败");
      }
    }
  }

  async function searchSongs(query: string, mode: string, seq: number, opts: any) {
    let songs: any[] = [];

    if (mode === "qq") {
      const data = await qqApi.search(query, 12);
      if (seq !== searchRequestSeq) return;
      songs = (data.songs || []).map(mapQQSong);
    } else if (mode === "netease") {
      const data = await rpc<any>("cloudsearch", { keywords: query, type: 1, limit: 18 });
      if (seq !== searchRequestSeq) return;
      songs = (data.result?.songs || data.songs || []).map(mapNetEaseSong);
    } else {
      // "song" (All) — query both netease and QQ, merge & deduplicate
      const [neteaseRes, qqRes] = await Promise.allSettled([
        rpc<any>("cloudsearch", { keywords: query, type: 1, limit: 14 }),
        qqApi.search(query, 12),
      ]);
      if (seq !== searchRequestSeq) return;

      const neteaseSongs = neteaseRes.status === "fulfilled"
        ? (neteaseRes.value.result?.songs || neteaseRes.value.songs || []).map(mapNetEaseSong) : [];
      const qqSongs = qqRes.status === "fulfilled"
        ? (qqRes.value.songs || []).map(mapQQSong) : [];

      if (qqRes.status === "rejected") console.warn("QQ search failed:", qqRes.reason);

      songs = mergeSongLists(neteaseSongs, qqSongs, query, 18);
    }

    search.setSearchResults(songs.map((s: any) => { const { _searchScore, ...rest } = s; return rest; }));

    if (opts.autoPlayFirst && songs.length > 0) {
      playback.set("playQueue", songs);
      playback.set("currentIdx", 0);
    }
  }

  async function searchPodcast(query: string, seq: number) {
    const data = await rpc<any>("dj_search", { keywords: query, limit: 18 });
    if (seq !== searchRequestSeq) return;

    const podcasts = (data.djRadios || []).map((r: any) => ({
      id: r.id,
      name: r.name,
      cover: r.picUrl || "",
      djName: r.dj?.nickname || "",
      programCount: r.programCount || 0,
      subCount: r.subCount || 0,
    }));

    search.setPodcastResults(podcasts);
  }

  async function loadPodcastHot() {
    const seq = ++searchRequestSeq;
    try {
      const data = await rpc<any>("dj_hot", { limit: 18 });
      if (seq !== searchRequestSeq) return;

      const podcasts = (data.djRadios || []).map((r: any) => ({
        id: r.id,
        name: r.name,
        cover: r.picUrl || "",
        djName: r.dj?.nickname || "",
        programCount: r.programCount || 0,
        subCount: r.subCount || 0,
      }));

      search.setPodcastResults(podcasts);
    } catch (err) {
      console.error("Podcast hot load failed:", err);
    }
  }

  async function doPodcastSearch(q: string) {
    const seq = ++searchRequestSeq;
    try {
      const data = await rpc<any>("dj_search", { keywords: q, limit: 18 });
      if (seq !== searchRequestSeq) return;

      const podcasts = (data.djRadios || []).map((r: any) => ({
        id: r.id,
        name: r.name,
        cover: r.picUrl || "",
        djName: r.dj?.nickname || "",
        programCount: r.programCount || 0,
      }));

      search.setPodcastResults(podcasts);
    } catch (err) {
      console.error("Podcast search failed:", err);
    }
  }

  async function openPodcastPrograms(radioId: string) {
    try {
      const data = await rpc<any>("dj_program", { id: radioId, limit: 36 });
      const programs = (data.programs || []).map((p: any) => ({
        id: p.id,
        name: p.mainTrackName || p.name,
        cover: p.picUrl || "",
        duration: p.duration,
        djName: p.dj?.nickname || "",
        radioName: p.radio?.name || "",
      }));

      search.setPodcastPrograms(programs);
    } catch (err) {
      console.error("Podcast programs load failed:", err);
    }
  }

  function setSearchMode(mode: "song" | "netease" | "qq" | "podcast") {
    search.setSearchMode(mode);
    if (mode === "podcast") {
      loadPodcastHot();
    } else {
      search.setSearchResults([]);
    }
  }

  function debounceSearch(query: string) {
    if (searchTimer) clearTimeout(searchTimer);
    searchTimer = setTimeout(() => doSearch(query), 180);
  }

  return {
    doSearch,
    setSearchMode,
    loadPodcastHot,
    doPodcastSearch,
    openPodcastPrograms,
    debounceSearch,
  };
}

export type SearchHook = ReturnType<typeof useSearchHook>;

// ---- Helpers (mirror legacy fetchMusicSearchResults + mergeSongSearchResults) ----

function mapNetEaseSong(s: any): any {
  return {
    id: s.id,
    name: s.name,
    artist: (s.artists || [{}])[0]?.name || s.singer || "",
    cover: s.al?.picUrl || s.cover || s.album?.picUrl || "",
    duration: s.dt || s.duration || 0,
    mid: s.mid || s.songmid || "",
    provider: s.provider || "netease",
    source: s.source || "netease",
    album: s.al?.name || "",
    artists: s.artists,
  };
}

function mapQQSong(s: any): any {
  return {
    id: s.id,
    name: s.name,
    artist: s.artist || (s.artists || [{}])[0]?.name || "",
    cover: s.cover || s.al?.picUrl || "",
    duration: s.duration || s.dt || 0,
    mid: s.mid || s.songmid || "",
    provider: s.provider || "qq",
    source: s.source || "qq",
    album: s.album || s.al?.name || "",
  };
}

function providerKey(song: any): string {
  if (song && (song.provider === "qq" || song.source === "qq" || song.type === "qq")) return "qq";
  return "netease";
}

function mergeSongLists(neteaseSongs: any[], qqSongs: any[], query: string, limit: number): any[] {
  const out: any[] = [];
  const seen: Record<string, boolean> = {};
  function push(song: any, sourceIndex: number) {
    if (!song || !song.name) return;
    const key = providerKey(song) + ":" + (song.mid || song.id || (song.name + "|" + song.artist));
    if (seen[key]) return;
    seen[key] = true;
    song._searchScore = scoreSong(song, query, sourceIndex);
    out.push(song);
  }
  neteaseSongs.forEach((s: any, i: number) => push(s, i));
  qqSongs.forEach((s: any, i: number) => push(s, i));
  out.sort((a, b) => (b._searchScore || 0) - (a._searchScore || 0));
  return out.slice(0, limit);
}

function simpleNorm(s: string): string {
  return String(s || "").toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff\s]/g, "").trim();
}

function searchLooksLikeDerivative(raw: string): boolean {
  return /(live|现场|翻唱|cover|伴奏|instrumental|remix|dj|片段|demo|女声|男声|karaoke)/i.test(raw);
}

function canonicalOriginalArtistsForSearch(q: string, song: any): string[] {
  const known: Record<string, string[]> = {
    "周杰伦": ["周杰伦", "jay chou"],
    "陈奕迅": ["陈奕迅", "eason chan"],
    "林俊杰": ["林俊杰", "jj lin"],
    "王力宏": ["王力宏", "leehom wang"],
    "蔡健雅": ["蔡健雅", "tanya chua"],
    "孙燕姿": ["孙燕姿", "stefanie sun"],
  };
  const nq = simpleNorm(q);
  for (const k of Object.keys(known)) {
    if (nq.includes(simpleNorm(k))) return known[k];
  }
  const songArtist = simpleNorm(song?.artist || "");
  if (songArtist) return [songArtist];
  return [];
}

function songArtistMatchesAny(song: any, artists: string[]): boolean {
  if (!song || !artists.length) return false;
  const songArtist = simpleNorm(song.artist || "");
  return artists.some(a => songArtist.includes(simpleNorm(a)));
}

function scoreSong(song: any, q: string, sourceIndex: number): number {
  const nq = simpleNorm(q);
  const name = simpleNorm(song?.name);
  const artist = simpleNorm(song?.artist);
  const raw = String(((song?.name) || "") + " " + ((song?.artist) || "") + " " + ((song?.album) || "")).toLowerCase();
  const derivative = searchLooksLikeDerivative(raw);
  const originalArtists = canonicalOriginalArtistsForSearch(q, song);
  const originalArtistMatch = songArtistMatchesAny(song, originalArtists);
  let score = 0;
  if (name === nq) score += 90;
  else if (name.indexOf(nq) === 0) score += 55;
  else if (name.indexOf(nq) >= 0) score += 32;
  if (name && nq && nq.indexOf(name) >= 0) score += name.length >= 2 ? 68 : 18;
  if (name && nq && levenshtein(name, nq) <= 2) score += 44;
  if (artist === nq) score += 80;
  else if (artist.indexOf(nq) >= 0) score += 28;
  if (originalArtistMatch) score += 24;
  if (derivative && !/live|现场/i.test(raw)) score -= 40;
  if (searchMentionsKnownArtist(q, song?.artist)) score += 10;
  // Boost exact name matches higher
  if (name === nq && originalArtistMatch) score += 36;
  // Slight decay by source index to keep original order
  score += Math.max(0, 10 - sourceIndex);
  return score;
}

function searchMentionsKnownArtist(q: string, songArtist: string): boolean {
  if (!q || !songArtist) return false;
  const nq = simpleNorm(q);
  const na = simpleNorm(songArtist);
  if (!na) return false;
  return nq.includes(na);
}

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[] = [];
  for (let i = 0; i <= n; i++) dp[i] = i;
  for (let i = 1; i <= m; i++) {
    let prev = i;
    for (let j = 1; j <= n; j++) {
      const cur = a[i - 1] === b[j - 1] ? dp[j - 1] : 1 + Math.min(dp[j - 1], prev, dp[j]);
      dp[j - 1] = prev;
      prev = cur;
    }
    dp[n] = prev;
  }
  return dp[n];
}
