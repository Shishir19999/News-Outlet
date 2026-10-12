// Shared newsroom rules: roles, permissions, the editorial workflow, validation, reading time,
// trending, search ranking, personalised feed scoring, revision diffs and headline tests.
// Pure functions with no dependencies. The same file is copied into backend/src/shared and
// frontend/src/shared (run `npm run sync:shared`); a test fails when the copies drift apart.

// ---------------------------------------------------------------------------------------------
// Roles and permissions
// ---------------------------------------------------------------------------------------------
export const ROLES = ['reader', 'author', 'editor', 'admin'];
export const normalizeRole = (r) => (r === 'user' ? 'reader' : ROLES.includes(r) ? r : 'reader');

const PERM_BY_ROLE = {
  reader: ['comment', 'react', 'vote', 'bookmark', 'follow', 'report'],
  author: ['article.create', 'article.editOwn', 'article.submit', 'stats.own', 'live.own', 'upload'],
  editor: [
    'article.viewAll', 'article.edit', 'review', 'assign', 'publish', 'archive', 'live.any', 'comments.moderate',
    'alert', 'polls', 'analytics', 'ab', 'breaking', 'revisions',
  ],
  admin: ['users', 'roles', 'sections', 'settings', 'audit', 'newsletter', 'article.delete', 'subscribers'],
};
const PERMS = {};
(() => {
  let acc = [];
  for (const r of ROLES) {
    acc = [...acc, ...PERM_BY_ROLE[r]];
    PERMS[r] = new Set(acc);
  }
})();
export const can = (role, perm) => !!PERMS[normalizeRole(role)] && PERMS[normalizeRole(role)].has(perm);
export const roleAtLeast = (role, min) => ROLES.indexOf(normalizeRole(role)) >= ROLES.indexOf(min);

export const ROLE_INFO = {
  reader: 'Read, comment, react, vote, save, follow topics and authors.',
  author: 'Reader rights plus write articles and submit them for review. Sees own stats.',
  editor: 'Author rights plus the review desk: assign, comment, request changes, approve, schedule, publish, breaking news, live blogs, moderation, polls.',
  admin: 'Editor rights plus users and roles, sections, settings, audit log, newsletters and deletion.',
};

// ---------------------------------------------------------------------------------------------
// Article kinds, labels, fact-check ratings
// ---------------------------------------------------------------------------------------------
export const KINDS = ['news', 'analysis', 'opinion', 'fact-check', 'sponsored', 'live'];
export const KIND_LABEL = { news: 'News', analysis: 'Analysis', opinion: 'Opinion', 'fact-check': 'Fact check', sponsored: 'Sponsored', live: 'Live' };
export const KIND_NOTE = {
  analysis: 'Analysis: interprets events and draws on reporting and expertise.',
  opinion: 'Opinion: the views of the writer, not of the newsroom.',
  'fact-check': 'Fact check: tests a public claim against evidence.',
  sponsored: 'Sponsored: paid for by a sponsor; the newsroom did not write it.',
  live: 'Live: updated as events unfold.',
};
export const RATINGS = ['true', 'mostly-true', 'mixed', 'mostly-false', 'false', 'unproven'];
export const RATING_LABEL = { true: 'True', 'mostly-true': 'Mostly true', mixed: 'Mixed', 'mostly-false': 'Mostly false', false: 'False', unproven: 'Unproven' };
export const RATING_VALUE = { true: 5, 'mostly-true': 4, mixed: 3, 'mostly-false': 2, false: 1, unproven: 3 };
export const REACTIONS = ['like', 'insightful', 'sad', 'surprised'];
export const REACTION_LABEL = { like: 'Like', insightful: 'Insightful', sad: 'Sad', surprised: 'Surprised' };

// ---------------------------------------------------------------------------------------------
// Editorial workflow
// ---------------------------------------------------------------------------------------------
export const STATUSES = ['draft', 'submitted', 'in_review', 'changes_requested', 'approved', 'scheduled', 'published', 'archived'];
export const STATUS_LABEL = {
  draft: 'Draft', submitted: 'Submitted', in_review: 'In review', changes_requested: 'Changes requested',
  approved: 'Approved', scheduled: 'Scheduled', published: 'Published', archived: 'Archived',
};
export const REVIEW_STATUSES = ['submitted', 'in_review', 'changes_requested', 'approved'];

