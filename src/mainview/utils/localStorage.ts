// Generic localStorage hook for SolidJS stores
// Replaces readBooleanPreference, readSavedVolume, readDiyModePreference, etc.

export function useLocalStorage<T>(
  key: string,
  fallback: T,
  parse: (raw: string) => T = JSON.parse as (raw: string) => T,
  serialize: (val: T) => string = JSON.stringify,
): [() => T, (val: T) => void] {
  const getValue = () => {
    try {
      const raw = localStorage.getItem(key);
      if (raw != null) return parse(raw);
    } catch { /* ignore */ }
    return fallback;
  };

  const setValue = (val: T) => {
    try {
      localStorage.setItem(key, serialize(val));
    } catch { /* ignore */ }
  };

  return [getValue, setValue];
}

export function getBooleanPreference(key: string, fallback: boolean): boolean {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return !!fallback;
    return raw === '1';
  } catch { return !!fallback; }
}

export function setBooleanPreference(key: string, on: boolean): void {
  try { localStorage.setItem(key, on ? '1' : '0'); } catch { /* ignore */ }
}

export function getSavedVolume(): number {
  try {
    const v = parseFloat(localStorage.getItem('apex-player-volume') || '');
    return isFinite(v) ? Math.max(0, Math.min(1, v)) : 1.0;
  } catch { return 1.0; }
}

export function clampRange(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

export function clamp01(val: number): number {
  return Math.max(0, Math.min(1, val));
}

export function isFiniteNumber(val: unknown): val is number {
  return typeof val === 'number' && isFinite(val);
}
