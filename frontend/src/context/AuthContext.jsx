/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import API, { authHeaders } from '../config/API';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  // `loaded` is the token the current profile was resolved for, so no loading flag is set in effects
  const [session, setSession] = useState({ for: null, user: null });

  useEffect(() => {
    if (!token) return undefined;
    let cancelled = false;
    API.get('/user/profile/user', { headers: { authorization: token } })
      .then((res) => { if (!cancelled) setSession({ for: token, user: res.data }); })
      .catch(() => {
        if (cancelled) return;
        localStorage.removeItem('token');
        setToken(null);
      });
    return () => { cancelled = true; };
  }, [token]);

  const login = useCallback(async (email, password) => {
    const res = await API.post('/login', { email, password });
    localStorage.setItem('token', res.data.token);
    setToken(res.data.token);
    return res.data.token;
  }, []);

  const logout = useCallback(async () => {
    try {
      await API.post('/logout', null, { headers: authHeaders() });
    } catch {
      // the token is dropped locally either way
    }
    localStorage.removeItem('token');
    setToken(null);
    setSession({ for: null, user: null });
  }, []);

  const refresh = useCallback(async () => {
    const res = await API.get('/user/profile/user', { headers: authHeaders() });
    setSession({ for: localStorage.getItem('token'), user: res.data });
  }, []);

  const user = token && session.for === token ? session.user : null;
  const value = useMemo(() => ({
    token,
    user,
    loading: !!token && !user,
    isAdmin: !!user && user.role === 'admin',
    login, logout, refresh,
  }), [token, user, login, logout, refresh]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
