import { createEffect, onCleanup } from "solid-js";
import { useAuth } from "../stores/authStore";
import { useUser } from "../stores/userStore";
import { rpc } from "../lib/api";

export function useAuthHook() {
  const auth = useAuth();
  const user = useUser();

  // Check login status on mount
  createEffect(() => {
    refreshLoginStatus();
  });

  async function refreshLoginStatus() {
    try {
      const data = await rpc<any>("login_status");
      if (data?.profile?.userId) {
        auth.setLoginStatus({
          loggedIn: true,
          vipType: data.profile.vipType || 0,
          vipLevel: data.profile.vipType >= 11 ? "svip" : (data.profile.vipType > 0 ? "vip" : "none"),
          isVip: data.profile.vipType > 0,
          isSvip: data.profile.vipType >= 11,
          vipLabel: data.profile.vipType >= 11 ? "SVIP" : (data.profile.vipType > 0 ? "VIP" : "无VIP"),
          userId: String(data.profile.userId),
          nickname: data.profile.nickname,
          avatar: data.profile.avatarUrl,
        });
      }
    } catch (err) {
      console.warn("Login status check failed:", err);
    }
  }

  async function refreshQQLoginStatus() {
    try {
      const data = await rpc<any>("login_status");
      if (data?.code === 800) {
        auth.setQQLoginStatus({ loggedIn: false, nickname: "QQ 音乐", avatar: "" });
      } else if (data?.profile) {
        auth.setQQLoginStatus({
          loggedIn: true,
          nickname: data.profile.nickname || "QQ User",
          avatar: data.profile.avatarUrl || "",
          userId: String(data.profile.userId || ""),
          vipType: data.profile.vipType || 0,
        });
      }
    } catch {
      auth.setQQLoginStatus({ loggedIn: false, nickname: "QQ 音乐", avatar: "" });
    }
  }

  async function openNeteaseWebLogin() {
    const api = (window as any).desktopWindow;
    if (!api?.isDesktop || typeof api.openNeteaseMusicLogin !== 'function') {
      // Fall back to QR refresh
      window.dispatchEvent(new CustomEvent("mineradio-refresh-qr"));
      return;
    }

    auth.set("neteaseWebLoginBusy", true);
    const statusEl = document.getElementById('qr-status');
    if (statusEl) { statusEl.textContent = '已打开网易云窗口，请在官方页面扫码登录…'; statusEl.className = 'preview'; }

    try {
      const result = await api.openNeteaseMusicLogin();
      if (!result?.ok || !result.cookie) {
        throw new Error((result?.message || result?.error) || '网易云登录未完成');
      }
      if (statusEl) { statusEl.textContent = '正在同步网易云会话…'; statusEl.className = 'preview'; }
      const info = await rpc<any>("saveCookie", { cookie: result.cookie });
      if (!info?.ok) throw new Error('网易云会话不可用');
      auth.hideModal();
      await refreshLoginStatus();
    } catch (e: any) {
      if (statusEl) { statusEl.textContent = e?.message || '网易云登录失败'; statusEl.className = 'fail'; }
    } finally {
      auth.set("neteaseWebLoginBusy", false);
    }
  }

  async function openQQWebLogin() {
    const api = (window as any).desktopWindow;
    if (!api?.isDesktop || typeof api.openQQMusicLogin !== 'function') {
      // Show manual cookie panel
      auth.set("qqManualCookieOpen", true);
      const toggle = document.getElementById('qq-cookie-toggle-btn');
      if (toggle) { toggle.classList.add('show'); toggle.textContent = '收起导入'; }
      const panel = document.getElementById('qq-cookie-panel');
      if (panel) panel.classList.add('show');
      const statusEl = document.getElementById('qr-status');
      if (statusEl) { statusEl.textContent = '当前环境不支持自动网页登录，可先使用手动导入。'; statusEl.className = 'fail'; }
      return;
    }

    auth.set("qqWebLoginBusy", true);
    const statusEl = document.getElementById('qr-status');
    if (statusEl) { statusEl.textContent = '已打开 QQ 音乐窗口，请扫码并确认登录…'; statusEl.className = 'preview'; }

    try {
      const result = await api.openQQMusicLogin();
      if (!result?.ok || !result.cookie) {
        throw new Error((result?.message || result?.error) || 'QQ 登录未完成');
      }
      if (statusEl) { statusEl.textContent = '正在同步 QQ 音乐会话…'; statusEl.className = 'preview'; }
      const info = await rpc<any>("saveQQCookie", { cookie: result.cookie });
      if (!info?.ok) throw new Error('QQ 会话不可用');
      auth.hideModal();
      await refreshQQLoginStatus();
    } catch (e: any) {
      if (statusEl) { statusEl.textContent = e?.message || 'QQ 登录失败'; statusEl.className = 'fail'; }
    } finally {
      auth.set("qqWebLoginBusy", false);
    }
  }

  async function submitQQCookie(cookie: string) {
    if (!cookie.trim()) {
      const statusEl = document.getElementById('qr-status');
      if (statusEl) { statusEl.textContent = '先粘贴 QQ 音乐 cookie'; statusEl.className = 'fail'; }
      return;
    }
    auth.set("qqCookieBusy", true);
    const saveBtn = document.getElementById('qq-cookie-save-btn');
    if (saveBtn) saveBtn.classList.add('busy');
    const statusEl = document.getElementById('qr-status');
    if (statusEl) { statusEl.textContent = '正在保存 QQ 会话…'; statusEl.className = 'preview'; }

    try {
      const info = await rpc<any>("saveQQCookie", { cookie: cookie.trim() });
      if (!info?.ok) throw new Error('QQ 会话不可用');
      const input = document.getElementById('qq-cookie-input') as HTMLTextAreaElement | null;
      if (input) input.value = '';
      auth.hideModal();
      await refreshQQLoginStatus();
    } catch (e: any) {
      if (statusEl) { statusEl.textContent = e?.message || 'QQ 会话保存失败'; statusEl.className = 'fail'; }
    } finally {
      auth.set("qqCookieBusy", false);
      if (saveBtn) saveBtn.classList.remove('busy');
    }
  }

  async function refreshQr() {
    try {
      const data = await rpc<any>("login_qr_key");
      if (data?.data?.unikey) {
        auth.startQrPoll(data.data.unikey);
      }
    } catch (err) {
      console.error("QR key fetch failed:", err);
    }
  }

  function startQrPoll(key: string) {
    auth.startQrPoll(key);
    const timer = setInterval(async () => {
      try {
        const data = await rpc<any>("login_qr_check", { key });
        if (data?.code === 800 || data?.code === 803) {
          clearInterval(timer);
          auth.stopQrPoll();
          await refreshLoginStatus();
        } else if (data?.code === 801) {
          // Waiting for scan
        } else if (data?.code === 802) {
          // Expired
          clearInterval(timer);
          auth.stopQrPoll();
        }
      } catch {
        // ignore
      }
    }, 3000);
    auth.set("qrPollTimer", timer as any);
  }

  function stopQrPoll() {
    if (auth.state.qrPollTimer) {
      clearInterval(auth.state.qrPollTimer as any);
      auth.set("qrPollTimer", null);
    }
    auth.set("qrKey", null);
  }

  async function logoutActiveAccount() {
    try {
      await rpc("logout");
    } catch { /* ignore */ }
    auth.logoutActiveAccount();
    user.set("userPlaylists", []);
    user.set("qqPlaylists", []);
    user.set("likedSongMap", {});
  }

  async function toggleLikeSong(songId: string) {
    try {
      await rpc("like", { id: songId, like: true });
      user.setLikedSongMap({ ...user.state.likedSongMap, [songId]: true });
    } catch {
      try {
        await rpc("like", { id: songId, like: false });
        const map = { ...user.state.likedSongMap };
        delete map[songId];
        user.setLikedSongMap(map);
      } catch { /* ignore */ }
    }
  }

  // Wire up custom event listeners
  let openWebLoginHandler: ((e: Event) => void) | null = null;
  let submitQQCookieHandler: ((e: Event) => void) | null = null;
  let logoutHandler: (() => void) | null = null;
  let refreshLoginStatusHandler: (() => void) | null = null;
  let toggleLikeHandler: ((e: Event) => void) | null = null;
  let collectSongHandler: ((e: Event) => void) | null = null;

  createEffect(() => {
    openWebLoginHandler = () => {
      if (auth.state.loginProvider === 'qq') openQQWebLogin();
      else openNeteaseWebLogin();
    };
    submitQQCookieHandler = () => {
      const input = document.getElementById('qq-cookie-input') as HTMLTextAreaElement | null;
      submitQQCookie(input?.value || '');
    };
    logoutHandler = () => logoutActiveAccount();
    refreshLoginStatusHandler = () => refreshLoginStatus();
    toggleLikeHandler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.song) toggleLikeSong(String(detail.song.id || detail.song.mid));
    };
    collectSongHandler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.song) user.openCollectModal(detail.song);
    };

    window.addEventListener("mineradio-open-web-login", openWebLoginHandler);
    window.addEventListener("mineradio-submit-qq-cookie", submitQQCookieHandler);
    window.addEventListener("mineradio-logout", logoutHandler);
    window.addEventListener("mineradio-refresh-login-status", refreshLoginStatusHandler);
    window.addEventListener("mineradio-toggle-like", toggleLikeHandler);
    window.addEventListener("mineradio-collect-song", collectSongHandler);
  });

  onCleanup(() => {
    if (openWebLoginHandler) window.removeEventListener("mineradio-open-web-login", openWebLoginHandler);
    if (submitQQCookieHandler) window.removeEventListener("mineradio-submit-qq-cookie", submitQQCookieHandler);
    if (logoutHandler) window.removeEventListener("mineradio-logout", logoutHandler);
    if (refreshLoginStatusHandler) window.removeEventListener("mineradio-refresh-login-status", refreshLoginStatusHandler);
    if (toggleLikeHandler) window.removeEventListener("mineradio-toggle-like", toggleLikeHandler);
    if (collectSongHandler) window.removeEventListener("mineradio-collect-song", collectSongHandler);
  });

  return {
    refreshLoginStatus,
    refreshQQLoginStatus,
    openNeteaseWebLogin,
    openQQWebLogin,
    refreshQr,
    startQrPoll,
    stopQrPoll,
    logoutActiveAccount,
    toggleLikeSong,
    refreshUserPlaylists: () => {},
    openCollectModal: (song: any) => user.openCollectModal(song),
  };
}

export type AuthHook = ReturnType<typeof useAuthHook>;
