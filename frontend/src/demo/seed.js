// Starting data for the live preview, built from the shared sample content (original and fictional).
import { buildSampleContent, dailyViews, DEMO_PASSWORDS } from '../shared/sample.js';
import { snapshotOf, SOURCES } from '../shared/rules.js';

export const DEMO_LOGINS = [
  { role: 'admin', label: 'Admin', email: 'admin@example.com', password: DEMO_PASSWORDS.admin },
  { role: 'editor', label: 'Editor', email: 'editor@example.com', password: DEMO_PASSWORDS.editor },
  { role: 'author', label: 'Author', email: 'author@example.com', password: DEMO_PASSWORDS.author },
  { role: 'reader', label: 'Reader', email: 'user@example.com', password: DEMO_PASSWORDS.reader },
];

let counter = 0;
export function newId() {
  counter += 1;
  const rand = Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, '0');
  return (Date.now().toString(16) + rand + counter.toString(16).padStart(4, '0') + '000000000000').slice(0, 24);
}
export const newToken = () => Array.from({ length: 4 }, () => Math.random().toString(16).slice(2, 10)).join('');

const DAY = 86400000;
const dayKey = (t) => new Date(t).toISOString().slice(0, 10);
const SRC_MIX = [0.34, 0.26, 0.14, 0.08, 0.14, 0.04];
const DEPTH_MIX = { 25: 0.6, 50: 0.42, 75: 0.27, 100: 0.15 };

export const DEFAULT_SETTINGS = {
  siteName: 'News Outlet',
  tagline: 'Independent reporting on technology, business, science, sports, culture and the world.',
  commentsOpen: true, newsletterEnabled: true, registrationOpen: true,
  alert: { active: false, text: '', link: '', level: 'breaking' },
};

