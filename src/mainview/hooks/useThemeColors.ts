import { createEffect } from "solid-js";
import { useFx } from "../stores/fxStore";

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  hex = hex.replace(/^#/, "");
  if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  return {
    r: parseInt(hex.slice(0, 2), 16),
    g: parseInt(hex.slice(2, 4), 16),
    b: parseInt(hex.slice(4, 6), 16),
  };
}

function cssRgb(rgb: { r: number; g: number; b: number }): string {
  return rgb.r + "," + rgb.g + "," + rgb.b;
}

export function useThemeColors() {
  const fx = useFx();

  createEffect(() => {
    const uiAccent = fx.state.uiAccentColor;
    const homeIcon = fx.state.homeIconColor;
    const visualIcon = fx.state.visualIconColor;
    const homeAccent = fx.state.homeAccentColor;
    const visualTint = fx.state.visualTintColor;

    const root = document.documentElement;

    // uiAccentColor → CSS accent variables
    const accentRgb = hexToRgb(uiAccent);
    root.style.setProperty("--fc-accent", uiAccent);
    root.style.setProperty("--fc-accent-hov", uiAccent);
    root.style.setProperty("--fc-accent-rgb", cssRgb(accentRgb));
    root.style.setProperty("--glass-border", `rgba(${cssRgb(accentRgb)},.30)`);
    root.style.setProperty(
      "--glass-shadow-focus",
      `0 24px 72px rgba(0,0,0,.34),0 0 0 1px rgba(${cssRgb(accentRgb)},.13),0 0 42px rgba(${cssRgb(accentRgb)},.075),inset 0 1px 0 rgba(255,255,255,.20)`
    );

    // homeIconColor
    const homeIconRgb = hexToRgb(homeIcon);
    root.style.setProperty("--home-icon-color", homeIcon);
    root.style.setProperty("--home-icon-rgb", cssRgb(homeIconRgb));

    // visualIconColor
    const visualIconRgb = hexToRgb(visualIcon);
    root.style.setProperty("--visual-icon-color", visualIcon);
    root.style.setProperty("--visual-icon-rgb", cssRgb(visualIconRgb));

    // homeAccentColor
    const homeAccentRgb = hexToRgb(homeAccent);
    root.style.setProperty("--home-accent", homeAccent);
    root.style.setProperty("--home-accent-rgb", cssRgb(homeAccentRgb));

    // visualTintColor
    root.style.setProperty("--visual-tint", visualTint);
  });
}
