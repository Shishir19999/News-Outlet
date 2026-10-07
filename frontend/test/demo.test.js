import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createDemoBackend } from '../src/demo/backend.js';
import { DEMO_ADMIN, DEMO_USER } from '../src/demo/seed.js';

const memory = () => {
  const data = new Map();
  return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => data.set(k, v), data };
};

let storage;
let api;
let clock;
const call = (method, url, { params, data, token } = {}) =>
  api.handle({ method, url, params, data, headers: token ? { authorization: token } : {} });
const login = (u) => call('POST', '/login', { data: u }).data.token;
let admin;
let user;

beforeEach(() => {
  storage = memory();
  clock = Date.parse('2026-06-15T10:00:00Z');
  api = createDemoBackend({ storage, now: () => clock });
  admin = login(DEMO_ADMIN);
  user = login(DEMO_USER);
});

test('seeded demo has articles, categories and the documented logins', () => {
  const list = call('GET', '/news', { params: { limit: 50 } });
  assert.equal(list.status, 200);
  assert.ok(list.data.total >= 12);
  assert.ok(!list.data.news.some((n) => n.status === 'draft'));
  assert.ok(call('GET', '/category').data.length >= 5);
  assert.equal(call('POST', '/login', { data: { email: DEMO_ADMIN.email, password: 'wrong' } }).status, 401);
  assert.equal(call('POST', '/login', { data: { email: 'nobody@example.com', password: 'x' } }).status, 401);
  assert.equal(call('GET', '/user/profile/user', { token: admin }).data.role, 'admin');
  assert.equal(call('GET', '/user/profile/user', { token: admin }).data.password, undefined);
});

test('state persists in storage and reset restores the seed', () => {
  const before = call('GET', '/news', { params: { limit: 50 } }).data.total;
  const created = call('POST', '/news', { token: admin, data: { title: 'Persisted', summary: 'S', categoryId: call('GET', '/category').data[0]._id } });
  assert.equal(created.status, 201);
  const second = createDemoBackend({ storage, now: () => clock });
  assert.equal(second.handle({ method: 'GET', url: '/news', params: { limit: 50 }, headers: {} }).data.total, before + 1);
  second.reset();
  assert.equal(second.handle({ method: 'GET', url: '/news', params: { limit: 50 }, headers: {} }).data.total, before);
});

test('auth: logout revokes the token, registration validates and never grants admin', () => {
  assert.equal(call('POST', '/login/toke-check', { data: { token: user } }).data.success, true);
  assert.equal(call('POST', '/logout', { token: user }).status, 200);
  assert.equal(call('POST', '/login/toke-check', { data: { token: user } }).data.success, false);
  assert.equal(call('GET', '/user/profile/user', { token: user }).status, 401);

  const reg = { name: 'Eve', email: 'eve@example.com', password: 'secret1', gender: 'female', role: 'admin' };
  assert.equal(call('POST', '/user', { data: reg }).status, 201);
  assert.equal(call('POST', '/user', { data: reg }).status, 409);
  assert.equal(call('POST', '/user', { data: { ...reg, email: 'bad' } }).status, 422);
  const t = login({ email: 'eve@example.com', password: 'secret1' });
  assert.equal(call('GET', '/user/profile/user', { token: t }).data.role, 'user');
});

test('role gates: only admins edit news and categories; users may create', () => {
  const cat = call('GET', '/category').data[0];
  const n = call('GET', '/news').data.news[0];
  assert.equal(call('PUT', `/news/${n._id}`, { token: user, data: { title: 'x' } }).status, 403);
  assert.equal(call('DELETE', `/news/${n._id}`).status, 401);
  assert.equal(call('POST', '/category', { token: user, data: { name: 'X' } }).status, 403);
  assert.equal(call('POST', '/category', { token: admin, data: { name: cat.name } }).status, 409);
  assert.equal(call('POST', '/news', { token: user, data: { title: 'By user', summary: 'S', categoryId: cat._id } }).status, 201);
  assert.equal(call('GET', '/stats', { token: user }).status, 403);
  assert.equal(call('GET', '/newsletter', { token: user }).status, 403);
});

