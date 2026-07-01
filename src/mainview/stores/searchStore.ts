import { createStore } from "solid-js/store";

export type SearchMode = 'song' | 'netease' | 'qq' | 'podcast';

export interface SearchHistoryItem {
  query: string;
  mode: SearchMode;
  timestamp: number;
}

export interface SearchResult {
  songs: any[];
  playlists: any[];
  podcasts: any[];
  query: string;
  mode: SearchMode;
}

export interface SearchStore {
  mode: SearchMode;
  query: string;
  results: any[];
  podcastResults: any[];
  podcastPrograms: any[];
  podcastCurrentRadio: any;
  history: SearchHistoryItem[];
  loading: boolean;
  error: string;
  lastResultQuery: string;
}

const [search, setSearch] = createStore<SearchStore>({
  mode: 'song',
  query: '',
  results: [],
  podcastResults: [],
  podcastPrograms: [],
  podcastCurrentRadio: null,
  history: [],
  loading: false,
  error: '',
  lastResultQuery: '',
});

export function useSearch() {
  return {
    state: search,
    set: (key: keyof SearchStore, value: any) => {
      setSearch(key, value);
    },
    setSearchMode: (mode: SearchMode) => {
      setSearch("mode", mode);
    },
    setQuery: (query: string) => {
      setSearch("query", query);
    },
    setSearchResults: (results: any[]) => {
      setSearch({
        results,
        loading: false,
        error: '',
        lastResultQuery: search.query,
      });
    },
    setSearchLoading: (loading: boolean) => {
      setSearch("loading", loading);
    },
    setSearchError: (error: string) => {
      setSearch("error", error);
    },
    addToSearchHistory: (query: string) => {
      if (!query.trim()) return;
      const newHistory = [
        { query: query.trim(), mode: search.mode, timestamp: Date.now() },
        ...search.history.filter(h => h.query !== query.trim()),
      ].slice(0, 20);
      setSearch("history", newHistory);
      try {
        localStorage.setItem('mineradio-search-history', JSON.stringify(newHistory));
      } catch { /* ignore */ }
    },
    clearSearchHistory: () => {
      setSearch("history", []);
      try {
        localStorage.removeItem('mineradio-search-history');
      } catch { /* ignore */ }
    },
    loadSearchHistory: () => {
      try {
        const raw = localStorage.getItem('mineradio-search-history');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            setSearch("history", parsed.filter((h: any) => h && h.query));
          }
        }
      } catch { /* ignore */ }
    },
    setPodcastResults: (results: any[]) => {
      setSearch("podcastResults", results);
    },
    setPodcastPrograms: (programs: any[]) => {
      setSearch("podcastPrograms", programs);
    },
  };
}

export type SearchStoreType = typeof search;
