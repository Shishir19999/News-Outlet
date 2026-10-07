// In-browser stand-in for the Express API. It answers the same paths with the same response
// shapes, so the UI code is identical in demo mode and in full-stack mode. Pure logic only:
// the caller supplies a storage object (localStorage in the browser, a shim in tests).
import { buildSeed, newId } from './seed.js';
import { slugify, isLive } from '../lib/text.js';

const STORE_KEY = 'news-demo-state-v1';
const STATUSES = ['draft', 'published', 'scheduled'];
const COMMENT_STATUSES = ['pending', 'approved', 'rejected'];
const EMAIL_RE = /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/;
const DAY = 86400000;

const ok = (data, status = 200) => ({ status, data });
const fail = (status, data) => ({ status, data });
const str = (v) => (typeof v === 'string' ? v.trim() : '');
const dayKey = (t) => new Date(t).toISOString().slice(0, 10);

export function createDemoBackend({ storage, now = () => Date.now() }) {
  let state = null;

  function load() {
    if (state) return state;
    try {
      const raw = storage.getItem(STORE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.version === 1) {
          state = parsed;
          return state;
        }
      }
    } catch {
      // fall through and reseed
    }
    state = buildSeed(now());
    persist();
    return state;
  }

  function persist() {
    try {
      storage.setItem(STORE_KEY, JSON.stringify(state));
      return true;
    } catch {
      return false;
    }
  }

  function reset() {
    state = buildSeed(now());
    persist();
  }

  const publicUser = (u) => {
    const { password: _p, tokenVersion: _t, ...rest } = u; // eslint-disable-line no-unused-vars
    return rest;
  };
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

  const live = (n) => isLive(n, now());
  const canSee = (n, user) => live(n) || (user && (user.role === 'admin' || n.author === user._id));
  const catOf = (id) => load().categories.find((c) => c._id === id);

  function validateNews(body, partial) {
    const s = load();
    const errors = {};
    const values = {};
    if (!partial || body.categoryId !== undefined) {
      const id = str(body.categoryId);
      if (!id) errors.categoryId = 'A valid category is required';
      else if (!s.categories.some((c) => c._id === id)) errors.categoryId = 'Category does not exist';
      else values.categoryId = id;
    }
    if (!partial || body.title !== undefined) {
      const title = str(body.title);
      if (!title) errors.title = 'Title is required';
      else if (title.length > 200) errors.title = 'Title must be at most 200 characters';
      else values.title = title;
    }
    if (!partial || body.summary !== undefined) {
      const summary = str(body.summary);
      if (!summary) errors.summary = 'Summary is required';
      else if (summary.length > 1000) errors.summary = 'Summary must be at most 1000 characters';
      else values.summary = summary;
    }
    if (body.description !== undefined) {
      if (typeof body.description !== 'string') errors.description = 'Description must be text';
      else values.description = body.description;
    }
    if (body.status !== undefined) {
      if (!STATUSES.includes(str(body.status))) errors.status = 'Status must be draft, published or scheduled';
      else values.status = str(body.status);
    }
    if (body.publishedAt !== undefined && str(body.publishedAt) !== '') {
      const d = new Date(str(body.publishedAt));
      if (Number.isNaN(d.getTime())) errors.publishedAt = 'Publish date is not valid';
      else values.publishedAt = d.toISOString();
    }
    if (body.featured !== undefined) {
      values.featured = body.featured === true || ['true', '1', 'on'].includes(String(body.featured).toLowerCase());
    }
    if (values.status === 'scheduled' && !errors.publishedAt && !values.publishedAt && !partial) {
      errors.publishedAt = 'A publish date is required to schedule an article';
    }
    return { errors, values };
  }

  const SORTS = {
    latest: (a, b) => new Date(b.publishedAt) - new Date(a.publishedAt),
    oldest: (a, b) => new Date(a.publishedAt) - new Date(b.publishedAt),
    popular: (a, b) => b.views - a.views || new Date(b.publishedAt) - new Date(a.publishedAt),
  };

  function paginate(list, query, defLimit, maxLimit = 50) {
    const page = Math.max(parseInt(query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(query.limit, 10) || defLimit, 1), maxLimit);
    const total = list.length;
    return { page, limit, total, pages: Math.max(Math.ceil(total / limit), 1), slice: list.slice((page - 1) * limit, page * limit) };
  }

  const matches = (n, q) => {
    const t = q.toLowerCase();
    return n.title.toLowerCase().includes(t) || n.summary.toLowerCase().includes(t);
  };

  function bumpView(news) {
    const s = load();
    news.views += 1;
    const key = dayKey(now());
    s.viewStats[key] = s.viewStats[key] || {};
    s.viewStats[key][news.categoryId] = (s.viewStats[key][news.categoryId] || 0) + 1;
  }

  // ---- route handlers -------------------------------------------------------------------
  const routes = [];
  const route = (method, pattern, handler) => {
    const keys = [];
    const re = new RegExp(`^${pattern.replace(/:(\w+)/g, (_, k) => (keys.push(k), '([^/]+)'))}$`);
    routes.push({ method, re, keys, handler });
  };

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
    const email = str(body.email);
    if (!str(body.name) || !email || !body.password || !['male', 'female'].includes(body.gender)) {
      return fail(422, { message: 'name, email, password and gender are required' });
    }
    if (!EMAIL_RE.test(email)) return fail(422, { message: 'A valid email address is required' });
    if (s.users.some((u) => u.email.toLowerCase() === email.toLowerCase())) return fail(409, { email: 'User already exists' });
    s.users.push({
      _id: newId(), name: str(body.name), email, password: body.password, gender: body.gender, role: 'user',
      image: body.image || '', tokenVersion: 0, createdAt: new Date(now()).toISOString(),
    });
    return ok({ success: true, message: 'User created successfully' }, 201);
  });
  route('GET', '/user', ({ user }) => {
    if (!user) return fail(401, { status: false, message: 'Token not found' });
    if (user.role === 'admin') return ok(load().users.filter((u) => u._id !== user._id).map(publicUser));
    return ok([publicUser(user)]);
  });
  route('GET', '/user/profile/user', ({ user }) => (user ? ok(publicUser(user)) : fail(401, { status: false, message: 'Invalid token' })));
  route('PUT', '/user/upload-profile/:id', ({ user, params, body }) => {
    if (!user) return fail(401, { status: false, message: 'Invalid token' });
    if (user.role !== 'admin' && user._id !== params.id) return fail(403, { status: false, message: 'Forbidden' });
    const target = load().users.find((u) => u._id === params.id);
    if (!target) return fail(404, { message: 'User not found' });
    if (!body.image) return fail(400, { message: 'Image file is required' });
    target.image = body.image;
    return ok({ success: true, message: 'Image uploaded successfully' });
  });
  route('DELETE', '/user/delete-profile/:id', ({ user, params }) => {
    if (!user) return fail(401, { status: false, message: 'Invalid token' });
    if (user.role !== 'admin' && user._id !== params.id) return fail(403, { status: false, message: 'Forbidden' });
    const target = load().users.find((u) => u._id === params.id);
    if (!target) return fail(404, { message: 'User not found' });
    target.image = '';
    return ok({ success: true, message: 'Profile image deleted successfully' });
  });
  route('GET', '/user/:id', ({ user, params }) => {
    if (!user) return fail(401, { status: false, message: 'Invalid token' });
    const target = load().users.find((u) => u._id === params.id);
    return target ? ok(publicUser(target)) : fail(404, { message: 'User not found' });
  });
  route('PUT', '/user/:id', ({ user, params, body }) => {
    if (!user) return fail(401, { status: false, message: 'Invalid token' });
    if (user.role !== 'admin' && user._id !== params.id) return fail(403, { status: false, message: 'Forbidden' });
    const target = load().users.find((u) => u._id === params.id);
    if (!target) return fail(404, { message: 'User not found' });
    for (const k of ['name', 'gender', 'password']) if (body[k]) target[k] = body[k];
    if (user.role === 'admin' && ['user', 'admin'].includes(body.role)) {
      if (target._id === user._id && body.role !== 'admin') return fail(409, { message: 'You cannot remove your own admin role' });
      target.role = body.role;
    }
    return ok({ success: true, message: 'User updated successfully' });
  });
  route('DELETE', '/user/:id', ({ user, params }) => {
    if (!user) return fail(401, { status: false, message: 'Invalid token' });
    if (user.role !== 'admin' && user._id !== params.id) return fail(403, { status: false, message: 'Forbidden' });
    const s = load();
    if (!s.users.some((u) => u._id === params.id)) return fail(404, { message: 'User not found' });
    s.users = s.users.filter((u) => u._id !== params.id);
    delete s.bookmarks[params.id];
    return ok({ success: true, message: 'User deleted successfully' });
  });

  // categories
  route('GET', '/category', () => {
    const s = load();
    return ok(s.categories.map((c) => ({
      ...c, slug: slugify(c.name), newsCount: s.news.filter((n) => n.categoryId === c._id && live(n)).length,
    })));
  });
  route('GET', '/category/:id', ({ params }) => {
    const c = catOf(params.id);
    return c ? ok({ ...c, slug: slugify(c.name) }) : fail(404, { message: 'Category not found' });
  });
  const needAdmin = (user) => {
    if (!user) return fail(401, { status: false, message: 'Token not found' });
    if (user.role !== 'admin') return fail(403, { status: false, message: 'Admin access required' });
    return null;
  };
  route('POST', '/category', ({ user, body }) => {
    const denied = needAdmin(user);
    if (denied) return denied;
    const name = str(body.name);
    if (!name) return fail(422, { success: false, message: 'Name is required' });
    const s = load();
    if (s.categories.some((c) => c.name === name)) return fail(409, { success: false, message: 'Category already exists!' });
    s.categories.push({ _id: newId(), name, description: str(body.description), createdAt: new Date(now()).toISOString() });
    return ok({ success: true, message: 'Category created successfully!' }, 201);
  });
  route('PUT', '/category/:id', ({ user, params, body }) => {
    const denied = needAdmin(user);
    if (denied) return denied;
    const c = catOf(params.id);
    if (!c) return fail(404, { success: false, message: 'Category not found' });
    if (body.name !== undefined) {
      const name = str(body.name);
      if (!name) return fail(422, { success: false, message: 'Name is required' });
      if (load().categories.some((x) => x.name === name && x._id !== c._id)) return fail(409, { success: false, message: 'Category already exists!' });
      c.name = name;
    }
    if (body.description !== undefined) c.description = body.description;
    return ok({ success: true, message: 'Category updated successfully!' });
  });
  route('DELETE', '/category/:id', ({ user, params }) => {
    const denied = needAdmin(user);
    if (denied) return denied;
    const s = load();
    if (!catOf(params.id)) return fail(404, { success: false, message: 'Category not found' });
    if (s.news.some((n) => n.categoryId === params.id)) return fail(409, { success: false, message: 'Category still has news; delete or move them first' });
    s.categories = s.categories.filter((c) => c._id !== params.id);
    return ok({ success: true, message: 'Category deleted successfully!' });
  });

  // news
  route('GET', '/news', ({ query }) => {
    let list = load().news.filter(live);
    const search = str(query.search);
    if (search) list = list.filter((n) => matches(n, search));
    if (query.categoryId) list = list.filter((n) => n.categoryId === query.categoryId);
    if (query.featured === '1' || query.featured === 'true') list = list.filter((n) => n.featured);
    if (typeof query.ids === 'string' && query.ids) {
      const ids = new Set(query.ids.split(','));
      list = list.filter((n) => ids.has(n._id));
    }
    const period = parseInt(query.period, 10);
    if (period > 0) list = list.filter((n) => new Date(n.publishedAt).getTime() >= now() - period * DAY);
    list = [...list].sort(SORTS[query.sort] || SORTS.latest);
    const { slice, ...meta } = paginate(list, query, 9);
    return ok({ news: slice, ...meta });
  });
  route('GET', '/news/manage/list', ({ user, query }) => {
    if (!user) return fail(401, { status: false, message: 'Token not found' });
    let list = load().news.filter((n) => user.role === 'admin' || n.author === user._id);
    const search = str(query.search);
    if (search) list = list.filter((n) => matches(n, search));
    if (STATUSES.includes(query.status)) list = list.filter((n) => n.status === query.status);
    list = [...list].sort(SORTS.latest);
    const { slice, ...meta } = paginate(list, query, 10);
    return ok({ news: slice, ...meta });
  });
  route('GET', '/news/news-details/:slug', ({ user, params }) => {
    const n = load().news.find((x) => x.slug === params.slug);
    if (!n || !canSee(n, user)) return fail(404, { message: 'News not found' });
    const relatedNews = load().news.filter((x) => x.categoryId === n.categoryId && x._id !== n._id && live(x)).sort(SORTS.popular).slice(0, 4);
    return ok({ findNews: n, relatedNews });
  });
  route('POST', '/news', ({ user, body }) => {
    if (!user) return fail(401, { status: false, message: 'Token not found' });
    const s = load();
    const { errors, values } = validateNews(body, false);
    const slug = slugify(str(body.slug) || values.title);
    if (!slug) errors.slug = 'Slug is required';
    if (Object.keys(errors).length) return fail(422, { success: false, message: 'Validation failed', errors });
    if (s.news.some((n) => n.slug === slug)) return fail(409, { success: false, message: 'Slug already exists', errors: { slug: 'Slug already exists' } });
    const t = new Date(now()).toISOString();
    const item = {
      description: '', status: 'published', featured: false, ...values, _id: newId(), slug, image: body.image || '',
      views: 0, author: user._id, createdAt: t, updatedAt: t,
      publishedAt: values.publishedAt || t,
    };
    s.news.push(item);
    return ok({ success: true, message: 'News created successfully', id: item._id, slug }, 201);
  });
  route('POST', '/news/:id/view', ({ params }) => {
    const n = load().news.find((x) => x._id === params.id);
    if (!n || !live(n)) return fail(404, { message: 'News not found' });
    bumpView(n);
    return ok({ success: true, views: n.views });
  });
  route('GET', '/news/:id', ({ user, params }) => {
    const n = load().news.find((x) => x._id === params.id);
    if (!n || !canSee(n, user)) return fail(404, { message: 'News not found' });
    return ok(n);
  });
  route('PUT', '/news/:id', ({ user, params, body }) => {
    const denied = needAdmin(user);
    if (denied) return denied;
    const s = load();
    const n = s.news.find((x) => x._id === params.id);
    if (!n) return fail(404, { success: false, message: 'News not found' });
    const { errors, values } = validateNews(body, true);
    let slug;
    if (body.slug !== undefined) {
      slug = slugify(str(body.slug) || values.title || n.title);
      if (!slug) errors.slug = 'Slug is required';
    }
    if (Object.keys(errors).length) return fail(422, { success: false, message: 'Validation failed', errors });
    if (slug && slug !== n.slug) {
      if (s.news.some((x) => x.slug === slug && x._id !== n._id)) return fail(409, { success: false, message: 'Slug already exists', errors: { slug: 'Slug already exists' } });
      values.slug = slug;
    }
    if (body.image) values.image = body.image;
    if (values.status === 'published' && !values.publishedAt && n.status !== 'published') values.publishedAt = new Date(now()).toISOString();
    Object.assign(n, values, { updatedAt: new Date(now()).toISOString() });
    return ok({ success: true, message: 'News updated successfully' });
  });
  route('DELETE', '/news/:id', ({ user, params }) => {
    const denied = needAdmin(user);
    if (denied) return denied;
    const s = load();
    if (!s.news.some((n) => n._id === params.id)) return fail(404, { success: false, message: 'News not found' });
    s.news = s.news.filter((n) => n._id !== params.id);
    s.comments = s.comments.filter((c) => c.newsId !== params.id);
    for (const id of Object.keys(s.bookmarks)) s.bookmarks[id] = s.bookmarks[id].filter((x) => x !== params.id);
    return ok({ success: true, message: 'News deleted successfully' });
  });

  // comments
  route('GET', '/comments', ({ query }) => {
    if (!query.newsId) return fail(422, { success: false, message: 'newsId is required' });
    return ok(load().comments
      .filter((c) => c.newsId === query.newsId && c.status === 'approved')
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
      .map(({ _id, newsId, name, body, createdAt }) => ({ _id, newsId, name, body, createdAt })));
  });
  route('POST', '/comments', ({ user, body }) => {
    const s = load();
    const errors = {};
    const newsId = str(body.newsId);
    const text = str(body.body);
    let name = str(body.name);
    if (!newsId) errors.newsId = 'A valid article is required';
    if (!text) errors.body = 'Comment is required';
    else if (text.length > 1000) errors.body = 'Comment must be at most 1000 characters';
    if (user) name = user.name;
    if (!name) errors.name = 'Name is required';
    else if (name.length > 60) errors.name = 'Name must be at most 60 characters';
    if (Object.keys(errors).length) return fail(422, { success: false, message: 'Validation failed', errors });
    const n = s.news.find((x) => x._id === newsId);
    if (!n || !live(n)) return fail(404, { success: false, message: 'News not found' });
    const approved = !!(user && user.role === 'admin');
    const c = {
      _id: newId(), newsId, userId: user ? user._id : null, name, body: text,
      status: approved ? 'approved' : 'pending', createdAt: new Date(now()).toISOString(),
    };
    s.comments.push(c);
    return ok({
      success: true, status: c.status, id: c._id,
      message: approved ? 'Comment published' : 'Thanks! Your comment is awaiting moderation',
    }, 201);
  });
  route('GET', '/comments/manage/list', ({ user, query }) => {
    const denied = needAdmin(user);
    if (denied) return denied;
    const s = load();
    let list = [...s.comments].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    if (COMMENT_STATUSES.includes(query.status)) list = list.filter((c) => c.status === query.status);
    const { slice, ...meta } = paginate(list, query, 20, 100);
    const comments = slice.map((c) => {
      const n = s.news.find((x) => x._id === c.newsId);
      return { _id: c._id, name: c.name, body: c.body, status: c.status, createdAt: c.createdAt, news: n ? { _id: n._id, title: n.title, slug: n.slug } : null };
    });
    return ok({ comments, ...meta, pending: s.comments.filter((c) => c.status === 'pending').length });
  });
  route('PUT', '/comments/:id', ({ user, params, body }) => {
    const denied = needAdmin(user);
    if (denied) return denied;
    const c = load().comments.find((x) => x._id === params.id);
    if (!c) return fail(404, { success: false, message: 'Comment not found' });
    if (!COMMENT_STATUSES.includes(body.status)) return fail(422, { success: false, message: 'Status must be pending, approved or rejected' });
    c.status = body.status;
    return ok({ success: true, message: 'Comment updated' });
  });
  route('DELETE', '/comments/:id', ({ user, params }) => {
    const denied = needAdmin(user);
    if (denied) return denied;
    const s = load();
    if (!s.comments.some((x) => x._id === params.id)) return fail(404, { success: false, message: 'Comment not found' });
    s.comments = s.comments.filter((x) => x._id !== params.id);
    return ok({ success: true, message: 'Comment deleted' });
  });

  // bookmarks
  route('GET', '/bookmarks', ({ user }) => {
    if (!user) return fail(401, { status: false, message: 'Token not found' });
    const s = load();
    const news = (s.bookmarks[user._id] || []).map((id) => s.news.find((n) => n._id === id)).filter((n) => n && live(n));
    return ok({ ids: news.map((n) => n._id), news });
  });
  route('PUT', '/bookmarks/:newsId', ({ user, params }) => {
    if (!user) return fail(401, { status: false, message: 'Token not found' });
    const s = load();
    const n = s.news.find((x) => x._id === params.newsId);
    if (!n || !live(n)) return fail(404, { success: false, message: 'News not found' });
    const list = s.bookmarks[user._id] || [];
    if (!list.includes(n._id)) list.unshift(n._id);
    s.bookmarks[user._id] = list;
    return ok({ success: true, bookmarked: true });
  });
  route('DELETE', '/bookmarks/:newsId', ({ user, params }) => {
    if (!user) return fail(401, { status: false, message: 'Token not found' });
    const s = load();
    s.bookmarks[user._id] = (s.bookmarks[user._id] || []).filter((id) => id !== params.newsId);
    return ok({ success: true, bookmarked: false });
  });

  // newsletter (demo: stored in this browser only)
  route('POST', '/newsletter', ({ body }) => {
    const email = str(body.email).toLowerCase();
    if (!email || email.length > 254 || !EMAIL_RE.test(email)) {
      return fail(422, { success: false, message: 'A valid email address is required', errors: { email: 'A valid email address is required' } });
    }
    const s = load();
    if (!s.subscribers.some((x) => x.email === email)) s.subscribers.unshift({ _id: newId(), email, createdAt: new Date(now()).toISOString() });
    return ok({ success: true, message: 'You are subscribed. Thank you!' }, 201);
  });
  route('GET', '/newsletter', ({ user }) => {
    const denied = needAdmin(user);
    return denied || ok(load().subscribers);
  });
  route('DELETE', '/newsletter/:id', ({ user, params }) => {
    const denied = needAdmin(user);
    if (denied) return denied;
    const s = load();
    if (!s.subscribers.some((x) => x._id === params.id)) return fail(404, { success: false, message: 'Subscriber not found' });
    s.subscribers = s.subscribers.filter((x) => x._id !== params.id);
    return ok({ success: true, message: 'Subscriber removed' });
  });

  // contact form (demo: stored in this browser, nothing is sent)
  route('POST', '/contact', ({ body }) => {
    const { name, subject, email, message } = body;
    if (![name, subject, email, message].every((v) => typeof v === 'string' && v.trim())) {
      return fail(422, { message: 'name, email, subject and message are required' });
    }
    if (!EMAIL_RE.test(email.trim())) return fail(422, { message: 'A valid email address is required' });
    const s = load();
    s.messages.push({ _id: newId(), name, email, subject, message, createdAt: new Date(now()).toISOString() });
    return ok({ success: true, message: 'Message saved in this demo (no email is sent)' });
  });

  // stats
  route('GET', '/stats', ({ user, query }) => {
    const denied = needAdmin(user);
    if (denied) return denied;
    const s = load();
    const days = Math.min(Math.max(parseInt(query.days, 10) || 14, 1), 90);
    const viewsByDay = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = dayKey(now() - i * DAY);
      const row = s.viewStats[date] || {};
      viewsByDay.push({ date, views: Object.values(row).reduce((a, b) => a + b, 0) });
    }
    const viewsByCategory = s.categories.map((c) => {
      const items = s.news.filter((n) => n.categoryId === c._id);
      return { categoryId: c._id, name: c.name, views: items.reduce((a, n) => a + n.views, 0), articles: items.length };
    });
    const count = (st) => s.news.filter((n) => n.status === st).length;
    return ok({
      totals: {
        articles: s.news.length, published: count('published'), drafts: count('draft'), scheduled: count('scheduled'),
        views: s.news.reduce((a, n) => a + n.views, 0), users: s.users.length,
        pendingComments: s.comments.filter((c) => c.status === 'pending').length, subscribers: s.subscribers.length,
      },
      viewsByCategory, viewsByDay,
      topArticles: s.news.filter(live).sort(SORTS.popular).slice(0, 5).map((n) => ({ _id: n._id, title: n.title, slug: n.slug, views: n.views })),
    });
  });

  // ---- dispatcher -----------------------------------------------------------------------
  function handle({ method = 'GET', url = '/', params = {}, headers = {}, data = {} }) {
    load();
    const path = ('/' + String(url).split('?')[0].replace(/^\/+/, '')).replace(/\/+$/, '') || '/';
    const verb = method.toUpperCase();
    const user = authUser(headers);
    for (const r of routes) {
      if (r.method !== verb) continue;
      const m = r.re.exec(path);
      if (!m) continue;
      const routeParams = {};
      r.keys.forEach((k, i) => { routeParams[k] = decodeURIComponent(m[i + 1]); });
      const result = r.handler({ user, params: routeParams, query: params || {}, body: data || {} });
      if (result.status < 400) persistSafe();
      return result;
    }
    return fail(404, { message: 'Not found' });
  }

  let persistFailed = false;
  function persistSafe() {
    persistFailed = !persist();
  }

  return { handle, reset, snapshot: () => load(), storageFailed: () => persistFailed, STORE_KEY };
}
