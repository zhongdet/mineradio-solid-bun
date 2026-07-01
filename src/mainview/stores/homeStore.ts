import { createStore } from "solid-js/store";

export interface HomeDiscoverState {
  loading: boolean;
  loaded: boolean;
  loggedIn: boolean;
  mode: 'starter' | 'personalized' | 'recommend' | 'error';
  songs: any[];
  playlists: any[];
  podcasts: any[];
  error: string;
  updatedAt: number;
}

export interface HomeWeatherState {
  loading: boolean;
  loaded: boolean;
  city: string;
  weather: any;
  radio: any;
  error: string;
  updatedAt: number;
}

export interface ListenStatsState {
  totalSongs: number;
  totalHours: number;
  favoriteArtist: string;
  favoriteGenre: string;
  firstListen: number;
  recentSongs: any[];
}

export interface HomeStore {
  emptyHomeActive: boolean;
  homeForcedOpen: boolean;
  homeSuppressed: boolean;
  homeVisualPresetActive: boolean;
  homeVisualPrevPreset: number;
  homeDiscoverState: HomeDiscoverState;
  homeWeatherRadioState: HomeWeatherState;
  listenStatsState: ListenStatsState;
}

const [home, setHome] = createStore<HomeStore>({
  emptyHomeActive: false,
  homeForcedOpen: false,
  homeSuppressed: false,
  homeVisualPresetActive: false,
  homeVisualPrevPreset: 0,
  homeDiscoverState: {
    loading: false,
    loaded: false,
    loggedIn: false,
    mode: 'starter',
    songs: [],
    playlists: [],
    podcasts: [],
    error: '',
    updatedAt: 0,
  },
  homeWeatherRadioState: {
    loading: false,
    loaded: false,
    city: '上海',
    weather: null,
    radio: null,
    error: '',
    updatedAt: 0,
  },
  listenStatsState: {
    totalSongs: 0,
    totalHours: 0,
    favoriteArtist: '',
    favoriteGenre: '',
    firstListen: 0,
    recentSongs: [],
  },
});

export function useHome() {
  return {
    state: home,
    set: (key: keyof HomeStore, value: any) => {
      setHome(key, value);
    },
    setHomeDiscoverLoading: (loading: boolean) => {
      setHome("homeDiscoverState", { ...home.homeDiscoverState, loading });
    },
    setHomeDiscoverResults: (songs: any[], playlists: any[], podcasts: any[]) => {
      setHome("homeDiscoverState", {
        ...home.homeDiscoverState,
        loading: false,
        loaded: true,
        songs,
        playlists,
        podcasts,
        updatedAt: Date.now(),
      });
    },
    setHomeDiscoverError: (error: string) => {
      setHome("homeDiscoverState", {
        ...home.homeDiscoverState,
        loading: false,
        loaded: true,
        mode: 'error',
        error,
      });
    },
    setWeatherCity: (city: string) => {
      setHome("homeWeatherRadioState", {
        ...home.homeWeatherRadioState,
        city,
      });
    },
    updateListenStats: (stats: Partial<ListenStatsState>) => {
      setHome("listenStatsState", { ...home.listenStatsState, ...stats });
    },
    setEmptyHomeActive: (active: boolean) => {
      setHome("emptyHomeActive", active);
    },
    setHomeSuppressed: (suppressed: boolean) => {
      setHome("homeSuppressed", suppressed);
    },
  };
}

export type HomeStoreType = typeof home;
