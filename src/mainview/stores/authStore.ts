import { createStore } from "solid-js/store";

export interface LoginStatus {
  loggedIn: boolean;
  vipType: number;
  vipLevel: 'none' | 'vip' | 'svip';
  isVip: boolean;
  isSvip: boolean;
  vipLabel: string;
  userId?: string;
  nickname?: string;
  avatar?: string;
}

export interface QQLoginStatus {
  provider: 'qq';
  loggedIn: boolean;
  preview: boolean;
  nickname: string;
  userId: string;
  avatar: string;
  vipType: number;
}

export interface AuthStore {
  loginStatus: LoginStatus;
  qqLoginStatus: QQLoginStatus;
  loginProvider: 'netease' | 'qq';
  activeAccountProvider: 'netease' | 'qq';
  dualAccountMode: boolean;
  qqCookieBusy: boolean;
  neteaseWebLoginBusy: boolean;
  qqWebLoginBusy: boolean;
  qqManualCookieOpen: boolean;
  loginStatusChecked: boolean;
  loginStatusCheckFailed: boolean;
  qrKey: string | null;
  qrPollTimer: ReturnType<typeof setInterval> | null;
  qqLoginAutoRefreshTimer: ReturnType<typeof setInterval> | null;
  qqLoginWasLoggedIn: boolean;
  modalOpen: boolean;
  modalType: 'login' | 'userinfo' | 'cover-crop' | 'collect' | 'hotkey' | 'settings' | null;
}

const [auth, setAuth] = createStore<AuthStore>({
  loginStatus: {
    loggedIn: false,
    vipType: 0,
    vipLevel: 'none',
    isVip: false,
    isSvip: false,
    vipLabel: '无VIP',
  },
  qqLoginStatus: {
    provider: 'qq',
    loggedIn: false,
    preview: true,
    nickname: 'QQ 音乐',
    userId: '',
    avatar: '',
    vipType: 0,
  },
  loginProvider: 'netease',
  activeAccountProvider: 'netease',
  dualAccountMode: false,
  qqCookieBusy: false,
  neteaseWebLoginBusy: false,
  qqWebLoginBusy: false,
  qqManualCookieOpen: false,
  loginStatusChecked: false,
  loginStatusCheckFailed: false,
  qrKey: null,
  qrPollTimer: null,
  qqLoginAutoRefreshTimer: null,
  qqLoginWasLoggedIn: false,
  modalOpen: false,
  modalType: null,
});

export function useAuth() {
  return {
    state: auth,
    set: (key: keyof AuthStore, value: any) => {
      setAuth(key, value);
    },
    setLoginStatus: (status: Partial<LoginStatus>) => {
      setAuth("loginStatus", { ...auth.loginStatus, ...status });
    },
    showLoginModal: () => {
      setAuth({ modalOpen: true, modalType: 'login' });
    },
    showUserInfoModal: () => {
      setAuth({ modalOpen: true, modalType: 'userinfo' });
    },
    hideModal: () => {
      setAuth({ modalOpen: false, modalType: null });
    },
    startQrPoll: (key: string) => {
      setAuth("qrKey", key);
      setAuth("qrPollTimer", null);
    },
    stopQrPoll: () => {
      setAuth("qrKey", null);
    },
    logoutActiveAccount: () => {
      setAuth({
        loginStatus: {
          loggedIn: false,
          vipType: 0,
          vipLevel: 'none',
          isVip: false,
          isSvip: false,
          vipLabel: '无VIP',
        },
        qqLoginStatus: {
          provider: 'qq',
          loggedIn: false,
          preview: true,
          nickname: 'QQ 音乐',
          userId: '',
          avatar: '',
          vipType: 0,
        },
        activeAccountProvider: 'netease',
      });
    },
    setQQLoginStatus: (status: Partial<QQLoginStatus>) => {
      setAuth("qqLoginStatus", { ...auth.qqLoginStatus, ...status });
    },
  };
}

export type AuthStoreType = typeof auth;
