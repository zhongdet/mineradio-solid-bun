import { createEffect, onCleanup } from "solid-js";
import { useSearch } from "../stores/searchStore";
import { usePlayback } from "../stores/playbackStore";
import { rpc } from "../lib/api";

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
    const neteaseType = mode === "qq" ? 140 : 1; // 140 = QQ, 1 = songs
    const data = await rpc<any>("cloudsearch", { keywords: query, type: neteaseType, limit: 30 });
    if (seq !== searchRequestSeq) return;

    const songs = (data.result?.songs || data.songs || []).map((s: any) => ({
      id: s.id,
      name: s.name,
      artist: (s.artists || [{}])[0]?.name || s.singer || "",
      cover: s.al?.picUrl || s.cover || s.album?.picUrl || "",
      duration: s.dt || s.duration || 0,
      mid: s.mid || s.songmid || "",
      provider: s.provider || "",
      source: s.source || "",
      album: s.al?.name || "",
    }));

    search.setSearchResults(songs);

    if (opts.autoPlayFirst && songs.length > 0) {
      playback.set("playQueue", songs);
      playback.set("currentIdx", 0);
    }
  }

  async function searchPodcast(_query: string, seq: number) {
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
