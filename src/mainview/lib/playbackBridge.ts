// @ts-nocheck
/**
 * Global playback bridge — allows non-hook code (home actions, legacy integrations)
 * to call playQueueAt without being inside a SolidJS hook.
 */
let _playQueueAt: ((idx: number, opts?: any) => Promise<void>) | null = null;
let _forcePlaybackControlsInteractive: (() => void) | null = null;

export function registerPlaybackBridge(fns: {
  playQueueAt: (idx: number, opts?: any) => Promise<void>;
  forcePlaybackControlsInteractive?: () => void;
}) {
  _playQueueAt = fns.playQueueAt;
  if (fns.forcePlaybackControlsInteractive) _forcePlaybackControlsInteractive = fns.forcePlaybackControlsInteractive;
}

export function getPlayQueueAt() {
  return _playQueueAt;
}

export function getForcePlaybackControlsInteractive() {
  return _forcePlaybackControlsInteractive;
}
