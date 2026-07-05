// @ts-nocheck
import { Component } from "solid-js";
import { useActionStore } from "../../stores/actionStore";

const ThumbWrap: Component = () => (
  <div id="thumb-wrap">
    <img id="thumb-cover" src="" alt="" />
    <div id="thumb-info">
      <div id="thumb-title" onClick={() => useActionStore.getState().openTrackDetail('song')} title="歌曲详情"></div>
      <div id="thumb-artist" onClick={() => useActionStore.getState().openTrackDetail('artist')} title="歌手详情"></div>
    </div>
  </div>
);

export default ThumbWrap;
