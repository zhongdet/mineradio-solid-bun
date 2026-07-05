// @ts-nocheck
import { Component, createSignal, createEffect, onCleanup, For } from "solid-js";

declare const gsap: any;

interface UpdateModalProps {
  onClose: () => void;
}

function formatBytes(bytes: number): string {
  bytes = Number(bytes) || 0;
  if (bytes >= 1024 * 1024 * 1024) return (bytes / (1024 * 1024 * 1024)).toFixed(2).replace(/\.00$/, "") + " GB";
  if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1).replace(/\.0$/, "") + " MB";
  if (bytes >= 1024) return Math.round(bytes / 1024) + " KB";
  return bytes + " B";
}

function formatSpeed(bps: number): string {
  return bps > 0 ? formatBytes(bps) + "/s" : "";
}

const UpdateModal: Component<UpdateModalProps> = (props) => {
  const [version, setVersion] = createSignal("1.0.0");
  const [hero, setHero] = createSignal("当前版本，更新检测已就绪。");
  const [notes, setNotes] = createSignal<string[]>(["更新检测已就绪"]);
  const [status, setStatus] = createSignal<"idle" | "downloading" | "ready" | "error">("idle");
  const [progress, setProgress] = createSignal(0);
  const [footnote, setFootnote] = createSignal("预览版只演示更新手感，不会真的下载安装。");
  const [configured, setConfigured] = createSignal(false);
  const [updateAvailable, setUpdateAvailable] = createSignal(false);
  const [downloadUrl, setDownloadUrl] = createSignal("");
  const [releaseUrl, setReleaseUrl] = createSignal("");
  let maskRef: HTMLDivElement | undefined;
  let downloadTimer: ReturnType<typeof setInterval> | null = null;

  createEffect(() => {
    checkLatestUpdate();
    animateOpen();
  });

  onCleanup(() => {
    if (downloadTimer) clearInterval(downloadTimer);
  });

  function animateOpen() {
    if (!maskRef || !window.gsap) return;
    const panel = maskRef.querySelector<HTMLElement>(".modal");
    maskRef.classList.add("show");
    window.gsap.set(maskRef, { display: "flex", visibility: "visible" });
    window.gsap.fromTo(maskRef,
      { autoAlpha: 0 },
      { autoAlpha: 1, duration: 0.38, ease: "power2.out", overwrite: true }
    );
    if (panel) {
      window.gsap.fromTo(panel,
        { autoAlpha: 0, y: 26, scale: 0.965, filter: "blur(12px)" },
        { autoAlpha: 1, y: 0, scale: 1, filter: "blur(0px)", duration: 0.68, ease: "expo.out", overwrite: true }
      );
    }
  }

  function animateClose() {
    if (!maskRef || !window.gsap) { props.onClose(); return; }
    const panel = maskRef.querySelector<HTMLElement>(".modal");
    if (panel) {
      window.gsap.to(panel, { autoAlpha: 0, y: 18, scale: 0.976, filter: "blur(8px)", duration: 0.28, ease: "power2.in", overwrite: true });
    }
    window.gsap.to(maskRef, {
      autoAlpha: 0,
      duration: 0.34,
      ease: "power2.inOut",
      overwrite: true,
      onComplete: () => {
        maskRef!.classList.remove("show");
        window.gsap.set(maskRef!, { clearProps: "display,visibility,opacity" });
        if (panel) window.gsap.set(panel, { clearProps: "opacity,visibility,transform,filter" });
        props.onClose();
      },
    });
  }

  async function checkLatestUpdate() {
    try {
      const res = await fetch("/api/update/latest?t=" + Date.now());
      const data = await res.json();
      const release = data.release || {};
      setVersion(data.latestVersion || release.version || data.currentVersion || "1.0.0");
      setConfigured(!!data.configured);
      setUpdateAvailable(!!data.updateAvailable);
      setHero(release.summary || (data.updateAvailable ? "发现新版本，建议更新。" : "当前版本，更新检测已就绪。"));
      setDownloadUrl(release.downloadUrl || "");
      setReleaseUrl(release.htmlUrl || "");
      if (Array.isArray(release.notes) && release.notes.length) {
        setNotes(release.notes.slice(0, 4));
      }
      if (!data.updateAvailable && !data.preview) {
        setFootnote("当前版本已是最新。");
      }
    } catch {
      setFootnote("更新检测失败，请稍后重试。");
    }
  }

  function handlePrimary() {
    if (status() === "downloading") return;

    if (configured() && updateAvailable() && downloadUrl()) {
      // Real download would happen here
      startPreviewDownload();
    } else if (status() === "ready") {
      // Preview mode — show toast
      showToast("正式接入后将重启并安装新版");
    } else {
      startPreviewDownload();
    }
  }

  function startPreviewDownload() {
    if (status() === "downloading") return;
    if (downloadTimer) clearInterval(downloadTimer);
    setStatus("downloading");
    setProgress(0);
    setFootnote("正在下载...");
    let p = 0;
    downloadTimer = setInterval(() => {
      p += 3.2 + Math.random() * 7.5;
      if (p >= 100) {
        if (downloadTimer) clearInterval(downloadTimer);
        downloadTimer = null;
        setStatus("ready");
        setProgress(100);
        setFootnote(configured() ? "安装包已准备好，点击按钮后再打开安装。" : "预览完成。");
        showToast("安装包已下载");
      } else {
        setProgress(p);
        setFootnote("正在下载... " + Math.round(p) + "%");
      }
    }, 260);
  }

  function handleBackdrop(e: MouseEvent) {
    if (e.target === e.currentTarget) animateClose();
  }

  const primaryLabel = () => {
    if (status() === "downloading") return "正在下载 " + Math.round(progress()) + "%";
    if (status() === "ready") return configured() ? "打开安装包" : "预览完成";
    if (status() === "error") return "重试下载";
    return (configured() && updateAvailable() && downloadUrl()) ? "下载完整安装包" : "立即更新";
  };

  return (
    <div id="update-modal" class="modal-mask" ref={maskRef} onClick={handleBackdrop}>
      <div class="modal update-modal" onClick={(e) => e.stopPropagation()}>
        <div class="update-panel-inner">
          <div class="update-panel-head">
            <div>
              <div class="update-kicker">MINERADIO</div>
              <div class="update-version">v{version()}</div>
            </div>
          </div>
          <div class="update-hero">
            <div class="update-hero-main">{hero()}</div>
          </div>
          <div class="update-list">
            <For each={notes()}>
              {(text, i) => (
                <div class="update-item">
                  <span class="update-item-dot" data-index={String(i() + 1).padStart(2, "0")}></span>
                  <div class="update-item-text">{text}</div>
                </div>
              )}
            </For>
          </div>
          <div class="update-actions">
            <button
              class="update-primary-btn"
              type="button"
              onClick={handlePrimary}
              disabled={status() === "downloading" && progress() >= 100}
            >
              <span
                class="update-btn-fill"
                style={{ width: progress() + "%" }}
              ></span>
              <span class="update-btn-label">{primaryLabel()}</span>
            </button>
            <button class="update-secondary-btn" type="button" onClick={animateClose}>
              取消
            </button>
          </div>
          <div class="update-footnote">{footnote()}</div>
        </div>
      </div>
    </div>
  );
};

function showToast(msg: string) {
  const t = document.getElementById("toast");
  if (!t) return;
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2600);
}

export default UpdateModal;
