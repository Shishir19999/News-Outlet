/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import API, { authHeaders } from '../config/API';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';

const KEY = 'news-bookmarks';
const BookmarksContext = createContext(null);

const readLocal = () => {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
};

// "Read later": signed-in readers keep the list on the server, guests keep it in this browser.
export function BookmarksProvider({ children }) {
  const { token } = useAuth();
  const toast = useToast();
  const [local, setLocal] = useState(readLocal);
  const [remote, setRemote] = useState({ for: null, ids: [] });

  useEffect(() => {
    if (!token) return undefined;
    let cancelled = false;
    API.get('/bookmarks', { headers: { authorization: token } })
      .then((res) => { if (!cancelled) setRemote({ for: token, ids: res.data.ids }); })
      .catch(() => { if (!cancelled) setRemote({ for: token, ids: [] }); });
    return () => { cancelled = true; };
  }, [token]);

  const serverMode = !!token;
  const ids = useMemo(() => (serverMode ? (remote.for === token ? remote.ids : []) : local), [serverMode, remote, token, local]);
  const has = useCallback((id) => ids.includes(id), [ids]);

  const toggle = useCallback(async (id) => {
    const present = ids.includes(id);
    const next = present ? ids.filter((x) => x !== id) : [id, ...ids];
    if (serverMode) {
      setRemote({ for: token, ids: next });
      try {
        if (present) await API.delete(`/bookmarks/${id}`, { headers: authHeaders() });
        else await API.put(`/bookmarks/${id}`, null, { headers: authHeaders() });
      } catch {
        setRemote({ for: token, ids });
        toast.error('Could not update your reading list. Please try again.');
        return;
      }
    } else {
      setLocal(next);
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        // keep the in-memory list
      }
    }
    toast.success(present ? 'Removed from your reading list' : 'Saved to your reading list');
  }, [ids, serverMode, token, toast]);

  const value = useMemo(() => ({ ids, has, toggle, count: ids.length }), [ids, has, toggle]);
  return <BookmarksContext.Provider value={value}>{children}</BookmarksContext.Provider>;
}

export const useBookmarks = () => useContext(BookmarksContext);
