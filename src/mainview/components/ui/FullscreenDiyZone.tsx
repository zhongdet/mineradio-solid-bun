// @ts-nocheck
import { Component } from "solid-js";
import { useSettings } from "../../stores/settingsStore";

const FullscreenDiyZone: Component = () => {
  const settings = useSettings();

  return (
    <div id="fullscreen-diy-zone" aria-hidden="true">
      <button
        id="fullscreen-diy-btn"
        classList={{ "desktop-mode-btn": true, on: settings.state.diyPlayerMode }}
        type="button"
        onClick={() => settings.toggleDiyMode()}
        title={settings.state.diyPlayerMode ? "关闭 DIY 玩家模式" : "开启 DIY 玩家模式"}
        aria-label={settings.state.diyPlayerMode ? "关闭 DIY 玩家模式" : "开启 DIY 玩家模式"}
        aria-pressed={settings.state.diyPlayerMode ? "true" : "false"}
      >DIY</button>
    </div>
  );
};

export default FullscreenDiyZone;