const ts = (v) => (v ? new Date(v).getTime() : NaN);

// A scheduled article whose time has come counts as published.
export function effectiveStatus(article, now = Date.now()) {
  if (!article) return 'draft';
  if (article.status === 'scheduled' && ts(article.publishedAt) <= now) return 'published';
  return article.status || 'published';
}
export const isLive = (article, now = Date.now()) => !!article && effectiveStatus(article, now) === 'published';
export const isArchived = (article) => !!article && article.status === 'archived';
export const inPublicArchive = (article, now = Date.now()) => isLive(article, now) || isArchived(article);

const sameId = (a, b) => a != null && b != null && String(a) === String(b);
export const isOwner = (article, actor) => !!actor && sameId(article.author && article.author._id ? article.author._id : article.author, actor._id);

// from -> [to, minimum role, rule]
const FLOW = {
  draft: [['submitted', 'author', 'owner']],
  submitted: [['in_review', 'editor', 'review'], ['changes_requested', 'editor', 'review'], ['draft', 'author', 'owner-withdraw']],
  in_review: [['approved', 'editor', 'review'], ['changes_requested', 'editor', 'review'], ['published', 'editor', 'review'], ['scheduled', 'editor', 'review']],
  changes_requested: [['submitted', 'author', 'owner'], ['draft', 'author', 'owner-withdraw']],
  approved: [['published', 'editor', 'review'], ['scheduled', 'editor', 'review'], ['in_review', 'editor', 'any'], ['changes_requested', 'editor', 'review']],
  scheduled: [['published', 'editor', 'review'], ['approved', 'editor', 'any']],
  published: [['archived', 'editor', 'any'], ['in_review', 'editor', 'any']],
  archived: [['published', 'editor', 'review'], ['in_review', 'editor', 'any']],
};
// admins may fast-track unfinished work straight to approved, scheduled or published
const ADMIN_FAST = { draft: ['approved', 'scheduled', 'published'], submitted: ['approved', 'scheduled', 'published'], changes_requested: ['approved', 'scheduled', 'published'] };

export const TRANSITION_LABEL = {
  submitted: 'Submit for review', in_review: 'Start review', changes_requested: 'Request changes', approved: 'Approve',
  published: 'Publish', scheduled: 'Schedule', archived: 'Archive', draft: 'Back to draft',
};

function allowedBy(rule, article, actor) {
  const owner = isOwner(article, actor);
  const admin = normalizeRole(actor.role) === 'admin';
  if (rule === 'owner') return owner || roleAtLeast(actor.role, 'editor');
  if (rule === 'owner-withdraw') return owner;
  if (rule === 'any') return true;
  // review rules: editors cannot sign off their own work (four-eyes), admins can
  if (rule === 'review') return admin || !owner;
  return false;
}

// Moves the actor may make on this article right now: [{ to, label, needsNote, needsDate }].
export function transitionsFor(article, actor, now = Date.now()) {
  if (!article || !actor) return [];
  const from = article.status || 'draft';
  const out = [];
  const seen = new Set();
  const push = (to) => {
    if (seen.has(to) || to === from) return;
    seen.add(to);
    out.push({ to, label: TRANSITION_LABEL[to], needsNote: to === 'changes_requested', needsDate: to === 'scheduled' });
  };
  for (const [to, minRole, rule] of FLOW[from] || []) {
    if (!roleAtLeast(actor.role, minRole)) continue;
    if (!allowedBy(rule, article, actor)) continue;
    push(to);
  }
  if (normalizeRole(actor.role) === 'admin') for (const to of ADMIN_FAST[from] || []) push(to);
  if (from === 'scheduled' && ts(article.publishedAt) <= now) return out.filter((t) => t.to !== 'published');
  return out;
}

