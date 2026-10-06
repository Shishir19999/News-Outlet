import './setup.js';
import mongoose from 'mongoose';
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../src/app.js';
import User from '../src/models/User.js';
import Category from '../src/models/Category.js';
import News from '../src/models/News.js';
import { contactController } from '../src/routes/contactRoute.js';

const NEWS_DIR = path.resolve('public', 'news');
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
const created = new Set(); // image files created during tests (safety-net cleanup)

let admin, user, cat;
const sent = [];
const okMailer = { sendMail: async (o) => { sent.push(o); return {}; } };

async function login(email, password) {
    const res = await request(app).post('/login').send({ email, password });
    assert.equal(res.status, 200);
    return res.body.token;
}
const newsFiles = () => (fs.existsSync(NEWS_DIR) ? fs.readdirSync(NEWS_DIR) : []);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const waitGone = async (file) => {
    for (let i = 0; i < 40 && fs.existsSync(path.join(NEWS_DIR, file)); i++) await sleep(25);
    return !fs.existsSync(path.join(NEWS_DIR, file));
};
const postNews = (token, fields, imageName) => {
    let r = request(app).post('/news');
    if (token) r = r.set('authorization', token);
    for (const [k, v] of Object.entries(fields)) r = r.field(k, v);
    if (imageName) r = r.attach('image', PNG, imageName);
    return r;
};

before(async () => {
    await mongoose.connect(process.env.MONGODB_URL);
    await mongoose.connection.dropDatabase();
    await User.init();
    await News.init();
    await Category.init();
    admin = await new User({ name: 'admin', email: 'admin@t.io', password: 'adminpass', gender: 'male', role: 'admin' }).save();
    user = await new User({ name: 'user', email: 'user@t.io', password: 'userpass', gender: 'female' }).save();
    cat = await Category.create({ name: 'Tech' });
    contactController.transporter = okMailer;
});

after(async () => {
    for (const f of newsFiles()) if (created.has(f)) fs.rmSync(path.join(NEWS_DIR, f), { force: true });
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
});

beforeEach(async () => {
    await News.deleteMany({});
    sent.length = 0;
});

test('auth: login success, wrong password, unknown email', async () => {
    const ok = await request(app).post('/login').send({ email: 'user@t.io', password: 'userpass' });
    assert.equal(ok.status, 200);
    assert.ok(ok.body.token);
    assert.equal((await request(app).post('/login').send({ email: 'user@t.io', password: 'bad' })).status, 401);
    assert.equal((await request(app).post('/login').send({ email: 'no@t.io', password: 'x' })).status, 401);
});

test('auth: protected routes reject missing and garbage tokens', async () => {
    assert.equal((await request(app).get('/user')).status, 401);
    assert.equal((await request(app).get('/user').set('authorization', 'garbage')).status, 401);
});

test('auth: registration never grants admin and never leaks secrets', async () => {
    const res = await request(app).post('/user').field('name', 'eve').field('email', 'eve@t.io')
        .field('password', 'evepass').field('gender', 'female').field('role', 'admin');
    assert.equal(res.status, 201);
    assert.equal((await User.findOne({ email: 'eve@t.io' })).role, 'user');
    const t = await login('eve@t.io', 'evepass');
    const me = await request(app).get('/user/profile/user').set('authorization', t);
    assert.equal(me.status, 200);
    assert.equal(me.body.password, undefined);
    assert.equal(me.body.tokenVersion, undefined);
    const dup = await request(app).post('/user').field('name', 'eve').field('email', 'eve@t.io')
        .field('password', 'x').field('gender', 'male');
    assert.equal(dup.status, 409);
});

