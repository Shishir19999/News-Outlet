import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import API from '../../config/API';
import { subscribe } from '../../lib/realtime';
import { useSettings } from '../../context/SettingsContext';
import { prefersReducedMotion } from '../../lib/motion';

// Editor-controlled alert bar. It can be dismissed for the session.
export function AlertBanner() {
  const { settings } = useSettings();
  const a = settings.alert;
  const key = `news-alert-${a.text}`;
  const [dismissed, setDismissed] = useState(() => {
    try { return sessionStorage.getItem(key) === '1'; } catch { return false; }
  });
  const [seenKey, setSeenKey] = useState(key);
  if (seenKey !== key) {
    setSeenKey(key);
    let d = false;
    try { d = sessionStorage.getItem(key) === '1'; } catch { /* ignore */ }
    setDismissed(d);
  }
  if (!a.active || !a.text || dismissed) return null;
  const close = () => { setDismissed(true); try { sessionStorage.setItem(key, '1'); } catch { /* ignore */ } };
  const external = /^https?:/.test(a.link);
  return (
    <div className={`alert-banner alert-${a.level}`} role="region" aria-label="Alert">
      <div className="container alert-row">
        <i className={`bi ${a.level === 'info' ? 'bi-info-circle-fill' : 'bi-exclamation-triangle-fill'}`} aria-hidden="true" />
        <p><strong>{a.level === 'info' ? 'Notice' : 'Alert'}:</strong> {a.text}{' '}
          {a.link && (external ? <a href={a.link} target="_blank" rel="noopener noreferrer">Read more</a> : <Link to={a.link.replace(/^#/, '')}>Read more</Link>)}
        </p>
        <button type="button" className="icon-btn" aria-label="Dismiss alert" onClick={close}><i className="bi bi-x-lg" aria-hidden="true" /></button>
      </div>
    </div>
  );
}

// Breaking-news ticker: one headline at a time with previous, next and pause controls.
export function BreakingTicker() {
  const [items, setItems] = useState([]);
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(() => prefersReducedMotion());
  const load = useCallback(() => API.get('/news/breaking').then((r) => setItems(r.data.news)).catch(() => {}), []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => subscribe('breaking', load), [load]);
  useEffect(() => {
    if (paused || items.length < 2) return undefined;
    const t = setInterval(() => setI((x) => x + 1), 6500);
    return () => clearInterval(t);
  }, [paused, items.length]);
  if (!items.length) return null;
  const cur = items[i % items.length];
  const step = (d) => setI((x) => (x + d + items.length * 100) % items.length);
  return (
    <section className="ticker" aria-label="Breaking news">
      <div className="container ticker-row">
        <span className="ticker-label"><span className="live-dot" aria-hidden="true" /> Breaking</span>
        <p className="ticker-item"><Link to={`/news-details/${cur.slug}`}>{cur.title}</Link></p>
        {items.length > 1 && (
          <span className="ticker-controls">
            <button type="button" className="icon-btn" aria-label="Previous headline" onClick={() => step(-1)}><i className="bi bi-chevron-left" aria-hidden="true" /></button>
            <button type="button" className="icon-btn" aria-label={paused ? 'Resume rotating headlines' : 'Pause rotating headlines'} aria-pressed={paused} onClick={() => setPaused((p) => !p)}><i className={`bi ${paused ? 'bi-play-fill' : 'bi-pause-fill'}`} aria-hidden="true" /></button>
            <button type="button" className="icon-btn" aria-label="Next headline" onClick={() => step(1)}><i className="bi bi-chevron-right" aria-hidden="true" /></button>
          </span>
        )}
      </div>
    </section>
  );
}

export function OfflineNotice() {
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  if (online) return null;
  return (
    <div className="offline-notice" role="status">
      <div className="container"><i className="bi bi-wifi-off" aria-hidden="true" /> You are offline. Stories you saved to your reading list can still be read from the <Link to="/bookmarks">Library</Link>.</div>
    </div>
  );
}