test('news: validation, slug rules, drafts and scheduling', () => {
  const cat = call('GET', '/category').data[0];
  const post = (data) => call('POST', '/news', { token: admin, data: { summary: 'S', categoryId: cat._id, ...data } });
  assert.equal(post({ title: '' }).status, 422);
  assert.equal(post({ title: 'T', categoryId: 'nope' }).status, 422);
  assert.equal(post({ title: 'T', status: 'scheduled' }).status, 422);

  const a = post({ title: 'A  Fancy: Title!' });
  assert.equal(a.data.slug, 'a-fancy-title');
  assert.equal(post({ title: 'Other', slug: 'A Fancy Title' }).status, 409);
  assert.equal(call('PUT', `/news/${a.data.id}`, { token: admin, data: { title: 'Renamed' } }).status, 200);
  assert.equal(call('GET', `/news/${a.data.id}`).data.slug, 'a-fancy-title');
  assert.equal(call('PUT', `/news/${a.data.id}`, { token: admin, data: { slug: '' } }).status, 200);
  assert.equal(call('GET', `/news/${a.data.id}`).data.slug, 'renamed');

  const draft = post({ title: 'Draft one', status: 'draft' });
  assert.equal(call('GET', `/news/${draft.data.id}`).status, 404);
  assert.equal(call('GET', `/news/${draft.data.id}`, { token: admin }).status, 200);
  assert.ok(!call('GET', '/news', { params: { limit: 50 } }).data.news.some((x) => x.title === 'Draft one'));

  const when = new Date(clock + 86400000).toISOString();
  const sched = post({ title: 'Later one', status: 'scheduled', publishedAt: when });
  assert.equal(call('GET', '/news/news-details/later-one').status, 404);
  clock += 2 * 86400000; // time passes: the scheduled article goes live without any action
  assert.equal(call('GET', '/news/news-details/later-one').status, 200);
  assert.ok(sched.data.id);

  call('PUT', `/news/${draft.data.id}`, { token: admin, data: { status: 'published' } });
  assert.equal(call('GET', `/news/${draft.data.id}`).status, 200);
});

test('news listing: search, category, sort, ids, pagination', () => {
  const all = call('GET', '/news', { params: { limit: 50 } }).data;
  const pageOne = call('GET', '/news', { params: { limit: 5 } }).data;
  assert.equal(pageOne.news.length, 5);
  assert.equal(pageOne.pages, Math.ceil(all.total / 5));
  const popular = call('GET', '/news', { params: { sort: 'popular', limit: 50 } }).data.news;
  assert.ok(popular[0].views >= popular[1].views);
  const oldest = call('GET', '/news', { params: { sort: 'oldest', limit: 50 } }).data.news;
  assert.ok(new Date(oldest[0].publishedAt) <= new Date(oldest[1].publishedAt));
  assert.ok(call('GET', '/news', { params: { search: 'MARATHON' } }).data.total >= 1);
  assert.equal(call('GET', '/news', { params: { search: 'zzzz-nothing' } }).data.total, 0);
  const cat = call('GET', '/category').data.find((c) => c.newsCount > 1);
  const inCat = call('GET', '/news', { params: { categoryId: cat._id, limit: 50 } }).data;
  assert.equal(inCat.total, cat.newsCount);
  const ids = all.news.slice(0, 2).map((n) => n._id).join(',');
  assert.equal(call('GET', '/news', { params: { ids } }).data.total, 2);
  assert.ok(call('GET', '/news', { params: { featured: '1' } }).data.total >= 1);
});

test('related articles and views counting', () => {
  const n = call('GET', '/news', { params: { sort: 'latest' } }).data.news[0];
  const rel = call('GET', `/news/news-details/${n.slug}`).data;
  assert.ok(rel.relatedNews.length <= 4);
  assert.ok(rel.relatedNews.every((r) => r.categoryId === n.categoryId && r._id !== n._id));
  const before = n.views;
  assert.equal(call('POST', `/news/${n._id}/view`).data.views, before + 1);
  assert.equal(call('POST', '/news/missing/view').status, 404);
  const stats = call('GET', '/stats', { token: admin }).data;
  assert.equal(stats.viewsByDay.length, 14);
  assert.ok(stats.viewsByDay.at(-1).views > 0);
  assert.ok(stats.viewsByCategory.some((c) => c.views > 0));
  assert.ok(stats.totals.pendingComments >= 1);
});

test('comments: pending until approved, admin moderation', () => {
  const n = call('GET', '/news', { params: { limit: 50 } }).data.news.find((x) => call('GET', '/comments', { params: { newsId: x._id } }).data.length === 0);
  assert.equal(call('POST', '/comments', { data: { newsId: n._id, body: 'Hello' } }).status, 422);
  assert.equal(call('POST', '/comments', { data: { newsId: n._id, name: 'G', body: '' } }).status, 422);
  const c = call('POST', '/comments', { data: { newsId: n._id, name: 'Guest', body: 'Hello there' } });
  assert.equal(c.data.status, 'pending');
  assert.equal(call('GET', '/comments', { params: { newsId: n._id } }).data.length, 0);
  assert.equal(call('GET', '/comments/manage/list', { token: user }).status, 403);
  const queue = call('GET', '/comments/manage/list', { token: admin, params: { status: 'pending' } }).data;
  assert.ok(queue.comments.some((x) => x._id === c.data.id));
  assert.equal(call('PUT', `/comments/${c.data.id}`, { token: admin, data: { status: 'bogus' } }).status, 422);
  assert.equal(call('PUT', `/comments/${c.data.id}`, { token: admin, data: { status: 'approved' } }).status, 200);
  assert.equal(call('GET', '/comments', { params: { newsId: n._id } }).data.length, 1);
  assert.equal(call('POST', '/comments', { token: admin, data: { newsId: n._id, body: 'Staff' } }).data.status, 'approved');
  assert.equal(call('DELETE', `/comments/${c.data.id}`, { token: admin }).status, 200);
  assert.equal(call('DELETE', `/comments/${c.data.id}`, { token: admin }).status, 404);
});

