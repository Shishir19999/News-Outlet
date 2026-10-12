import './setup.js';
import mongoose from 'mongoose';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { io as ioClient } from 'socket.io-client';
import app from '../src/app.js';
import User from '../src/models/User.js';
import News from '../src/models/News.js';
import Category from '../src/models/Category.js';
import Subscriber from '../src/models/Subscriber.js';
import { Settings } from '../src/models/Extra.js';
import { contactController } from '../src/routes/contactRoute.js';
import { setMailTransport } from '../src/config/mail.js';
import { attachRealtime, closeRealtime } from '../src/realtime.js';
import ContentSeeder from '../src/config/Seeder/ContentSeeder.js';

const NEWS_DIR = path.resolve('public', 'news');
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
const filesBefore = new Set(fs.existsSync(NEWS_DIR) ? fs.readdirSync(NEWS_DIR) : []);
const sent = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const T = {}; // tokens
const U = {}; // users
let cat, cat2;

const api = (method, url, token) => {
    const r = request(app)[method](url);
    return token ? r.set('authorization', token) : r;
};
async function login(email, password) {
    const res = await request(app).post('/login').send({ email, password });
    assert.equal(res.status, 200, `login ${email}`);
    return res.body.token;
}
const draft = (token, extra = {}) => api('post', '/news', token).send({ categoryId: String(cat._id), title: `Story ${Math.random().toString(36).slice(2, 8)}`, summary: 'A short summary of the story.', description: 'Body text of the story.', ...extra });
const move = (token, id, to, extra = {}) => api('post', `/news/${id}/transition`, token).send({ to, ...extra });
// Creates an article and walks it to published with two different people.
async function published(extra = {}, author = 'author') {
  const created = await draft(T[author], extra);
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const id = created.body.id;
  assert.equal((await move(T[author], id, 'submitted')).status, 200);
  assert.equal((await move(T.editor, id, 'in_review')).status, 200);
  assert.equal((await move(T.editor, id, 'published')).status, 200);
  return { id, slug: created.body.slug };
}

let server;
let port;
before(async () => {
  await mongoose.connect(process.env.MONGODB_URL);
  await mongoose.connection.dropDatabase();
  for (const m of [User, News, Category, Subscriber]) await m.init();
  const mk = (name, role) => new User({ name, email: `${name.toLowerCase().replace(/\s/g, '')}@t.io`, password: `${role}-pass`, role }).save();
  U.admin = await mk('Admin One', 'admin');
  U.editor = await mk('Editor One', 'editor');
  U.editor2 = await mk('Editor Two', 'editor');
  U.author = await mk('Author One', 'author');
  U.author2 = await mk('Author Two', 'author');
  U.reader = await mk('Reader One', 'reader');
  U.legacy = await User.collection.insertOne({ name: 'Legacy', email: 'legacy@t.io', password: U.reader.password, role: 'user', gender: 'male' });
  T.admin = await login('adminone@t.io', 'admin-pass');
  T.editor = await login('editorone@t.io', 'editor-pass');
  T.editor2 = await login('editortwo@t.io', 'editor-pass');
  T.author = await login('authorone@t.io', 'author-pass');
  T.author2 = await login('authortwo@t.io', 'author-pass');
  T.reader = await login('readerone@t.io', 'reader-pass');
  cat = await Category.create({ name: 'Tech' });
  cat2 = await Category.create({ name: 'Sport' });
  contactController.transporter = { sendMail: async (o) => { sent.push(o); return {}; } };
  setMailTransport({ sendMail: async (o) => { sent.push(o); return {}; } });
  server = http.createServer(app);
  attachRealtime(server);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  port = server.address().port;
});

