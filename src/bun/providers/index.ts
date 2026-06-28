// MusicProvider — unified facade over all music providers
import { NeteaseProvider } from "./netease";
import { QQProvider } from "./qq";

export type ProviderName = "netease" | "qq" | "local";

export class MusicProvider {
  netease: NeteaseProvider;
  qq: QQProvider;
  cookie = "";
  qqCookie = "";
  saveCookie: (c: string) => void = () => {};
  saveQQCookie: (c: string) => void = () => {};

  constructor() {
    this.netease = new NeteaseProvider();
    this.qq = new QQProvider();
  }

  init(cookie: string, qqCookie: string, saveCookie: (c: string) => void, saveQQCookie: (c: string) => void) {
    this.cookie = cookie;
    this.qqCookie = qqCookie;
    this.saveCookie = saveCookie;
    this.saveQQCookie = saveQQCookie;
    this.netease.init({ cookie, saveCookie });
    this.qq.init({ cookie: qqCookie, saveCookie: saveQQCookie });
  }

  setCookie(c: string) {
    this.cookie = c;
    this.netease.setCookie(c);
  }

  setQQCookie(c: string) {
    this.qqCookie = c;
    this.qq.setCookie(c);
  }

  getCookie() { return this.cookie; }
  getQQCookie() { return this.qqCookie; }

  getProvider(name: ProviderName) {
    switch (name) {
      case "netease": return this.netease;
      case "qq": return this.qq;
      default: throw new Error(`Unknown provider: ${name}`);
    }
  }
}
