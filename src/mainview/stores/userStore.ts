import { createStore } from "solid-js/store";

export interface UserStore {
  userPlaylists: any[];
  qqPlaylists: any[];
  myPodcastCollections: any[];
  myPodcastItems: Record<string, any>;
  playlistCoverCache: Record<string, any>;
  likedSongMap: Record<string, boolean>;
  likeBusyMap: Record<string, boolean>;
  likeStatusToken: number;
  collectTargetSong: any;
  collectBusy: boolean;
}

const [user, setUser] = createStore<UserStore>({
  userPlaylists: [],
  qqPlaylists: [],
  myPodcastCollections: [],
  myPodcastItems: {},
  playlistCoverCache: {},
  likedSongMap: {},
  likeBusyMap: {},
  likeStatusToken: 0,
  collectTargetSong: null,
  collectBusy: false,
});

export function useUser() {
  return {
    state: user,
    set: (key: keyof UserStore, value: any) => {
      setUser(key, value);
    },
    toggleLikeSong: (songId: string) => {
      const isLiked = user.likedSongMap[songId];
      setUser("likeBusyMap", { ...user.likeBusyMap, [songId]: true });
      if (isLiked) {
        delete user.likedSongMap[songId];
      } else {
        setUser("likedSongMap", { ...user.likedSongMap, [songId]: true });
      }
      // Optimistic update; actual API call happens in hook
      setTimeout(() => {
        setUser("likeBusyMap", { ...user.likeBusyMap, [songId]: false });
      }, 500);
    },
    setLikedSongMap: (map: Record<string, boolean>) => {
      setUser("likedSongMap", map);
    },
    setPlaylists: (playlists: any[]) => {
      setUser("userPlaylists", playlists);
    },
    openCollectModal: (song: any) => {
      setUser("collectTargetSong", song);
      setUser("collectBusy", false);
    },
    closeCollectModal: () => {
      setUser("collectTargetSong", null);
      setUser("collectBusy", false);
    },
    clearLikeBusy: (songId: string) => {
      const map = { ...user.likeBusyMap };
      delete map[songId];
      setUser("likeBusyMap", map);
    },
  };
}

export type UserStoreType = typeof user;
