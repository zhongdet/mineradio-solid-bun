// @ts-nocheck
const UI_HIT_SELECTOR = "#top-right, #search-area, #bottom-bar, #fx-panel, #playlist-panel, #fx-fab, #bottom-handle, #empty-home, .modal-overlay, .modal-content, button, a, input, select, textarea";

export function isPointerOverUi(e: MouseEvent | TouchEvent | null): boolean {
  if (!e) return false;
  const clientX = (e as MouseEvent).clientX ?? (e as TouchEvent).touches?.[0]?.clientX ?? 0;
  const clientY = (e as MouseEvent).clientY ?? (e as TouchEvent).touches?.[0]?.clientY ?? 0;
  const el = document.elementFromPoint(clientX, clientY);
  return !!(el && el.closest && el.closest(UI_HIT_SELECTOR));
}

export function updateUserCapsuleAutoHideFromPointer(x: number, y: number) {
  const settings = (window as any).__settingsStore;
  const userCapsuleAutoHide = settings?.state?.userCapsuleAutoHide ?? false;
  const immersiveMode = settings?.state?.immersiveMode ?? false;
  if (!userCapsuleAutoHide || immersiveMode) {
    document.body.classList.remove("user-capsule-peek");
    return;
  }
  const nearTopRight = x > window.innerWidth - 112 && y < 126;
  document.body.classList.toggle("user-capsule-peek", nearTopRight);
}

const focusHover = {
  wantType: null as string | null,
  pendingTimer: null as ReturnType<typeof setTimeout> | null,
  exitTimer: null as ReturnType<typeof setTimeout> | null,
};

export function setFocusZone(type: string | null, immediate?: boolean) {
  if (type && !/^shelf-/.test(type)) {
    type = null;
  }
  if (focusHover.wantType === type) return;
  focusHover.wantType = type;
  if (focusHover.pendingTimer) { clearTimeout(focusHover.pendingTimer); focusHover.pendingTimer = null; }
  if (focusHover.exitTimer) { clearTimeout(focusHover.exitTimer); focusHover.exitTimer = null; }
  if (!type) {
    const exitDelay = 170;
    focusHover.exitTimer = setTimeout(() => {
      focusHover.exitTimer = null;
      if (!focusHover.wantType) {
        // orbit.focus.active = false;
      }
    }, exitDelay);
    return;
  }
  if (immediate) {
    activateFocusZone(type);
    return;
  }
  focusHover.pendingTimer = setTimeout(() => {
    focusHover.pendingTimer = null;
    if (focusHover.wantType !== type) return;
    activateFocusZone(type);
  }, 260);
}

function activateFocusZone(type: string) {
  // Placeholder — orbit camera focus integration
}
