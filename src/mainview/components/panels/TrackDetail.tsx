// @ts-nocheck
import { Component, createSignal, createEffect, onCleanup, Show } from "solid-js";
import { proxyImageUrl, rpc, qqApi } from "../../lib/api";
import { usePlayback } from "../../stores/playbackStore";
import { useUser } from "../../stores/userStore";
import { useActionStore } from "../../stores/actionStore";

declare const gsap: any;

interface TrackDetailProps {
  type: "song" | "artist";
  onClose: () => void;
}

function escHtml(s: string): string {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function songDurationLabel(song: any): string {
  if (!song || !song.duration) return "";
  const d = Number(song.duration);
  if (!isFinite(d) || d <= 0) return "";
  const m = Math.floor(d / 60);
  const sec = Math.floor(d % 60);
  return m + ":" + (sec < 10 ? "0" : "") + sec;
}

function songSourceLabel(song: any): string {
  if (!song) return "未知";
  const t = String(song.type || "").toLowerCase();
  if (t === "qq" || t === "tencent") return "QQ 音乐";
  if (t === "podcast" || t === "dj") return "播客";
  if (t === "local") return "本地文件";
  return "网易云音乐";
}

function songCoverSrc(song: any, size = 180): string {
  if (!song) return "";
  const raw = song.cover || song.albumPicUrl || song.al?.picUrl || "";
  if (!raw) return "";
  return proxyImageUrl(raw + (raw.includes("?") ? "" : `?param=${size}y${size}`));
}

function isCloudSong(song: any): boolean {
  if (!song) return false;
  const t = String(song.type || "").toLowerCase();
  return t !== "qq" && t !== "tencent" && t !== "podcast" && t !== "dj" && t !== "local";
}

function isQQSong(song: any): boolean {
  const t = String(song.type || "").toLowerCase();
  return t === "qq" || t === "tencent";
}

function songProviderKey(song: any): string {
  if (isQQSong(song)) return "qq";
  return "netease";
}

function artistNames(song: any): string[] {
  const text = String(song?.artist || "").trim();
  if (!text) return [];
  return text.split(/\s*\/\s*|\s*,\s*|、/).map((s) => s.trim()).filter(Boolean);
}

function currentArtistId(song: any): string {
  if (!song || !isCloudSong(song)) return "";
  if (song.artistId) return String(song.artistId);
  const artists = song.artists || [];
  for (const a of artists) {
    if (a?.id) return String(a.id);
  }
  return "";
}

function currentQQArtistMid(song: any): string {
  if (!song || !isQQSong(song)) return "";
  if (song.artistMid) return String(song.artistMid);
  if (song.singerMid) return String(song.singerMid);
  if (song.artistId && !/^\d+$/.test(String(song.artistId))) return String(song.artistId);
  const artists = song.artists || [];
  for (const a of artists) {
    if (a?.mid) return String(a.mid);
    if (a?.id && !/^\d+$/.test(String(a.id))) return String(a.id);
  }
  return "";
}

function normalizeName(name: string): string {
  return String(name || "").toLowerCase().replace(/[\s·・,，、/\\|&＋+_-]+/g, "").replace(/[()（）\[\]【】"'""'']/g, "");
}

function nameMatches(expected: string[], actual: string): boolean {
  const a = normalizeName(actual);
  if (!a) return false;
  return expected.some((n) => {
    const e = normalizeName(n);
    return e && (e === a || e.indexOf(a) >= 0 || a.indexOf(e) >= 0);
  });
}

function commentTimeLabel(ms: number): string {
  if (!ms) return "";
  try {
    return new Date(ms).toLocaleDateString("zh-CN", { month: "short", day: "numeric" });
  } catch { return ""; }
}

const TrackDetail: Component<TrackDetailProps> = (props) => {
  const playback = usePlayback();
  const user = useUser();
  const [artistSongs, setArtistSongs] = createSignal<any[]>([]);
  const [artistData, setArtistData] = createSignal<any>(null);
  const [comments, setComments] = createSignal<any[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [commentsLoading, setCommentsLoading] = createSignal(false);
  let seq = 0;
  let maskRef: HTMLDivElement | undefined;

  const song = () => playback.state.currentSong;

  function detailRow(label: string, value: any) {
    const v = value == null || value === "" ? "未知" : value;
    return `<div class="detail-k">${escHtml(label)}</div><div class="detail-v">${escHtml(String(v))}</div>`;
  }

  createEffect(() => {
    const s = song();
    if (!s) return;
    const mySeq = ++seq;
    setLoading(true);
    setArtistSongs([]);
    setArtistData(null);
    setComments([]);

    if (props.type === "artist") {
      const artistId = currentArtistId(s);
      const qqMid = currentQQArtistMid(s);
      const names = artistNames(s);
      const artistName = names.join(" / ") || s.artist || "未知歌手";

      // Fetch artist detail
      const fetchDetail = async () => {
        try {
          let data: any;
          if (artistId) {
            data = await rpc<any>("artist_detail", { id: artistId, limit: 36 });
          } else if (qqMid) {
            data = await qqApi.artistDetail(qqMid, 36);
          }
          if (mySeq !== seq) return;
          if (data?.artist?.name && names.length && !nameMatches(names, data.artist.name)) {
            setArtistData({ error: true });
            return;
          }
          setArtistData(data);
          setArtistSongs(data?.songs || []);
        } catch {
          if (mySeq === seq) setArtistData({ error: true });
        } finally {
          if (mySeq === seq) setLoading(false);
        }
      };
      fetchDetail();
    } else {
      // Song mode — load comments
      const canLoad = isCloudSong(s) || isQQSong(s);
      if (!canLoad) {
        setLoading(false);
        return;
      }
      setCommentsLoading(true);
      const fetchComments = async () => {
        try {
          let data: any;
          if (isQQSong(s)) {
            const qqId = s.qqId || "";
            const mid = s.mid || s.songmid || s.id || "";
            const res = await fetch(`/api/qq/song/comments?id=${encodeURIComponent(qqId)}&mid=${encodeURIComponent(mid)}&limit=18`);
            data = await res.json();
          } else {
            data = await rpc<any>("comment_music", { id: String(s.id), limit: 18 });
          }
          if (mySeq !== seq) return;
          setComments(data?.comments || []);
        } catch {
          // ignore
        } finally {
          if (mySeq === seq) {
            setCommentsLoading(false);
            setLoading(false);
          }
        }
      };
      fetchComments();
    }
  });

  function close() {
    props.onClose();
  }

  function backdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) close();
  }

  function playArtistSong(i: number) {
    const songs = artistSongs();
    const s = songs[i];
    if (!s) return;
    // Replace queue and play
    playback.set("playQueue", [...songs.map((x: any) => ({ ...x }))]);
    playback.setCurrentIdx(i);
    close();
    // Trigger play via action store
    useActionStore.getState().togglePlay();
  }

  function collectArtistSong(i: number) {
    const s = artistSongs()[i];
    if (!s) return;
    useActionStore.getState().collectSong(s);
  }

  function queueArtistSongNext(i: number) {
    const s = artistSongs()[i];
    if (!s) return;
    playback.addToQueue({ ...s });
    // Toast via showToast
    const toast = document.getElementById("toast");
    if (toast) {
      toast.textContent = "已设为下一首: " + (s.name || "");
      toast.classList.add("show");
      setTimeout(() => toast.classList.remove("show"), 2600);
    }
  }

  const isSongMode = () => props.type === "song";
  const isArtistMode = () => props.type === "artist";
  const s = () => song();
  const names = () => artistNames(s());

  return (
    <div id="track-detail-modal" class="modal-mask" ref={maskRef} onClick={backdropClick}>
      <div class="modal track-detail-modal" onClick={(e) => e.stopPropagation()}>
        <h2>{isArtistMode() ? "歌手详情" : "歌曲详情"}</h2>
        <div id="track-detail-body" style={{ "min-height": "0", "overflow": "auto" }}>
          <Show when={s()}>
            {/* Hero */}
            <div class="detail-hero">
              <Show when={isSongMode()}>
                <img class="detail-cover" src={songCoverSrc(s(), 180)} alt="" />
              </Show>
              <Show when={isArtistMode()}>
                <Show
                  when={artistData()?.artist?.avatar}
                  fallback={
                    <div class="detail-cover detail-artist-avatar">
                      {names().length ? names()[0].charAt(0) : "歌"}
                    </div>
                  }
                >
                  <div
                    class="detail-cover detail-artist-avatar"
                    style={{ "background-image": `url("${proxyImageUrl(artistData()!.artist.avatar)}")`, "background-size": "cover", "background-position": "center" }}
                  ></div>
                </Show>
              </Show>
              <div style={{ "min-width": "0", "flex": "1" }}>
                <div class="detail-title">
                  {isArtistMode() ? (artistData()?.artist?.name || names().join(" / ") || s()!.artist || "未知歌手") : (s()!.name || "当前歌曲")}
                </div>
                <div class="detail-sub">
                  {isArtistMode() ? ("来自当前播放 · " + (s()!.name || "")) : (s()!.artist || (s()!.type === "local" ? "本地文件" : "未知歌手"))}
                </div>
              </div>
            </div>

            {/* Grid */}
            <div class="detail-grid">
              {isSongMode() ? (
                <>
                  <div innerHTML={detailRow("歌曲名", s()!.name)} />
                  <div innerHTML={detailRow("歌手", s()!.artist || "未知歌手")} />
                  <div innerHTML={detailRow("专辑", s()!.album || (s()!.type === "podcast" ? (s()!.radioName || "Podcast") : "未知"))} />
                  <div innerHTML={detailRow("时长", songDurationLabel(s()))} />
                  <div innerHTML={detailRow("来源", songSourceLabel(s()))} />
                  <div innerHTML={detailRow("歌词源", "原词")} />
                </>
              ) : (
                <>
                  <div innerHTML={detailRow("当前歌曲", s()!.name)} />
                  <div innerHTML={detailRow("关联歌手", names().join(" / ") || s()!.artist || "未知歌手")} />
                  <div innerHTML={detailRow("所属专辑", s()!.album || (s()!.type === "podcast" ? (s()!.radioName || "Podcast") : "未知"))} />
                  <div innerHTML={detailRow("来源", songSourceLabel(s()))} />
                </>
              )}
            </div>

            {/* Chips */}
            <div class="detail-chip-row">
              {isArtistMode() ? (
                names().length ? names().map((n) => <span class="detail-chip">{n}</span>) : <span class="detail-chip">未知歌手</span>
              ) : (
                <>
                  <span class="detail-chip">{songSourceLabel(s())}</span>
                  {user.state.likedSongMap[String(s()!.id || s()!.mid)] && <span class="detail-chip">红心喜欢</span>}
                </>
              )}
            </div>

            {/* Section: Comments or Artist Hot Songs */}
            <div class="detail-section">
              <div class="detail-section-head">
                <div class="detail-section-title">
                  {isArtistMode() ? "热门歌曲" : (isQQSong(s()) ? "QQ 音乐评论" : "网易云评论")}
                </div>
              </div>

              {isArtistMode() ? (
                <div>
                  {loading() ? (
                    <div class="detail-loading">正在载入歌手主页...</div>
                  ) : artistData()?.error ? (
                    <div class="detail-empty">歌手主页加载失败</div>
                  ) : artistSongs().length === 0 ? (
                    <div class="detail-empty">暂无热门歌曲</div>
                  ) : (
                    <div class="detail-scroll">
                      {artistSongs().map((as: any, i: number) => (
                        <div class="artist-song-item" onClick={() => playArtistSong(i)}>
                          <div class="artist-song-rank">{String(i + 1).padStart(2, "0")}</div>
                          <img
                            class="artist-song-cover"
                            src={songCoverSrc(as, 80)}
                            alt=""
                            onerror={(e) => (e.currentTarget.style.opacity = "0.18")}
                          />
                          <div class="artist-song-main">
                            <div class="artist-song-name">{as.name || ""}</div>
                            <div class="artist-song-meta">
                              {(as.album || "未知专辑") + (as.duration ? (" · " + songDurationLabel(as)) : "")}
                            </div>
                          </div>
                          <div class="artist-song-actions">
                            <button
                              class="artist-song-action collect"
                              type="button"
                              title="收藏到歌单"
                              aria-label="收藏到歌单"
                              onClick={(e) => { e.stopPropagation(); collectArtistSong(i); }}
                            >
                              <svg fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24" aria-hidden="true">
                                <path d="M12 5v9" /><path d="M7.5 9.5h9" /><path d="M4.5 12.5v6h15v-6" />
                              </svg>
                            </button>
                            <button
                              class="artist-song-action next"
                              type="button"
                              title="下一首播放"
                              aria-label="下一首播放"
                              onClick={(e) => { e.stopPropagation(); queueArtistSongNext(i); }}
                            >
                              <svg fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" viewBox="0 0 24 24" aria-hidden="true">
                                <path d="M12 5.5v13" /><path d="M5.5 12h13" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  {commentsLoading() ? (
                    <div class="detail-loading">正在载入评论...</div>
                  ) : comments().length === 0 ? (
                    <div class="detail-empty">暂无评论</div>
                  ) : (
                    <div class="detail-scroll">
                      {comments().map((c: any) => {
                        const user = c.user || {};
                        const avatar = user.avatar ? proxyImageUrl(user.avatar) : "";
                        return (
                          <div class="comment-item">
                            {avatar
                              ? <img class="comment-avatar" src={avatar} alt="" />
                              : <div class="comment-avatar"></div>
                            }
                            <div class="comment-main">
                              <div class="comment-meta">
                                {user.nickname || "音乐用户"}
                                {c.likedCount ? (" · " + c.likedCount + " 赞") : ""}
                                {c.time ? (" · " + commentTimeLabel(c.time)) : ""}
                              </div>
                              <div class="comment-text">{c.content || ""}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </Show>
        </div>
        <div class="btn-row">
          <button class="modal-btn" onClick={close}>关闭</button>
        </div>
      </div>
    </div>
  );
};

export default TrackDetail;
