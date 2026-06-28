// @ts-nocheck
import { Component } from "solid-js";

export const ThumbWrap: Component = () => (
  <div id="thumb-wrap">
    <img id="thumb-cover" src="" alt="" />
    <div id="thumb-info">
      <div id="thumb-title" onclick="openTrackDetailModal('song')" title="歌曲详情"></div>
      <div id="thumb-artist" onclick="openTrackDetailModal('artist')" title="歌手详情"></div>
    </div>
  </div>
);