test('role gates: admin-only and self-or-admin routes', async () => {
    const ut = await login('user@t.io', 'userpass');
    const at = await login('admin@t.io', 'adminpass');
    // category management is admin only
    assert.equal((await request(app).post('/category').send({ name: 'X' })).status, 401);
    assert.equal((await request(app).post('/category').set('authorization', ut).send({ name: 'X' })).status, 403);
    assert.equal((await request(app).post('/category').set('authorization', at).send({ name: 'X' })).status, 201);
    assert.equal((await request(app).get('/category')).status, 200);
    // news update/delete are admin only
    const n = await News.create({ categoryId: cat._id, title: 'T', slug: 't', summary: 's' });
    assert.equal((await request(app).put(`/news/${n._id}`).set('authorization', ut).field('title', 'N')).status, 403);
    assert.equal((await request(app).delete(`/news/${n._id}`).set('authorization', ut)).status, 403);
    // but any logged-in user may create
    assert.equal((await postNews(ut, { categoryId: String(cat._id), title: 'By user', summary: 's' })).status, 201);
    // users: self or admin only
    assert.equal((await request(app).put(`/user/${admin._id}`).set('authorization', ut).send({ name: 'hack' })).status, 403);
    assert.equal((await request(app).delete(`/user/${admin._id}`).set('authorization', ut)).status, 403);
    assert.equal((await request(app).put(`/user/${user._id}`).set('authorization', ut).send({ name: 'me', role: 'admin' })).status, 200);
    assert.equal((await User.findById(user._id)).role, 'user');
});

test('news CRUD with image cleanup', async () => {
    const at = await login('admin@t.io', 'adminpass');
    const base = { categoryId: String(cat._id), title: 'Hello World', summary: 'Sum' };

    let res = await postNews(at, { ...base, categoryId: 'nope' });
    assert.equal(res.status, 422);
    assert.ok(res.body.errors.categoryId);
    res = await postNews(at, { categoryId: String(cat._id) });
    assert.equal(res.status, 422);
    assert.ok(res.body.errors.title && res.body.errors.summary);
    assert.equal((await postNews(null, base)).status, 401);

    res = await postNews(at, base, 'one.png');
    assert.equal(res.status, 201);
    const item = await News.findOne({ slug: 'hello-world' });
    assert.ok(item.image);
    created.add(item.image);
    assert.ok(fs.existsSync(path.join(NEWS_DIR, item.image)));

    const list = await request(app).get('/news');
    assert.equal(list.status, 200);
    assert.equal(list.body.total, 1);
    assert.equal((await request(app).get(`/news/${item._id}`)).body.title, 'Hello World');
    assert.equal((await request(app).get('/news/news-details/hello-world')).body.findNews.title, 'Hello World');
    assert.equal((await request(app).get('/news/zzz')).status, 404);

    // update replaces the image and removes the old file
    const oldImage = item.image;
    res = await request(app).put(`/news/${item._id}`).set('authorization', at)
        .field('title', 'Hello Again').attach('image', PNG, 'two.png');
    assert.equal(res.status, 200);
    const upd = await News.findById(item._id);
    created.add(upd.image);
    assert.notEqual(upd.image, oldImage);
    assert.equal(upd.title, 'Hello Again');
    assert.equal(upd.slug, 'hello-world');
    assert.ok(await waitGone(oldImage));
    assert.ok(fs.existsSync(path.join(NEWS_DIR, upd.image)));

    // delete removes record and file
    res = await request(app).delete(`/news/${item._id}`).set('authorization', at);
    assert.equal(res.status, 200);
    assert.equal(await News.countDocuments(), 0);
    assert.ok(await waitGone(upd.image));
    assert.equal((await request(app).delete(`/news/${item._id}`).set('authorization', at)).status, 404);
});

test('news: uploaded image is removed when validation fails or slug conflicts', async () => {
    const at = await login('admin@t.io', 'adminpass');
    const base = { categoryId: String(cat._id), title: 'Dup', summary: 'S' };
    const snapshot = new Set(newsFiles());
    const leaked = () => newsFiles().filter((f) => !snapshot.has(f));

    assert.equal((await postNews(at, { categoryId: String(cat._id) }, 'bad.png')).status, 422);
    assert.equal((await postNews(at, base)).status, 201);
    assert.equal((await postNews(at, base, 'dup.png')).status, 409);
    for (let i = 0; i < 40 && leaked().length; i++) await sleep(25);
    assert.deepEqual(leaked(), []);
});

