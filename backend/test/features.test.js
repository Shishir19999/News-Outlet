import './setup.js';
import mongoose from 'mongoose';
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import app from '../src/app.js';
import User from '../src/models/User.js';
import Category from '../src/models/Category.js';
import News from '../src/models/News.js';
import Comment from '../src/models/Comment.js';
import Bookmark from '../src/models/Bookmark.js';
import Subscriber from '../src/models/Subscriber.js';

let admin, user, cat, cat2, at, ut;
const login = async (email, password) => (await request(app).post('/login').send({ email, password })).body.token;
const mk = (over) => News.create({ categoryId: cat._id, title: 'T', slug: `t-${Math.random().toString(36).slice(2)}`, summary: 'S', ...over });
const DAY = 86400000;

before(async () => {
    await mongoose.connect(process.env.MONGODB_URL);
    await mongoose.connection.dropDatabase();
    await Promise.all([User.init(), News.init(), Category.init(), Subscriber.init(), Bookmark.init()]);
    admin = await new User({ name: 'admin', email: 'admin@t.io', password: 'adminpass', gender: 'male', role: 'admin' }).save();
    user = await new User({ name: 'Una User', email: 'user@t.io', password: 'userpass', gender: 'female' }).save();
    cat = await Category.create({ name: 'Local Tech' });
    cat2 = await Category.create({ name: 'Sports' });
    at = await login('admin@t.io', 'adminpass');
    ut = await login('user@t.io', 'userpass');
});

after(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
});

beforeEach(async () => {
    await Promise.all([News.deleteMany({}), Comment.deleteMany({}), Bookmark.deleteMany({}), Subscriber.deleteMany({})]);
});

test('publishing: drafts and future-scheduled articles are hidden from the public', async () => {
    const live = await mk({ title: 'Live' });
    const draft = await mk({ title: 'Draft', status: 'draft' });
    const later = await mk({ title: 'Later', status: 'scheduled', publishedAt: new Date(Date.now() + DAY) });
    const due = await mk({ title: 'Due', status: 'scheduled', publishedAt: new Date(Date.now() - 1000) });

    const list = await request(app).get('/news');
    assert.deepEqual(list.body.news.map((n) => n.title).sort(), ['Due', 'Live']);
    assert.equal((await request(app).get(`/news/${draft._id}`)).status, 404);
    assert.equal((await request(app).get(`/news/news-details/${later.slug}`)).status, 404);
    assert.equal((await request(app).get(`/news/${live._id}`)).status, 200);
    // admins can preview everything
    assert.equal((await request(app).get(`/news/${draft._id}`).set('authorization', at)).status, 200);
    assert.equal((await request(app).get(`/news/news-details/${later.slug}`).set('authorization', at)).status, 200);
    // the author can preview their own draft, other users cannot
    const mine = await mk({ title: 'Mine', status: 'draft', author: user._id });
    assert.equal((await request(app).get(`/news/${mine._id}`).set('authorization', ut)).status, 200);
    assert.equal((await request(app).get(`/news/${draft._id}`).set('authorization', ut)).status, 404);
    // views and comments are refused for hidden articles
    assert.equal((await request(app).post(`/news/${draft._id}/view`)).status, 404);
});

test('publishing: create with status/schedule, validation, and publish transition', async () => {
    const post = (fields) => {
        let r = request(app).post('/news').set('authorization', at);
        for (const [k, v] of Object.entries({ categoryId: String(cat._id), summary: 'S', ...fields })) r = r.field(k, v);
        return r;
    };
    assert.equal((await post({ title: 'Bad status', status: 'nope' })).status, 422);
    assert.equal((await post({ title: 'No date', status: 'scheduled' })).status, 422);
    assert.equal((await post({ title: 'Bad date', status: 'scheduled', publishedAt: 'zzz' })).status, 422);

    const when = new Date(Date.now() + 2 * DAY).toISOString();
    const sched = await post({ title: 'Future one', status: 'scheduled', publishedAt: when, featured: 'true' });
    assert.equal(sched.status, 201);
    assert.ok(sched.body.id);
    const doc = await News.findById(sched.body.id);
    assert.equal(doc.status, 'scheduled');
    assert.equal(doc.featured, true);
    assert.equal(String(doc.author), String(admin._id));
    assert.equal((await request(app).get('/news')).body.total, 0);

    const pub = await request(app).put(`/news/${doc._id}`).set('authorization', at).field('status', 'published');
    assert.equal(pub.status, 200);
    assert.ok((await News.findById(doc._id)).publishedAt <= new Date());
    assert.equal((await request(app).get('/news')).body.total, 1);

    const drafts = await post({ title: 'Wip', status: 'draft' });
    assert.equal(drafts.status, 201);
    assert.equal((await request(app).get('/news')).body.total, 1);
});