after(async () => {
  for (const f of fs.existsSync(NEWS_DIR) ? fs.readdirSync(NEWS_DIR) : []) if (!filesBefore.has(f)) fs.rmSync(path.join(NEWS_DIR, f), { force: true });
  await closeRealtime();
  await new Promise((r) => server.close(r));
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

test('auth: registration makes readers, never leaks secrets; logout revokes; legacy "user" is a reader', async () => {
  const res = await request(app).post('/user').send({ name: 'New Reader', email: 'new@t.io', password: 'secret1', role: 'admin' });
  assert.equal(res.status, 201);
  const made = await User.findOne({ email: 'new@t.io' });
  assert.equal(made.role, 'reader');
  const profile = await api('get', '/user/profile/user', await login('new@t.io', 'secret1'));
  assert.equal(profile.body.role, 'reader');
  assert.equal(profile.body.password, undefined);
  assert.equal(profile.body.tokenVersion, undefined);
  assert.equal((await request(app).post('/user').send({ name: 'x', email: 'bad', password: 'secret1' })).status, 422);
  assert.equal((await request(app).post('/user').send({ name: 'x', email: 'new@t.io', password: 'secret1' })).status, 409);
  const legacy = await login('legacy@t.io', 'reader-pass').catch(() => null);
  if (legacy) assert.equal((await api('get', '/user/profile/user', legacy)).body.role, 'reader');
  const t = await login('authortwo@t.io', 'author-pass');
  assert.equal((await api('post', '/logout', t)).status, 200);
  assert.equal((await api('get', '/user/profile/user', t)).status, 401);
  T.author2 = await login('authortwo@t.io', 'author-pass');
});

test('permissions: reader cannot write, authors cannot reach editor tools, admin owns users and settings', async () => {
  assert.equal((await draft(T.reader)).status, 403);
  assert.equal((await draft(null)).status, 401);
  assert.equal((await api('get', '/stats', T.author)).status, 403);
  assert.equal((await api('get', '/stats', T.editor)).status, 200);
  assert.equal((await api('get', '/stats/me', T.reader)).status, 403);
  assert.equal((await api('get', '/stats/me', T.author)).status, 200);
  assert.equal((await api('get', '/audit', T.editor)).status, 403);
  assert.equal((await api('get', '/audit', T.admin)).status, 200);
  assert.equal((await api('post', '/category', T.editor).send({ name: 'Nope' })).status, 403);
  assert.equal((await api('get', '/newsletter', T.editor)).status, 403);
  assert.equal((await api('get', '/comments/manage/list', T.author)).status, 403);
  assert.equal((await api('get', '/comments/manage/list', T.editor)).status, 200);
  // roles: only admins change them; the last admin is protected
  assert.equal((await api('put', `/user/${U.reader._id}`, T.editor).send({ role: 'editor' })).status, 403);
  assert.equal((await api('put', `/user/${U.reader._id}`, T.reader).send({ role: 'admin' })).status, 200);
  assert.equal((await User.findById(U.reader._id)).role, 'reader');
  assert.equal((await api('put', `/user/${U.reader._id}`, T.admin).send({ role: 'boss' })).status, 422);
  assert.equal((await api('put', `/user/${U.admin._id}`, T.admin).send({ role: 'editor' })).status, 409);
  assert.equal((await api('delete', `/user/${U.admin._id}`, T.admin)).status, 409);
  assert.equal((await api('put', `/user/${U.author2._id}`, T.admin).send({ role: 'editor' })).status, 200);
  assert.equal((await api('put', `/user/${U.author2._id}`, T.admin).send({ role: 'editor' })).status, 200);
  assert.equal((await api('put', `/user/${U.author2._id}`, T.admin).send({ role: 'author' })).status, 200);
  T.author2 = await login('authortwo@t.io', 'author-pass');
});

test('workflow: draft to published, four-eyes rule, notes and visibility', async () => {
  const created = await draft(T.author, { title: 'Workflow story' });
  assert.equal(created.status, 201);
  const id = created.body.id;
  const slug = created.body.slug;
  assert.equal(created.body.status, 'draft');
  const live = async () => (await request(app).get(`/news/news-details/${slug}`)).status;
  assert.equal(await live(), 404);
  assert.equal((await move(T.author, id, 'published')).status, 403, 'authors cannot publish');
  assert.equal((await move(T.author, id, 'approved')).status, 403);
  assert.equal((await move(T.author2, id, 'submitted')).status, 404, 'other authors cannot see it');
  assert.equal((await move(T.author, id, 'submitted')).status, 200);
  assert.equal(await live(), 404);
  assert.equal((await move(T.editor, id, 'in_review')).status, 200);
  assert.equal((await api('get', `/news/${id}`, T.editor)).body.assignedEditor.name, 'Editor One');
  const noNote = await move(T.editor, id, 'changes_requested');
  assert.equal(noNote.status, 422);
  assert.ok(noNote.body.errors.note);
  const changes = await move(T.editor, id, 'changes_requested', { note: 'Add the source of the figures.' });
  assert.equal(changes.status, 200);
  const mine = await api('get', `/news/${id}`, T.author);
  assert.equal(mine.body.reviewNotes.at(-1).type, 'changes');
  assert.equal((await api('get', `/news/${id}`)).status, 404);
  // the author fixes it and replies
  assert.equal((await api('put', `/news/${id}`, T.author).send({ description: 'Body text with the source added.' })).status, 200);
  assert.equal((await api('post', `/news/${id}/notes`, T.author).send({ body: 'Source added.' })).status, 201);
  assert.equal((await move(T.author, id, 'submitted')).status, 200);
  // locked while submitted
  assert.equal((await api('put', `/news/${id}`, T.author).send({ title: 'Sneaky edit' })).status, 403);
  assert.equal((await move(T.editor, id, 'in_review')).status, 200);
  assert.equal((await move(T.editor, id, 'approved')).status, 200);
  assert.equal(await live(), 404);
  const past = await move(T.editor2, id, 'scheduled', { publishedAt: new Date(Date.now() - 1000).toISOString() });
  assert.equal(past.status, 422);
  const when = new Date(Date.now() + 3600000).toISOString();
  assert.equal((await move(T.editor2, id, 'scheduled', { publishedAt: when })).status, 200);
  assert.equal(await live(), 404, 'scheduled in the future is hidden');
  await News.updateOne({ _id: id }, { publishedAt: new Date(Date.now() - 1000) });
  assert.equal(await live(), 200, 'a due scheduled article is live');
  assert.equal((await move(T.editor2, id, 'published')).status, 409, 'already live');
  const list = await request(app).get('/news');
  assert.ok(list.body.news.some((n) => n._id === id));
  assert.equal((await move(T.editor2, id, 'archived')).status, 409, 'scheduled cannot be archived directly');
  await News.updateOne({ _id: id }, { status: 'published' });
  assert.equal((await move(T.editor2, id, 'archived')).status, 200);
  assert.equal(await live(), 200, 'archived stays reachable by link');
  assert.ok(!(await request(app).get('/news')).body.news.some((n) => n._id === id), 'archived leaves the front pages');
  assert.ok((await request(app).get('/news?archived=1')).body.news.some((n) => n._id === id));
  const months = await request(app).get('/news/archive');
  assert.ok(months.body.months.length >= 1);
  assert.equal((await move(T.editor2, id, 'in_review')).status, 200);
  assert.equal((await move(T.editor2, id, 'published')).status, 200);
});

test('four-eyes: editors cannot approve or publish their own article, admins can', async () => {
  const created = await draft(T.editor, { title: 'Editor wrote this' });
  const id = created.body.id;
  assert.equal((await move(T.editor, id, 'submitted')).status, 200);
  assert.equal((await move(T.editor, id, 'in_review')).status, 403);
  assert.equal((await move(T.editor2, id, 'in_review')).status, 200);
  assert.equal((await move(T.editor, id, 'approved')).status, 403);
  assert.equal((await move(T.editor, id, 'published')).status, 403);
  assert.equal((await move(T.editor2, id, 'approved')).status, 200);
  const fast = await draft(T.admin, { title: 'Admin fast track', status: 'published' });
  assert.equal(fast.status, 201);
  assert.equal(fast.body.status, 'published');
  const denied = await draft(T.editor, { title: 'Editor direct publish', status: 'published' });
  assert.equal(denied.status, 403);
  assert.equal((await draft(T.author, { title: 'Author direct publish', status: 'published' })).status, 403);
  const ok = await draft(T.author, { title: 'Author submits on create', status: 'submitted' });
  assert.equal(ok.body.status, 'submitted');
});

test('revisions: every change is saved, listed, restorable, and authors stay in their lane', async () => {
  const created = await draft(T.author, { title: 'Revision story', description: 'Version one.' });
  const id = created.body.id;
  await api('put', `/news/${id}`, T.author).send({ description: 'Version two.', revisionNote: 'second' });
  await api('put', `/news/${id}`, T.author).send({ description: 'Version two.' });
  const list = await api('get', `/news/${id}/revisions`, T.author);
  assert.equal(list.body.revisions.length, 2, 'unchanged saves do not add revisions');
  assert.equal(list.body.revisions[0].snapshot.description, 'Version two.');
  assert.equal((await api('get', `/news/${id}/revisions`, T.author2)).status, 404);
  const first = list.body.revisions[1];
  const restored = await api('post', `/news/${id}/revisions/${first._id}/restore`, T.author);
  assert.equal(restored.status, 200);
  assert.equal((await News.findById(id)).description, 'Version one.');
  assert.equal((await api('get', `/news/${id}/revisions`, T.author)).body.revisions.length, 3);
  assert.equal((await api('post', `/news/${id}/revisions/${first._id}/restore`, T.reader)).status, 403);
});

test('articles: validation, kinds, slugs and image cleanup', async () => {
  assert.equal((await draft(T.author, { title: '' })).status, 422);
  assert.equal((await draft(T.author, { categoryId: '123' })).status, 422);
  const noSponsor = await draft(T.author, { kind: 'sponsored' });
  assert.ok(noSponsor.body.errors.sponsor);
  const noClaim = await draft(T.author, { kind: 'fact-check' });
  assert.ok(noClaim.body.errors.factCheck);
  assert.equal((await draft(T.author, { kind: 'fact-check', factCheck: { claim: 'X is true', rating: 'false' } })).status, 201);
  assert.ok((await draft(T.author, { embed: { url: 'https://example.com/video' } })).body.errors.embed);
  assert.equal((await draft(T.author, { embed: { url: 'https://www.youtube.com/watch?v=M7lc1UVf-VE' } })).status, 201);
  assert.ok((await draft(T.author, { gallery: [{ src: 'https://x.test/a.png', alt: '' }] })).body.errors.gallery);
  assert.equal((await draft(T.author, { poll: { question: 'Great?', options: [{ label: 'A' }, { label: 'B' }] } })).status, 403);
  assert.equal((await draft(T.editor, { poll: { question: 'Great?', options: [{ label: 'A' }] } })).status, 422);
  assert.equal((await draft(T.author, { breaking: true })).status, 403);
  assert.equal((await draft(T.author, { headlineB: 'Another' })).status, 403);
  const a = await draft(T.author, { title: 'Slug Test Story', slug: 'My Custom Slug' });
  assert.equal(a.body.slug, 'my-custom-slug');
  assert.equal((await draft(T.author, { title: 'Other', slug: 'my-custom-slug' })).status, 409);
  const upd = await api('put', `/news/${a.body.id}`, T.author).field('title', 'Slug Test Story').field('slug', '').attach('image', PNG, 'one.png');
  assert.equal(upd.status, 200);
  assert.equal((await News.findById(a.body.id)).slug, 'slug-test-story');
  const img1 = (await News.findById(a.body.id)).image;
  assert.ok(fs.existsSync(path.join(NEWS_DIR, img1)));
  await api('put', `/news/${a.body.id}`, T.author).attach('image', PNG, 'two.png');
  for (let i = 0; i < 40 && fs.existsSync(path.join(NEWS_DIR, img1)); i++) await sleep(25);
  assert.ok(!fs.existsSync(path.join(NEWS_DIR, img1)), 'replaced image is removed');
  assert.equal((await api('delete', `/news/${a.body.id}`, T.editor)).status, 403);
  const img2 = (await News.findById(a.body.id)).image;
  assert.equal((await api('delete', `/news/${a.body.id}`, T.admin)).status, 200);
  for (let i = 0; i < 40 && fs.existsSync(path.join(NEWS_DIR, img2)); i++) await sleep(25);
  assert.ok(!fs.existsSync(path.join(NEWS_DIR, img2)));
  const up = await api('post', '/upload', T.author).attach('image', PNG, 'gallery.png');
  assert.equal(up.status, 201);
  assert.match(up.body.url, /\/news\//);
  assert.equal((await api('post', '/upload', T.reader).attach('image', PNG, 'x.png')).status, 403);
});

test('manage list: authors see their own, editors everything, with counts', async () => {
  const mineA = await api('get', '/news/manage/list?limit=50', T.author);
  assert.ok(mineA.body.news.length > 0);
  assert.ok(mineA.body.news.every((n) => n.author.name === 'Author One'));
  const all = await api('get', '/news/manage/list?limit=50', T.editor);
  assert.ok(all.body.news.length > mineA.body.news.length);
  const review = await api('get', '/news/manage/list?status=review', T.editor);
  assert.ok(review.body.news.every((n) => ['submitted', 'in_review', 'changes_requested', 'approved'].includes(n.status)));
  assert.ok(typeof all.body.counts.draft === 'number');
  assert.equal((await api('get', '/news/manage/list', T.reader)).status, 403);
});

test('search: typo tolerance, suggestions, did-you-mean, filters, tags and archive range', async () => {
  const a = await published({ title: 'Harbor bridge reopens after repairs', summary: 'Traffic returns to the bridge.', tags: ['bridge', 'transport'], kind: 'analysis' });
  await published({ title: 'Cricket final draws crowd', summary: 'A packed stadium.', categoryId: String(cat2._id), tags: ['cricket'] });
  const typo = await request(app).get('/news?search=harbr%20bridg');
  assert.ok(typo.body.news.some((n) => n.slug === a.slug), 'typos still match');
  assert.ok(typo.body.fuzzy);
  const none = await request(app).get('/news?search=zzzzqqq');
  assert.equal(none.body.total, 0);
  const sug = await request(app).get('/search/suggest?q=brid');
  assert.ok(sug.body.suggestions.some((s) => s.slug === a.slug));
  const dym = await request(app).get('/news?search=crickt%20finl');
  assert.ok(dym.body.total >= 1);
  assert.equal((await request(app).get('/news?tag=bridge')).body.news[0].slug, a.slug);
  assert.ok((await request(app).get('/news?kind=analysis')).body.news.every((n) => n.kind === 'analysis'));
  assert.ok((await request(app).get(`/news?categoryId=${cat2._id}`)).body.news.every((n) => n.categoryId === String(cat2._id)));
  const today = new Date().toISOString().slice(0, 10);
  assert.ok((await request(app).get(`/news?from=${today}&to=${today}`)).body.total >= 2);
  assert.equal((await request(app).get('/news?from=2001-01-01&to=2001-01-31')).body.total, 0);
  assert.ok((await request(app).get('/news?authorId=' + U.author._id)).body.total >= 1);
});

test('trending decays by time, for-you follows topics and authors, breaking ticker', async () => {
  const old = await published({ title: 'Older popular story' });
  const fresh = await published({ title: 'Fresh rising story' });
  await News.updateOne({ _id: old.id }, { publishedAt: new Date(Date.now() - 10 * 86400000), views: 5000 });
  const { ArticleView } = await import('../src/models/Extra.js');
  const old10 = new Date(Date.now() - 10 * 86400000).toISOString().slice(0, 10);
  await ArticleView.updateOne({ date: old10, newsId: old.id }, { $set: { count: 300 } }, { upsert: true });
  for (let i = 0; i < 6; i++) await request(app).post(`/news/${fresh.id}/view`).send({ source: 'search' });
  const t = await request(app).get('/news/trending?limit=3');
  assert.equal(t.body.news[0]._id, fresh.id, 'recent views beat old ones');
  const fy = await request(app).get(`/news/for-you?topics=${cat2._id}&limit=3`);
  assert.equal(fy.body.personalised, true);
  assert.equal(fy.body.news[0].categoryId, String(cat2._id));
  assert.ok(fy.body.news[0].reasons.includes('topic'));
  const fy2 = await request(app).get(`/news/for-you?authors=${U.author._id}`);
  assert.ok(fy2.body.news[0].reasons.includes('author'));
  const brk = await draft(T.editor, { title: 'Breaking: bridge closed', breaking: true });
  await move(T.editor, brk.body.id, 'submitted');
  await move(T.editor2, brk.body.id, 'in_review');
  await move(T.editor2, brk.body.id, 'published');
  const b = await request(app).get('/news/breaking');
  assert.equal(b.body.news[0].slug, brk.body.slug);
});

test('views record sources and depth; analytics and author stats read them', async () => {
  const { id } = await published({ title: 'Analytics story' });
  assert.equal((await request(app).post(`/news/${id}/view`).send({ source: 'social' })).status, 200);
  assert.equal((await request(app).post(`/news/${id}/depth`).send({ depth: 50 })).status, 200);
  assert.equal((await request(app).post(`/news/${id}/depth`).send({ depth: 33 })).status, 422);
  const s = await api('get', '/stats?days=7', T.editor);
  assert.equal(s.body.sources.social, 1);
  assert.equal(s.body.depth['50'], 1);
  assert.equal(s.body.viewsByDay.length, 7);
  assert.ok(s.body.totals.published > 0 && s.body.totals.inReview >= 0);
  assert.equal(s.body.newsletterGrowth.length, 7);
  assert.ok((await api('get', '/stats/me', T.author)).body.totals.views >= 1);
  assert.equal((await request(app).post('/news/not-an-id/view')).status, 404);
});

test('headline test: impressions and clicks, then a winner replaces the title', async () => {
  const { id } = await published({ title: 'Headline alpha' });
  assert.equal((await api('put', `/news/${id}`, T.author).send({ headlineB: 'Headline beta' })).status, 403);
  assert.equal((await api('put', `/news/${id}`, T.editor).send({ headlineB: 'Headline beta' })).status, 200);
  for (let i = 0; i < 4; i++) await request(app).post('/news/ab/impressions').send({ items: [{ id, variant: i < 2 ? 'a' : 'b' }] });
  await request(app).post(`/news/${id}/view`).send({ variant: 'b' });
  const ed = await api('get', `/news/${id}`, T.editor);
  assert.equal(ed.body.abTest.b.impressions, 2);
  assert.equal(ed.body.abTest.b.clicks, 1);
  assert.equal((await request(app).get(`/news/${id}`)).body.abTest.b, undefined, 'public sees no numbers');
  assert.equal((await api('post', `/news/${id}/ab/winner`, T.author).send({ variant: 'b' })).status, 403);
  assert.equal((await api('post', `/news/${id}/ab/winner`, T.editor).send({ variant: 'b' })).status, 200);
  assert.equal((await News.findById(id)).title, 'Headline beta');
});

test('reactions and polls: one per reader, results, closed polls', async () => {
  const { id } = await published({ title: 'Engagement story' });
  await api('put', `/news/${id}`, T.editor).send({ poll: { question: 'Do you like it?', options: [{ label: 'Yes' }, { label: 'No' }] } });
  const poll = (await request(app).get(`/news/${id}/engagement`)).body.poll;
  assert.equal(poll.options.length, 2);
  const c1 = { 'x-client-id': 'client-aaaaaaaa' };
  const c2 = { 'x-client-id': 'client-bbbbbbbb' };
  assert.equal((await request(app).put(`/news/${id}/reaction`).send({ type: 'like' })).status, 422, 'needs an identity');
  await request(app).put(`/news/${id}/reaction`).set(c1).send({ type: 'like' });
  const r2 = await request(app).put(`/news/${id}/reaction`).set(c1).send({ type: 'insightful' });
  assert.equal(r2.body.reactions.like, 0);
  assert.equal(r2.body.reactions.insightful, 1);
  assert.equal(r2.body.mine, 'insightful');
  assert.equal((await request(app).put(`/news/${id}/reaction`).set(c2).send({ type: 'nope' })).status, 422);
  const v1 = await request(app).post(`/news/${id}/poll/vote`).set(c1).send({ optionId: poll.options[0].id });
  assert.equal(v1.status, 200);
  assert.equal(v1.body.poll.total, 1);
  assert.equal((await request(app).post(`/news/${id}/poll/vote`).set(c1).send({ optionId: poll.options[1].id })).status, 409);
  assert.equal((await api('post', `/news/${id}/poll/vote`, T.reader).send({ optionId: poll.options[1].id })).status, 200);
  assert.equal((await request(app).post(`/news/${id}/poll/vote`).set(c2).send({ optionId: 'zzz' })).status, 422);
  await News.updateOne({ _id: id }, { 'poll.closesAt': new Date(Date.now() - 1000) });
  assert.equal((await request(app).post(`/news/${id}/poll/vote`).set(c2).send({ optionId: poll.options[0].id })).status, 409);
  const details = await request(app).get(`/news/news-details/${(await News.findById(id)).slug}`).set(c1);
  assert.equal(details.body.engagement.poll.closed, true);
  assert.equal(details.body.engagement.poll.myVote, poll.options[0].id);
});

test('comments: moderation, threads, depth limit, reports and closing', async () => {
  const { id } = await published({ title: 'Comment story' });
  const add = (token, body) => api('post', '/comments', token).send({ newsId: id, ...body });
  const first = await add(null, { name: 'Guest', body: 'Hello there' });
  assert.equal(first.status, 201);
  assert.equal(first.body.status, 'pending');
  assert.equal((await request(app).get(`/comments?newsId=${id}`)).body.length, 0);
  assert.equal((await add(null, { name: '', body: 'No name' })).status, 422);
  assert.equal((await api('put', `/comments/${first.body.id}`, T.reader).send({ status: 'approved' })).status, 403);
  assert.equal((await api('put', `/comments/${first.body.id}`, T.editor).send({ status: 'approved' })).status, 200);
  const staff = await add(T.editor, { body: 'Reply from staff', parentId: first.body.id });
  assert.equal(staff.body.status, 'approved');
  const l2 = await add(T.editor, { body: 'Level 3', parentId: staff.body.id });
  const l3 = await add(T.editor, { body: 'Level 4', parentId: l2.body.id });
  assert.equal(l3.status, 422, 'replies stop at three levels');
  const list = (await request(app).get(`/comments?newsId=${id}`)).body;
  assert.equal(list.find((c) => c._id === staff.body.id).parentId, first.body.id);
  assert.equal(list.find((c) => c._id === staff.body.id).isStaff, true);
  // reports: three different readers hide a comment until an editor reviews it
  const rp = (n) => request(app).post('/comments/' + first.body.id + '/report').set({ 'x-client-id': 'rep-' + n }).send({ reason: 'spam' });
  assert.equal((await rp('aaaaaaaa')).status, 201);
  assert.equal((await rp('aaaaaaaa')).status, 200);
  assert.equal((await rp('bbbbbbbb')).status, 201);
  assert.equal((await rp('cccccccc')).status, 201);
  assert.ok(!(await request(app).get(`/comments?newsId=${id}`)).body.some((c) => c._id === first.body.id));
  const rep = await api('get', '/comments/manage/list?status=reported', T.editor);
  assert.ok(rep.body.comments.some((c) => c._id === first.body.id && c.reports.length === 3));
  assert.equal((await api('put', `/comments/${first.body.id}`, T.editor).send({ status: 'approved', clearReports: true })).status, 200);
  assert.equal((await api('delete', `/comments/${staff.body.id}`, T.editor)).status, 200);
  assert.equal((await api('put', '/settings', T.editor).send({ commentsOpen: false })).status, 200);
  assert.equal((await add(null, { name: 'G', body: 'late' })).status, 201, 'editors cannot close comments');
  assert.equal((await api('put', '/settings', T.admin).send({ commentsOpen: false })).status, 200);
  assert.equal((await add(null, { name: 'G', body: 'late' })).status, 403);
  await api('put', '/settings', T.admin).send({ commentsOpen: true });
});

test('live blog: only live articles, author or editors post, updates are pushed over Socket.IO', async () => {
  const { id } = await published({ title: 'Live story', kind: 'live' });
  const plain = await published({ title: 'Not live' });
  assert.equal((await api('post', `/news/${plain.id}/live`, T.editor).send({ body: 'x' })).status, 403);
  assert.equal((await api('post', `/news/${id}/live`, T.reader).send({ body: 'x' })).status, 403);
  assert.equal((await api('post', `/news/${id}/live`, T.author2).send({ body: 'x' })).status, 403);
  const socket = ioClient(`http://127.0.0.1:${port}`, { transports: ['websocket'] });
  await new Promise((r) => socket.on('connect', r));
  socket.emit('live:join', id);
  await sleep(100);
  const got = new Promise((resolve) => socket.on('live:update', resolve));
  const posted = await api('post', `/news/${id}/live`, T.author).send({ body: 'First update', important: true });
  assert.equal(posted.status, 201);
  const evt = await Promise.race([got, sleep(2000).then(() => null)]);
  assert.ok(evt, 'event received');
  assert.equal(evt.type, 'add');
  assert.equal(evt.update.body, 'First update');
  assert.equal((await api('post', `/news/${id}/live`, T.editor).send({ body: '' })).status, 422);
  await api('post', `/news/${id}/live`, T.editor).send({ body: 'Pinned note', pinned: true });
  const list = (await request(app).get(`/news/${id}/live`)).body.updates;
  assert.equal(list[0].body, 'Pinned note', 'pinned first');
  assert.equal((await api('put', `/news/${id}/live/${posted.body.update._id}`, T.editor).send({ body: 'Edited update' })).status, 200);
  assert.equal((await api('delete', `/news/${id}/live/${posted.body.update._id}`, T.editor)).status, 200);
  socket.close();
});

test('newsletter: double opt-in, topics, digest to confirmed readers only', async () => {
  sent.length = 0;
  const sub = await request(app).post('/newsletter').send({ email: 'Fan@Example.com', topics: [String(cat._id)] });
  assert.equal(sub.status, 201);
  assert.equal(sent.length, 1);
  assert.match(sent[0].text, /\/newsletter\/confirm\?token=/);
  assert.equal(sent[0].to, 'fan@example.com');
  assert.equal((await Subscriber.findOne({ email: 'fan@example.com' })).confirmed, false);
  assert.equal((await request(app).post('/newsletter').send({ email: 'nope' })).status, 422);
  const token = sent[0].text.match(/token=([a-f0-9]+)/)[1];
  // a second request for a pending address resends, it never reveals state
  await request(app).post('/newsletter').send({ email: 'fan@example.com' });
  assert.equal(sent.length, 2);
  await request(app).post('/newsletter').send({ email: 'other@example.com' });
  const { id } = await published({ title: 'Digest story' });
  const digest = (extra = {}) => api('post', '/newsletter/send', T.admin).send({ subject: 'Weekly', intro: 'Hello', articleIds: [id], ...extra });
  sent.length = 0;
  assert.equal((await digest()).body.sent, 0, 'pending addresses get nothing');
  assert.equal((await request(app).post('/newsletter/confirm').send({ token: 'bad' })).status, 404);
  assert.equal((await request(app).post('/newsletter/confirm').send({ token })).status, 200);
  const prefs = await request(app).put('/newsletter/preferences').send({ token, topics: [String(cat2._id)] });
  assert.deepEqual(prefs.body.topics, [String(cat2._id)]);
  assert.equal((await digest({ topics: [String(cat._id)] })).body.sent, 0, 'topic filter');
  const ok = await digest({ topics: [String(cat2._id)] });
  assert.equal(ok.body.sent, 1);
  assert.equal(sent.length, 1);
  assert.match(sent[0].text, /unsubscribe/i);
  assert.equal((await api('post', '/newsletter/send', T.editor).send({ subject: 'x', articleIds: [id] })).status, 403);
  assert.equal((await digest({ articleIds: [] })).status, 422);
  const stats = await api('get', '/stats', T.admin);
  assert.ok(stats.body.totals.subscribers >= 1 && stats.body.totals.pendingSubscribers >= 1);
  assert.equal((await api('get', '/newsletter', T.admin)).body.every((s) => s.token === undefined), true);
  assert.equal((await request(app).post('/newsletter/unsubscribe').send({ token })).status, 200);
  assert.equal(await Subscriber.countDocuments({ email: 'fan@example.com' }), 0);
});

test('follows and author pages', async () => {
  const { slug } = await published({ title: 'Author page story' });
  assert.ok(slug);
  const f = await api('put', '/user/follows', T.reader).send({ topics: [String(cat._id), 'bad'], authors: [String(U.author._id)] });
  assert.deepEqual(f.body.topics, [String(cat._id)]);
  const profile = await api('get', '/user/profile/user', T.reader);
  assert.deepEqual(profile.body.follows.authors, [String(U.author._id)]);
  const authors = await request(app).get('/authors');
  const me = authors.body.find((a) => a._id === String(U.author._id));
  assert.ok(me.articles >= 1);
  assert.equal(me.followers, 1);
  assert.equal(me.password, undefined);
  assert.equal((await request(app).get(`/authors/${U.reader._id}`)).status, 404);
  assert.equal((await request(app).get(`/authors/${U.author._id}`)).body.name, 'Author One');
  assert.equal((await api('put', '/user/follows', null).send({})).status, 401);
});

test('feeds, sitemap, robots and share pages with structured data', async () => {
  const { slug } = await published({ title: 'Feed story & <more>', tags: ['feedtag'] });
  const rss = await request(app).get('/feed.xml');
  assert.match(rss.headers['content-type'], /rss/);
  assert.match(rss.text, /<rss version="2.0"/);
  assert.match(rss.text, /Feed story &amp; &lt;more&gt;/);
  const sec = await request(app).get('/rss/tech.xml');
  assert.equal(sec.status, 200);
  assert.match(sec.text, /Tech/);
  assert.equal((await request(app).get('/rss/nothing.xml')).status, 404);
  assert.match((await request(app).get('/atom.xml')).text, /<feed xmlns="http:\/\/www.w3.org\/2005\/Atom">/);
  assert.match((await request(app).get('/atom/tech.xml')).text, /<entry>/);
  const sm = await request(app).get('/sitemap.xml');
  assert.match(sm.text, new RegExp(`/news-details/${slug}`));
  assert.match((await request(app).get('/robots.txt')).text, /Sitemap:/);
  const share = await request(app).get(`/share/${slug}`);
  assert.match(share.text, /og:title/);
  assert.match(share.text, /"@type":"NewsArticle"/);
  assert.match(share.text, /twitter:card/);
  assert.equal((await request(app).get('/share/does-not-exist')).status, 404);
});

test('settings, alert banner and audit log', async () => {
  const ev = ioClient(`http://127.0.0.1:${port}`, { transports: ['websocket'] });
  await new Promise((r) => ev.on('connect', r));
  const alert = new Promise((resolve) => ev.on('alert', resolve));
  assert.equal((await api('put', '/settings', T.editor).send({ alert: { active: true, text: '' } })).status, 422);
  assert.equal((await api('put', '/settings', T.editor).send({ alert: { active: true, text: 'Storm warning', link: 'javascript:1' } })).status, 422);
  const set = await api('put', '/settings', T.editor).send({ alert: { active: true, text: 'Storm warning', link: '/category/tech' }, siteName: 'Hacked' });
  assert.equal(set.status, 200);
  assert.equal(set.body.siteName, 'News Outlet', 'editors cannot rename the site');
  assert.equal((await Promise.race([alert, sleep(2000).then(() => null)])).text, 'Storm warning');
  assert.equal((await request(app).get('/settings')).body.alert.active, true);
  assert.equal((await api('put', '/settings', T.admin).send({ siteName: 'Daily Ledger' })).body.siteName, 'Daily Ledger');
  assert.equal((await api('put', '/settings', T.admin).send({ siteName: '' })).status, 422);
  await api('put', '/settings', T.admin).send({ siteName: 'News Outlet', alert: { active: false, text: '' } });
  const log = await api('get', '/audit?limit=100', T.admin);
  assert.ok(log.body.entries.some((e) => e.action === 'alert.update' && e.byName === 'Editor One'));
  assert.ok(log.body.entries.some((e) => e.action === 'article.transition'));
  assert.ok((await api('get', '/audit?action=user.role', T.admin)).body.entries.length >= 1);
  const regOff = await api('put', '/settings', T.admin).send({ registrationOpen: false });
  assert.equal(regOff.body.registrationOpen, false);
  assert.equal((await request(app).post('/user').send({ name: 'Late', email: 'late@t.io', password: 'secret1' })).status, 403);
  await api('put', '/settings', T.admin).send({ registrationOpen: true });
  ev.close();
});

test('sections: ordering, validation, menu data', async () => {
  const made = await api('post', '/category', T.admin).send({ name: 'Weather', description: 'Forecasts', order: 1 });
  assert.equal(made.status, 201);
  assert.equal((await api('post', '/category', T.admin).send({ name: 'Weather' })).status, 409);
  assert.equal((await api('post', '/category', T.admin).send({ name: '' })).status, 422);
  const list = (await request(app).get('/category')).body;
  assert.equal(list[0].name, 'Weather');
  assert.equal(list[0].slug, 'weather');
  const menu = (await request(app).get('/category/menu')).body;
  const tech = menu.find((m) => m.name === 'Tech');
  assert.ok(tech.latest.length > 0);
  assert.ok(Array.isArray(tech.tags));
  assert.equal((await api('delete', `/category/${list[0]._id}`, T.admin)).status, 200);
  assert.equal((await api('delete', `/category/${cat._id}`, T.admin)).status, 409, 'sections with articles stay');
});

test('bookmarks and contact still work', async () => {
  const { id } = await published({ title: 'Bookmark story' });
  assert.equal((await api('put', `/bookmarks/${id}`, T.reader)).status, 200);
  assert.equal((await api('put', `/bookmarks/${id}`, T.reader)).status, 200);
  assert.deepEqual((await api('get', '/bookmarks', T.reader)).body.ids, [id]);
  assert.equal((await api('delete', `/bookmarks/${id}`, T.reader)).status, 200);
  sent.length = 0;
  assert.equal((await request(app).post('/contact').send({ name: 'A', subject: 'S', email: 'a@b.co', message: 'Hi' })).status, 200);
  assert.equal(sent[0].replyTo, 'a@b.co');
  assert.equal((await request(app).post('/contact').send({ name: 'A', subject: 'S', email: 'bad', message: 'Hi' })).status, 422);
});

test('seeder: sample newsroom is created once and is complete', async () => {
  await mongoose.connection.dropDatabase();
  await ContentSeeder.run();
  const counts = { users: await User.countDocuments(), news: await News.countDocuments(), comments: await mongoose.model('Comment').countDocuments() };
  await ContentSeeder.run();
  assert.equal(await User.countDocuments(), counts.users);
  assert.equal(await News.countDocuments(), counts.news);
  assert.equal(await mongoose.model('Comment').countDocuments(), counts.comments);
  assert.equal(counts.users, 5);
  const statuses = new Set((await News.find()).map((n) => n.status));
  for (const s of ['draft', 'submitted', 'in_review', 'changes_requested', 'approved', 'scheduled', 'published', 'archived']) assert.ok(statuses.has(s), `sample has ${s}`);
  const kinds = new Set((await News.find()).map((n) => n.kind));
  for (const k of ['live', 'opinion', 'analysis', 'fact-check', 'sponsored']) assert.ok(kinds.has(k), `sample has ${k}`);
  assert.ok(await News.exists({ poll: { $exists: true } }));
  assert.ok(await Settings.exists({ key: 'site' }));
  const t = await login('admin@example.com', process.env.SEED_ADMIN_PASSWORD || 'admin123');
  assert.equal((await api('get', '/stats', t)).status, 200);
});