test('news slug rules', async () => {
    const at = await login('admin@t.io', 'adminpass');
    const base = { categoryId: String(cat._id), summary: 'S' };
    assert.equal((await postNews(at, { ...base, title: 'A  Fancy: Title!' })).status, 201);
    assert.ok(await News.exists({ slug: 'a-fancy-title' }));
    assert.equal((await postNews(at, { ...base, title: 'Other', slug: 'My Custom Slug' })).status, 201);
    assert.ok(await News.exists({ slug: 'my-custom-slug' }));
    const dup = await postNews(at, { ...base, title: 'Third', slug: 'my custom SLUG' });
    assert.equal(dup.status, 409);
    assert.ok(dup.body.errors.slug);

    const a = await News.findOne({ slug: 'a-fancy-title' });
    const put = (f, v) => request(app).put(`/news/${a._id}`).set('authorization', at).field(f, v);
    await put('title', 'Renamed');
    assert.equal((await News.findById(a._id)).slug, 'a-fancy-title'); // kept when slug not sent
    assert.equal((await put('slug', 'my-custom-slug')).status, 409); // owned by another item
    assert.equal((await put('slug', 'a-fancy-title')).status, 200); // own slug is fine
    assert.equal((await put('slug', '')).status, 200); // empty regenerates from title
    assert.equal((await News.findById(a._id)).slug, 'renamed');
});

test('news pagination', async () => {
    await News.insertMany(Array.from({ length: 12 }, (_, i) => ({
        categoryId: cat._id, title: `Item ${i}`, slug: `item-${i}`, summary: 'S', createdAt: new Date(2024, 0, i + 1),
    })));
    const p1 = await request(app).get('/news?limit=5');
    assert.equal(p1.body.news.length, 5);
    assert.equal(p1.body.total, 12);
    assert.equal(p1.body.pages, 3);
    assert.equal((await request(app).get('/news?limit=5&page=3')).body.news.length, 2);
});

test('contact: validation and stub mailer', async () => {
    const good = { name: 'Ann', email: 'ann@x.io', subject: 'Hi', message: 'Hello' };
    for (const k of Object.keys(good)) {
        const body = { ...good };
        delete body[k];
        assert.equal((await request(app).post('/contact').send(body)).status, 422, `missing ${k}`);
    }
    assert.equal((await request(app).post('/contact').send({ ...good, subject: '   ' })).status, 422);
    assert.equal((await request(app).post('/contact').send({ ...good, email: 'not-an-email' })).status, 422);
    assert.equal(sent.length, 0);

    assert.equal((await request(app).post('/contact').send(good)).status, 200);
    assert.equal(sent.length, 1);
    assert.equal(sent[0].to, 'inbox@test.local');
    assert.equal(sent[0].text, 'Hello');

    contactController.transporter = { sendMail: async () => { throw new Error('smtp down'); } };
    assert.equal((await request(app).post('/contact').send(good)).status, 500);
    contactController.transporter = okMailer;
});

test('revocation: logout invalidates old tokens, new login works', async () => {
    const t1 = await login('user@t.io', 'userpass');
    const t2 = await login('user@t.io', 'userpass'); // second session, same user
    assert.equal((await request(app).get('/user/profile/user').set('authorization', t1)).status, 200);
    assert.equal((await request(app).post('/logout')).status, 401);

    assert.equal((await request(app).post('/logout').set('authorization', t1)).status, 200);
    assert.equal((await User.findById(user._id)).tokenVersion, 1);

    for (const t of [t1, t2]) {
        assert.equal((await request(app).get('/user/profile/user').set('authorization', t)).status, 401);
        const chk = await request(app).post('/login/toke-check').send({ token: t });
        assert.equal(chk.body.success, false);
    }
    assert.equal((await request(app).post('/logout').set('authorization', t1)).status, 401);

    const t3 = await login('user@t.io', 'userpass');
    assert.equal((await request(app).get('/user/profile/user').set('authorization', t3)).status, 200);
    assert.equal((await request(app).post('/login/toke-check').send({ token: t3 })).body.success, true);
});

test('revocation: token of a deleted user is rejected', async () => {
    const tmp = await new User({ name: 'tmp', email: 'tmp@t.io', password: 'tmppass', gender: 'male' }).save();
    const t = await login('tmp@t.io', 'tmppass');
    assert.equal((await request(app).get('/user/profile/user').set('authorization', t)).status, 200);
    await User.findByIdAndDelete(tmp._id);
    assert.equal((await request(app).get('/user/profile/user').set('authorization', t)).status, 401);
});

test('revocation: legacy tokens without tokenVersion work until logout', async () => {
    const legacy = jwt.sign({ pay_load: { _id: admin._id, role: 'admin' } }, process.env.JWT_SECRET);
    assert.equal((await request(app).get('/user').set('authorization', legacy)).status, 200);
});
