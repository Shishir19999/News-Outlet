/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import API from '../config/API';
import { subscribe } from '../lib/realtime';
import { SITE_NAME } from '../config/env';

const DEFAULTS = {
  siteName: SITE_NAME, tagline: '', commentsOpen: true, newsletterEnabled: true, registrationOpen: true,
  alert: { active: false, text: '', link: '', level: 'breaking' },
};
const SettingsContext = createContext({ settings: DEFAULTS, reload: () => {} });

// Site settings and the alert banner. The banner changes live when an editor updates it.
export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(DEFAULTS);
  const reload = useCallback(() => API.get('/settings').then((r) => setSettings({ ...DEFAULTS, ...r.data })).catch(() => {}), []);
  useEffect(() => { reload(); }, [reload]);
  useEffect(() => subscribe('alert', (alert) => setSettings((s) => ({ ...s, alert }))), []);
  const value = useMemo(() => ({ settings, reload }), [settings, reload]);
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export const useSettings = () => useContext(SettingsContext);
