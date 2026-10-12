/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo } from 'react';
import { useStored } from '../lib/localStore';

const ReaderContext = createContext(null);
const NONE = [];
export const DEFAULT_PREFS = { size: 1, leading: 1.75 };
export const SIZES = [0.9, 1, 1.15, 1.3, 1.5];
export const LEADINGS = [[1.5, 'Compact'], [1.75, 'Comfortable'], [2, 'Relaxed']];

// Reading comfort settings, reading history and the "listen later" queue. All stay on this device.
export function ReaderProvider({ children }) {
  const [prefs, setPrefs] = useStored('news-reader-prefs', DEFAULT_PREFS);
  const [history, setHistory] = useStored('news-history', NONE);
  const [queue, setQueue] = useStored('news-listen-queue', NONE);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--prose-size', `${(prefs.size || 1) * 1.1}rem`);
    root.style.setProperty('--prose-leading', String(prefs.leading || 1.75));
  }, [prefs]);

  const addHistory = useCallback((a) => {
    setHistory((list) => [{ id: a._id, slug: a.slug, title: a.title, at: new Date().toISOString() }, ...list.filter((x) => x.id !== a._id)].slice(0, 50));
  }, [setHistory]);
  const toggleQueue = useCallback((a) => {
    setQueue((list) => (list.some((x) => x.id === a._id) ? list.filter((x) => x.id !== a._id) : [...list, { id: a._id, slug: a.slug, title: a.title, text: `${a.title}. ${a.summary}. ${a.description || ''}` }]));
  }, [setQueue]);

  const value = useMemo(() => ({
    prefs, setPrefs: (p) => setPrefs({ ...prefs, ...p }), resetPrefs: () => setPrefs(DEFAULT_PREFS),
    history, addHistory, clearHistory: () => setHistory([]),
    queue, toggleQueue, inQueue: (id) => queue.some((x) => x.id === id), removeFromQueue: (id) => setQueue((l) => l.filter((x) => x.id !== id)), clearQueue: () => setQueue([]),
  }), [prefs, setPrefs, history, addHistory, setHistory, queue, toggleQueue, setQueue]);
  return <ReaderContext.Provider value={value}>{children}</ReaderContext.Provider>;
}

export const useReader = () => useContext(ReaderContext);