test('news listing: sort, period, featured, ids and category filters', async () => {
    const a = await mk({ title: 'Alpha', views: 5, publishedAt: new Date(Date.now() - 10 * DAY) });
    const b = await mk({ title: 'Bravo', views: 50, featured: true, categoryId: cat2._id });
    const c = await mk({ title: 'Charlie', views: 20, publishedAt: new Date(Date.now() - 3 * DAY) });
    const titles = async (q) => (await request(app).get(`/news?${q}`)).body.news.map((n) => n.title);

    assert.deepEqual(await titles('sort=popular'), ['Bravo', 'Charlie', 'Alpha']);
    assert.deepEqual(await titles('sort=latest'), ['Bravo', 'Charlie', 'Alpha']);
    assert.deepEqual(await titles('sort=oldest'), ['Alpha', 'Charlie', 'Bravo']);
    assert.deepEqual(await titles('period=7&sort=oldest'), ['Charlie', 'Bravo']);
    assert.deepEqual(await titles('featured=1'), ['Bravo']);
    assert.deepEqual(await titles(`ids=${a._id},${c._id},nope`), ['Charlie', 'Alpha']);
    assert.deepEqual(await titles(`categoryId=${cat2._id}`), ['Bravo']);
    assert.deepEqual(await titles('search=ALPH'), ['Alpha']);
    assert.ok(b);
});

test('news manage list: admin sees all, users only their own', async () => {
    await mk({ title: 'Admins draft', status: 'draft', author: admin._id });
    await mk({ title: 'Users piece', author: user._id });
    assert.equal((await request(app).get('/news/manage/list')).status, 401);
    const all = await request(app).get('/news/manage/list').set('authorization', at);
    assert.equal(all.body.total, 2);
    const mine = await request(app).get('/news/manage/list').set('authorization', ut);
    assert.deepEqual(mine.body.news.map((n) => n.title), ['Users piece']);
    const drafts = await request(app).get('/news/manage/list?status=draft').set('authorization', at);
    assert.deepEqual(drafts.body.news.map((n) => n.title), ['Admins draft']);
});

test('related articles: same category, live only, at most four', async () => {
    const main = await mk({ title: 'Main' });
    for (let i = 0; i < 6; i++) await mk({ title: `Rel ${i}`, views: i });
    await mk({ title: 'Hidden', status: 'draft' });
    await mk({ title: 'Other cat', categoryId: cat2._id });
    const res = await request(app).get(`/news/news-details/${main.slug}`);
    assert.equal(res.body.relatedNews.length, 4);
    assert.ok(res.body.relatedNews.every((n) => /^Rel/.test(n.title)));
    assert.equal(res.body.relatedNews[0].title, 'Rel 5');
});

test('views: counted per article and aggregated in stats (admin only)', async () => {
    const n = await mk({ title: 'Counted' });
    assert.equal((await request(app).post(`/news/${n._id}/view`)).status, 200);
    const second = await request(app).post(`/news/${n._id}/view`);
    assert.equal(second.body.views, 2);
    assert.equal((await request(app).post('/news/nope/view')).status, 404);

    assert.equal((await request(app).get('/stats')).status, 401);
    assert.equal((await request(app).get('/stats').set('authorization', ut)).status, 403);
    const res = await request(app).get('/stats?days=7').set('authorization', at);
    assert.equal(res.status, 200);
    assert.equal(res.body.viewsByDay.length, 7);
    assert.equal(res.body.viewsByDay.at(-1).views >= 2, true);
    const row = res.body.viewsByCategory.find((c) => c.name === 'Local Tech');
    assert.equal(row.views, 2);
    assert.equal(res.body.totals.published, 1);
    assert.equal(res.body.topArticles[0].title, 'Counted');
});