// Validates one move. Returns { ok:true, patch } or { ok:false, status, message }.
export function checkTransition(article, to, actor, { note = '', publishedAt, now = Date.now() } = {}) {
  if (!STATUSES.includes(to)) return { ok: false, status: 422, message: 'Unknown status' };
  const options = transitionsFor(article, actor, now);
  const found = options.find((o) => o.to === to);
  if (!found) {
    const from = article.status || 'draft';
    if (from === 'scheduled' && to === 'published' && ts(article.publishedAt) <= now) return { ok: false, status: 409, message: 'This article is already live' };
    const known = [...(FLOW[from] || []).map((f) => f[0]), ...(ADMIN_FAST[from] || [])];
    if (!known.includes(to)) return { ok: false, status: 409, message: `An article that is ${STATUS_LABEL[from].toLowerCase()} cannot move to ${STATUS_LABEL[to].toLowerCase()}` };
    return { ok: false, status: 403, message: 'You are not allowed to make this change (editors cannot approve or publish their own articles)' };
  }
  if (found.needsNote && !String(note || '').trim()) return { ok: false, status: 422, message: 'Explain what needs to change', errors: { note: 'A note for the author is required' } };
  const patch = { status: to };
  if (to === 'scheduled') {
    const t = ts(publishedAt);
    if (!publishedAt || Number.isNaN(t)) return { ok: false, status: 422, message: 'A publish date is required to schedule an article', errors: { publishedAt: 'A publish date is required to schedule an article' } };
    if (t <= now) return { ok: false, status: 422, message: 'The scheduled time must be in the future', errors: { publishedAt: 'The scheduled time must be in the future' } };
    patch.publishedAt = new Date(t).toISOString();
  }
  if (to === 'published') {
    const wasLive = ['published', 'archived'].includes(article.status) && article.publishedAt;
    if (!wasLive) patch.publishedAt = new Date(now).toISOString();
  }
  return { ok: true, patch };
}

// Who may change the content of an article right now.
export function canEditArticle(article, actor) {
  if (!actor || !article) return false;
  if (roleAtLeast(actor.role, 'editor')) return true;
  return roleAtLeast(actor.role, 'author') && isOwner(article, actor) && ['draft', 'changes_requested'].includes(article.status || 'draft');
}
export function canViewArticle(article, actor, now = Date.now()) {
  if (inPublicArchive(article, now)) return true;
  if (!actor) return false;
  return roleAtLeast(actor.role, 'editor') || isOwner(article, actor);
}

// ---------------------------------------------------------------------------------------------
// Text helpers
// ---------------------------------------------------------------------------------------------
export function slugify(input) {
  return String(input || '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
export function stripMarkdown(src) {
  return String(src || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/^@\[(video|audio)\]\([^)]*\)\s*$/gm, ' ')
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
export const readingTime = (src, wpm = 200) => Math.max(1, Math.ceil(wordCount(src) / wpm));
export function excerpt(src, max = 160) {
  const text = stripMarkdown(src);
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), 40)).trim()}…`;
}
export function normalize(s) {
  return String(s || '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}
const STOP = new Set('about after again against among being between could during every first from have into more most other over part said says than that their them then there these they this those through under until very were what when where which while with would your will also been just like some such only back many make made much news year years week today city local'.split(' '));
// Up to `max` topic tags taken from a title.
export function deriveTags(title, max = 3) {
  const out = [];
  for (const w of normalize(title).split(' ')) {
    if (w.length >= 5 && !STOP.has(w) && !out.includes(w)) out.push(w);
    if (out.length >= max) break;
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Validation (same messages in the API and in the live preview)
// ---------------------------------------------------------------------------------------------
export const EMAIL_RE = /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/;
export const isEmail = (v) => typeof v === 'string' && v.length <= 254 && EMAIL_RE.test(v.trim());
const str = (v) => (typeof v === 'string' ? v.trim() : '');
const SAFE_SRC = /^(https?:\/\/|\/|data:image\/(png|jpe?g|gif|webp|svg\+xml)[;,])/i;
const parseJson = (v) => {
  if (typeof v !== 'string') return v;
  try { return JSON.parse(v); } catch { return undefined; }
};
const truthy = (v) => v === true || ['true', '1', 'on'].includes(String(v).toLowerCase());

// Privacy-friendly embeds only: no-cookie YouTube, Vimeo with do-not-track, plain audio files.
export function parseEmbed(url) {
  const u = str(url);
  let m = /^https:\/\/(?:www\.)?(?:youtube\.com\/(?:watch\?(?:[^#]*&)?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/.exec(u);
  if (m) return { provider: 'YouTube', kind: 'video', src: `https://www.youtube-nocookie.com/embed/${m[1]}`, watchUrl: `https://www.youtube.com/watch?v=${m[1]}` };
  m = /^https:\/\/(?:www\.)?vimeo\.com\/(?:video\/)?(\d{6,12})/.exec(u);
  if (m) return { provider: 'Vimeo', kind: 'video', src: `https://player.vimeo.com/video/${m[1]}?dnt=1`, watchUrl: `https://vimeo.com/${m[1]}` };
  if (/^https:\/\/[^\s]+\.(mp3|ogg|oga|wav|m4a)(\?[^\s]*)?$/i.test(u)) return { provider: 'Audio', kind: 'audio', src: u, watchUrl: u };
  return null;
}

