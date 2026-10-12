/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import API, { authHeaders } from '../config/API';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';
import { useStored } from '../lib/localStore';

const KEY = 'news-bookmarks';
const OFFLINE_KEY = 'news-offline-articles';
const MAX_OFFLINE = 40;
const BookmarksContext = createContext(null);
const NONE = [];
const NO_COPIES = {};

// "Read later": signed-in readers keep the list on the server, guests keep it in this browser.
// A copy of every saved article is kept on the device so saved stories can be read offline.
export function BookmarksProvider({ children }) {
  const { token } = useAuth();
  const toast = useToast();
  const [local, setLocal] = useStored(KEY, NONE);
  const [copies, setCopies] = useStored(OFFLINE_KEY, NO_COPIES);
  const [remote, setRemote] = useState({ for: null, ids: [] });

  useEffect(() => {
    if (!token) return undefined;
    let cancelled = false;
    API.get('/bookmarks', { headers: { authorization: token } })
      .then((res) => {
        if (cancelled) return;
        setRemote({ for: token, ids: res.data.ids });
        setCopies((c) => { const next = { ...c }; for (const a of res.data.news) next[a._id] = a; return trim(next); });
      })
      .catch(() => { if (!cancelled) setRemote({ for: token, ids: [] }); });
    return () => { cancelled = true; };
  }, [token, setCopies]);

  const serverMode = !!token;
  const ids = useMemo(() => (serverMode ? (remote.for === token ? remote.ids : NONE) : local), [serverMode, remote, token, local]);
  const has = useCallback((id) => ids.includes(id), [ids]);

  const toggle = useCallback(async (id, article) => {
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
    }
    if (!present && article) setCopies((c) => trim({ ...c, [id]: article }));
    if (present) setCopies((c) => { const { [id]: _gone, ...rest } = c; return rest; }); // eslint-disable-line no-unused-vars
    toast.success(present ? 'Removed from your reading list' : 'Saved to your reading list, also available offline');
  }, [ids, serverMode, token, toast, setLocal, setCopies]);

  const value = useMemo(() => ({ ids, has, toggle, count: ids.length, copies }), [ids, has, toggle, copies]);
  return <BookmarksContext.Provider value={value}>{children}</BookmarksContext.Provider>;
}

function trim(map) {
  const keys = Object.keys(map);
  if (keys.length <= MAX_OFFLINE) return map;
  return Object.fromEntries(keys.slice(keys.length - MAX_OFFLINE).map((k) => [k, map[k]]));
}

export const useBookmarks = () => useContext(BookmarksContext);
