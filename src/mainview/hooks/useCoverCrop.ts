export function useCoverCrop() {

  let cropState: {
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
    width: number;
    height: number;
    active: boolean;
  } | null = null;

  function beginCrop(image: HTMLImageElement | null) {
    if (!image) return;
    cropState = {
      startX: 0,
      startY: 0,
      currentX: 0,
      currentY: 0,
      width: 1,
      height: 1,
      active: true,
    };
  }

  function updateCropFromPointer(x: number, y: number) {
    if (!cropState || !cropState.active) return;
    cropState.currentX = x;
    cropState.currentY = y;
  }

  function endCrop() {
    if (!cropState) return;
    cropState.active = false;
    // Generate crop data URL from the selected region
    // This would be implemented with canvas
  }

  function clearCrop() {
    cropState = null;
  }

  return {
    beginCrop,
    updateCropFromPointer,
    endCrop,
    clearCrop,
    getCropState: () => cropState,
  };
}

export type CoverCropHook = ReturnType<typeof useCoverCrop>;