export function validateArticle(body, { partial = false } = {}) {
  const errors = {};
  const values = {};
  const has = (k) => body[k] !== undefined;
  if (!partial || has('categoryId')) {
    const v = str(body.categoryId);
    if (!v) errors.categoryId = 'A valid category is required';
    else values.categoryId = v;
  }
  if (!partial || has('title')) {
    const v = str(body.title);
    if (!v) errors.title = 'Title is required';
    else if (v.length > 200) errors.title = 'Title must be at most 200 characters';
    else values.title = v;
  }
  if (!partial || has('summary')) {
    const v = str(body.summary);
    if (!v) errors.summary = 'Summary is required';
    else if (v.length > 1000) errors.summary = 'Summary must be at most 1000 characters';
    else values.summary = v;
  }
  if (has('description')) {
    if (typeof body.description !== 'string') errors.description = 'Description must be text';
    else if (body.description.length > 100000) errors.description = 'The article text is too long';
    else values.description = body.description;
  }
  if (has('kind')) {
    const v = str(body.kind) || 'news';
    if (!KINDS.includes(v)) errors.kind = 'Unknown article type';
    else values.kind = v;
  }
  if (has('tags')) {
    const raw = typeof body.tags === 'string' ? (parseJson(body.tags) ?? body.tags.split(',')) : body.tags;
    if (!Array.isArray(raw)) errors.tags = 'Tags must be a list';
    else {
      const tags = [...new Set(raw.map((t) => slugify(String(t))).filter(Boolean))];
      if (tags.length > 10) errors.tags = 'Use at most 10 tags';
      else if (tags.some((t) => t.length > 30)) errors.tags = 'A tag can have at most 30 characters';
      else values.tags = tags;
    }
  }
  for (const [k, max, label] of [['imageAlt', 200, 'Image description'], ['headlineB', 200, 'Alternative headline'], ['sponsor', 100, 'Sponsor']]) {
    if (has(k)) {
      const v = str(body[k]);
      if (v.length > max) errors[k] = `${label} must be at most ${max} characters`;
      else values[k] = v;
    }
  }
  if (has('featured')) values.featured = truthy(body.featured);
  if (has('breaking')) values.breaking = truthy(body.breaking);
  if (has('factCheck')) {
    const fc = parseJson(body.factCheck);
    if (fc === null || fc === '' || (fc && typeof fc === 'object' && !str(fc.claim) && !str(fc.rating))) values.factCheck = null;
    else if (!fc || typeof fc !== 'object') errors.factCheck = 'Fact check details are not valid';
    else if (!str(fc.claim)) errors.factCheck = 'State the claim that was checked';
    else if (str(fc.claim).length > 300) errors.factCheck = 'The claim must be at most 300 characters';
    else if (!RATINGS.includes(str(fc.rating))) errors.factCheck = 'Choose a rating';
    else values.factCheck = { claim: str(fc.claim), rating: str(fc.rating) };
  }
  if (has('embed')) {
    const raw = parseJson(body.embed);
    if (raw === null || raw === '' || (raw && typeof raw === 'object' && !str(raw.url))) values.embed = null;
    else if (!raw || typeof raw !== 'object') errors.embed = 'Embed details are not valid';
    else if (!parseEmbed(raw.url)) errors.embed = 'Use a YouTube, Vimeo or direct audio file (https) link';
    else values.embed = { url: str(raw.url), title: str(raw.title).slice(0, 120) };
  }
  if (has('gallery')) {
    const raw = parseJson(body.gallery);
    if (raw === null || raw === '' || raw === undefined) values.gallery = [];
    else if (!Array.isArray(raw)) errors.gallery = 'Gallery must be a list of pictures';
    else if (raw.length > 20) errors.gallery = 'A gallery can hold at most 20 pictures';
    else if (raw.some((g) => !g || typeof g.src !== 'string' || !SAFE_SRC.test(g.src))) errors.gallery = 'Every gallery picture needs an uploaded image or an https link';
    else if (raw.some((g) => !str(g.alt))) errors.gallery = 'Describe every gallery picture (alternative text)';
    else values.gallery = raw.map((g) => ({ src: g.src, alt: str(g.alt).slice(0, 200), caption: str(g.caption).slice(0, 300) }));
  }
  if (has('poll')) {
    const raw = parseJson(body.poll);
    if (raw === null || raw === '' || (raw && typeof raw === 'object' && !str(raw.question) && !(raw.options || []).length)) values.poll = null;
    else if (!raw || typeof raw !== 'object') errors.poll = 'Poll details are not valid';
    else {
      const q = str(raw.question);
      const opts = (Array.isArray(raw.options) ? raw.options : []).map((o) => ({ id: str(o && o.id), label: str(o && o.label) })).filter((o) => o.label);
      if (q.length < 5 || q.length > 200) errors.poll = 'The poll question needs 5 to 200 characters';
      else if (opts.length < 2 || opts.length > 6) errors.poll = 'A poll needs 2 to 6 answers';
      else if (opts.some((o) => o.label.length > 80)) errors.poll = 'A poll answer can have at most 80 characters';
      else if (raw.closesAt && Number.isNaN(ts(raw.closesAt))) errors.poll = 'The poll closing date is not valid';
      else values.poll = { question: q, options: opts, closesAt: raw.closesAt ? new Date(raw.closesAt).toISOString() : null };
    }
  }
  const kind = values.kind;
  if (kind === 'sponsored' && !str(values.sponsor ?? body.sponsor)) errors.sponsor = 'Name the sponsor of a sponsored article';
  if (kind === 'fact-check' && !values.factCheck && !errors.factCheck) errors.factCheck = 'A fact check needs the claim and a rating';
  return { errors, values };
}