test('comments: pending until approved; moderation is admin only', async () => {
    const n = await mk({ title: 'Discuss' });
    const post = (body, token) => {
        const r = request(app).post('/comments');
        return (token ? r.set('authorization', token) : r).send(body);
    };
    assert.equal((await post({ newsId: String(n._id), body: '' , name: 'Guest' })).status, 422);
    assert.equal((await post({ newsId: String(n._id), body: 'Hi' })).status, 422); // guest needs a name
    assert.equal((await post({ newsId: 'x', body: 'Hi', name: 'G' })).status, 422);
    assert.equal((await post({ newsId: String(n._id), body: 'x'.repeat(1001), name: 'G' })).status, 422);
    const draft = await mk({ title: 'Hidden', status: 'draft' });
    assert.equal((await post({ newsId: String(draft._id), body: 'Hi', name: 'G' })).status, 404);

    const guest = await post({ newsId: String(n._id), body: 'Nice piece', name: 'Guest' });
    assert.equal(guest.status, 201);
    assert.equal(guest.body.status, 'pending');
    const byUser = await post({ newsId: String(n._id), body: 'From a user', name: 'ignored' }, ut);
    assert.equal(byUser.body.status, 'pending');
    assert.equal((await Comment.findById(byUser.body.id)).name, 'Una User');
    const byAdmin = await post({ newsId: String(n._id), body: 'Staff note' }, at);
    assert.equal(byAdmin.body.status, 'approved');

    let pub = await request(app).get(`/comments?newsId=${n._id}`);
    assert.deepEqual(pub.body.map((c) => c.body), ['Staff note']);
    assert.equal(pub.body[0].userId, undefined);
    assert.equal((await request(app).get('/comments')).status, 422);

    assert.equal((await request(app).get('/comments/manage/list')).status, 401);
    assert.equal((await request(app).get('/comments/manage/list').set('authorization', ut)).status, 403);
    const queue = await request(app).get('/comments/manage/list?status=pending').set('authorization', at);
    assert.equal(queue.body.total, 2);
    assert.equal(queue.body.pending, 2);
    assert.equal(queue.body.comments[0].news.title, 'Discuss');

    assert.equal((await request(app).put(`/comments/${guest.body.id}`).set('authorization', ut).send({ status: 'approved' })).status, 403);
    assert.equal((await request(app).put(`/comments/${guest.body.id}`).set('authorization', at).send({ status: 'bad' })).status, 422);
    assert.equal((await request(app).put(`/comments/${guest.body.id}`).set('authorization', at).send({ status: 'approved' })).status, 200);
    assert.equal((await request(app).put(`/comments/${byUser.body.id}`).set('authorization', at).send({ status: 'rejected' })).status, 200);
    pub = await request(app).get(`/comments?newsId=${n._id}`);
    assert.deepEqual(pub.body.map((c) => c.body), ['Nice piece', 'Staff note']);

    assert.equal((await request(app).delete(`/comments/${guest.body.id}`).set('authorization', at)).status, 200);
    assert.equal((await request(app).delete(`/comments/${guest.body.id}`).set('authorization', at)).status, 404);
    // deleting the article removes its comments
    await request(app).delete(`/news/${n._id}`).set('authorization', at);
    assert.equal(await Comment.countDocuments({ newsId: n._id }), 0);
});

test('bookmarks: per user, idempotent, live articles only', async () => {
    const a = await mk({ title: 'A' });
    const b = await mk({ title: 'B' });
    assert.equal((await request(app).get('/bookmarks')).status, 401);
    assert.equal((await request(app).put(`/bookmarks/${a._id}`).set('authorization', ut)).status, 200);
    assert.equal((await request(app).put(`/bookmarks/${a._id}`).set('authorization', ut)).status, 200);
    assert.equal((await request(app).put(`/bookmarks/${b._id}`).set('authorization', ut)).status, 200);
    assert.equal((await request(app).put(`/bookmarks/${new mongoose.Types.ObjectId()}`).set('authorization', ut)).status, 404);
    assert.equal(await Bookmark.countDocuments(), 2);

    let res = await request(app).get('/bookmarks').set('authorization', ut);
    assert.deepEqual(res.body.news.map((n) => n.title), ['B', 'A']);
    assert.deepEqual(res.body.ids, [String(b._id), String(a._id)]);
    assert.equal((await request(app).get('/bookmarks').set('authorization', at)).body.ids.length, 0);

    assert.equal((await request(app).delete(`/bookmarks/${a._id}`).set('authorization', ut)).status, 200);
    assert.equal((await request(app).delete(`/bookmarks/${a._id}`).set('authorization', ut)).status, 200);
    await News.findByIdAndUpdate(b._id, { status: 'draft' });
    res = await request(app).get('/bookmarks').set('authorization', ut);
    assert.equal(res.body.ids.length, 0);
});

test('newsletter: stores addresses only, validates, dedupes, admin lists', async () => {
    assert.equal((await request(app).post('/newsletter').send({ email: 'nope' })).status, 422);
    assert.equal((await request(app).post('/newsletter').send({})).status, 422);
    assert.equal((await request(app).post('/newsletter').send({ email: ' Reader@Example.com ' })).status, 201);
    assert.equal((await request(app).post('/newsletter').send({ email: 'reader@example.com' })).status, 201);
    assert.equal(await Subscriber.countDocuments(), 1);
    assert.equal((await Subscriber.findOne()).email, 'reader@example.com');

    assert.equal((await request(app).get('/newsletter')).status, 401);
    assert.equal((await request(app).get('/newsletter').set('authorization', ut)).status, 403);
    const list = await request(app).get('/newsletter').set('authorization', at);
    assert.equal(list.body.length, 1);
    assert.equal((await request(app).delete(`/newsletter/${list.body[0]._id}`).set('authorization', at)).status, 200);
    assert.equal(await Subscriber.countDocuments(), 0);
});

test('categories: slug and live article count', async () => {
    await mk({ title: 'One' });
    await mk({ title: 'Two', status: 'draft' });
    const res = await request(app).get('/category');
    const c = res.body.find((x) => x.name === 'Local Tech');
    assert.equal(c.slug, 'local-tech');
    assert.equal(c.newsCount, 1);
    assert.equal(res.body.find((x) => x.name === 'Sports').newsCount, 0);
});
