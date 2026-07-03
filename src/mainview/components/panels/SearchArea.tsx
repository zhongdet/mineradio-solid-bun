// @ts-nocheck
import { Component, createSignal, onMount, onCleanup, For, Show } from "solid-js";
import { useSearch } from "../../stores/searchStore";
import { usePlayback } from "../../stores/playbackStore";
import { useUi } from "../../stores/uiStore";
import { useSettings } from "../../stores/settingsStore";
import { proxyImageUrl } from "../../lib/api";

const SearchArea: Component = () => {
  const search = useSearch();
  const playback = usePlayback();
  const ui = useUi();
  const settings = useSettings();
  const [query, setQuery] = createSignal("");
  let searchTimer: ReturnType<typeof setTimeout> | null = null;

  function handleInput(value: string) {
    setQuery(value);
    if (searchTimer) clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      const q = value.trim();
      if (q) {
        window.dispatchEvent(new CustomEvent("mineradio-search", { detail: { query: q, mode: search.state.mode } }));
      }
    }, 300);
  }

  const modes = [
    { key: "song", label: "All" },
    { key: "netease", label: "NE" },
    { key: "qq", label: "QQ" },
    { key: "podcast", label: "Podcast" },
  ] as const;

  // Listen for home search requests
  let homeSearchHandler: ((e: Event) => void) | null = null;
  onMount(() => {
    homeSearchHandler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.query != null) {
        setQuery(detail.query);
        window.dispatchEvent(new CustomEvent("mineradio-search", { detail: { query: detail.query, mode: search.state.mode } }));
        const input = document.getElementById("search-input") as HTMLInputElement | null;
        if (input) input.focus();
      }
    };
    window.addEventListener("mineradio-home-search", homeSearchHandler);
  });
  onCleanup(() => {
    if (homeSearchHandler) window.removeEventListener("mineradio-home-search", homeSearchHandler);
    if (searchTimer) clearTimeout(searchTimer);
  });

  function handleSubmit(e: Event) {
    e.preventDefault();
    const q = query().trim();
    if (!q) return;
    window.dispatchEvent(new CustomEvent("mineradio-search", { detail: { query: q, mode: search.state.mode } }));
  }

  function playSearchResult(idx: number) {
    const song = search.state.results[idx];
    if (!song) return;
    playback.set("playQueue", [song]);
    playback.set("currentIdx", 0);
    window.dispatchEvent(new CustomEvent("mineradio-hotkey", { detail: "togglePlay" }));
  }

  function openSearchResultArtist(idx: number) {
    const song = search.state.results[idx];
    if (song?.artistId) {
      window.dispatchEvent(new CustomEvent("mineradio-search", { detail: { query: song.artist, mode: "netease" } }));
    }
  }

  function toggleLikeSearchResult(idx: number) {
    const song = search.state.results[idx];
    if (song) {
      window.dispatchEvent(new CustomEvent("mineradio-toggle-like", { detail: { song, idx } }));
    }
  }

  function collectSearchResult(idx: number) {
    const song = search.state.results[idx];
    if (song) {
      window.dispatchEvent(new CustomEvent("mineradio-collect-song", { detail: { song } }));
    }
  }

  function queueSearchResult(idx: number) {
    const song = search.state.results[idx];
    if (song) {
      playback.addToQueue(song);
    }
  }

  function providerKey(song: any): string {
    if (song && (song.provider === "qq" || song.source === "qq" || song.type === "qq")) return "qq";
    return "netease";
  }

  function sourceTag(song: any): string {
    return providerKey(song) === "qq" ? "QQ" : "NE";
  }

  function sourceClass(song: any): string {
    return providerKey(song) + "-source";
  }

  return (
    <div id="search-area">
      <div id="search-stack">
        <form id="search-box" onSubmit={handleSubmit}>
          <svg id="search-icon" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            id="search-input"
            type="text"
            placeholder="搜索歌曲、歌手..."
            autocomplete="off"
            spellcheck={false}
            value={query()}
            onInput={(e) => handleInput(e.currentTarget.value)}
          />
        </form>

        <div id="search-mode-tabs" class="search-mode-tabs" role="tablist" aria-label="Search mode">
          <For each={modes}>
            {(m) => (
              <button
                id={`search-mode-${m.key}`}
                classList={{ active: search.state.mode === m.key }}
                type="button"
                onClick={() => {
                  search.setSearchMode(m.key as any);
                  if (m.key === "podcast") {
                    window.dispatchEvent(new CustomEvent("mineradio-podcast-hot"));
                  }
                }}
                aria-selected={search.state.mode === m.key}
              >
                {m.label}
              </button>
            )}
          </For>
        </div>

        <div id="search-results" classList={{ show: query().trim().length > 0 && (search.state.results.length > 0 || search.state.podcastResults.length > 0 || search.state.loading) }}>
          <Show when={search.state.loading}>
            <div class="search-loading">搜索中...</div>
          </Show>

          <Show when={!search.state.loading && search.state.results.length > 0}>
            <For each={search.state.results}>
              {(song: any, idx) => (
                <div classList={{ "search-result": true, [sourceClass(song)]: !!sourceClass(song) }}>
                  <div style={{ display: "flex", "align-items": "center", gap: "12px", flex: "1", "min-width": "0" }} onClick={() => playSearchResult(idx())}>
                    <img
                      src={proxyImageUrl(song.cover)}
                      alt=""
                      loading="lazy"
                      onError={(e) => { (e.target as HTMLElement).style.opacity = "0.2"; }}
                      style={{ width: "44px", height: "44px", "border-radius": "4px", "object-fit": "cover", "flex-shrink": "0" }}
                    />
                    <div class="search-result-info">
                      <div class="search-result-title">
                        {song.name}
                        <Show when={sourceTag(song)}>
                          <span classList={{ "tag-source": true, [sourceTag(song).toLowerCase()]: true }}>{sourceTag(song)}</span>
                        </Show>
                      </div>
                      <div class="search-result-meta">
                        <button class="search-artist-link" type="button" onClick={(e) => { e.stopPropagation(); openSearchResultArtist(idx()); }}>{song.artist || ""}</button>
                        <Show when={song.album}> · {song.album}</Show>
                      </div>
                    </div>
                  </div>
                  <button class="song-action-btn" data-like-index={idx()} title="红心喜欢" onClick={(e) => { e.stopPropagation(); toggleLikeSearchResult(idx()); }}>
                    <svg class="heart-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21.45c-.32 0-.62-.12-.86-.34l-1.23-1.12C5.54 16.03 2.25 13.05 2.25 8.9 2.25 5.48 4.88 2.9 8.28 2.9c1.7 0 3.35.72 4.52 1.96C13.97 3.62 15.62 2.9 17.32 2.9c3.4 0 6.03 2.58 6.03 6 0 4.15-3.29 7.13-7.66 11.09l-1.23 1.12c-.24.22-.54.34-.86.34z"/></svg>
                  </button>
                  <button class="song-action-btn" title="收藏到歌单" onClick={(e) => { e.stopPropagation(); collectSearchResult(idx()); }}>
                    <svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h10"/><path d="M4 11h10"/><path d="M4 16h7"/><path d="M18 14v6"/><path d="M15 17h6"/></svg>
                  </button>
                  <button class="add-btn" title="下一首播放" onClick={(e) => { e.stopPropagation(); queueSearchResult(idx()); }}>+</button>
                </div>
              )}
            </For>
          </Show>

          <Show when={!search.state.loading && search.state.podcastResults.length > 0 && search.state.results.length === 0 && search.state.mode === "podcast"}>
            <For each={search.state.podcastResults}>
              {(podcast: any) => (
                <div class="search-result">
                  <div style={{ display: "flex", "align-items": "center", gap: "12px", flex: "1", "min-width": "0" }}>
                    <img src={proxyImageUrl(podcast.cover)} alt="" loading="lazy" style={{ width: "44px", height: "44px", "border-radius": "4px", "object-fit": "cover" }} />
                    <div class="search-result-info">
                      <div class="search-result-title">{podcast.name}</div>
                      <div class="search-result-meta">{podcast.djName}</div>
                    </div>
                  </div>
                </div>
              )}
            </For>
          </Show>

          <Show when={!search.state.loading && search.state.results.length === 0 && search.state.podcastResults.length === 0 && search.state.history.length > 0}>
            <div class="search-history">
              <div class="search-history-head">
                <span>搜索历史</span>
                <button class="search-history-clear" type="button" onClick={() => search.clearSearchHistory()}>清空</button>
              </div>
              <div class="search-history-list">
                <For each={search.state.history}>
                  {(h) => (
                    <button class="search-history-chip" type="button" onClick={() => {
                      setQuery(h.query);
                      window.dispatchEvent(new CustomEvent("mineradio-search", { detail: { query: h.query, mode: h.mode || search.state.mode } }));
                    }}>{h.query}</button>
                  )}
                </For>
              </div>
            </div>
          </Show>
        </div>
      </div>

      <div id="upload-actions">
        <button id="upload-btn" class="icon-btn" onClick={() => document.getElementById('file-input')?.click()} title="导入音乐或封面">
          <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
        </button>
        <button id="clear-cover-btn" class="icon-btn" title="取消自定义封面" aria-label="取消自定义封面">×</button>
      </div>
    </div>
  );
};

export default SearchArea;
