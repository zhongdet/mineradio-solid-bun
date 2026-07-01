import { createStore } from "solid-js/store";

export interface RenderPerfState {
  mode: string;
  fps: number;
  skipped: number;
  longFrames: number;
  lastRenderAt: number;
}

export interface RuntimePerfState {
  lastCacheTrimAt: number;
  cacheTrimCount: number;
  lastCacheTrimReason: string;
  lastHeapSampleAt: number;
  heapMB: number;
  cacheCounts: Record<string, number>;
}

export interface UiStore {
  // Mini queue
  miniQueueOpen: boolean;
  miniQueueRenderSeq: number;
  queueRenderSeq: number;
  playlistRenderSeq: number;
  queuePanelDirty: boolean;

  // Playlist panel
  playlistPanelRenderLimit: number;
  playlistPanelLazyBound: boolean;

  // Cover crop
  coverCropState: any;
  coverCropBound: boolean;

  // Upload tip
  uploadTipVisible: boolean;
  uploadTipAttempts: number;

  // Visual guide
  visualGuideActive: boolean;
  visualGuideStep: number;
  visualGuideResizeBound: boolean;
  visualGuideState: { bottomWasVisible: boolean; searchWasPeek: boolean; fxWasPeek: boolean; plWasPeek: boolean; manual: boolean };

  // Cursor
  cursorVisible: boolean;

  // Overlay states
  immersiveMode: boolean;
  fxPanelShow: boolean;
  fxPanelPeek: boolean;

  // Desktop runtime
  desktopRuntimeState: {
    desktop: boolean;
    minimized: boolean;
    visible: boolean;
    focused: boolean;
    fullscreen: boolean;
  };

  // Performance
  renderPerfState: RenderPerfState;
  runtimePerfState: RuntimePerfState;
  coverDepthCache: Record<string, any>;
  coverDepthCacheKeys: string[];
  aiDepthPipeline: any;
  aiDepthReady: boolean;
  aiDepthBusy: boolean;
  aiDepthFailUntil: number;
  aiDepthLastRunAt: number;

  // Ripples
  ripples: any[];
}

const defaultRenderPerf: RenderPerfState = {
  mode: '',
  fps: 0,
  skipped: 0,
  longFrames: 0,
  lastRenderAt: 0,
};

const defaultRuntimePerf: RuntimePerfState = {
  lastCacheTrimAt: 0,
  cacheTrimCount: 0,
  lastCacheTrimReason: '',
  lastHeapSampleAt: 0,
  heapMB: 0,
  cacheCounts: {},
};

const [ui, setUi] = createStore<UiStore>({
  miniQueueOpen: false,
  miniQueueRenderSeq: 0,
  queueRenderSeq: 0,
  playlistRenderSeq: 0,
  queuePanelDirty: false,
  playlistPanelRenderLimit: 28,
  playlistPanelLazyBound: false,
  coverCropState: null,
  coverCropBound: false,
  uploadTipVisible: false,
  uploadTipAttempts: 0,
  visualGuideActive: false,
  visualGuideStep: 0,
  visualGuideResizeBound: false,
  visualGuideState: { bottomWasVisible: false, searchWasPeek: false, fxWasPeek: false, plWasPeek: false, manual: false },
  cursorVisible: true,
  immersiveMode: false,
  fxPanelShow: false,
  fxPanelPeek: false,
  desktopRuntimeState: {
    desktop: !!(window as any).desktopWindow,
    minimized: false,
    visible: true,
    focused: true,
    fullscreen: false,
  },
  renderPerfState: defaultRenderPerf,
  runtimePerfState: defaultRuntimePerf,
  coverDepthCache: Object.create(null),
  coverDepthCacheKeys: [],
  aiDepthPipeline: null,
  aiDepthReady: false,
  aiDepthBusy: false,
  aiDepthFailUntil: 0,
  aiDepthLastRunAt: 0,
  ripples: [],
});

export function useUi() {
  return {
    state: ui,
    set: (key: keyof UiStore, value: any) => {
      setUi(key, value);
    },
    triggerRipple: (x: number, y: number, strength: number) => {
      const newRipple = {
        x, y, strength,
        start: performance.now(),
        duration: 600,
        channels: new Array(12).fill(0),
      };
      setUi("ripples", [...ui.ripples, newRipple]);
      // Auto-remove after duration
      setTimeout(() => {
        setUi("ripples", ui.ripples.filter(r => r !== newRipple));
      }, 600);
    },
    triggerRippleChannel: (channel: number, value: number) => {
      if (ui.ripples.length > 0) {
        const lastRipple = ui.ripples[ui.ripples.length - 1];
        if (lastRipple.channels[channel] !== undefined) {
          lastRipple.channels[channel] = Math.max(lastRipple.channels[channel] || 0, value);
        }
      }
    },
    showUploadTip: () => {
      setUi("uploadTipVisible", true);
      setUi("uploadTipAttempts", 0);
    },
    closeUploadTip: (_permanent?: boolean) => {
      setUi("uploadTipVisible", false);
    },
    setVisualGuideActive: (active: boolean) => {
      setUi("visualGuideActive", active);
    },
    setVisualGuideStep: (step: number) => {
      setUi("visualGuideStep", step);
    },
    setRenderPerfState: (state: Partial<RenderPerfState>) => {
      setUi("renderPerfState", { ...ui.renderPerfState, ...state });
    },
    trimCaches: (_reason?: string, aggressive?: boolean) => {
      // Trim cover cache
      const coverKeys = Object.keys(ui.coverDepthCache);
      const keep = aggressive ? 4 : 10;
      if (coverKeys.length > keep) {
        const drop = coverKeys.length - keep;
        for (let i = 0; i < drop; i++) {
          delete ui.coverDepthCache[coverKeys[i]];
        }
      }
    },
  };
}

export type UiStoreType = typeof ui;
