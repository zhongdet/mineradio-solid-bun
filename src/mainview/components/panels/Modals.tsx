// @ts-nocheck
import { Component, Show, createSignal, createEffect, onCleanup } from "solid-js";
import { useAuth } from "../../stores/authStore";
import { useUser } from "../../stores/userStore";
import { useActionStore } from "../../stores/actionStore";
import { rpc } from "../../lib/api";
import HotkeyModal from "./HotkeyModal";
import TrackDetail from "./TrackDetail";
import UpdateModal from "../panels/UpdateModal";
import CoverCropModal from "../panels/CoverCropModal";

declare const gsap: any;

const Modals: Component = () => {
  const auth = useAuth();
  const [showHotkeyModal, setShowHotkeyModal] = createSignal(false);
  const [trackDetailType, setTrackDetailType] = createSignal<"song" | "artist" | null>(null);
  const [showUpdateModal, setShowUpdateModal] = createSignal(false);
  const [coverCropData, setCoverCropData] = createSignal<{ img: HTMLImageElement; dataUrl: string } | null>(null);

  // Register hotkey modal open action
  createEffect(() => {
    useActionStore.getState().register({
      openHotkeyModal: () => setShowHotkeyModal(true),
      openTrackDetail: (type) => setTrackDetailType(type),
      openUpdateModal: () => setShowUpdateModal(true),
      openCoverCrop: (img: HTMLImageElement, dataUrl: string) => setCoverCropData({ img, dataUrl }),
    });
  });

  // ---- GSAP animation for modal open/close ----
  function animateModal(mask: HTMLElement | null, open: boolean, afterClose?: () => void) {
    if (!mask) return;
    const panel = mask.querySelector<HTMLElement>('.modal');
    if (open) {
      mask.classList.add('show');
      if (window.gsap) {
        window.gsap.killTweensOf(mask);
        if (panel) window.gsap.killTweensOf(panel);
        window.gsap.set(mask, { display: 'flex', visibility: 'visible' });
        window.gsap.fromTo(mask,
          { autoAlpha: 0 },
          { autoAlpha: 1, duration: 0.38, ease: 'power2.out', overwrite: true }
        );
        if (panel) {
          window.gsap.fromTo(panel,
            { autoAlpha: 0, y: 26, scale: 0.965, filter: 'blur(12px)' },
            { autoAlpha: 1, y: 0, scale: 1, filter: 'blur(0px)', duration: 0.68, ease: 'expo.out', overwrite: true }
          );
        }
      } else {
        mask.style.display = 'flex';
        mask.style.visibility = 'visible';
        mask.style.opacity = '1';
      }
    } else {
      if (!mask.classList.contains('show')) { if (afterClose) afterClose(); return; }
      function finish() {
        mask.classList.remove('show');
        if (window.gsap) {
          window.gsap.set(mask, { clearProps: 'display,visibility,opacity' });
          if (panel) window.gsap.set(panel, { clearProps: 'opacity,visibility,transform,filter' });
        } else {
          mask.style.display = '';
          mask.style.visibility = '';
          mask.style.opacity = '';
        }
        if (afterClose) afterClose();
      }
      if (window.gsap) {
        window.gsap.killTweensOf(mask);
        if (panel) {
          window.gsap.killTweensOf(panel);
          window.gsap.to(panel, { autoAlpha: 0, y: 18, scale: 0.976, filter: 'blur(8px)', duration: 0.28, ease: 'power2.in', overwrite: true });
        }
        window.gsap.to(mask, { autoAlpha: 0, duration: 0.34, ease: 'power2.inOut', overwrite: true, onComplete: finish });
      } else {
        finish();
      }
    }
  }

  createEffect(() => {
    const loginMask = document.getElementById('login-modal');
    if (auth.state.modalOpen && auth.state.modalType === 'login') {
      animateModal(loginMask, true);
      updateLoginProviderUi();
      refreshQrForProvider();
    } else if (!auth.state.modalOpen) {
      animateModal(loginMask, false);
      stopQrPoll();
    }
  });

  createEffect(() => {
    const userMask = document.getElementById('user-modal');
    if (auth.state.modalOpen && auth.state.modalType === 'userinfo') {
      animateModal(userMask, true);
    } else if (!auth.state.modalOpen) {
      animateModal(userMask, false);
    }
  });

  // On loginProvider change, update UI and refresh QR
  createEffect(() => {
    if (auth.state.modalOpen && auth.state.modalType === 'login') {
      updateLoginProviderUi();
      refreshQrForProvider();
    }
  });

  // ---- QR state ----
  let qrPollTimer: ReturnType<typeof setInterval> | null = null;

  function stopQrPoll() {
    if (qrPollTimer) { clearInterval(qrPollTimer); qrPollTimer = null; }
  }

  async function refreshQrForProvider() {
    stopQrPoll();
    const isQQ = auth.state.loginProvider === 'qq';
    const img = document.getElementById('qr-img') as HTMLImageElement;
    const status = document.getElementById('qr-status');
    const refreshBtn = document.getElementById('refresh-qr-btn');
    if (!img || !status || !refreshBtn) return;

    if (isQQ) {
      // QQ uses web login preview card, not QR
      img.src = '';
      status.textContent = auth.state.qqLoginStatus.loggedIn
        ? ('已保存 QQ 音乐会话 · ' + (auth.state.qqLoginStatus.nickname || ''))
        : '点击"扫码登录"打开 QQ 音乐官方窗口';
      status.className = 'preview';
      return;
    }

    // Check if desktop web login is available (netease)
    const canOpenNeteaseWeb = !!(window as any).desktopWindow && typeof (window as any).desktopWindow.openNeteaseMusicLogin === 'function';
    if (canOpenNeteaseWeb) {
      img.src = '';
      status.textContent = auth.state.loginStatus.loggedIn
        ? ('已保存网易云会话 · ' + (auth.state.loginStatus.nickname || ''))
        : '点击"网页登录"打开网易云官方窗口';
      status.className = 'preview';
      return;
    }

    // Standard QR code flow
    try {
      const keyRes = await rpc<any>("login_qr_key");
      if (!keyRes?.key) throw new Error('获取 key 失败');
      const createRes = await rpc<any>("login_qr_create", { key: keyRes.key });
      if (!createRes?.img) throw new Error('生成二维码失败');
      img.src = createRes.img;
      status.textContent = '请使用网易云音乐 App 扫码';
      status.className = '';
      startQrPoll(keyRes.key);
    } catch (e: any) {
      status.textContent = '出错: ' + e.message;
      status.className = 'fail';
    }
  }

  function startQrPoll(key: string) {
    stopQrPoll();
    qrPollTimer = setInterval(async () => {
      try {
        const data = await rpc<any>("login_qr_check", { key });
        const status = document.getElementById('qr-status');
        if (data.code === 803) {
          // Logged in successfully
          stopQrPoll();
          if (status) { status.textContent = '登录成功！'; status.className = 'scan'; }
          // Refresh login status after success
          useActionStore.getState().refreshLoginStatus();
          setTimeout(() => auth.hideModal(), 1200);
        } else if (data.code === 802) {
          // Scanned, waiting for confirmation
          if (status) { status.textContent = '已扫码，请在手机上确认'; status.className = 'scan'; }
        } else if (data.code === 801) {
          // Waiting for scan
          if (status) { status.textContent = '请使用网易云音乐 App 扫码'; status.className = ''; }
        } else if (data.code === 800) {
          // Expired
          stopQrPoll();
          if (status) { status.textContent = '二维码已过期，请刷新'; status.className = 'fail'; }
        }
      } catch { /* ignore */ }
    }, 2000);
  }

  onCleanup(() => stopQrPoll());

  // ---- UI updaters ----
  function updateLoginProviderUi() {
    const isQQ = auth.state.loginProvider === 'qq';
    const title = document.getElementById('login-modal-title');
    const desc = document.getElementById('login-modal-desc');
    const shell = document.getElementById('qr-shell');
    const st = document.getElementById('qr-status');
    const refreshBtn = document.getElementById('refresh-qr-btn');
    const qqPanel = document.getElementById('qq-cookie-panel');
    const qqCookieToggle = document.getElementById('qq-cookie-toggle-btn');
    const qqCard = document.getElementById('qq-web-login-card');
    const neteaseBtn = document.getElementById('login-provider-netease');
    const qqBtn = document.getElementById('login-provider-qq');
    const bothBtn = document.getElementById('login-both-btn');
    const cancelBtn = document.getElementById('login-cancel-btn');
    const skipBtn = document.getElementById('login-skip-btn');
    const canOpenNeteaseWeb = !!(window as any).desktopWindow && typeof (window as any).desktopWindow.openNeteaseMusicLogin === 'function';

    if (neteaseBtn) neteaseBtn.classList.toggle('active', !isQQ);
    if (qqBtn) qqBtn.classList.toggle('active', isQQ);

    const metaLabel = isQQ ? 'QQ 音乐' : '网易云音乐';
    if (title) title.textContent = '扫码登录' + metaLabel;

    if (desc) {
      desc.innerHTML = isQQ
        ? '打开 <b>QQ 音乐官方网页登录窗口</b> 扫码，成功后会自动同步账号会话。'
        : (canOpenNeteaseWeb
          ? '打开 <b>网易云音乐官方网页登录窗口</b> 扫码，避开接口二维码风控；成功后会自动同步账号会话。'
          : '使用 <b>网易云音乐 App</b> 扫码，可同步歌单、红心与播客。');
    }

    if (shell) {
      shell.classList.toggle('web-login-preview', isQQ || canOpenNeteaseWeb);
      shell.classList.toggle('qq-preview', isQQ);
      shell.classList.toggle('netease-preview', !isQQ && canOpenNeteaseWeb);
    }

    const qqManualCookieOpen = auth.state.qqManualCookieOpen;
    if (qqPanel) qqPanel.classList.toggle('show', isQQ && qqManualCookieOpen);
    if (qqCookieToggle) {
      qqCookieToggle.classList.toggle('show', isQQ);
      qqCookieToggle.textContent = qqManualCookieOpen ? '收起导入' : '手动导入';
    }

    if (qqCard) {
      qqCard.disabled = false;
      const cardMark = qqCard.querySelector('b');
      const cardLabel = qqCard.querySelector('span');
      if (cardMark) cardMark.textContent = isQQ ? 'QQ' : 'NE';
      if (cardLabel) cardLabel.textContent = isQQ ? '打开官方扫码窗口' : '打开官方登录窗口';
    }

    if (st) {
      st.className = isQQ ? 'preview' : '';
      st.textContent = isQQ
        ? (auth.state.qqLoginStatus.loggedIn ? ('已保存 QQ 音乐会话 · ' + (auth.state.qqLoginStatus.nickname || '')) : '点击"扫码登录"打开 QQ 音乐官方窗口')
        : (canOpenNeteaseWeb ? '点击"网页登录"打开网易云官方窗口' : '正在生成二维码…');
    }

    if (refreshBtn) {
      refreshBtn.disabled = false;
      refreshBtn.textContent = isQQ ? '扫码登录' : (canOpenNeteaseWeb ? '网页登录' : '刷新二维码');
    }

    // Show/hide buttons based on platform
    if (bothBtn) bothBtn.style.display = isQQ ? 'none' : '';
    if (skipBtn) skipBtn.style.display = isQQ ? 'none' : '';
  }

  function closeLoginModal() {
    stopQrPoll();
    auth.hideModal();
  }

  function setLoginProvider(provider: "netease" | "qq") {
    auth.set("loginProvider", provider);
  }

  function handleRefreshOrWebLogin() {
    const isQQ = auth.state.loginProvider === 'qq';
    const canOpenNeteaseWeb = !!(window as any).desktopWindow && typeof (window as any).desktopWindow.openNeteaseMusicLogin === 'function';
    if (isQQ) {
      useActionStore.getState().openWebLogin();
    } else if (canOpenNeteaseWeb) {
      useActionStore.getState().openWebLogin();
    } else {
      refreshQrForProvider();
    }
  }

  function skipLoginAndFocusSearch() {
    closeLoginModal();
    useActionStore.getState().homeSearch("");
  }

  function requestDualLoginMode() {
    auth.set("dualAccountMode", true);
  }

  function toggleQQCookiePanel() {
    const newVal = !auth.state.qqManualCookieOpen;
    auth.set("qqManualCookieOpen", newVal);
    const panel = document.getElementById('qq-cookie-panel');
    if (panel) panel.classList.toggle('show', newVal && auth.state.loginProvider === 'qq');
    const toggle = document.getElementById('qq-cookie-toggle-btn');
    if (toggle) toggle.textContent = newVal ? '收起导入' : '手动导入';
  }

  function submitQQCookieLogin() {
    useActionStore.getState().submitQQCookie();
  }

  function backdropClick(e: MouseEvent, modalType: string) {
    const mask = e.currentTarget as HTMLElement;
    if (e.target === mask) {
      if (modalType === 'login') closeLoginModal();
      else auth.hideModal();
    }
  }

  return (
    <>
      {/* Login Modal */}
      <div id="login-modal" class="modal-mask" onClick={(e) => backdropClick(e, 'login')}>
        <div class="modal dual-login-modal" onClick={(e) => e.stopPropagation()}>
          <div class="login-platform-tabs" id="login-platform-tabs">
            <button id="login-provider-netease" classList={{ netease: true, active: auth.state.loginProvider === "netease" }} type="button" onClick={() => setLoginProvider("netease")}>网易云</button>
            <button id="login-provider-qq" classList={{ qq: true, active: auth.state.loginProvider === "qq" }} type="button" onClick={() => setLoginProvider("qq")}>QQ 音乐</button>
          </div>
          <div class="login-intro">
            <div class="login-intro-kicker">Mineradio</div>
            <div class="login-intro-title">音乐播放器，也是一座视觉舞台</div>
            <div class="login-intro-body">搜索或导入一首歌即可播放；登录后会同步歌单、红心和播客，让封面、歌词和粒子跟着音乐动起来。</div>
          </div>
          <h2 id="login-modal-title">扫码登录网易云音乐</h2>
          <div id="login-modal-desc" class="desc">使用 <b>网易云音乐 App</b> 扫码，可同步歌单、红心与播客。</div>
          <div id="qr-shell" class="qr-shell">
            <img id="qr-img" src="" alt="" />
            <button id="qq-web-login-card" class="qq-login-mark" type="button" onClick={() => useActionStore.getState().openWebLogin()}><b>QQ</b><span>打开官方扫码窗口</span></button>
          </div>
          <div id="qr-status">正在生成二维码…</div>
          <div id="qq-cookie-panel" class="qq-cookie-panel">
            <textarea id="qq-cookie-input" class="qq-cookie-input" spellcheck="false" autocomplete="off" placeholder="uin=...; qqmusic_key=...; qm_keyst=..."></textarea>
            <div class="qq-cookie-actions">
              <div class="qq-cookie-note">从 y.qq.com 的登录会话导入。</div>
              <button id="qq-cookie-save-btn" class="modal-btn primary" type="button" onClick={submitQQCookieLogin}>保存</button>
            </div>
          </div>
          <div class="btn-row">
            <button id="login-cancel-btn" class="modal-btn" onClick={closeLoginModal}>取消</button>
            <button id="login-skip-btn" class="modal-btn" onClick={skipLoginAndFocusSearch}>先搜索一首歌</button>
            <button id="login-both-btn" class="modal-btn" onClick={requestDualLoginMode}>我两个都要</button>
            <button id="qq-cookie-toggle-btn" class="modal-btn" type="button" onClick={toggleQQCookiePanel}>手动导入</button>
            <button id="refresh-qr-btn" class="modal-btn primary" onClick={handleRefreshOrWebLogin}>刷新二维码</button>
          </div>
        </div>
      </div>

      {/* User Info Modal */}
      <div id="user-modal" class="modal-mask" onClick={(e) => backdropClick(e, 'userinfo')}>
        <div class="modal dual-user-modal" onClick={(e) => e.stopPropagation()}>
          <h2>账号信息</h2>
          <div class="account-provider-chip netease">
            <span class="account-source-dot netease"></span>
            <span>网易云音乐</span>
          </div>
          <Show when={auth.state.loginStatus.avatar}>
            <img src={auth.state.loginStatus.avatar} style={{ width: "72px", height: "72px", "border-radius": "50%", margin: "0 auto 12px", "object-fit": "cover", display: "block" }} />
          </Show>
          <div style={{ "font-size": "15px", "margin-bottom": "4px" }}>{auth.state.loginStatus.nickname || "未登录"}</div>
          <div style={{ "font-size": "11px", color: "rgba(255,255,255,0.5)", "margin-bottom": "20px" }}>{auth.state.loginStatus.vipLabel}</div>
          <div class="btn-row">
            <button class="modal-btn" onClick={() => auth.hideModal()}>关闭</button>
            <button class="modal-btn primary" onClick={() => {
              useActionStore.getState().logout();
              auth.hideModal();
            }}>退出当前平台</button>
          </div>
        </div>
      </div>

      {/* Hotkey Modal */}
      <Show when={showHotkeyModal()}>
        <HotkeyModal onClose={() => setShowHotkeyModal(false)} />
      </Show>

      {/* Track Detail Modal */}
      <Show when={trackDetailType()}>
        <TrackDetail type={trackDetailType()!} onClose={() => setTrackDetailType(null)} />
      </Show>

      {/* Update Modal */}
      <Show when={showUpdateModal()}>
        <UpdateModal onClose={() => setShowUpdateModal(false)} />
      </Show>

      {/* Cover Crop Modal */}
      <Show when={coverCropData()}>
        <CoverCropModal
          img={coverCropData()!.img}
          dataUrl={coverCropData()!.dataUrl}
          onClose={() => setCoverCropData(null)}
          onCommit={(canvas) => {
            // TODO: commit custom cover to song
            setCoverCropData(null);
          }}
        />
      </Show>
    </>
  );
};

export default Modals;
