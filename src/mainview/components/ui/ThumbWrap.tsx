// @ts-nocheck
import { Component } from "solid-js";

function openTrackDetailModal(type: string) {
  console.log("[ThumbWrap] openTrackDetailModal(" + type + ") - not yet implemented");
}

const ThumbWrap: Component = () => (
  <div id="thumb-wrap">
    <img id="thumb-cover" src="" alt="" />
    <div id="thumb-info">
      <div id="thumb-title" onClick={() => openTrackDetailModal('song')} title="歌曲详情"></div>
      <div id="thumb-artist" onClick={() => openTrackDetailModal('artist')} title="歌手详情"></div>
    </div>
  </div>
);

export default ThumbWrap;
