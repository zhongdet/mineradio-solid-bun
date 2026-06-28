// @ts-nocheck
import { Component } from "solid-js";

export const Modals: Component = () => (
  <>
    <div id="login-modal" class="modal-mask">
      <div class="modal dual-login-modal">
        <div class="login-platform-tabs" id="login-platform-tabs">
          <button id="login-provider-netease" class="netease active" type="button" onclick="setLoginProvider('netease')">网易云</button>
          <button id="login-provider-qq" class="qq" type="button" onclick="setLoginProvider('qq')">QQ 音乐</button>
        </div>
        <div class="login-intro">
          <div class="login-intro-kicker">Mineradio</div>
          <div class="login-intro-title">音乐播放器，也是一座视觉舞台</div>
          <div class="login-intro-body">搜索或导入一首歌即可播放；登录后会同步歌单、红心和播客。</div>
        </div>
        <h2 id="login-modal-title">扫码登录网易云音乐</h2>
        <div id="login-modal-desc" class="desc">使用 <b>网易云音乐 App</b> 扫码。</div>
        <div id="qr-shell" class="qr-shell">
          <img id="qr-img" src="" alt="" />
          <button id="qq-web-login-card" class="qq-login-mark" type="button" onclick="openProviderWebLogin()"><b>QQ</b><span>打开官方扫码窗口</span></button>
        </div>
        <div id="qr-status">正在生成二维码…</div>
        <div id="qq-cookie-panel" class="qq-cookie-panel">
          <textarea id="qq-cookie-input" class="qq-cookie-input" spellcheck="false" autocomplete="off" placeholder="uin=...; qqmusic_key=...; qm_keyst=..."></textarea>
          <div class="qq-cookie-actions">
            <div class="qq-cookie-note">从 y.qq.com 的登录会话导入。</div>
            <button id="qq-cookie-save-btn" class="modal-btn primary" type="button" onclick="submitQQCookieLogin()">保存</button>
          </div>
        </div>
        <div class="btn-row">
          <button class="modal-btn" onclick="closeLoginModal()">取消</button>
          <button class="modal-btn" onclick="skipLoginAndFocusSearch()">先搜索一首歌</button>
          <button id="login-both-btn" class="modal-btn" onclick="requestDualLoginMode()">我两个都要</button>
          <button id="qq-cookie-toggle-btn" class="modal-btn" type="button" onclick="toggleQQCookiePanel()">手动导入</button>
          <button id="refresh-qr-btn" class="modal-btn primary" onclick="refreshQr()">刷新二维码</button>
        </div>
      </div>
    </div>
    <div id="user-modal" class="modal-mask">
      <div class="modal dual-user-modal">
        <h2>账号信息</h2>
        <div id="account-provider-chip" class="account-provider-chip netease"><span class="account-source-dot netease"></span><span>网易云音乐</span></div>
        <img id="user-modal-avatar" src="" style="width:72px;height:72px;border-radius:50%;margin:0 auto 12px;object-fit:cover;background:rgba(255,255,255,0.1);display:block" />
        <div id="user-modal-name" style="font-size:15px;margin-bottom:4px"></div>
        <div id="user-modal-vip" style="font-size:11px;color:rgba(255,255,255,0.5);margin-bottom:20px;letter-spacing:.5px"></div>
        <div class="user-platform-tabs" id="user-platform-tabs">...</div>
        <div class="btn-row">
          <button class="modal-btn" onclick="closeUserModal()">关闭</button>
          <button id="account-logout-btn" class="modal-btn primary" onclick="logoutActiveAccount()">退出当前平台</button>
        </div>
      </div>
    </div>
    <div id="cover-crop-modal" class="modal-mask">...</div>
    <div id="collect-modal" class="modal-mask">...</div>
    <div id="local-beat-modal" class="modal-mask">...</div>
    <div id="custom-lyric-modal" class="modal-mask">...</div>
    <div id="track-detail-modal" class="modal-mask">...</div>
    <div id="update-modal" class="modal-mask">...</div>
  </>
);
