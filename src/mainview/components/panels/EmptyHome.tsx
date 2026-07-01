// @ts-nocheck
import { Component } from "solid-js";
import { useAuth } from "../../stores/authStore";
import { useHome } from "../../stores/homeStore";
import { openHomeLibrary, playHomeSong, playHomeRecent, openHomeInsight } from "../../lib/homeActions";
import { openHomePlayerConsole } from "../../lib/uiControls";
import { hasAnyPlatformLogin } from "../../lib/platformLogin";

const EmptyHome: Component = () => {
  const auth = useAuth();
  const home = useHome();

  const loggedOutHome = (): boolean => {
    return !auth.state.loginStatus.loggedIn && !hasAnyPlatformLogin();
  };

  const railTitle = (): string => {
    const stats = home.state.listenStatsState;
    if (stats.recentSongs && stats.recentSongs.length > 0) return '接着听';
    if (loggedOutHome()) return '先从这里开始';
    return '你的歌单与推荐';
  };

  return (
    <section id="empty-home" aria-label="Mineradio home">
      <div class="empty-home-shell">
        <div class="home-hero">
          <div class="home-hero-inner home-construction-inner">
            <div class="home-title home-construction-title">🚧此处施工，敬请期待🚧</div>
            <button class="home-chip home-console-chip" type="button" onClick={openHomePlayerConsole}>展开播放器控制台</button>
          </div>
        </div>
        <div class="home-grid">
          <button class="home-card" data-home-tone="library" type="button" onClick={openHomeLibrary}>
            <div class="home-card-label">Library</div>
            <div class="home-card-title" id="home-weather-card-title">我的歌单</div>
            <div class="home-card-sub" id="home-weather-card-sub">打开左侧歌单库</div>
            <div class="home-card-art" id="home-weather-art"></div>
          </button>
          <button class="home-card" data-home-tone="mix" type="button" onClick={() => playHomeSong(0)}>
            <div class="home-card-label">Daily</div>
            <div class="home-card-title" id="home-daily-title">每日推荐</div>
            <div class="home-card-sub" id="home-daily-sub">登录后同步你的今日歌曲</div>
            <div class="home-card-art" id="home-daily-art"></div>
          </button>
          <button class="home-card" data-home-tone="playlist" type="button" onClick={() => playHomeSong(1)}>
            <div class="home-card-label">Song</div>
            <div class="home-card-title" id="home-private-title">私人电台</div>
            <div class="home-card-sub" id="home-private-sub">从你的推荐和歌单里开播</div>
            <div class="home-card-art" id="home-private-art"></div>
          </button>
          <button class="home-card" data-home-tone="mix" type="button" onClick={playHomeRecent}>
            <div class="home-card-label">Continue</div>
            <div class="home-card-title" id="home-continue-title">继续听</div>
            <div class="home-card-sub" id="home-continue-sub">最近播放会出现在这里</div>
            <div class="home-card-art" id="home-continue-art"></div>
          </button>
          <button class="home-card" data-home-tone="local" type="button" onClick={openHomeInsight}>
            <div class="home-card-label">Profile</div>
            <div class="home-card-title" id="home-profile-title">听歌画像</div>
            <div class="home-card-sub" id="home-profile-sub">播放几首后生成偏好</div>
            <div class="home-card-art" id="home-profile-art"></div>
          </button>
          <button class="home-card" data-home-tone="local" type="button" onClick={() => playHomeSong(2)}>
            <div class="home-card-label">Song</div>
            <div class="home-card-title" id="home-library-title">常听歌手</div>
            <div class="home-card-sub" id="home-library-sub">你的偏好会在这里汇总</div>
            <div class="home-card-art" id="home-library-art"></div>
          </button>
        </div>
        <div class="home-rail">
          <div class="home-section-head">
            <div class="home-section-title" id="home-rail-title">{railTitle()}</div>
            <div class="home-section-note" id="home-rail-note">正在整理推荐</div>
          </div>
          <div id="home-tile-row" class="home-tile-row"></div>
        </div>
      </div>
    </section>
  );
};

export default EmptyHome;
