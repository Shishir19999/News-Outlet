// Tiny localStorage-backed stores (per-reader conveniences that stay on this device).
import { useCallback, useSyncExternalStore } from 'react';

const listeners = new Set();
const cache = new Map(); // key -> { raw, value }

function read(key, fallback) {
  let raw = null;
  try { raw = localStorage.getItem(key); } catch { /* storage blocked */ }
  const hit = cache.get(key);
  if (hit && hit.raw === raw) return hit.value;
  let value = fallback;
  if (raw) {
    try { value = JSON.parse(raw); } catch { value = fallback; }
  }
  cache.set(key, { raw, value });
  return value;
}

export function readStored(key, fallback) {
  return read(key, fallback);
}

export function writeStored(key, value) {
  try {
    const raw = JSON.stringify(value);
    localStorage.setItem(key, raw);
    cache.set(key, { raw, value });
  } catch {
    // keep the in-memory copy even when storage is full or blocked
    cache.set(key, { raw: Symbol('memory'), value });
  }
  listeners.forEach((fn) => fn());
}

const subscribe = (fn) => {
  listeners.add(fn);
  const onStorage = (e) => { if (!e.key || cache.has(e.key)) { cache.delete(e.key); fn(); } };
  window.addEventListener('storage', onStorage);
  return () => { listeners.delete(fn); window.removeEventListener('storage', onStorage); };
};

// [value, setValue] that re-renders every component using the same key.
export function useStored(key, fallback) {
  const value = useSyncExternalStore(subscribe, () => read(key, fallback), () => fallback);
  const set = useCallback((next) => writeStored(key, typeof next === 'function' ? next(read(key, fallback)) : next), [key, fallback]);
  return [value, set];
}
