// @ts-nocheck
import { Component } from "solid-js";

export const Background: Component = () => (
  <>
    <div id="custom-bg"><video id="custom-bg-video" muted loop playsinline preload="metadata"></video></div>
    <div id="album-bg"></div>
    <div id="canvas-container"></div>
  </>
);
