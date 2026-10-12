// In-browser stand-in for the Express API used by the live preview. It answers the same paths with
// the same response shapes and enforces the same rules (src/shared/rules.js), so the UI code is
// identical in preview and in real mode. Pure logic only: the caller supplies a storage object
// (localStorage in the browser, a shim in tests) and an `emit` function for real-time events.
import { buildSeed, newId, newToken, DEFAULT_SETTINGS } from './seed.js';
import {
  validateArticle, validateComment, validateLiveUpdate, validateSettings, validateSection, validateNewsletter, validateDigest, slugify, deriveTags,
  can, roleAtLeast, normalizeRole, ROLES, checkTransition, transitionsFor, canEditArticle, canViewArticle, isLive, inPublicArchive, isOwner, abActive, abLeader,
  rankSearch, vocabulary, didYouMean, suggest, trendingScore, forYouScore, snapshotOf, sameSnapshot, isEmail, excerpt,
  KINDS, REACTIONS, SOURCES, DEPTHS, STATUSES, COMMENT_MAX_DEPTH, REPORT_REASONS, REPORT_THRESHOLD,
} from '../shared/rules.js';

const STORE_KEY = 'news-preview-state-v2';
const DAY = 86400000;
const ok = (data, status = 200) => ({ status, data });
const fail = (status, data) => ({ status, data });
const str = (v) => (typeof v === 'string' ? v.trim() : '');
const dayKey = (t) => new Date(t).toISOString().slice(0, 10);
const clone = (v) => JSON.parse(JSON.stringify(v));
const SORTS = {
  latest: (a, b) => new Date(b.publishedAt || b.createdAt) - new Date(a.publishedAt || a.createdAt),
  oldest: (a, b) => new Date(a.publishedAt || a.createdAt) - new Date(b.publishedAt || b.createdAt),
  popular: (a, b) => b.views - a.views || new Date(b.publishedAt) - new Date(a.publishedAt),
};

