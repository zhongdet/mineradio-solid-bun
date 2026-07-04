// @ts-nocheck
import { Component, Show } from "solid-js";
import { useAuth } from "../../stores/authStore";
import { useHome } from "../../stores/homeStore";
import { useSettings } from "../../stores/settingsStore";
import { setHomeControlsLocked } from "../../lib/uiControls";

const TopRight: Component = () => {
  const auth = useAuth();
  const home = useHome();
  const settings = useSettings();

  function goHome() {
    const isActive = document.body.classList.contains("empty-home-active");
    if (isActive) {
      document.body.classList.remove("empty-home-active");
      home.setEmptyHomeActive(false);
      home.setHomeSuppressed(true);
      setHomeControlsLocked(false);
    } else {
      document.body.classList.add("empty-home-active");
      home.setEmptyHomeActive(true);
      home.setHomeSuppressed(false);
      home.set("homeForcedOpen", true);
      setHomeControlsLocked(true);
    }
  }

  return (
    <div id="top-right">
      <button
        id="user-capsule-hide-btn"
        class="user-capsule-hide-btn"
        type="button"
        classList={{ on: settings.state.userCapsuleAutoHide }}
        onClick={() => settings.toggleUserCapsuleAutoHide()}
        title="自动隐藏账号胶囊"
      >
        {settings.state.userCapsuleAutoHide ? "›" : "‹"}
      </button>
      <button id="home-btn" class="icon-btn" title="回到 Home" aria-label="回到 Home" onClick={goHome}>
        <svg width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.9" viewBox="0 0 24 24">
          <path d="M3 10.8 12 3l9 7.8"/><path d="M5 10v10h14V10"/><path d="M9.5 20v-5h5v5"/>
        </svg>
      </button>
      <button
        id="user-btn"
        classList={{ "icon-btn": true, "logged-out": !auth.state.loginStatus.loggedIn }}
        onClick={() => {
          if (auth.state.loginStatus.loggedIn) {
            auth.showUserInfoModal();
          } else {
            auth.showLoginModal();
          }
        }}
        title={auth.state.loginStatus.loggedIn ? auth.state.loginStatus.nickname || "账号" : "登录账号"}
      >
        <Show when={auth.state.loginStatus.loggedIn && auth.state.loginStatus.avatar}>
          <img
            src={auth.state.loginStatus.avatar}
            alt=""
            style={{ width: "24px", height: "24px", "border-radius": "50%", "object-fit": "cover" }}
          />
        </Show>
        <Show when={!auth.state.loginStatus.loggedIn}>
          <span class="login-word">登录</span>
        </Show>
      </button>
    </div>
  );
};

export default TopRight;
