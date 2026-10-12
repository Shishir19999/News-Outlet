// The live preview backend must follow the same rules as the real API (shared/rules.js).
// These tests mirror the main flows of the backend suite and check the shared copies for drift.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createDemoBackend } from '../src/demo/backend.js';
import { DEMO_LOGINS } from '../src/demo/seed.js';

const store = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; };
let be;
let events;
let T;
const call = (method, url, token, data, headers = {}) => be.handle({ method, url, headers: { ...(token ? { authorization: token } : {}), ...headers }, data: data || {} });
const login = (role) => { const c = DEMO_LOGINS.find((x) => x.role === role); const r = call('POST', '/login', null, { email: c.email, password: c.password }); assert.equal(r.status, 200); return r.data.token; };

beforeEach(() => {
  events = [];
  be = createDemoBackend({ storage: store(), emit: (e, p) => events.push([e, p]) });
  T = { admin: login('admin'), editor: login('editor'), author: login('author'), reader: login('reader') };
});

const section = () => call('GET', '/category').data[0]._id;
const draft = (token, extra = {}) => call('POST', '/news', token, { categoryId: section(), title: `Story ${Math.random().toString(36).slice(2, 8)}`, summary: 'A summary.', description: 'Body.', ...extra });
const move = (token, id, to, extra = {}) => call('POST', `/news/${id}/transition`, token, { to, ...extra });

test('shared rules are identical in the frontend, backend and root copies', () => {
  const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
  const dirs = [path.resolve(here, '..', 'src', 'shared'), path.resolve(here, '..', '..', 'backend', 'src', 'shared'), path.resolve(here, '..', '..', 'shared')].filter((d) => fs.existsSync(d));
  assert.ok(dirs.length >= 1);
  const sum = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
  for (const n of fs.readdirSync(dirs[0]).filter((x) => x.endsWith('.js'))) for (const d of dirs.slice(1)) assert.equal(sum(path.join(d, n)), sum(path.join(dirs[0], n)), `${n} differs in ${d} (run npm run sync:shared)`);
});

test('seeded newsroom has every workflow state, kind and role', () => {
  const all = call('GET', '/news/manage/list?limit=50', T.admin).data.news;
  for (const s of ['draft', 'submitted', 'in_review', 'changes_requested', 'approved', 'scheduled', 'published', 'archived']) assert.ok(all.some((n) => n.status === s), s);
  for (const k of ['live', 'opinion', 'analysis', 'fact-check', 'sponsored']) assert.ok(all.some((n) => n.kind === k), k);
  assert.equal(call('GET', '/user/profile/user', T.editor).data.role, 'editor');
  assert.ok(call('GET', '/news/breaking').data.news.length >= 1);
  assert.ok(call('GET', '/news/trending?limit=3').data.news.length === 3);
});

test('permissions mirror the API', () => {
  assert.equal(draft(T.reader).status, 403);
  assert.equal(draft(null).status, 401);
  assert.equal(call('GET', '/stats', T.author).status, 403);
  assert.equal(call('GET', '/stats', T.editor).status, 200);
  assert.equal(call('GET', '/stats/me', T.author).status, 200);
  assert.equal(call('GET', '/audit', T.editor).status, 403);
  assert.equal(call('POST', '/category', T.editor, { name: 'Nope' }).status, 403);
  assert.equal(call('GET', '/newsletter', T.editor).status, 403);
  assert.equal(draft(T.author, { breaking: true }).status, 403);
  assert.equal(draft(T.author, { kind: 'sponsored' }).status, 422);
  const me = call('GET', '/user/profile/user', T.admin).data;
  assert.equal(call('PUT', `/user/${me._id}`, T.admin, { role: 'editor' }).status, 409, 'last admin is protected');
});