export function validateComment(body) {
  const errors = {};
  const text = str(body.body);
  const name = str(body.name);
  if (!text) errors.body = 'Comment is required';
  else if (text.length > 1000) errors.body = 'Comment must be at most 1000 characters';
  if (name.length > 60) errors.name = 'Name must be at most 60 characters';
  return { errors, values: { body: text, name, parentId: str(body.parentId) || null } };
}
export const COMMENT_MAX_DEPTH = 3;
export const REPORT_REASONS = ['spam', 'abuse', 'misinformation', 'off-topic', 'other'];
export const REPORT_THRESHOLD = 3; // reports that hide a comment until an editor looks at it

export function validateLiveUpdate(body) {
  const errors = {};
  const text = str(body.body);
  if (!text) errors.body = 'Write the update';
  else if (text.length > 2000) errors.body = 'An update can have at most 2000 characters';
  return { errors, values: { body: text, important: truthy(body.important), pinned: truthy(body.pinned) } };
}

export function validateSettings(body, { alertOnly = false } = {}) {
  const errors = {};
  const values = {};
  if (!alertOnly) {
    if (body.siteName !== undefined) {
      const v = str(body.siteName);
      if (!v || v.length > 60) errors.siteName = 'Site name needs 1 to 60 characters';
      else values.siteName = v;
    }
    if (body.tagline !== undefined) {
      const v = str(body.tagline);
      if (v.length > 140) errors.tagline = 'The tagline can have at most 140 characters';
      else values.tagline = v;
    }
    for (const k of ['commentsOpen', 'newsletterEnabled', 'registrationOpen']) if (body[k] !== undefined) values[k] = truthy(body[k]);
  }
  if (body.alert !== undefined) {
    const a = body.alert || {};
    const text = str(a.text);
    const link = str(a.link);
    if (text.length > 200) errors.alert = 'The alert text can have at most 200 characters';
    else if (truthy(a.active) && !text) errors.alert = 'Write the alert text before turning it on';
    else if (link && !/^(https?:\/\/|\/|#)/.test(link)) errors.alert = 'The alert link must start with https://, / or #';
    else values.alert = { active: truthy(a.active), text, link, level: a.level === 'info' ? 'info' : 'breaking' };
  }
  return { errors, values };
}

export function validateSection(body) {
  const errors = {};
  const name = str(body.name);
  if (!name) errors.name = 'Name is required';
  else if (name.length > 40) errors.name = 'Name must be at most 40 characters';
  const description = str(body.description);
  if (description.length > 300) errors.description = 'Description must be at most 300 characters';
  const order = body.order === undefined || body.order === '' ? undefined : Number(body.order);
  if (order !== undefined && (!Number.isFinite(order) || order < 0 || order > 999)) errors.order = 'Order must be a number between 0 and 999';
  return { errors, values: { name, description, ...(order !== undefined ? { order } : {}) } };
}

export function validateNewsletter(body) {
  const errors = {};
  const email = str(body.email).toLowerCase();
  if (!isEmail(email)) errors.email = 'Enter a valid email address, for example you@example.com';
  const topics = Array.isArray(body.topics) ? [...new Set(body.topics.map(String).filter(Boolean))].slice(0, 30) : [];
  return { errors, values: { email, topics } };
}

export function validateDigest(body) {
  const errors = {};
  const subject = str(body.subject);
  if (!subject || subject.length > 150) errors.subject = 'The subject needs 1 to 150 characters';
  const intro = str(body.intro);
  if (intro.length > 1000) errors.intro = 'The introduction can have at most 1000 characters';
  const topics = Array.isArray(body.topics) ? body.topics.map(String) : [];
  const articleIds = Array.isArray(body.articleIds) ? body.articleIds.map(String).slice(0, 12) : [];
  if (!articleIds.length) errors.articleIds = 'Pick at least one article';
  return { errors, values: { subject, intro, topics, articleIds } };
}

// ---------------------------------------------------------------------------------------------
// Trending, personalised feed, analytics helpers
// ---------------------------------------------------------------------------------------------
const DAY = 86400000;
const dayMid = (key) => new Date(`${key}T12:00:00Z`).getTime();
// Views per day decayed by age (half-life in days). Articles without daily data fall back to total views.
export function trendingScore({ daily, views = 0, publishedAt }, now = Date.now(), halfLife = 1.5) {
  let score = 0;
  const keys = daily ? Object.keys(daily) : [];
  for (const k of keys) {
    const age = Math.max((now - dayMid(k)) / DAY, 0);
    if (age > 14) continue;
    score += (Number(daily[k]) || 0) * 0.5 ** (age / halfLife);
  }
  if (!keys.length) {
    const age = Math.max((now - ts(publishedAt)) / DAY, 0) || 0;
    score = views * 0.1 * 0.5 ** (age / halfLife);
  }
  // a small boost for fresh stories so a new article can reach the list
  const ageHours = Math.max((now - ts(publishedAt)) / 3600000, 0) || 0;
  return score * (1 + 0.5 / (1 + ageHours / 12));
}

export function forYouScore(article, { topics = [], authors = [], tags = [] } = {}, now = Date.now()) {
  const age = Math.max((now - ts(article.publishedAt)) / DAY, 0) || 0;
  let s = 2 ** (-age / 4) * (1 + Math.log1p(article.views || 0) / 8);
  const cat = String(article.categoryId && article.categoryId._id ? article.categoryId._id : article.categoryId);
  const author = String(article.author && article.author._id ? article.author._id : article.author);
  const reasons = [];
  if (topics.includes(cat)) { s += 2; reasons.push('topic'); }
  if (authors.includes(author)) { s += 3; reasons.push('author'); }
  const overlap = (article.tags || []).filter((t) => tags.includes(t)).length;
  if (overlap) { s += overlap * 0.8; reasons.push('tag'); }
  return { score: s, reasons };
}

export const DEPTHS = [25, 50, 75, 100];
export const depthBucket = (p) => DEPTHS.filter((d) => p >= d).pop() || 0;
export const SOURCES = ['direct', 'search', 'social', 'newsletter', 'internal', 'other'];
export function classifySource(referrer, siteHost, utm) {
  if (utm === 'newsletter') return 'newsletter';
  const r = str(referrer);
  if (!r) return 'direct';
  let host = '';
  try { host = new URL(r).hostname.replace(/^www\./, ''); } catch { return 'other'; }
  if (siteHost && host === siteHost.replace(/^www\./, '')) return 'internal';
  if (/(google|bing|duckduckgo|yahoo|ecosia|brave|startpage)\./.test(host)) return 'search';
  if (/(facebook|twitter|x\.com|t\.co|linkedin|reddit|instagram|mastodon|bsky|threads)/.test(host)) return 'social';
  return 'other';
}

// ---------------------------------------------------------------------------------------------
// Search: ranking, typo tolerance and suggestions
// ---------------------------------------------------------------------------------------------
export function editDistance(a, b, max = 3) {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      const v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      cur.push(v);
      if (v < best) best = v;
    }
    if (best > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}
const tolerance = (len) => (len >= 8 ? 2 : len >= 4 ? 1 : 0);
// 3 exact word, 2 prefix, 1 within the typo tolerance, 0 no match
function wordScore(term, word) {
  if (word === term) return 3;
  if (word.startsWith(term)) return 2;
  const tol = tolerance(term.length);
  if (tol && editDistance(term, word.slice(0, term.length + tol), tol) <= tol) return 1;
  if (tol && editDistance(term, word, tol) <= tol) return 1;
  return 0;
}
const WEIGHTS = { title: 5, tags: 3, summary: 2, body: 1 };
export function searchScore(terms, article) {
  const fields = {
    title: normalize(article.title).split(' '),
    tags: (article.tags || []).flatMap((t) => normalize(t).split(' ')),
    summary: normalize(article.summary).split(' '),
    body: normalize(String(article.description || '').slice(0, 1500)).split(' '),
  };
  let total = 0;
  let fuzzy = false;
  for (const term of terms) {
    let best = 0;
    let bestRaw = 0;
    for (const [f, words] of Object.entries(fields)) {
      for (const w of words) {
        const raw = wordScore(term, w);
        if (raw && raw * WEIGHTS[f] > best) { best = raw * WEIGHTS[f]; bestRaw = raw; }
      }
    }
    if (!best) return { score: 0, fuzzy: false };
    if (bestRaw === 1) fuzzy = true;
    total += best;
  }
  return { score: total, fuzzy };
}
// Articles that match every word (typos allowed), best first. Ties go to the newest story.
export function rankSearch(query, articles) {
  const terms = normalize(query).split(' ').filter(Boolean);
  if (!terms.length) return [];
  return articles
    .map((a) => ({ article: a, ...searchScore(terms, a) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || ts(b.article.publishedAt) - ts(a.article.publishedAt));
}
export function vocabulary(articles) {
  const set = new Set();
  for (const a of articles) {
    for (const w of normalize(a.title).split(' ')) if (w.length > 3) set.add(w);
    for (const t of a.tags || []) set.add(normalize(t));
  }
  return [...set];
}
// "Did you mean": the closest vocabulary word for each misspelled term.
export function didYouMean(query, vocab) {
  const terms = normalize(query).split(' ').filter(Boolean);
  let changed = false;
  const out = terms.map((t) => {
    if (vocab.includes(t) || t.length < 4) return t;
    let best = null;
    let bestD = tolerance(t.length) + 1;
    for (const w of vocab) {
      const d = editDistance(t, w, tolerance(t.length));
      if (d < bestD) { bestD = d; best = w; }
    }
    if (best) { changed = true; return best; }
    return t;
  });
  return changed ? out.join(' ') : '';
}
export function suggest(query, articles, sections = [], limit = 6) {
  const q = normalize(query);
  if (q.length < 2) return [];
  const out = [];
  for (const s of sections) if (normalize(s.name).startsWith(q)) out.push({ type: 'section', label: s.name, slug: s.slug });
  const ranked = rankSearch(query, articles).slice(0, limit);
  for (const r of ranked) out.push({ type: 'article', label: r.article.title, slug: r.article.slug });
  const dym = didYouMean(query, vocabulary(articles));
  if (dym && !ranked.length) out.push({ type: 'query', label: dym });
  return out.slice(0, limit + 2);
}

// ---------------------------------------------------------------------------------------------
// Revisions: snapshots and diffs
// ---------------------------------------------------------------------------------------------
export const REVISION_FIELDS = ['title', 'summary', 'description', 'categoryId', 'kind', 'tags', 'imageAlt', 'headlineB', 'sponsor', 'factCheck', 'embed', 'gallery', 'poll'];
export function snapshotOf(article) {
  const snap = {};
  for (const f of REVISION_FIELDS) {
    let v = article[f];
    if (f === 'categoryId' && v && v._id) v = v._id;
    snap[f] = v === undefined || v === '' ? null : JSON.parse(JSON.stringify(v));
    if (f === 'poll' && snap.poll) snap.poll = { question: snap.poll.question, options: (snap.poll.options || []).map((o) => ({ id: o.id, label: o.label })), closesAt: snap.poll.closesAt || null };
    if (f === 'categoryId' && snap[f] != null) snap[f] = String(snap[f]);
    if (f === 'tags' && !snap[f]) snap[f] = [];
    if (f === 'gallery' && !snap[f]) snap[f] = [];
  }
  return snap;
}
export const sameSnapshot = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// Longest-common-subsequence diff of two token arrays -> [{ type: 'same'|'add'|'del', text }]
export function diffTokens(a, b) {
  const n = a.length;
  const m = b.length;
  if (n * m > 4000000) return [...a.map((text) => ({ type: 'del', text })), ...b.map((text) => ({ type: 'add', text }))];
  const dp = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const out = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { out.push({ type: 'same', text: a[i] }); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) out.push({ type: 'del', text: a[i++] });
    else out.push({ type: 'add', text: b[j++] });
  }
  while (i < n) out.push({ type: 'del', text: a[i++] });
  while (j < m) out.push({ type: 'add', text: b[j++] });
  return out;
}
export const diffLines = (a, b) => diffTokens(String(a || '').split('\n'), String(b || '').split('\n'));
export const diffWords = (a, b) => diffTokens(String(a || '').split(/(\s+)/).filter((x) => x !== ''), String(b || '').split(/(\s+)/).filter((x) => x !== ''));
// Field-by-field changes between two snapshots: [{ field, kind: 'words'|'lines'|'value', diff|from|to }]
export function diffSnapshots(prev, next) {
  const out = [];
  const p = prev || {};
  for (const f of REVISION_FIELDS) {
    const a = p[f] ?? null;
    const b = next[f] ?? null;
    if (JSON.stringify(a) === JSON.stringify(b)) continue;
    if (f === 'title' || f === 'summary' || f === 'headlineB') out.push({ field: f, kind: 'words', diff: diffWords(a || '', b || '') });
    else if (f === 'description') out.push({ field: f, kind: 'lines', diff: diffLines(a || '', b || '') });
    else out.push({ field: f, kind: 'value', from: a, to: b });
  }
  return out;
}
export const FIELD_LABEL = {
  title: 'Headline', summary: 'Summary', description: 'Article text', categoryId: 'Section', kind: 'Type', tags: 'Tags',
  imageAlt: 'Image description', headlineB: 'Alternative headline', sponsor: 'Sponsor', factCheck: 'Fact check', embed: 'Embedded media', gallery: 'Gallery', poll: 'Poll',
};

// ---------------------------------------------------------------------------------------------
// Headline A/B test
// ---------------------------------------------------------------------------------------------
export function hashString(input) {
  let h = 2166136261;
  const s = String(input || '');
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
export const abVariant = (clientId, articleId) => (hashString(`${clientId}|${articleId}`) % 2 === 0 ? 'a' : 'b');
export const abActive = (a) => !!(a && a.headlineB && !(a.abTest && a.abTest.winner));
export const abCtr = (v) => (v && v.impressions ? v.clicks / v.impressions : 0);
// A leader only with enough impressions on both sides.
export function abLeader(ab, minImpressions = 20) {
  if (!ab || !ab.a || !ab.b || ab.a.impressions < minImpressions || ab.b.impressions < minImpressions) return null;
  const a = abCtr(ab.a);
  const b = abCtr(ab.b);
  if (a === b) return null;
  return a > b ? 'a' : 'b';
}
export const headlineFor = (article, variant) => (article.headlineB && variant === 'b' && abActive(article) ? article.headlineB : article.title);

export const AUDIT_LABEL = {
  'article.create': 'created an article', 'article.update': 'edited an article', 'article.transition': 'changed an article status',
  'article.delete': 'deleted an article', 'article.restore': 'restored an older version', 'article.assign': 'assigned an article',
  'user.role': 'changed a role', 'user.delete': 'deleted a user', 'section.save': 'saved a section', 'section.delete': 'deleted a section',
  'settings.update': 'updated the settings', 'alert.update': 'updated the alert banner', 'comment.moderate': 'moderated a comment',
  'newsletter.send': 'sent a newsletter', 'live.post': 'posted a live update', 'ab.winner': 'picked a headline winner',
};