test('bookmarks are per user and idempotent', () => {
  const [a, b] = call('GET', '/news').data.news;
  assert.equal(call('GET', '/bookmarks').status, 401);
  call('PUT', `/bookmarks/${a._id}`, { token: user });
  call('PUT', `/bookmarks/${a._id}`, { token: user });
  call('PUT', `/bookmarks/${b._id}`, { token: user });
  assert.deepEqual(call('GET', '/bookmarks', { token: user }).data.ids, [b._id, a._id]);
  assert.deepEqual(call('GET', '/bookmarks', { token: admin }).data.ids, []);
  call('DELETE', `/bookmarks/${a._id}`, { token: user });
  assert.deepEqual(call('GET', '/bookmarks', { token: user }).data.ids, [b._id]);
  assert.equal(call('PUT', '/bookmarks/nope', { token: user }).status, 404);
});

test('newsletter and contact are stored only', () => {
  assert.equal(call('POST', '/newsletter', { data: { email: 'bad' } }).status, 422);
  const before = call('GET', '/newsletter', { token: admin }).data.length;
  assert.equal(call('POST', '/newsletter', { data: { email: ' New@Example.com ' } }).status, 201);
  assert.equal(call('POST', '/newsletter', { data: { email: 'new@example.com' } }).status, 201);
  const list = call('GET', '/newsletter', { token: admin }).data;
  assert.equal(list.length, before + 1);
  assert.equal(list[0].email, 'new@example.com');
  assert.equal(call('DELETE', `/newsletter/${list[0]._id}`, { token: admin }).status, 200);

  assert.equal(call('POST', '/contact', { data: { name: 'A', email: 'a@b.co', subject: 's' } }).status, 422);
  assert.equal(call('POST', '/contact', { data: { name: 'A', email: 'a@b.co', subject: 's', message: 'm' } }).status, 200);
});

test('categories: admin CRUD, cannot delete one that still has articles', () => {
  const created = call('POST', '/category', { token: admin, data: { name: 'Travel', description: 'Places' } });
  assert.equal(created.status, 201);
  const cat = call('GET', '/category').data.find((c) => c.name === 'Travel');
  assert.equal(cat.slug, 'travel');
  assert.equal(call('PUT', `/category/${cat._id}`, { token: admin, data: { name: 'Trips' } }).status, 200);
  assert.equal(call('DELETE', `/category/${cat._id}`, { token: admin }).status, 200);
  const busy = call('GET', '/category').data.find((c) => c.newsCount > 0);
  assert.equal(call('DELETE', `/category/${busy._id}`, { token: admin }).status, 409);
});

test('users: admin changes roles, cannot demote self, can delete others', () => {
  const users = call('GET', '/user', { token: admin }).data;
  assert.equal(users.length, 1); // the admin themself is excluded
  const target = users[0];
  assert.equal(call('PUT', `/user/${target._id}`, { token: user, data: { role: 'admin' } }).status, 200);
  assert.equal(call('GET', `/user/${target._id}`, { token: admin }).data.role, 'user'); // users cannot promote themselves
  assert.equal(call('PUT', `/user/${target._id}`, { token: admin, data: { role: 'admin' } }).status, 200);
  assert.equal(call('GET', `/user/${target._id}`, { token: admin }).data.role, 'admin');
  const me = call('GET', '/user/profile/user', { token: admin }).data;
  assert.equal(call('PUT', `/user/${me._id}`, { token: admin, data: { role: 'user' } }).status, 409);
  assert.equal(call('DELETE', `/user/${target._id}`, { token: admin }).status, 200);
});

test('seed has at least 30 published articles across every category', () => {
  const list = call('GET', '/news', { params: { limit: 50 } }).data;
  assert.ok(list.total >= 30);
  const cats = call('GET', '/category').data;
  assert.ok(cats.every((c) => c.newsCount >= 3));
});