export function createDemoBackend({ storage, now = () => Date.now(), emit = () => {} }) {
  let state = null;
  let persistFailed = false;

  function load() {
    if (state) return state;
    try {
      const raw = storage.getItem(STORE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.version === 2) { state = parsed; return state; }
      }
    } catch { /* reseed */ }
    state = buildSeed(now());
    persist();
    return state;
  }
  function persist() {
    try { storage.setItem(STORE_KEY, JSON.stringify(state)); persistFailed = false; return true; } catch { persistFailed = true; return false; }
  }
  const invalidate = () => { state = null; };
  function reset() { state = buildSeed(now()); persist(); }

  // ---- identity ------------------------------------------------------------------------------
  const tokenFor = (u) => `demo.${u._id}.${u.tokenVersion || 0}`;
  function authUser(headers) {
    const token = headers && (headers.authorization || headers.Authorization);
    if (!token || typeof token !== 'string') return null;
    const [tag, id, ver] = token.split('.');
    if (tag !== 'demo') return null;
    const user = load().users.find((u) => u._id === id);
    if (!user || String(user.tokenVersion || 0) !== ver) return null;
    return user;
  }
  const actorOf = (u) => (u ? { _id: u._id, role: normalizeRole(u.role), name: u.name } : null);
  const publicUser = (u) => {
    const { password: _p, tokenVersion: _t, ...rest } = u; // eslint-disable-line no-unused-vars
    return { ...rest, role: normalizeRole(u.role), follows: u.follows || { topics: [], authors: [] } };
  };
  const authorObj = (id) => {
    const u = load().users.find((x) => x._id === id);
    return u ? { _id: u._id, name: u.name, bio: u.bio || '', role: normalizeRole(u.role), image: u.image || '' } : null;
  };
  const voterOf = (user, headers) => {
    if (user) return `u:${user._id}`;
    const id = headers && headers['x-client-id'];
    return typeof id === 'string' && /^[A-Za-z0-9_-]{8,64}$/.test(id) ? `c:${id}` : null;
  };
  const audit = (actor, action, { targetType = '', targetId = '', targetLabel = '', detail = '' } = {}) => {
    load().audit.unshift({ _id: newId(), action, by: actor && actor._id, byName: actor && actor.name, byRole: actor && actor.role, targetType, targetId: String(targetId || ''), targetLabel, detail, at: new Date(now()).toISOString() });
    load().audit.length = Math.min(load().audit.length, 500);
  };
  const mail = (to, subject, text, kind = 'mail') => {
    load().inbox.unshift({ _id: newId(), to, subject, text, kind, at: new Date(now()).toISOString() });
    load().inbox.length = Math.min(load().inbox.length, 60);
  };

  // ---- articles ------------------------------------------------------------------------------
  const live = (n) => isLive(n, now());
  const canSee = (n, actor) => canViewArticle(n, actor, now());
  const catOf = (id) => load().categories.find((c) => c._id === id);
  const sectionJson = (c) => ({ ...c, slug: slugify(c.name) });
  const settings = () => ({ ...DEFAULT_SETTINGS, ...load().settings, alert: { ...DEFAULT_SETTINGS.alert, ...(load().settings.alert || {}) } });

  function shape(n, actor) {
    const o = clone(n);
    o.author = authorObj(n.author) || { _id: n.author, name: 'Former contributor', bio: '', role: 'author', image: '' };
    const ae = n.assignedEditor ? load().users.find((u) => u._id === n.assignedEditor) : null;
    o.assignedEditor = ae ? { _id: ae._id, name: ae.name } : null;
    const privileged = !!actor && (roleAtLeast(actor.role, 'editor') || isOwner(n, actor));
    const editorial = !!actor && roleAtLeast(actor.role, 'editor');
    if (!privileged) { delete o.reviewNotes; delete o.assignedEditor; delete o.submittedAt; delete o.depth; }
    if (!editorial && !abActive(n)) o.headlineB = '';
    if (!editorial) o.abTest = { winner: (n.abTest && n.abTest.winner) || '' };
    if (!o.poll) delete o.poll;
    return o;
  }
  function recordRevision(n, actor, note = '', force = false) {
    const s = load();
    const snap = snapshotOf(n);
    const mine = s.revisions.filter((r) => r.newsId === n._id);
    const last = mine.reduce((m, r) => (r.version > (m ? m.version : 0) ? r : m), null);
    if (last && !force && sameSnapshot(last.snapshot, snap)) return;
    s.revisions.push({ _id: newId(), newsId: n._id, version: (last ? last.version : 0) + 1, snapshot: snap, by: actor && actor._id, byName: actor && actor.name, note, createdAt: new Date(now()).toISOString() });
  }
  const withOptionIds = (poll) => (poll ? { ...poll, options: poll.options.map((o, i) => ({ id: o.id || `o${i + 1}`, label: o.label })) } : poll);
  function restricted(values, role) {
    if (values.featured !== undefined && !can(role, 'breaking')) return 'Only editors can feature an article';
    if (values.breaking !== undefined && !can(role, 'breaking')) return 'Only editors can mark an article as breaking news';
    if (values.headlineB && !can(role, 'ab')) return 'Only editors can set an alternative headline';
    if (values.poll && !can(role, 'polls')) return 'Only editors can add a poll';
    return '';
  }
  function engagement(n, voter) {
    const s = load();
    const reactions = Object.fromEntries(REACTIONS.map((r) => [r, 0]));
    for (const r of s.reactions) if (r.newsId === n._id && r.type in reactions) reactions[r.type] += 1;
    const mine = voter ? s.reactions.find((r) => r.newsId === n._id && r.voter === voter) : null;
    let poll = null;
    if (n.poll) {
      const votes = s.pollVotes.filter((v) => v.newsId === n._id);
      const my = voter ? votes.find((v) => v.voter === voter) : null;
      poll = {
        question: n.poll.question, closesAt: n.poll.closesAt || null, closed: !!(n.poll.closesAt && new Date(n.poll.closesAt).getTime() <= now()),
        total: votes.length, myVote: my ? my.optionId : null,
        options: n.poll.options.map((o) => ({ id: o.id, label: o.label, votes: votes.filter((v) => v.optionId === o.id).length })),
      };
    }
    return { reactions, mine: mine ? mine.type : null, poll };
  }
  function paginate(list, query, defLimit, maxLimit = 50) {
    const page = Math.max(parseInt(query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(query.limit, 10) || defLimit, 1), maxLimit);
    return { page, limit, total: list.length, pages: Math.max(Math.ceil(list.length / limit), 1), slice: list.slice((page - 1) * limit, page * limit) };
  }
  function publicList(q) {
    const t = now();
    let list = load().news.filter((n) => (q.archived === '1' ? inPublicArchive(n, t) : live(n)));
    if (q.categoryId) list = list.filter((n) => n.categoryId === q.categoryId);
    if (q.authorId) list = list.filter((n) => n.author === q.authorId);
    if (q.tag) list = list.filter((n) => (n.tags || []).includes(slugify(q.tag)));
    if (KINDS.includes(q.kind)) list = list.filter((n) => n.kind === q.kind);
    if (q.featured === '1' || q.featured === 'true') list = list.filter((n) => n.featured);
    if (typeof q.ids === 'string' && q.ids) { const ids = q.ids.split(',').slice(0, 100); list = list.filter((n) => ids.includes(n._id)); }
    const period = parseInt(q.period, 10);
    if (period > 0) list = list.filter((n) => new Date(n.publishedAt).getTime() >= t - period * DAY);
    if (q.from && !Number.isNaN(Date.parse(q.from))) list = list.filter((n) => new Date(n.publishedAt).getTime() >= Date.parse(q.from));
    if (q.to && !Number.isNaN(Date.parse(q.to))) list = list.filter((n) => new Date(n.publishedAt).getTime() <= Date.parse(q.to) + DAY - 1);
    return list;
  }
  function dailyOf(id) { return load().articleViews[id] || {}; }
  function bumpView(n, source, variant) {
    const s = load();
    const date = dayKey(now());
    n.views += 1;
    s.viewStats[date] = s.viewStats[date] || {};
    s.viewStats[date][n.categoryId] = (s.viewStats[date][n.categoryId] || 0) + 1;
    s.articleViews[n._id] = s.articleViews[n._id] || {};
    s.articleViews[n._id][date] = (s.articleViews[n._id][date] || 0) + 1;
    const d = s.dayStats[date] || { views: 0, sources: {}, depth: {} };
    d.views += 1;
    const src = SOURCES.includes(source) ? source : 'direct';
    d.sources[src] = (d.sources[src] || 0) + 1;
    s.dayStats[date] = d;
    if ((variant === 'a' || variant === 'b') && n.headlineB && !n.abTest.winner) n.abTest[variant].clicks += 1;
  }

  // ---- routes --------------------------------------------------------------------------------
  const routes = [];
  const route = (method, pattern, handler) => {
    const keys = [];
    const re = new RegExp(`^${pattern.replace(/:(\w+)/g, (_, k) => (keys.push(k), '([^/]+)'))}$`);
    routes.push({ method, re, keys, handler });
  };
  const needRole = (user, perm) => {
    if (!user) return fail(401, { status: false, message: 'Token not found' });
    if (!can(user.role, perm)) return fail(403, { status: false, message: 'You do not have permission to do this' });
    return null;
  };
  const adminCount = () => load().users.filter((u) => normalizeRole(u.role) === 'admin').length;

  route('POST', '/login', ({ body }) => {
    const user = load().users.find((u) => u.email.toLowerCase() === str(body.email).toLowerCase());
    if (!user) return fail(401, { email: 'Email not found' });
    if (user.password !== body.password) return fail(401, { password: 'Password not match' });
    return ok({ token: tokenFor(user) });
  });
  route('POST', '/login/toke-check', ({ body }) => ok({ success: !!authUser({ authorization: body.token }) }));
  route('POST', '/logout', ({ user }) => {
    if (!user) return fail(401, { status: false, message: 'Token not found' });
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    return ok({ success: true, message: 'Logged out' });
  });

  // users
  route('POST', '/user', ({ body }) => {
    const s = load();
    if (!settings().registrationOpen) return fail(403, { message: 'Registration is closed at the moment' });
    const email = str(body.email).toLowerCase();
    if (!str(body.name) || !email || !body.password) return fail(422, { message: 'name, email and password are required' });
    if (!isEmail(email)) return fail(422, { message: 'A valid email address is required' });
    if (String(body.password).length < 6) return fail(422, { message: 'The password needs at least 6 characters' });
    if (s.users.some((u) => u.email.toLowerCase() === email)) return fail(409, { email: 'User already exists' });
    s.users.push({ _id: newId(), name: str(body.name), email, password: body.password, gender: body.gender === 'female' ? 'female' : 'male', role: 'reader', image: body.image || '', bio: '', follows: { topics: [], authors: [] }, tokenVersion: 0, createdAt: new Date(now()).toISOString() });
    return ok({ success: true, message: 'User created successfully' }, 201);
  });
  route('GET', '/user', ({ user }) => {
    if (!user) return fail(401, { status: false, message: 'Token not found' });
    if (normalizeRole(user.role) === 'admin') return ok(load().users.filter((u) => u._id !== user._id).map(publicUser));
    return ok([publicUser(user)]);
  });
  route('GET', '/user/profile/user', ({ user }) => (user ? ok(publicUser(user)) : fail(401, { status: false, message: 'Invalid token' })));
  route('PUT', '/user/follows', ({ user, body }) => {
    if (!user) return fail(401, { status: false, message: 'Token not found' });
    const s = load();
    const topics = (Array.isArray(body.topics) ? body.topics : []).filter((id) => s.categories.some((c) => c._id === id)).slice(0, 50);
    const authors = (Array.isArray(body.authors) ? body.authors : []).filter((id) => s.users.some((u) => u._id === id)).slice(0, 100);
    user.follows = { topics, authors };
    return ok({ success: true, topics, authors });
  });
  route('PUT', '/user/upload-profile/:id', ({ user, params, body }) => {
    if (!user) return fail(401, { status: false, message: 'Invalid token' });
    if (normalizeRole(user.role) !== 'admin' && user._id !== params.id) return fail(403, { status: false, message: 'Forbidden' });
    const target = load().users.find((u) => u._id === params.id);
    if (!target) return fail(404, { message: 'User not found' });
    if (!body.image) return fail(400, { message: 'Image file is required' });
    target.image = body.image;
    return ok({ success: true, message: 'Image uploaded successfully' });
  });
  route('DELETE', '/user/delete-profile/:id', ({ user, params }) => {
    if (!user) return fail(401, { status: false, message: 'Invalid token' });
    if (normalizeRole(user.role) !== 'admin' && user._id !== params.id) return fail(403, { status: false, message: 'Forbidden' });
    const target = load().users.find((u) => u._id === params.id);
    if (!target) return fail(404, { message: 'User not found' });
    target.image = '';
    return ok({ success: true, message: 'Profile image deleted successfully' });
  });
  route('GET', '/user/:id', ({ user, params }) => {
    if (!user) return fail(401, { status: false, message: 'Token not found' });
    const target = load().users.find((u) => u._id === params.id);
    return target ? ok(publicUser(target)) : fail(404, { message: 'User not found' });
  });
  route('PUT', '/user/:id', ({ user, params, body }) => {
    if (!user) return fail(401, { status: false, message: 'Invalid token' });
    const isAdmin = normalizeRole(user.role) === 'admin';
    if (!isAdmin && user._id !== params.id) return fail(403, { status: false, message: 'Forbidden' });
    const target = load().users.find((u) => u._id === params.id);
    if (!target) return fail(404, { message: 'User not found' });
    const patch = {};
    if (body.name !== undefined) { patch.name = str(body.name); if (!patch.name) return fail(422, { message: 'Name is required' }); }
    if (body.email !== undefined) {
      patch.email = str(body.email).toLowerCase();
      if (!isEmail(patch.email)) return fail(422, { message: 'A valid email address is required' });
      if (load().users.some((u) => u._id !== target._id && u.email.toLowerCase() === patch.email)) return fail(409, { message: 'That email is already used' });
    }
    if (body.gender === 'male' || body.gender === 'female') patch.gender = body.gender;
    if (body.bio !== undefined) { patch.bio = str(body.bio); if (patch.bio.length > 300) return fail(422, { message: 'The bio can have at most 300 characters' }); }
    if (body.password) {
      if (String(body.password).length < 6) return fail(422, { message: 'The password needs at least 6 characters' });
      patch.password = body.password;
    }
    let roleChanged = null;
    if (body.role !== undefined && isAdmin) {
      if (!ROLES.includes(body.role)) return fail(422, { message: 'Role must be reader, author, editor or admin' });
      if (normalizeRole(target.role) === 'admin' && body.role !== 'admin' && adminCount() <= 1) return fail(409, { message: 'The last admin cannot be demoted' });
      if (normalizeRole(target.role) !== body.role) roleChanged = body.role;
      patch.role = body.role;
    }
    Object.assign(target, patch);
    if (roleChanged) { target.tokenVersion = (target.tokenVersion || 0) + 1; audit(actorOf(user), 'user.role', { targetType: 'user', targetId: target._id, targetLabel: target.name, detail: `-> ${roleChanged}` }); }
    return ok({ success: true, message: 'User updated successfully' });
  });
  route('DELETE', '/user/:id', ({ user, params }) => {
    if (!user) return fail(401, { status: false, message: 'Invalid token' });
    if (normalizeRole(user.role) !== 'admin' && user._id !== params.id) return fail(403, { status: false, message: 'Forbidden' });
    const s = load();
    const target = s.users.find((u) => u._id === params.id);
    if (!target) return fail(404, { message: 'User not found' });
    if (normalizeRole(target.role) === 'admin' && adminCount() <= 1) return fail(409, { message: 'The last admin cannot be deleted' });
    s.users = s.users.filter((u) => u._id !== params.id);
    delete s.bookmarks[params.id];
    audit(actorOf(user), 'user.delete', { targetType: 'user', targetId: target._id, targetLabel: target.name });
    return ok({ success: true, message: 'User deleted successfully' });
  });
  route('GET', '/authors', () => {
    const s = load();
    const out = s.users.map((u) => {
      const mine = s.news.filter((n) => n.author === u._id && live(n));
      return { _id: u._id, name: u.name, bio: u.bio || '', role: normalizeRole(u.role), image: u.image || '', articles: mine.length, followers: s.users.filter((x) => (x.follows && x.follows.authors || []).includes(u._id)).length };
    }).filter((a) => a.articles > 0).sort((a, b) => b.articles - a.articles);
    return ok(out);
  });
  route('GET', '/authors/:id', ({ params }) => {
    const s = load();
    const u = s.users.find((x) => x._id === params.id);
    if (!u || !roleAtLeast(u.role, 'author')) return fail(404, { message: 'Author not found' });
    return ok({ _id: u._id, name: u.name, bio: u.bio || '', role: normalizeRole(u.role), image: u.image || '', articles: s.news.filter((n) => n.author === u._id && live(n)).length, followers: s.users.filter((x) => (x.follows && x.follows.authors || []).includes(u._id)).length, since: u.createdAt });
  });

  // sections
  route('GET', '/category', () => {
    const s = load();
    const sorted = [...s.categories].sort((a, b) => (a.order ?? 100) - (b.order ?? 100) || a.name.localeCompare(b.name));
    return ok(sorted.map((c) => ({ ...sectionJson(c), newsCount: s.news.filter((n) => n.categoryId === c._id && live(n)).length })));
  });
  route('GET', '/category/menu', () => {
    const s = load();
    const sorted = [...s.categories].sort((a, b) => (a.order ?? 100) - (b.order ?? 100));
    return ok(sorted.map((c) => {
      const items = s.news.filter((n) => n.categoryId === c._id && live(n)).sort(SORTS.latest);
      const counts = {};
      for (const n of items) for (const t of n.tags || []) counts[t] = (counts[t] || 0) + 1;
      const tags = Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 5).map((x) => x[0]);
      return { ...sectionJson(c), latest: items.slice(0, 3).map((n) => ({ _id: n._id, title: n.title, slug: n.slug, publishedAt: n.publishedAt })), tags };
    }));
  });
  route('GET', '/category/:id', ({ params }) => {
    const c = catOf(params.id);
    return c ? ok(sectionJson(c)) : fail(404, { message: 'Category not found' });
  });
  route('POST', '/category', ({ user, body }) => {
    const denied = needRole(user, 'sections');
    if (denied) return denied;
    const { errors, values } = validateSection(body);
    if (Object.keys(errors).length) return fail(422, { success: false, message: Object.values(errors)[0], errors });
    const s = load();
    if (s.categories.some((c) => c.name.toLowerCase() === values.name.toLowerCase())) return fail(409, { success: false, message: 'Category already exists!' });
    const c = { _id: newId(), name: values.name, description: values.description, order: values.order ?? (s.categories.length * 10 + 10), createdAt: new Date(now()).toISOString() };
    s.categories.push(c);
    audit(actorOf(user), 'section.save', { targetType: 'section', targetId: c._id, targetLabel: c.name });
    return ok({ success: true, message: 'Category created successfully!' }, 201);
  });
  route('PUT', '/category/:id', ({ user, params, body }) => {
    const denied = needRole(user, 'sections');
    if (denied) return denied;
    const c = catOf(params.id);
    if (!c) return fail(404, { success: false, message: 'Category not found' });
    const { errors, values } = validateSection({ name: body.name ?? c.name, description: body.description ?? c.description, order: body.order });
    if (Object.keys(errors).length) return fail(422, { success: false, message: Object.values(errors)[0], errors });
    if (load().categories.some((x) => x._id !== c._id && x.name.toLowerCase() === values.name.toLowerCase())) return fail(409, { success: false, message: 'Category already exists!' });
    Object.assign(c, values);
    audit(actorOf(user), 'section.save', { targetType: 'section', targetId: c._id, targetLabel: c.name });
    return ok({ success: true, message: 'Category updated successfully!' });
  });
  route('DELETE', '/category/:id', ({ user, params }) => {
    const denied = needRole(user, 'sections');
    if (denied) return denied;
    const s = load();
    const c = catOf(params.id);
    if (!c) return fail(404, { success: false, message: 'Category not found' });
    if (s.news.some((n) => n.categoryId === c._id)) return fail(409, { success: false, message: 'Category still has news; delete or move them first' });
    s.categories = s.categories.filter((x) => x._id !== c._id);
    audit(actorOf(user), 'section.delete', { targetType: 'section', targetId: c._id, targetLabel: c.name });
    return ok({ success: true, message: 'Category deleted successfully!' });
  });

  // news: lists
  route('GET', '/news', ({ query, user }) => {
    const search = str(query.search);
    const actor = actorOf(user);
    if (search) {
      const ranked = rankSearch(search, publicList(query));
      const p = paginate(ranked, query, 9);
      const suggestion = ranked.length < 3 ? didYouMean(search, vocabulary(publicList(query))) : '';
      return ok({ news: p.slice.map((r) => shape(r.article, actor)), page: p.page, limit: p.limit, total: p.total, pages: p.pages, suggestion, fuzzy: ranked.some((r) => r.fuzzy) });
    }
    const list = publicList(query).sort(SORTS[query.sort] || SORTS.latest);
    const p = paginate(list, query, 9);
    return ok({ news: p.slice.map((n) => shape(n, actor)), page: p.page, limit: p.limit, total: p.total, pages: p.pages });
  });
  route('GET', '/news/trending', ({ query, user }) => {
    const limit = Math.min(Math.max(parseInt(query.limit, 10) || 5, 1), 20);
    const t = now();
    let list = load().news.filter(live);
    if (query.categoryId) list = list.filter((n) => n.categoryId === query.categoryId);
    const scored = list.map((n) => ({ n, s: trendingScore({ daily: dailyOf(n._id), views: n.views, publishedAt: n.publishedAt }, t) })).sort((a, b) => b.s - a.s);
    return ok({ news: scored.slice(0, limit).map((x) => shape(x.n, actorOf(user))) });
  });
  route('GET', '/news/for-you', ({ query, user }) => {
    const split = (v) => (typeof v === 'string' && v ? v.split(',').slice(0, 50) : []);
    const prefs = { topics: split(query.topics), authors: split(query.authors), tags: split(query.tags) };
    const exclude = new Set(split(query.exclude));
    const limit = Math.min(Math.max(parseInt(query.limit, 10) || 12, 1), 30);
    const t = now();
    const ranked = load().news.filter((n) => live(n) && !exclude.has(n._id)).map((n) => ({ n, ...forYouScore(n, prefs, t) })).sort((a, b) => b.score - a.score).slice(0, limit);
    return ok({ news: ranked.map((r) => ({ ...shape(r.n, actorOf(user)), reasons: r.reasons })), personalised: prefs.topics.length + prefs.authors.length > 0 });
  });
  route('GET', '/news/breaking', () => {
    const t = now();
    const list = load().news.filter((n) => live(n) && n.breaking && new Date(n.publishedAt).getTime() >= t - 48 * 3600000).sort(SORTS.latest).slice(0, 5);
    return ok({ news: list.map((n) => ({ _id: n._id, title: n.title, slug: n.slug, kind: n.kind, publishedAt: n.publishedAt })) });
  });
  route('GET', '/news/archive', () => {
    const counts = {};
    for (const n of load().news) if (inPublicArchive(n, now())) { const k = dayKey(n.publishedAt).slice(0, 7); counts[k] = (counts[k] || 0) + 1; }
    return ok({ months: Object.keys(counts).sort().reverse().map((key) => ({ key, count: counts[key] })) });
  });
  route('GET', '/news/manage/list', ({ user, query }) => {
    const denied = needRole(user, 'article.create');
    if (denied) return denied;
    const editorial = roleAtLeast(user.role, 'editor');
    const base = load().news.filter((n) => editorial || n.author === user._id);
    let list = base;
    const q = str(query.search).toLowerCase();
    if (q) list = list.filter((n) => n.title.toLowerCase().includes(q) || n.summary.toLowerCase().includes(q));
    if (STATUSES.includes(query.status)) list = list.filter((n) => n.status === query.status);
    if (query.status === 'review') list = list.filter((n) => ['submitted', 'in_review', 'changes_requested', 'approved'].includes(n.status));
    if (query.assignee === 'me') list = list.filter((n) => n.assignedEditor === user._id);
    if (query.assignee === 'none') list = list.filter((n) => !n.assignedEditor);
    list = [...list].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    const p = paginate(list, query, 10);
    const counts = {};
    for (const n of base) counts[n.status] = (counts[n.status] || 0) + 1;
    return ok({ news: p.slice.map((n) => shape(n, actorOf(user))), page: p.page, limit: p.limit, total: p.total, pages: p.pages, counts });
  });
  route('GET', '/news/news-details/:slug', ({ user, params, headers }) => {
    const n = load().news.find((x) => x.slug === params.slug);
    const actor = actorOf(user);
    if (!n || !canSee(n, actor)) return fail(404, { message: 'News not found' });
    const related = load().news.filter((x) => x.categoryId === n.categoryId && x._id !== n._id && live(x)).sort(SORTS.popular).slice(0, 4);
    return ok({ findNews: shape(n, actor), relatedNews: related.map((r) => shape(r, actor)), engagement: engagement(n, voterOf(user, headers)) });
  });
  route('POST', '/news/ab/impressions', ({ body }) => {
    for (const i of (Array.isArray(body.items) ? body.items : []).slice(0, 40)) {
      const n = i && load().news.find((x) => x._id === i.id);
      if (n && (i.variant === 'a' || i.variant === 'b') && n.headlineB && !n.abTest.winner) n.abTest[i.variant].impressions += 1;
    }
    return ok({ success: true });
  });

  // news: create / update / delete
  route('POST', '/news', ({ user, body }) => {
    const denied = needRole(user, 'article.create');
    if (denied) return denied;
    const s = load();
    const actor = actorOf(user);
    const { errors, values } = validateArticle(body, { partial: false });
    if (values.categoryId && !catOf(values.categoryId)) errors.categoryId = 'Category does not exist';
    const slug = slugify(str(body.slug) || values.title);
    if (!slug) errors.slug = 'Slug is required';
    if (Object.keys(errors).length) return fail(422, { success: false, message: 'Validation failed', errors });
    const deniedField = restricted(values, actor.role);
    if (deniedField) return fail(403, { success: false, message: deniedField });
    if (s.news.some((n) => n.slug === slug)) return fail(409, { success: false, message: 'Slug already exists', errors: { slug: 'Slug already exists' } });
    const t = new Date(now()).toISOString();
    const n = {
      _id: newId(), ...values, slug, image: body.image || '', status: 'draft', publishedAt: null, submittedAt: null, views: 0, depth: { 25: 0, 50: 0, 75: 0, 100: 0 },
      author: user._id, assignedEditor: null, reviewNotes: [], createdAt: t, updatedAt: t,
      tags: values.tags && values.tags.length ? values.tags : deriveTags(values.title), poll: withOptionIds(values.poll) || null,
      factCheck: values.factCheck || null, embed: values.embed || null, gallery: values.gallery || [], headlineB: values.headlineB || '', sponsor: values.sponsor || '',
      imageAlt: values.imageAlt || '', kind: values.kind || 'news', featured: !!values.featured, breaking: !!values.breaking, abTest: { a: { impressions: 0, clicks: 0 }, b: { impressions: 0, clicks: 0 }, winner: '' },
    };
    const wanted = str(body.status);
    if (wanted && wanted !== 'draft') {
      const moved = checkTransition({ status: 'draft', author: user._id }, wanted, actor, { note: body.note, publishedAt: body.publishedAt, now: now() });
      if (!moved.ok) return fail(moved.status, { success: false, message: moved.message, errors: moved.errors });
      Object.assign(n, moved.patch);
      if (wanted === 'submitted') n.submittedAt = t;
    }
    s.news.push(n);
    recordRevision(n, actor, 'First version');
    audit(actor, 'article.create', { targetType: 'article', targetId: n._id, targetLabel: n.title });
    return ok({ success: true, message: 'News created successfully', id: n._id, slug, status: n.status }, 201);
  });
  route('POST', '/news/:id/view', ({ params, body }) => {
    const n = load().news.find((x) => x._id === params.id);
    if (!n || !inPublicArchive(n, now())) return fail(404, { message: 'News not found' });
    bumpView(n, body.source, body.variant);
    return ok({ success: true, views: n.views });
  });
  route('POST', '/news/:id/depth', ({ params, body }) => {
    const n = load().news.find((x) => x._id === params.id);
    const d = Number(body.depth);
    if (!DEPTHS.includes(d)) return fail(422, { success: false, message: 'depth must be 25, 50, 75 or 100' });
    if (!n || !inPublicArchive(n, now())) return fail(404, { message: 'News not found' });
    n.depth = n.depth || {};
    n.depth[d] = (n.depth[d] || 0) + 1;
    const date = dayKey(now());
    const ds = load().dayStats[date] || { views: 0, sources: {}, depth: {} };
    ds.depth[d] = (ds.depth[d] || 0) + 1;
    load().dayStats[date] = ds;
    return ok({ success: true });
  });
  route('GET', '/news/:id/engagement', ({ user, params, headers }) => {
    const n = load().news.find((x) => x._id === params.id);
    if (!n || !canSee(n, actorOf(user))) return fail(404, { success: false, message: 'News not found' });
    return ok(engagement(n, voterOf(user, headers)));
  });
  route('PUT', '/news/:id/reaction', ({ user, params, body, headers }) => {
    const s = load();
    const n = s.news.find((x) => x._id === params.id);
    const voter = voterOf(user, headers);
    if (!n || !live(n)) return fail(404, { success: false, message: 'News not found' });
    if (!voter) return fail(422, { success: false, message: 'Missing client id' });
    s.reactions = s.reactions.filter((r) => !(r.newsId === n._id && r.voter === voter));
    if (body.type !== null && body.type !== undefined && body.type !== '') {
      if (!REACTIONS.includes(body.type)) return fail(422, { success: false, message: 'Unknown reaction' });
      s.reactions.push({ newsId: n._id, voter, type: body.type });
    }
    return ok(engagement(n, voter));
  });
  route('POST', '/news/:id/poll/vote', ({ user, params, body, headers }) => {
    const s = load();
    const n = s.news.find((x) => x._id === params.id);
    const voter = voterOf(user, headers);
    if (!n || !n.poll || !live(n)) return fail(404, { success: false, message: 'News not found' });
    if (!voter) return fail(422, { success: false, message: 'Missing client id' });
    if (n.poll.closesAt && new Date(n.poll.closesAt).getTime() <= now()) return fail(409, { success: false, message: 'This poll is closed' });
    const optionId = str(body.optionId);
    if (!n.poll.options.some((o) => o.id === optionId)) return fail(422, { success: false, message: 'Choose one of the answers' });
    if (s.pollVotes.some((v) => v.newsId === n._id && v.voter === voter)) return fail(409, { success: false, message: 'You have already voted', ...engagement(n, voter) });
    s.pollVotes.push({ newsId: n._id, voter, optionId });
    return ok({ success: true, ...engagement(n, voter) });
  });

  // live blog
  route('GET', '/news/:id/live', ({ user, params }) => {
    const n = load().news.find((x) => x._id === params.id);
    if (!n || !canSee(n, actorOf(user))) return fail(404, { success: false, message: 'News not found' });
    const rows = load().live.filter((u) => u.newsId === n._id).sort((a, b) => Number(b.pinned) - Number(a.pinned) || new Date(b.createdAt) - new Date(a.createdAt));
    return ok({ updates: rows });
  });
  const liveGate = (user, id) => {
    if (!user) return { error: fail(401, { status: false, message: 'Token not found' }) };
    const n = load().news.find((x) => x._id === id);
    if (!n) return { error: fail(404, { success: false, message: 'News not found' }) };
    const allowed = n.kind === 'live' && (can(user.role, 'live.any') || (can(user.role, 'live.own') && isOwner(n, user)));
    if (!allowed) return { error: fail(403, { success: false, message: n.kind === 'live' ? 'Only the author or an editor can post live updates' : 'This article is not a live blog' }) };
    return { n };
  };
  route('POST', '/news/:id/live', ({ user, params, body }) => {
    const g = liveGate(user, params.id);
    if (g.error) return g.error;
    const { errors, values } = validateLiveUpdate(body);
    if (Object.keys(errors).length) return fail(422, { success: false, message: 'Validation failed', errors });
    const t = new Date(now()).toISOString();
    const row = { _id: newId(), newsId: g.n._id, ...values, by: user._id, byName: user.name, createdAt: t, updatedAt: t };
    load().live.push(row);
    audit(actorOf(user), 'live.post', { targetType: 'article', targetId: g.n._id, targetLabel: g.n.title });
    emit('live:update', { newsId: g.n._id, type: 'add', update: row });
    return ok({ success: true, update: row }, 201);
  });
  route('PUT', '/news/:id/live/:uid', ({ user, params, body }) => {
    const g = liveGate(user, params.id);
    if (g.error) return g.error;
    const { errors, values } = validateLiveUpdate({ ...body, body: body.body ?? 'x' });
    if (Object.keys(errors).length) return fail(422, { success: false, message: 'Validation failed', errors });
    const row = load().live.find((u) => u._id === params.uid && u.newsId === g.n._id);
    if (!row) return fail(404, { success: false, message: 'Update not found' });
    Object.assign(row, { important: values.important, pinned: values.pinned, updatedAt: new Date(now()).toISOString() });
    if (body.body !== undefined) row.body = values.body;
    emit('live:update', { newsId: g.n._id, type: 'edit', update: row });
    return ok({ success: true, update: row });
  });
  route('DELETE', '/news/:id/live/:uid', ({ user, params }) => {
    const g = liveGate(user, params.id);
    if (g.error) return g.error;
    const row = load().live.find((u) => u._id === params.uid && u.newsId === g.n._id);
    if (!row) return fail(404, { success: false, message: 'Update not found' });
    load().live = load().live.filter((u) => u._id !== row._id);
    emit('live:update', { newsId: g.n._id, type: 'delete', update: { _id: row._id } });
    return ok({ success: true });
  });

  // editorial workflow
  route('POST', '/news/:id/transition', ({ user, params, body }) => {
    const denied = needRole(user, 'article.create');
    if (denied) return denied;
    const n = load().news.find((x) => x._id === params.id);
    const actor = actorOf(user);
    if (!n || !canSee(n, actor)) return fail(404, { success: false, message: 'News not found' });
    const to = str(body.to);
    const note = str(body.note);
    const moved = checkTransition(n, to, actor, { note, publishedAt: body.publishedAt, now: now() });
    if (!moved.ok) return fail(moved.status, { success: false, message: moved.message, errors: moved.errors });
    const from = n.status;
    const t = new Date(now()).toISOString();
    Object.assign(n, moved.patch, { updatedAt: t });
    if (to === 'submitted') n.submittedAt = t;
    if (to === 'in_review' && !n.assignedEditor && roleAtLeast(actor.role, 'editor')) n.assignedEditor = actor._id;
    if (note || to === 'approved') n.reviewNotes.push({ _id: newId(), by: actor._id, byName: actor.name, byRole: actor.role, type: to === 'changes_requested' ? 'changes' : to === 'approved' ? 'approval' : 'comment', body: note || 'Approved', at: t });
    if (to === 'published') recordRevision(n, actor, 'Published', true);
    audit(actor, 'article.transition', { targetType: 'article', targetId: n._id, targetLabel: n.title, detail: `${from} -> ${to}` });
    if (to === 'published' && n.breaking) emit('breaking', { _id: n._id, title: n.title, slug: n.slug });
    return ok({ success: true, message: 'Status updated', status: n.status, article: shape(n, actor), transitions: transitionsFor(n, actor, now()) });
  });
  route('POST', '/news/:id/notes', ({ user, params, body }) => {
    const denied = needRole(user, 'article.create');
    if (denied) return denied;
    const n = load().news.find((x) => x._id === params.id);
    const actor = actorOf(user);
    if (!n || !canSee(n, actor)) return fail(404, { success: false, message: 'News not found' });
    if (!roleAtLeast(actor.role, 'editor') && !isOwner(n, actor)) return fail(403, { success: false, message: 'Forbidden' });
    const text = str(body.body);
    if (!text || text.length > 2000) return fail(422, { success: false, message: 'Write a note of up to 2000 characters', errors: { body: 'Write a note of up to 2000 characters' } });
    n.reviewNotes.push({ _id: newId(), by: actor._id, byName: actor.name, byRole: actor.role, type: 'comment', body: text, at: new Date(now()).toISOString() });
    return ok({ success: true, notes: n.reviewNotes }, 201);
  });
  route('PUT', '/news/:id/assign', ({ user, params, body }) => {
    const denied = needRole(user, 'assign');
    if (denied) return denied;
    const n = load().news.find((x) => x._id === params.id);
    if (!n) return fail(404, { success: false, message: 'News not found' });
    let editor = null;
    if (body.editorId) {
      editor = load().users.find((u) => u._id === body.editorId);
      if (!editor || !roleAtLeast(editor.role, 'editor')) return fail(422, { success: false, message: 'Pick an editor or an admin', errors: { editorId: 'Pick an editor or an admin' } });
    }
    n.assignedEditor = editor ? editor._id : null;
    audit(actorOf(user), 'article.assign', { targetType: 'article', targetId: n._id, targetLabel: n.title, detail: editor ? editor.name : 'unassigned' });
    return ok({ success: true, assignedEditor: editor ? { _id: editor._id, name: editor.name } : null });
  });
  route('GET', '/news/:id/revisions', ({ user, params }) => {
    const denied = needRole(user, 'article.create');
    if (denied) return denied;
    const n = load().news.find((x) => x._id === params.id);
    if (!n || !(roleAtLeast(user.role, 'editor') || isOwner(n, user))) return fail(404, { success: false, message: 'News not found' });
    return ok({ revisions: load().revisions.filter((r) => r.newsId === n._id).sort((a, b) => b.version - a.version).slice(0, 100) });
  });
  route('POST', '/news/:id/revisions/:rid/restore', ({ user, params }) => {
    const denied = needRole(user, 'article.create');
    if (denied) return denied;
    const n = load().news.find((x) => x._id === params.id);
    const actor = actorOf(user);
    if (!n || !canSee(n, actor)) return fail(404, { success: false, message: 'News not found' });
    if (!canEditArticle(n, actor)) return fail(403, { success: false, message: 'You cannot edit this article right now' });
    const rev = load().revisions.find((r) => r._id === params.rid && r.newsId === n._id);
    if (!rev) return fail(404, { success: false, message: 'Version not found' });
    Object.assign(n, clone(rev.snapshot), { updatedAt: new Date(now()).toISOString() });
    recordRevision(n, actor, `Restored version ${rev.version}`, true);
    audit(actor, 'article.restore', { targetType: 'article', targetId: n._id, targetLabel: n.title, detail: `version ${rev.version}` });
    return ok({ success: true, message: `Version ${rev.version} restored` });
  });
  route('POST', '/news/:id/ab/winner', ({ user, params, body }) => {
    const denied = needRole(user, 'ab');
    if (denied) return denied;
    const n = load().news.find((x) => x._id === params.id);
    if (!n) return fail(404, { success: false, message: 'News not found' });
    const variant = body.variant === 'b' ? 'b' : body.variant === 'a' ? 'a' : abLeader(n.abTest);
    if (!variant || !n.headlineB) return fail(422, { success: false, message: 'Choose a headline (a or b) to keep' });
    n.abTest.winner = variant;
    if (variant === 'b') { const old = n.title; n.title = n.headlineB; n.headlineB = old; }
    recordRevision(n, actorOf(user), `Headline test finished: ${variant.toUpperCase()} wins`, true);
    audit(actorOf(user), 'ab.winner', { targetType: 'article', targetId: n._id, targetLabel: n.title, detail: variant });
    return ok({ success: true, winner: variant });
  });
  route('GET', '/news/:id', ({ user, params }) => {
    const n = load().news.find((x) => x._id === params.id);
    if (!n || !canSee(n, actorOf(user))) return fail(404, { message: 'News not found' });
    return ok(shape(n, actorOf(user)));
  });
  route('PUT', '/news/:id', ({ user, params, body }) => {
    const denied = needRole(user, 'article.create');
    if (denied) return denied;
    const s = load();
    const actor = actorOf(user);
    const n = s.news.find((x) => x._id === params.id);
    if (!n || !canSee(n, actor)) return fail(404, { success: false, message: 'News not found' });
    if (!canEditArticle(n, actor)) return fail(403, { success: false, message: 'This article can no longer be edited by you. Withdraw it first, or ask an editor.' });
    const { errors, values } = validateArticle(body, { partial: true });
    if (values.categoryId && !catOf(values.categoryId)) errors.categoryId = 'Category does not exist';
    if ((values.kind === 'sponsored' || (values.kind === undefined && n.kind === 'sponsored')) && !(values.sponsor ?? n.sponsor)) errors.sponsor = 'Name the sponsor of a sponsored article';
    let slug;
    if (body.slug !== undefined) {
      slug = slugify(str(body.slug) || values.title || n.title);
      if (!slug) errors.slug = 'Slug is required';
    }
    if (Object.keys(errors).length) return fail(422, { success: false, message: 'Validation failed', errors });
    const deniedField = restricted(values, actor.role);
    if (deniedField) return fail(403, { success: false, message: deniedField });
    if (slug && slug !== n.slug) {
      if (s.news.some((x) => x._id !== n._id && x.slug === slug)) return fail(409, { success: false, message: 'Slug already exists', errors: { slug: 'Slug already exists' } });
      values.slug = slug;
    }
    if (values.poll) values.poll = withOptionIds(values.poll);
    if (values.headlineB !== undefined && values.headlineB !== n.headlineB) values.abTest = { a: { impressions: 0, clicks: 0 }, b: { impressions: 0, clicks: 0 }, winner: '' };
    const wasBreaking = n.breaking;
    if (body.image !== undefined && body.image !== '') values.image = body.image;
    Object.assign(n, values, { updatedAt: new Date(now()).toISOString() });
    recordRevision(n, actor, str(body.revisionNote));
    audit(actor, 'article.update', { targetType: 'article', targetId: n._id, targetLabel: n.title });
    if (n.breaking && !wasBreaking && live(n)) emit('breaking', { _id: n._id, title: n.title, slug: n.slug });
    return ok({ success: true, message: 'News updated successfully' });
  });
  route('DELETE', '/news/:id', ({ user, params }) => {
    const denied = needRole(user, 'article.delete');
    if (denied) return denied;
    const s = load();
    const n = s.news.find((x) => x._id === params.id);
    if (!n) return fail(404, { success: false, message: 'News not found' });
    s.news = s.news.filter((x) => x._id !== n._id);
    s.comments = s.comments.filter((c) => c.newsId !== n._id);
    s.revisions = s.revisions.filter((r) => r.newsId !== n._id);
    s.live = s.live.filter((u) => u.newsId !== n._id);
    s.reactions = s.reactions.filter((r) => r.newsId !== n._id);
    s.pollVotes = s.pollVotes.filter((r) => r.newsId !== n._id);
    for (const id of Object.keys(s.bookmarks)) s.bookmarks[id] = s.bookmarks[id].filter((x) => x !== n._id);
    audit(actorOf(user), 'article.delete', { targetType: 'article', targetId: n._id, targetLabel: n.title });
    return ok({ success: true, message: 'News deleted successfully' });
  });
  route('POST', '/upload', ({ user, body }) => {
    const denied = needRole(user, 'upload');
    if (denied) return denied;
    if (!body.image) return fail(422, { success: false, message: 'Choose a picture (PNG, JPG, GIF, WebP or SVG up to 8 MB)' });
    return ok({ success: true, url: body.image }, 201);
  });

  // search
  route('GET', '/search/suggest', ({ query }) => {
    const q = str(query.q);
    if (q.length < 2) return ok({ suggestions: [] });
    return ok({ suggestions: suggest(q, load().news.filter(live), load().categories.map(sectionJson)) });
  });

  // comments
  const commentJson = (c) => {
    const author = c.userId ? load().users.find((u) => u._id === c.userId) : null;
    return { _id: c._id, newsId: c.newsId, parentId: c.parentId || null, name: c.name, body: c.body, createdAt: c.createdAt, isStaff: !!(author && roleAtLeast(author.role, 'editor')) };
  };
  route('GET', '/comments', ({ query }) => {
    if (!query.newsId) return fail(422, { success: false, message: 'newsId is required' });
    return ok(load().comments.filter((c) => c.newsId === query.newsId && c.status === 'approved').sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)).map(commentJson));
  });
  route('POST', '/comments', ({ user, body }) => {
    const s = load();
    if (!settings().commentsOpen) return fail(403, { success: false, message: 'Comments are closed at the moment' });
    const newsId = str(body.newsId);
    const { errors, values } = validateComment(body);
    if (!newsId) errors.newsId = 'A valid article is required';
    const name = user ? user.name : values.name;
    if (!name) errors.name = 'Name is required';
    let parent = null;
    if (values.parentId) {
      parent = s.comments.find((c) => c._id === values.parentId && c.newsId === newsId && c.status === 'approved');
      let depth = 1;
      for (let cur = parent; cur && cur.parentId && depth < 10; depth++) cur = s.comments.find((c) => c._id === cur.parentId);
      if (!parent) errors.parentId = 'The comment you reply to is not available';
      else if (depth >= COMMENT_MAX_DEPTH) errors.parentId = 'Replies can only go three levels deep';
    }
    if (Object.keys(errors).length) return fail(422, { success: false, message: 'Validation failed', errors });
    const n = s.news.find((x) => x._id === newsId);
    if (!n || !live(n)) return fail(404, { success: false, message: 'News not found' });
    const approved = !!(user && roleAtLeast(user.role, 'editor'));
    const t = new Date(now()).toISOString();
    const c = { _id: newId(), newsId, userId: user ? user._id : null, parentId: parent ? parent._id : null, name, body: values.body, status: approved ? 'approved' : 'pending', reports: [], createdAt: t, updatedAt: t };
    s.comments.push(c);
    return ok({ success: true, message: approved ? 'Comment published' : 'Thanks! Your comment is awaiting moderation', status: c.status, id: c._id }, 201);
  });
  route('POST', '/comments/:id/report', ({ user, params, body, headers }) => {
    const voter = voterOf(user, headers);
    const reason = REPORT_REASONS.includes(body.reason) ? body.reason : 'other';
    if (!voter) return fail(422, { success: false, message: 'Missing client id' });
    const c = load().comments.find((x) => x._id === params.id && x.status === 'approved');
    if (!c) return fail(404, { success: false, message: 'Comment not found' });
    if (c.reports.some((r) => r.voter === voter)) return ok({ success: true, message: 'You already reported this comment' });
    c.reports.push({ voter, reason, at: new Date(now()).toISOString() });
    if (c.reports.length >= REPORT_THRESHOLD) c.status = 'pending';
    return ok({ success: true, message: 'Thanks, an editor will take a look', hidden: c.status === 'pending' }, 201);
  });
  route('GET', '/comments/manage/list', ({ user, query }) => {
    const denied = needRole(user, 'comments.moderate');
    if (denied) return denied;
    const s = load();
    let list = [...s.comments];
    if (['pending', 'approved', 'rejected'].includes(query.status)) list = list.filter((c) => c.status === query.status);
    if (query.status === 'reported') list = list.filter((c) => c.reports.length > 0);
    list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const p = paginate(list, query, 20, 100);
    return ok({
      comments: p.slice.map((c) => {
        const n = s.news.find((x) => x._id === c.newsId);
        return { _id: c._id, name: c.name, body: c.body, status: c.status, createdAt: c.createdAt, parentId: c.parentId || null, reports: c.reports.map((r) => ({ reason: r.reason, at: r.at })), news: n ? { _id: n._id, title: n.title, slug: n.slug } : null };
      }),
      page: p.page, limit: p.limit, total: p.total, pages: p.pages, pending: s.comments.filter((c) => c.status === 'pending').length, reported: s.comments.filter((c) => c.reports.length > 0).length,
    });
  });
  route('PUT', '/comments/:id', ({ user, params, body }) => {
    const denied = needRole(user, 'comments.moderate');
    if (denied) return denied;
    const c = load().comments.find((x) => x._id === params.id);
    if (!c) return fail(404, { success: false, message: 'Comment not found' });
    if (body.status !== undefined) {
      if (!['pending', 'approved', 'rejected'].includes(body.status)) return fail(422, { success: false, message: 'Status must be pending, approved or rejected' });
      c.status = body.status;
    }
    if (body.clearReports) c.reports = [];
    audit(actorOf(user), 'comment.moderate', { targetType: 'comment', targetId: c._id, targetLabel: c.body.slice(0, 60), detail: body.status || 'reports cleared' });
    return ok({ success: true, message: 'Comment updated' });
  });
  route('DELETE', '/comments/:id', ({ user, params }) => {
    const denied = needRole(user, 'comments.moderate');
    if (denied) return denied;
    const s = load();
    const c = s.comments.find((x) => x._id === params.id);
    if (!c) return fail(404, { success: false, message: 'Comment not found' });
    s.comments = s.comments.filter((x) => x._id !== c._id);
    for (const x of s.comments) if (x.parentId === c._id) x.parentId = c.parentId || null;
    audit(actorOf(user), 'comment.moderate', { targetType: 'comment', targetId: c._id, targetLabel: c.body.slice(0, 60), detail: 'deleted' });
    return ok({ success: true, message: 'Comment deleted' });
  });

  // bookmarks
  route('GET', '/bookmarks', ({ user }) => {
    if (!user) return fail(401, { status: false, message: 'Token not found' });
    const ids = (load().bookmarks[user._id] || []);
    const byId = new Map(load().news.filter(live).map((n) => [n._id, n]));
    const ordered = ids.map((id) => byId.get(id)).filter(Boolean);
    return ok({ ids: ordered.map((n) => n._id), news: ordered.map((n) => shape(n, actorOf(user))) });
  });
  route('PUT', '/bookmarks/:newsId', ({ user, params }) => {
    if (!user) return fail(401, { status: false, message: 'Token not found' });
    const n = load().news.find((x) => x._id === params.newsId);
    if (!n || !live(n)) return fail(404, { success: false, message: 'News not found' });
    const list = load().bookmarks[user._id] || [];
    if (!list.includes(n._id)) load().bookmarks[user._id] = [n._id, ...list];
    return ok({ success: true, bookmarked: true });
  });
  route('DELETE', '/bookmarks/:newsId', ({ user, params }) => {
    if (!user) return fail(401, { status: false, message: 'Token not found' });
    load().bookmarks[user._id] = (load().bookmarks[user._id] || []).filter((id) => id !== params.newsId);
    return ok({ success: true, bookmarked: false });
  });

  // newsletter (double opt-in; the confirmation e-mail lands in the Preview inbox)
  route('POST', '/newsletter', ({ body }) => {
    if (!settings().newsletterEnabled) return fail(403, { success: false, message: 'The newsletter is not open for sign-ups right now' });
    const { errors, values } = validateNewsletter(body);
    if (Object.keys(errors).length) return fail(422, { success: false, message: errors.email, errors });
    const s = load();
    let sub = s.subscribers.find((x) => x.email === values.email);
    if (!sub) {
      sub = { _id: newId(), email: values.email, confirmed: false, token: newToken(), topics: values.topics, confirmedAt: null, lastSentAt: null, createdAt: new Date(now()).toISOString() };
      s.subscribers.push(sub);
    }
    if (!sub.confirmed) {
      sub.topics = values.topics;
      mail(sub.email, `Confirm your ${settings().siteName} newsletter`, `Please confirm your subscription to the ${settings().siteName} newsletter.\n\n#/newsletter/confirm?token=${sub.token}\n\nIf you did not ask for this, ignore this message and nothing will be sent.`, 'confirm');
    }
    return ok({ success: true, mailed: true, message: 'Almost done: check your inbox and open the confirmation link.' }, 201);
  });
  route('POST', '/newsletter/confirm', ({ body }) => {
    const sub = load().subscribers.find((x) => x.token === str(body.token));
    if (!sub) return fail(404, { success: false, message: 'This confirmation link is not valid any more' });
    if (!sub.confirmed) { sub.confirmed = true; sub.confirmedAt = new Date(now()).toISOString(); }
    return ok({ success: true, message: 'You are subscribed. Thank you!', email: sub.email, topics: sub.topics });
  });
  const prefs = ({ query, body, method }) => {
    const sub = load().subscribers.find((x) => x.token === str(query.token || body.token));
    if (!sub) return fail(404, { success: false, message: 'This link is not valid any more' });
    if (method === 'PUT') sub.topics = validateNewsletter({ email: sub.email, topics: body.topics }).values.topics;
    return ok({ success: true, email: sub.email, confirmed: sub.confirmed, topics: sub.topics });
  };
  route('GET', '/newsletter/preferences', (ctx) => prefs({ ...ctx, method: 'GET' }));
  route('PUT', '/newsletter/preferences', (ctx) => prefs({ ...ctx, method: 'PUT' }));
  route('POST', '/newsletter/unsubscribe', ({ body }) => {
    const s = load();
    const sub = s.subscribers.find((x) => x.token === str(body.token));
    if (!sub) return fail(404, { success: false, message: 'This link is not valid any more' });
    s.subscribers = s.subscribers.filter((x) => x !== sub);
    return ok({ success: true, message: 'You have been unsubscribed.' });
  });
  route('POST', '/newsletter/send', ({ user, body }) => {
    const denied = needRole(user, 'newsletter');
    if (denied) return denied;
    const { errors, values } = validateDigest(body);
    if (Object.keys(errors).length) return fail(422, { success: false, message: 'Validation failed', errors });
    const s = load();
    const items = s.news.filter((n) => values.articleIds.includes(n._id) && live(n));
    if (!items.length) return fail(422, { success: false, message: 'None of the chosen articles is published', errors: { articleIds: 'Pick published articles' } });
    const subs = s.subscribers.filter((x) => x.confirmed && (!values.topics.length || !x.topics.length || x.topics.some((t) => values.topics.includes(t))));
    for (const sub of subs) {
      mail(sub.email, values.subject, `${values.intro ? `${values.intro}\n\n` : ''}${items.map((n) => `${n.title}\n${n.summary || excerpt(n.description, 160)}\n#/news-details/${n.slug}`).join('\n\n')}\n\nManage topics or unsubscribe: #/newsletter/preferences?token=${sub.token}`, 'digest');
      sub.lastSentAt = new Date(now()).toISOString();
    }
    audit(actorOf(user), 'newsletter.send', { targetType: 'newsletter', targetLabel: values.subject, detail: `${subs.length} sent` });
    return ok({ success: true, sent: subs.length, failed: 0, total: subs.length });
  });
  route('GET', '/newsletter', ({ user }) => {
    const denied = needRole(user, 'subscribers');
    if (denied) return denied;
    return ok([...load().subscribers].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).map(({ token: _t, ...rest }) => rest)); // eslint-disable-line no-unused-vars
  });
  route('DELETE', '/newsletter/:id', ({ user, params }) => {
    const denied = needRole(user, 'subscribers');
    if (denied) return denied;
    const s = load();
    const sub = s.subscribers.find((x) => x._id === params.id);
    if (!sub) return fail(404, { success: false, message: 'Subscriber not found' });
    s.subscribers = s.subscribers.filter((x) => x !== sub);
    return ok({ success: true, message: 'Subscriber removed' });
  });

  route('POST', '/contact', ({ body }) => {
    if (![body.name, body.subject, body.email, body.message].every((v) => typeof v === 'string' && v.trim())) return fail(422, { message: 'name, email, subject and message are required' });
    if (!isEmail(body.email)) return fail(422, { message: 'A valid email address is required' });
    mail('newsroom (preview)', `I am: ${str(body.name)}, ${str(body.subject)}`, `${str(body.message)}\n\nReply-To: ${str(body.email)}`, 'contact');
    return ok({ success: true, message: 'Email sent successfully' });
  });

  // settings, audit
  route('GET', '/settings', () => ok(settings()));
  route('PUT', '/settings', ({ user, body }) => {
    const denied = needRole(user, 'alert');
    if (denied) return denied;
    const alertOnly = !roleAtLeast(user.role, 'admin');
    const { errors, values } = validateSettings(body, { alertOnly });
    if (Object.keys(errors).length) return fail(422, { success: false, message: Object.values(errors)[0], errors });
    load().settings = { ...load().settings, ...values };
    audit(actorOf(user), values.alert && Object.keys(values).length === 1 ? 'alert.update' : 'settings.update', { targetType: 'settings', targetLabel: 'site' });
    if (values.alert) emit('alert', settings().alert);
    return ok(settings());
  });
  route('GET', '/audit', ({ user, query }) => {
    const denied = needRole(user, 'audit');
    if (denied) return denied;
    let list = load().audit;
    if (typeof query.action === 'string' && query.action) list = list.filter((e) => e.action === query.action);
    const p = paginate(list, query, 30, 100);
    return ok({ entries: p.slice, page: p.page, limit: p.limit, total: p.total, pages: p.pages });
  });

  // analytics
  route('GET', '/stats', ({ user, query }) => {
    const denied = needRole(user, 'analytics');
    if (denied) return denied;
    const s = load();
    const days = Math.min(Math.max(parseInt(query.days, 10) || 14, 1), 90);
    const t = now();
    const viewsByDay = [];
    const growth = [];
    const sources = Object.fromEntries(SOURCES.map((x) => [x, 0]));
    const depth = Object.fromEntries(DEPTHS.map((d) => [d, 0]));
    const firstKey = dayKey(t - (days - 1) * DAY);
    const confirmedAt = (x) => dayKey(x.confirmedAt || x.createdAt);
    let base = s.subscribers.filter((x) => x.confirmed && confirmedAt(x) < firstKey).length;
    for (let i = days - 1; i >= 0; i--) {
      const date = dayKey(t - i * DAY);
      const row = s.viewStats[date] || {};
      viewsByDay.push({ date, views: Object.values(row).reduce((a, b) => a + b, 0) });
      const added = s.subscribers.filter((x) => x.confirmed && confirmedAt(x) === date).length;
      base += added;
      growth.push({ date, subscribers: base, added });
      const ds = s.dayStats[date];
      if (ds) {
        for (const k of Object.keys(ds.sources)) if (k in sources) sources[k] += ds.sources[k];
        for (const k of Object.keys(ds.depth)) if (k in depth) depth[k] += ds.depth[k];
      }
    }
    const count = (st) => s.news.filter((n) => n.status === st).length;
    const top = s.news.filter(live).sort((a, b) => b.views - a.views).slice(0, 5);
    return ok({
      totals: {
        articles: s.news.length, published: count('published'), drafts: count('draft'), scheduled: count('scheduled'),
        inReview: count('submitted') + count('in_review') + count('changes_requested') + count('approved'), archived: count('archived'),
        views: s.news.reduce((a, n) => a + n.views, 0), users: s.users.length, pendingComments: s.comments.filter((c) => c.status === 'pending').length,
        reportedComments: s.comments.filter((c) => c.reports.length > 0).length, subscribers: s.subscribers.filter((x) => x.confirmed).length, pendingSubscribers: s.subscribers.filter((x) => !x.confirmed).length,
      },
      viewsByCategory: [...s.categories].sort((a, b) => (a.order ?? 100) - (b.order ?? 100)).map((c) => ({ categoryId: c._id, name: c.name, views: s.news.filter((n) => n.categoryId === c._id).reduce((a, n) => a + n.views, 0), articles: s.news.filter((n) => n.categoryId === c._id).length })),
      viewsByDay, sources, depth, newsletterGrowth: growth, topArticles: top.map((n) => ({ _id: n._id, title: n.title, slug: n.slug, views: n.views })),
    });
  });
  route('GET', '/stats/me', ({ user }) => {
    const denied = needRole(user, 'stats.own');
    if (denied) return denied;
    const s = load();
    const mine = s.news.filter((n) => n.author === user._id);
    const by = (st) => mine.filter((n) => n.status === st).length;
    const d = { 25: 0, 50: 0, 75: 0, 100: 0 };
    for (const n of mine) for (const k of DEPTHS) d[k] += (n.depth && n.depth[k]) || 0;
    const ids = new Set(mine.map((n) => n._id));
    const liveMine = mine.filter((n) => n.status === 'published' || n.status === 'archived');
    return ok({
      totals: {
        articles: mine.length, published: by('published'), drafts: by('draft'), inReview: by('submitted') + by('in_review'), changesRequested: by('changes_requested'), views: mine.reduce((a, n) => a + n.views, 0),
        followers: s.users.filter((u) => (u.follows && u.follows.authors || []).includes(user._id)).length, comments: s.comments.filter((c) => ids.has(c.newsId) && c.status === 'approved').length, reactions: s.reactions.filter((r) => ids.has(r.newsId)).length,
      },
      depth: d, top: [...liveMine].sort((a, b) => b.views - a.views).slice(0, 5).map((n) => ({ _id: n._id, title: n.title, slug: n.slug, views: n.views })),
    });
  });

  // preview inbox (stands in for real e-mail)
  route('GET', '/__inbox', () => ok({ messages: load().inbox }));
  route('DELETE', '/__inbox', () => { load().inbox = []; return ok({ success: true }); });

  // ---- dispatcher ----------------------------------------------------------------------------
  function handle({ method = 'GET', url = '/', params = {}, headers = {}, data = {} }) {
    const [path, qs] = String(url).split('?');
    const query = { ...Object.fromEntries(new URLSearchParams(qs || '')), ...(params || {}) };
    const m = method.toUpperCase();
    for (const r of routes) {
      if (r.method !== m) continue;
      const match = r.re.exec(path.replace(/\/+$/, '') || '/');
      if (!match) continue;
      const routeParams = {};
      r.keys.forEach((k, i) => { routeParams[k] = decodeURIComponent(match[i + 1]); });
      load();
      const user = authUser(headers);
      const result = r.handler({ user, params: routeParams, query, body: data || {}, headers, method: m });
      if (m !== 'GET') persist();
      return result;
    }
    return { status: 404, data: { message: `No route for ${m} ${path}` } };
  }

  return { handle, reset, invalidate, snapshot: () => load(), storageFailed: () => persistFailed, STORE_KEY };
}
