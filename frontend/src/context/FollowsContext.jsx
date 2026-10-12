/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import API, { authHeaders } from '../config/API';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';
import { useStored } from '../lib/localStore';

const FollowsContext = createContext(null);
const EMPTY = { topics: [], authors: [] };

// Topics (sections) and authors a reader follows. Guests keep them in this browser,
// signed-in readers on the server so they follow them to other devices.
export function FollowsProvider({ children }) {
  const { token, user } = useAuth();
  const toast = useToast();
  const [local, setLocal] = useStored('news-follows', EMPTY);
  const [remote, setRemote] = useState({ for: null, value: EMPTY });

  const serverMode = !!token && !!user;
  const fromUser = user ? { topics: (user.follows && user.follows.topics) || [], authors: (user.follows && user.follows.authors) || [] } : EMPTY;
  const value = serverMode ? (remote.for === user._id ? remote.value : fromUser) : local;

  const save = useCallback(async (next) => {
    if (serverMode) {
      const prev = remote;
      setRemote({ for: user._id, value: next });
      try {
        await API.put('/user/follows', next, { headers: authHeaders() });
      } catch {
        setRemote(prev);
        toast.error('Could not save what you follow. Please try again.');
      }
    } else {
      setLocal(next);
    }
  }, [serverMode, remote, user, setLocal, toast]);

  const toggle = useCallback((kind, id, label) => {
    const list = value[kind];
    const has = list.includes(id);
    save({ ...value, [kind]: has ? list.filter((x) => x !== id) : [...list, id] });
    toast.success(has ? `You no longer follow ${label}` : `Following ${label}`);
  }, [value, save, toast]);

  const api = useMemo(() => ({
    topics: value.topics, authors: value.authors,
    followsTopic: (id) => value.topics.includes(id),
    followsAuthor: (id) => value.authors.includes(id),
    toggleTopic: (id, label) => toggle('topics', id, label),
    toggleAuthor: (id, label) => toggle('authors', id, label),
    count: value.topics.length + value.authors.length,
  }), [value, toggle]);

  return <FollowsContext.Provider value={api}>{children}</FollowsContext.Provider>;
}

export const useFollows = () => useContext(FollowsContext);
