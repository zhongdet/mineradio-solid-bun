// @ts-nocheck
import { Component } from "solid-js";

const Background: Component = () => (
  <>
    <div id="custom-bg"><video id="custom-bg-video" muted loop playsinline preload="metadata"></video></div>
    <div id="album-bg"></div>
    <div id="canvas-container"></div>
  </>
);

export default Background;