export function buildSeed(now = Date.now()) {
  const sample = buildSampleContent(now);
  const iso = (t) => new Date(t).toISOString();
  const categories = sample.sections.map((s) => ({ _id: newId(), name: s.name, description: s.description, order: s.order * 10 + 10, createdAt: iso(now - 60 * DAY) }));
  const catId = (name) => categories.find((c) => c.name === name)._id;
  const users = sample.people.map((p) => ({
    _id: newId(), name: p.name, email: p.email, password: DEMO_PASSWORDS[p.role === 'reader' ? 'reader' : p.role], gender: p.gender, role: p.role, image: '', bio: p.bio,
    follows: { topics: [], authors: [] }, tokenVersion: 0, createdAt: iso(now - 40 * DAY),
  }));
  const byKey = Object.fromEntries(sample.people.map((p, i) => [p.key, users[i]]));
  const news = [];
  const revisions = [];
  const live = [];
  const reactions = [];
  const pollVotes = [];
  const articleViews = {};
  const dayStats = {};
  const viewStats = {};
  sample.articles.forEach((a, index) => {
    const _id = newId();
    const author = byKey[a.author] || users[0];
    const n = {
      _id, categoryId: catId(a.section), title: a.title, slug: a.slug, summary: a.summary, description: a.description, image: a.image || '', imageAlt: a.imageAlt || '',
      status: a.status, kind: a.kind, tags: a.tags || [], sponsor: a.sponsor || '', factCheck: a.factCheck || null, embed: a.embed || null, gallery: a.gallery || [],
      poll: a.poll ? { question: a.poll.question, options: a.poll.options.map((o) => ({ id: o.id, label: o.label })), closesAt: a.poll.closesAt || null } : null,
      headlineB: a.headlineB || '', abTest: { a: { impressions: 0, clicks: 0, ...((a.ab && a.ab.a) || {}) }, b: { impressions: 0, clicks: 0, ...((a.ab && a.ab.b) || {}) }, winner: '' },
      publishedAt: a.publishedAt, submittedAt: ['submitted', 'in_review', 'changes_requested', 'approved'].includes(a.status) ? iso(now - 6 * 3600000) : null,
      views: a.views || 0, depth: Object.fromEntries(Object.entries(DEPTH_MIX).map(([k, m]) => [k, Math.round((a.views || 0) * m)])),
      featured: !!a.featured, breaking: !!a.breaking, author: author._id, assignedEditor: a.editor && byKey[a.editor] ? byKey[a.editor]._id : null,
      reviewNotes: (a.notes || []).map((x) => ({ _id: newId(), by: byKey[x.by]._id, byName: byKey[x.by].name, byRole: byKey[x.by].role, type: x.type, body: x.body, at: iso(now - x.hoursAgo * 3600000) })),
      createdAt: a.createdAt, updatedAt: a.publishedAt || a.createdAt,
    };
    news.push(n);
    let v = 0;
    for (const h of a.history || []) {
      v += 1;
      revisions.push({ _id: newId(), newsId: _id, version: v, snapshot: { ...snapshotOf(n), ...h.override }, by: byKey[h.by]._id, byName: byKey[h.by].name, note: h.note, createdAt: iso(now - h.daysAgo * DAY) });
    }
    revisions.push({ _id: newId(), newsId: _id, version: v + 1, snapshot: snapshotOf(n), by: author._id, byName: author.name, note: v ? 'Current version' : 'First version', createdAt: a.createdAt });
    if (a.status === 'published' && a.views) {
      const daily = dailyViews(index + 1, a.views, now);
      articleViews[_id] = daily;
      for (const [date, count] of Object.entries(daily)) {
        viewStats[date] = viewStats[date] || {};
        viewStats[date][n.categoryId] = (viewStats[date][n.categoryId] || 0) + count;
        const d = dayStats[date] || { views: 0, sources: {}, depth: {} };
        d.views += count;
        SOURCES.forEach((s, i) => { d.sources[s] = (d.sources[s] || 0) + Math.round(count * SRC_MIX[i]); });
        for (const [k, m] of Object.entries(DEPTH_MIX)) d.depth[k] = (d.depth[k] || 0) + Math.round(count * m);
        dayStats[date] = d;
      }
      const mix = { like: 9 + ((index + 1) % 7), insightful: 3 + ((index + 1) % 4), sad: (index + 1) % 3, surprised: 1 + ((index + 1) % 3) };
      for (const [type, c] of Object.entries(mix)) for (let i = 0; i < c; i++) reactions.push({ newsId: _id, voter: `seed:${type}:${i}`, type });
    }
    if (a.poll) for (const o of a.poll.options) for (let i = 0; i < (a.poll.votes[o.id] || 0); i++) pollVotes.push({ newsId: _id, voter: `seed:${o.id}:${i}`, optionId: o.id });
    (a.live || []).forEach((u, i) => live.push({ _id: newId(), newsId: _id, body: u[1], important: u[2], pinned: u[3], by: author._id, byName: author.name, createdAt: iso(now - u[0] * 60000 + i), updatedAt: iso(now - u[0] * 60000 + i) }));
  });
  const bySlug = Object.fromEntries(news.map((n) => [n.slug, n]));
  const comments = [];
  sample.comments.forEach((c) => {
    comments.push({
      _id: newId(), newsId: bySlug[c.article]._id, userId: null, parentId: c.parentIndex !== null && comments[c.parentIndex] ? comments[c.parentIndex]._id : null, name: c.name, body: c.body, status: c.status,
      reports: Array.from({ length: c.reports }, (_, i) => ({ voter: `seed:${i}`, reason: 'spam', at: c.createdAt })), createdAt: c.createdAt, updatedAt: c.createdAt,
    });
  });
  const subscribers = sample.subscribers.map((s) => ({
    _id: newId(), email: s.email, confirmed: s.confirmed, token: newToken(), topics: s.topics.map(catId), confirmedAt: s.confirmed ? iso(now - s.daysAgo * DAY) : null, lastSentAt: null, createdAt: iso(now - s.daysAgo * DAY),
  }));
  return {
    version: 2, categories, users, news, comments, bookmarks: {}, subscribers, revisions, live, reactions, pollVotes, articleViews, dayStats, viewStats,
    settings: { ...DEFAULT_SETTINGS }, audit: [], inbox: [],
  };
}
export { dayKey };
