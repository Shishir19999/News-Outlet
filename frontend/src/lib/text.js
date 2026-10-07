// Small, dependency-free text helpers (pure functions, unit tested).

export function slugify(input) {
  return String(input || '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Plain text of a markdown string (used for word counts, excerpts and search).
export function stripMarkdown(src) {
  return String(src || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+\.)\s+/gm, '')
    .replace(/[*_`~]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function wordCount(src) {
  const text = stripMarkdown(src);
  return text ? text.split(' ').length : 0;
}

// Minutes to read at ~200 words per minute, never less than one.
export function readingTime(src, wpm = 200) {
  return Math.max(1, Math.ceil(wordCount(src) / wpm));
}

export function excerpt(src, max = 160) {
  const text = stripMarkdown(src);
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), 40)).trim()}…`;
}

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

// An article is live when it is published, or scheduled for a time that has passed.
export function isLive(article, now = Date.now()) {
  if (!article) return false;
  if (article.status === 'draft') return false;
  if (article.status === 'scheduled') return new Date(article.publishedAt).getTime() <= now;
  return true;
}

// The label shown for an article's state in admin lists.
export function statusOf(article, now = Date.now()) {
  if (article.status === 'draft') return 'draft';
  if (article.status === 'scheduled') return new Date(article.publishedAt).getTime() <= now ? 'published' : 'scheduled';
  return 'published';
}
