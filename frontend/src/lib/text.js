// Small, dependency-free text helpers (pure functions, unit tested). Rules that the server also
// applies (slugs, reading time, who is live) come from the shared module.
export { slugify, stripMarkdown, wordCount, readingTime, excerpt, isLive, effectiveStatus } from '../shared/rules.js';

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Splits text into [{ text, match }] parts so matches can be wrapped without innerHTML.
export function highlightParts(text, query) {
  const value = String(text ?? '');
  const terms = String(query || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)
    .map(escapeRe);
  if (!terms.length || !value) return [{ text: value, match: false }];
  const re = new RegExp(`(${terms.join('|')})`, 'gi');
  // split() with one capture group puts the matches at the odd indexes
  return value
    .split(re)
    .map((part, i) => ({ text: part, match: i % 2 === 1 }))
    .filter((part) => part.text !== '');
}

export function formatNumber(n) {
  const v = Number(n) || 0;
  if (v >= 1000000) return `${(v / 1000000).toFixed(1).replace(/\.0$/, '')}M`;
  if (v >= 1000) return `${(v / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return String(v);
}

export function formatDate(value, opts = { year: 'numeric', month: 'short', day: 'numeric' }) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-US', opts).format(d);
}

export function formatDateTime(value) {
  return formatDate(value, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function timeAgo(value, now = Date.now()) {
  const t = new Date(value).getTime();
  if (Number.isNaN(t)) return '';
  const s = Math.round((now - t) / 1000);
  if (s < 0) return formatDate(value);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hr ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} day${d === 1 ? '' : 's'} ago`;
  return formatDate(value);
}

const pad = (n) => String(n).padStart(2, '0');

// Date -> value for <input type="datetime-local"> (local time).
export function toLocalInput(value) {
  const d = value ? new Date(value) : new Date();
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// <input type="datetime-local"> value -> ISO string ('' when empty/invalid).
export function fromLocalInput(value) {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString();
}

// "2026-09" -> "September 2026"
export function monthLabel(key) {
  const [y, m] = String(key).split('-').map(Number);
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, 1)));
}