test('workflow: draft to published with four-eyes, notes and visibility', () => {
  const made = draft(T.author, { title: 'Preview workflow' });
  assert.equal(made.status, 201);
  const { id, slug } = made.data;
  const visible = () => call('GET', `/news/news-details/${slug}`).status;
  assert.equal(visible(), 404);
  assert.equal(move(T.author, id, 'published').status, 403);
  assert.equal(move(T.author, id, 'submitted').status, 200);
  assert.equal(move(T.editor, id, 'in_review').status, 200);
  assert.equal(move(T.editor, id, 'changes_requested').status, 422);
  assert.equal(move(T.editor, id, 'changes_requested', { note: 'Needs sources.' }).status, 200);
  assert.equal(call('PUT', `/news/${id}`, T.author, { description: 'Now with sources.' }).status, 200);
  assert.equal(move(T.author, id, 'submitted').status, 200);
  assert.equal(call('PUT', `/news/${id}`, T.author, { title: 'sneaky' }).status, 403, 'locked while submitted');
  assert.equal(move(T.editor, id, 'in_review').status, 200);
  assert.equal(move(T.editor, id, 'approved').status, 200);
  assert.equal(move(T.editor, id, 'scheduled', { publishedAt: new Date(Date.now() - 5).toISOString() }).status, 422);
  assert.equal(move(T.editor, id, 'published').status, 200);
  assert.equal(visible(), 200);
  assert.equal(move(T.editor, id, 'archived').status, 200);
  assert.equal(visible(), 200);
  assert.ok(!call('GET', '/news?limit=50').data.news.some((n) => n._id === id));
  assert.ok(call('GET', '/news?archived=1&limit=50').data.news.some((n) => n._id === id));
  assert.ok(call('GET', `/news/${id}/revisions`, T.author).data.revisions.length >= 2);
  const mine = call('GET', `/news/${id}`, T.author).data;
  assert.ok(mine.reviewNotes.some((n) => n.type === 'changes'));
  assert.equal(call('GET', `/news/${id}`, null).data.reviewNotes, undefined);
  const own = draft(T.editor, { title: 'Editor wrote this' }).data.id;
  assert.equal(move(T.editor, own, 'submitted').status, 200);
  assert.equal(move(T.editor, own, 'in_review').status, 403);
  assert.equal(call('POST', '/news', T.admin, { categoryId: section(), title: 'Admin fast', summary: 's', status: 'published' }).data.status, 'published');
});

test('revisions restore, headline test, search, engagement, comments', () => {
  const id = draft(T.author, { title: 'Revisions', description: 'Version one.' }).data.id;
  call('PUT', `/news/${id}`, T.author, { description: 'Version two.' });
  const revs = call('GET', `/news/${id}/revisions`, T.author).data.revisions;
  assert.equal(revs.length, 2);
  assert.equal(call('POST', `/news/${id}/revisions/${revs[1]._id}/restore`, T.author).status, 200);
  assert.equal(call('GET', `/news/${id}`, T.author).data.description, 'Version one.');

  const pub = call('GET', '/news?limit=50').data.news[0];
  assert.equal(call('PUT', `/news/${pub._id}`, T.editor, { headlineB: 'Alternative' }).status, 200);
  call('POST', '/news/ab/impressions', null, { items: [{ id: pub._id, variant: 'a' }, { id: pub._id, variant: 'b' }] });
  call('POST', `/news/${pub._id}/view`, null, { variant: 'b', source: 'search' });
  const ab = call('GET', `/news/${pub._id}`, T.editor).data.abTest;
  assert.equal(ab.b.clicks, 1);
  assert.equal(call('GET', `/news/${pub._id}`).data.abTest.b, undefined);
  assert.equal(call('POST', `/news/${pub._id}/ab/winner`, T.editor, { variant: 'b' }).status, 200);

  const typo = call('GET', '/news?search=marathn');
  assert.ok(typo.data.total >= 1 && typo.data.fuzzy);
  assert.ok(call('GET', '/search/suggest?q=marat').data.suggestions.length >= 1);
  assert.equal(call('GET', '/news?search=zzzzqq').data.total, 0);

  const target = call('GET', '/news?limit=50').data.news.find((n) => n.poll);
  const c1 = { 'x-client-id': 'client-aaaaaaaa' };
  const poll = call('GET', `/news/${target._id}/engagement`, null, null, c1).data.poll;
  assert.equal(call('POST', `/news/${target._id}/poll/vote`, null, { optionId: poll.options[0].id }, c1).status, 200);
  assert.equal(call('POST', `/news/${target._id}/poll/vote`, null, { optionId: poll.options[1].id }, c1).status, 409);
  assert.equal(call('PUT', `/news/${target._id}/reaction`, null, { type: 'like' }).status, 422);
  assert.equal(call('PUT', `/news/${target._id}/reaction`, null, { type: 'like' }, c1).data.mine, 'like');

  const add = (token, body) => call('POST', '/comments', token, { newsId: pub._id, ...body });
  const first = add(null, { name: 'Guest', body: 'Hello' });
  assert.equal(first.data.status, 'pending');
  assert.equal(call('PUT', `/comments/${first.data.id}`, T.reader, { status: 'approved' }).status, 403);
  call('PUT', `/comments/${first.data.id}`, T.editor, { status: 'approved' });
  const l1 = add(T.editor, { body: 'reply', parentId: first.data.id });
  const l2 = add(T.editor, { body: 'reply 2', parentId: l1.data.id });
  assert.equal(add(T.editor, { body: 'too deep', parentId: l2.data.id }).status, 422);
  for (const n of ['aaaaaaaa', 'bbbbbbbb', 'cccccccc']) call('POST', `/comments/${first.data.id}/report`, null, { reason: 'spam' }, { 'x-client-id': `rep-${n}` });
  assert.ok(!call('GET', `/comments?newsId=${pub._id}`).data.some((c) => c._id === first.data.id));
  assert.ok(call('GET', '/comments/manage/list?status=reported', T.editor).data.comments.length >= 1);
});

