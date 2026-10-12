// Real-time events for live blogs, breaking news and the alert banner.
// Real mode: Socket.IO against the API. Live preview: BroadcastChannel between tabs of this browser
// (the preview backend also calls emitLocal for the tab that made the change).
import { DEMO, API_URL } from '../config/env';

const handlers = new Map(); // event -> Set(fn)
const joined = new Set();
let socketPromise = null;
let channel = null;

function dispatch(event, payload) {
  (handlers.get(event) || new Set()).forEach((fn) => { try { fn(payload); } catch { /* a handler must not break the others */ } });
}
export const emitLocal = dispatch;

function ensureTransport() {
  if (DEMO) {
    if (!channel && typeof BroadcastChannel !== 'undefined') {
      channel = new BroadcastChannel('news-preview-rt');
      channel.onmessage = (e) => e.data && dispatch(e.data.event, e.data.payload);
    }
    return null;
  }
  if (!socketPromise) {
    socketPromise = import('socket.io-client').then(({ io }) => {
      const socket = io(API_URL, { transports: ['websocket', 'polling'], reconnectionDelayMax: 8000 });
      for (const ev of ['live:update', 'breaking', 'alert']) socket.on(ev, (p) => dispatch(ev, p));
      socket.on('connect', () => joined.forEach((id) => socket.emit('live:join', id)));
      return socket;
    }).catch(() => null);
  }
  return socketPromise;
}

// Listen for an event ('live:update', 'breaking', 'alert'). Returns an unsubscribe function.
export function subscribe(event, fn) {
  ensureTransport();
  if (!handlers.has(event)) handlers.set(event, new Set());
  handlers.get(event).add(fn);
  return () => handlers.get(event).delete(fn);
}

// Receive live-blog updates for one article. Returns a function that leaves the room again.
export function joinLive(newsId) {
  joined.add(newsId);
  const p = ensureTransport();
  if (p) p.then((s) => s && s.connected && s.emit('live:join', newsId));
  return () => {
    joined.delete(newsId);
    if (p) p.then((s) => s && s.emit('live:leave', newsId));
  };
}
