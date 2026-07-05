import { createEffect } from "solid-js";
import { useHome } from "../stores/homeStore";
import { useAuth } from "../stores/authStore";
import { rpc } from "../lib/api";
import { renderHomeDiscover, renderHomeTiles } from "../lib/homeDiscover";
import { HOME_LISTEN_STATS_KEY, HOME_WEATHER_CITY_KEY } from "../utils/constants";

export function useHomeDiscover() {
  const home = useHome();
  const auth = useAuth();

  // Load listen stats from localStorage and sync auth login state
  createEffect(() => {
    loadListenStats();
    loadWeatherCity();
    // Sync login state into homeDiscoverState
    const loggedIn = !!(auth.state.loginStatus.loggedIn || auth.state.qqLoginStatus.loggedIn);
    const prev = home.state.homeDiscoverState.loggedIn;
    if (prev !== loggedIn) {
      home.set("homeDiscoverState", { ...home.state.homeDiscoverState, loggedIn });
    }
  });

  // Re-render home discover when login state or data changes
  createEffect(() => {
    const s = home.state.homeDiscoverState;
    if (s.loaded) {
      renderHomeDiscover();
      renderHomeTiles();
    }
  });

  // Also re-render when listen stats change
  createEffect(() => {
    const stats = home.state.listenStatsState;
    void stats; // Trigger reactive dependency
    if (home.state.homeDiscoverState.loaded) {
      renderHomeDiscover();
      renderHomeTiles();
    }
  });

  async function refreshHomeDiscover() {
    if (!auth.state.loginStatus.loggedIn) {
      home.setHomeDiscoverLoading(false);
      home.set("homeDiscoverState", { ...home.state.homeDiscoverState, mode: "starter", loaded: true });
      return;
    }

    home.setHomeDiscoverLoading(true);

    try {
      // Fetch personalized songs
      const [personalized, _recommend, playlists] = await Promise.all([
        rpc<any>("personalized", { limit: 12 }).catch(() => ({ result: { songList: [] } })),
        rpc<any>("recommend_songs", {}).catch(() => ({ data: { dailySongs: [] } })),
        rpc<any>("personalized_playlist", { limit: 12 }).catch(() => ({ result: { list: [] } })),
      ]);

      const songs = (personalized.result?.songList || []).map((s: any) => ({
        id: s.id,
        name: s.name,
        artist: (s.artists || [{}])[0]?.name || "Unknown",
        cover: s.al?.picUrl || "",
        duration: s.dt,
      }));

      const playlistItems = (personalized.result?.playlist || playlists.result?.list || []).map((p: any) => ({
        id: p.id,
        name: p.name,
        cover: p.picUrl || "",
        trackCount: p.trackCount || 0,
      }));

      home.setHomeDiscoverResults(songs, playlistItems, []);
    } catch (err) {
      console.error("Home discover load failed:", err);
      home.setHomeDiscoverError("Discover load failed");
    }
  }

  async function loadWeatherRadio() {
    const city = home.state.homeWeatherRadioState.city;
    home.set("homeWeatherRadioState", { ...home.state.homeWeatherRadioState, loading: true });

    try {
      // Auto-detect city if not set
      if (!city || city === "上海") {
        try {
          const locRes = await fetch("/api/weather/ip-location");
          const loc = await locRes.json();
          if (loc?.city) {
            home.setWeatherCity(loc.city);
            localStorage.setItem(HOME_WEATHER_CITY_KEY, loc.city);
          }
        } catch { /* ignore */ }
      }

      // Fetch weather radio
      const params = new URLSearchParams();
      // Use default Shanghai coords for now; could add geolocation later
      params.set("lat", "31.23");
      params.set("lon", "121.47");
      params.set("timezone", "Asia/Shanghai");

      const res = await fetch(`/api/weather/radio?${params}`);
      const data = await res.json();

      if (data?.ok) {
        home.set("homeWeatherRadioState", {
          ...home.state.homeWeatherRadioState,
          loading: false,
          loaded: true,
          weather: data.weather,
          radio: data.radio,
          updatedAt: Date.now(),
        });
      } else {
        home.set("homeWeatherRadioState", {
          ...home.state.homeWeatherRadioState,
          loading: false,
          error: data?.error || "Weather load failed",
        });
      }
    } catch (err) {
      console.error("Weather load failed:", err);
      home.set("homeWeatherRadioState", {
        ...home.state.homeWeatherRadioState,
        loading: false,
        error: "Weather load failed",
      });
    }
  }

  function loadListenStats() {
    try {
      const raw = localStorage.getItem(HOME_LISTEN_STATS_KEY);
      if (raw) {
        const stats = JSON.parse(raw);
        home.updateListenStats(stats);
      }
    } catch { /* ignore */ }
  }

  function updateListenStatsTick(paused: boolean) {
    if (paused) return;
    const stats = {
      ...home.state.listenStatsState,
      totalSongs: home.state.listenStatsState.totalSongs + 1,
      totalHours: home.state.listenStatsState.totalHours + 0.003, // ~10 min per song
    };
    try {
      localStorage.setItem(HOME_LISTEN_STATS_KEY, JSON.stringify(stats));
    } catch { /* ignore */ }
    home.updateListenStats(stats);
  }

  function loadWeatherCity() {
    try {
      const city = localStorage.getItem(HOME_WEATHER_CITY_KEY);
      if (city) {
        home.setWeatherCity(city);
      }
    } catch { /* ignore */ }
  }

  return {
    refreshHomeDiscover,
    loadWeatherRadio,
    updateListenStatsTick,
    loadListenStats,
  };
}

export type HomeDiscoverHook = ReturnType<typeof useHomeDiscover>;