test('live blog pushes events, newsletter is double opt-in with a preview inbox, settings and audit', () => {
  const live = call('GET', '/news?kind=live').data.news[0];
  assert.equal(call('POST', `/news/${live._id}/live`, T.reader, { body: 'x' }).status, 403);
  assert.equal(call('POST', `/news/${live._id}/live`, T.editor, { body: '' }).status, 422);
  assert.equal(call('POST', `/news/${live._id}/live`, T.editor, { body: 'Fresh update' }).status, 201);
  assert.ok(events.some(([e, p]) => e === 'live:update' && p.type === 'add' && p.update.body === 'Fresh update'));
  assert.equal(call('GET', `/news/${live._id}/live`).data.updates[0].pinned || true, true);

  assert.equal(call('POST', '/newsletter', null, { email: 'bad' }).status, 422);
  assert.equal(call('POST', '/newsletter', null, { email: 'Fan@Example.com', topics: [] }).status, 201);
  const mail = call('GET', '/__inbox').data.messages[0];
  assert.equal(mail.to, 'fan@example.com');
  const token = /token=([a-f0-9]+)/.exec(mail.text)[1];
  const digest = () => call('POST', '/newsletter/send', T.admin, { subject: 'Weekly', articleIds: [live._id] });
  const before = digest().data.sent;
  assert.equal(call('POST', '/newsletter/confirm', null, { token: 'bad' }).status, 404);
  assert.equal(call('POST', '/newsletter/confirm', null, { token }).status, 200);
  assert.equal(digest().data.sent, before + 1);
  assert.equal(call('POST', '/newsletter/send', T.editor, { subject: 'x', articleIds: [live._id] }).status, 403);
  assert.equal(call('POST', '/newsletter/unsubscribe', null, { token }).status, 200);

  assert.equal(call('PUT', '/settings', T.editor, { alert: { active: true, text: '' } }).status, 422);
  const set = call('PUT', '/settings', T.editor, { alert: { active: true, text: 'Storm', link: '/news' }, siteName: 'Hacked' });
  assert.equal(set.data.siteName, 'News Outlet');
  assert.ok(events.some(([e]) => e === 'alert'));
  assert.equal(call('PUT', '/settings', T.admin, { registrationOpen: false }).status, 200);
  assert.equal(call('POST', '/user', null, { name: 'Late', email: 'late@t.io', password: 'secret1' }).status, 403);
  const log = call('GET', '/audit?limit=100', T.admin).data.entries;
  assert.ok(log.some((e) => e.action === 'alert.update'));

  const stats = call('GET', '/stats?days=7', T.editor).data;
  assert.equal(stats.viewsByDay.length, 7);
  assert.ok(stats.sources.search >= 0 && stats.newsletterGrowth.length === 7);
  const f = call('PUT', '/user/follows', T.reader, { topics: [section()], authors: [] });
  assert.equal(f.data.topics.length, 1);
  assert.ok(call('GET', `/news/for-you?topics=${section()}`).data.news[0].reasons.includes('topic'));
});

test('state survives a reload from storage', () => {
  const s = store();
  const a = createDemoBackend({ storage: s });
  const t = a.handle({ method: 'POST', url: '/login', data: { email: 'author@example.com', password: 'author123' } }).data.token;
  const id = a.handle({ method: 'POST', url: '/news', headers: { authorization: t }, data: { categoryId: a.handle({ url: '/category' }).data[0]._id, title: 'Persisted', summary: 's' } }).data.id;
  const b = createDemoBackend({ storage: s });
  assert.equal(b.handle({ url: `/news/${id}`, headers: { authorization: t } }).data.title, 'Persisted');
});
