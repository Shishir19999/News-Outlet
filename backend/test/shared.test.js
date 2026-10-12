import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  can, roleAtLeast, normalizeRole, transitionsFor, checkTransition, canEditArticle, effectiveStatus, isLive, validateArticle, validateComment,
  readingTime, trendingScore, forYouScore, rankSearch, didYouMean, vocabulary, editDistance, diffSnapshots, diffLines, snapshotOf,
  abLeader, abVariant, parseEmbed, classifySource, depthBucket, deriveTags, slugify, validateSettings,
} from '../src/shared/rules.js';
import { buildSampleContent } from '../src/shared/sample.js';
import { rssFeed, sitemapXml, articleJsonLd } from '../src/shared/feeds.js';

const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const dirs = [
  path.resolve(here, '..', 'src', 'shared'),
  path.resolve(here, '..', '..', 'frontend', 'src', 'shared'),
  path.resolve(here, '..', '..', 'shared'),
].filter((d) => fs.existsSync(d));
const sum = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');

test('shared code has not drifted: backend, frontend and root copies are identical', () => {
  assert.ok(dirs.length >= 2, 'at least two copies are present');
  const names = fs.readdirSync(dirs[0]).filter((n) => n.endsWith('.js')).sort();
  assert.ok(names.includes('rules.js'));
  for (const d of dirs.slice(1)) {
    assert.deepEqual(fs.readdirSync(d).filter((n) => n.endsWith('.js')).sort(), names, `same files in ${d}`);
    for (const n of names) assert.equal(sum(path.join(d, n)), sum(path.join(dirs[0], n)), `${n} differs in ${d} (run npm run sync:shared)`);
  }
});

test('roles and permissions are cumulative', () => {
  assert.equal(normalizeRole('user'), 'reader');
  assert.equal(normalizeRole('weird'), 'reader');
  assert.ok(can('reader', 'comment') && !can('reader', 'article.create'));
  assert.ok(can('author', 'comment') && can('author', 'article.create') && !can('author', 'review'));
  assert.ok(can('editor', 'article.create') && can('editor', 'review') && !can('editor', 'users'));
  assert.ok(can('admin', 'users') && can('admin', 'review'));
  assert.ok(roleAtLeast('admin', 'editor') && !roleAtLeast('author', 'editor'));
});

test('workflow table', () => {
  const me = (role, _id = 'u1') => ({ _id, role });
  const art = (status, author = 'a1', extra = {}) => ({ status, author, ...extra });
  assert.deepEqual(transitionsFor(art('draft'), me('author', 'a1')).map((t) => t.to), ['submitted']);
  assert.deepEqual(transitionsFor(art('draft'), me('author', 'other')).map((t) => t.to), []);
  assert.deepEqual(transitionsFor(art('submitted'), me('editor')).map((t) => t.to).sort(), ['changes_requested', 'in_review']);
  assert.ok(!transitionsFor(art('in_review', 'u1'), me('editor', 'u1')).some((t) => t.to === 'approved'));
  assert.ok(transitionsFor(art('in_review', 'u1'), me('admin', 'u1')).some((t) => t.to === 'approved'));
  assert.ok(transitionsFor(art('draft'), me('admin')).some((t) => t.to === 'published'));
  const now = Date.now();
  assert.equal(checkTransition(art('approved'), 'scheduled', me('editor'), { publishedAt: new Date(now - 5).toISOString(), now }).status, 422);
  const ok = checkTransition(art('approved'), 'scheduled', me('editor'), { publishedAt: new Date(now + 5000).toISOString(), now });
  assert.ok(ok.ok && ok.patch.status === 'scheduled');
  const pub = checkTransition(art('approved'), 'published', me('editor'), { now });
  assert.equal(new Date(pub.patch.publishedAt).getTime(), now);
  const keep = checkTransition(art('archived', 'a1', { publishedAt: '2024-01-01T00:00:00Z' }), 'published', me('editor'), { now });
  assert.equal(keep.patch.publishedAt, undefined, 'republishing keeps the original date');
  assert.equal(checkTransition(art('published'), 'draft', me('admin')).status, 409);
  assert.equal(checkTransition(art('submitted'), 'changes_requested', me('editor'), { note: ' ' }).status, 422);
  assert.ok(canEditArticle(art('draft', 'a1'), me('author', 'a1')));
  assert.ok(!canEditArticle(art('submitted', 'a1'), me('author', 'a1')));
  assert.ok(canEditArticle(art('submitted', 'a1'), me('editor')));
  assert.equal(effectiveStatus({ status: 'scheduled', publishedAt: new Date(now - 1) }, now), 'published');
  assert.ok(!isLive({ status: 'scheduled', publishedAt: new Date(now + 9999) }, now));
});

test('validation messages', () => {
  assert.equal(validateArticle({ title: '', summary: 'x', categoryId: '1' }).errors.title, 'Title is required');
  assert.ok(validateArticle({ title: 't', summary: 's', categoryId: '1', kind: 'sponsored' }).errors.sponsor);
  assert.deepEqual(validateArticle({ title: 't', summary: 's', categoryId: '1', tags: 'A Tag, b' }).values.tags, ['a-tag', 'b']);
  assert.ok(validateArticle({ tags: new Array(11).fill('x').map((x, i) => x + i) }, { partial: true }).errors.tags);
  assert.equal(validateComment({ body: ' hi ', name: 'N' }).values.body, 'hi');
  assert.ok(validateSettings({ alert: { active: true, text: '' } }).errors.alert);
  assert.equal(parseEmbed('https://youtu.be/M7lc1UVf-VE').src, 'https://www.youtube-nocookie.com/embed/M7lc1UVf-VE');
  assert.match(parseEmbed('https://vimeo.com/123456789').src, /dnt=1/);
  assert.equal(parseEmbed('http://youtu.be/M7lc1UVf-VE'), null);
  assert.equal(parseEmbed('https://x.test/a.mp3').kind, 'audio');
});

test('text, trending and personalisation helpers', () => {
  assert.equal(readingTime('word '.repeat(450)), 3);
  assert.equal(slugify('Café & Crème!'), 'cafe-and-creme');
  assert.deepEqual(deriveTags('Riverton Rovers clinch the league title'), ['riverton', 'rovers', 'clinch']);
  const now = Date.parse('2026-06-10T12:00:00Z');
  const fresh = trendingScore({ daily: { '2026-06-10': 100 }, publishedAt: '2026-06-10T06:00:00Z' }, now);
  const old = trendingScore({ daily: { '2026-06-01': 900 }, publishedAt: '2026-05-30T06:00:00Z' }, now);
  assert.ok(fresh > old, 'recent views outweigh a bigger old spike');
  const a = { categoryId: 'c1', author: 'x', publishedAt: '2026-06-10T00:00:00Z', views: 10, tags: [] };
  assert.ok(forYouScore(a, { topics: ['c1'] }, now).score > forYouScore(a, {}, now).score);
  assert.deepEqual(forYouScore(a, { authors: ['x'] }, now).reasons, ['author']);
  assert.equal(classifySource('https://www.google.com/', 'site.test'), 'search');
  assert.equal(classifySource('https://news.test/x', 'news.test'), 'internal');
  assert.equal(classifySource('', 'x'), 'direct');
  assert.equal(classifySource('https://t.co/abc', 'x'), 'social');
  assert.equal(classifySource('', 'x', 'newsletter'), 'newsletter');
  assert.equal(depthBucket(80), 75);
  assert.equal(depthBucket(10), 0);
});

test('search ranks, tolerates typos and suggests corrections', () => {
  const { articles } = buildSampleContent(Date.UTC(2026, 5, 10));
  assert.equal(editDistance('market', 'markt'), 1);
  const hits = rankSearch('riversde markt', articles);
  assert.ok(hits.length > 0 && hits[0].fuzzy);
  assert.equal(rankSearch('zzzzqq', articles).length, 0);
  assert.equal(didYouMean('marathn', vocabulary(articles)), 'marathon');
  assert.equal(rankSearch('marathon', articles)[0].article.title.toLowerCase().includes('marathon'), true);
});

test('revision diffs, headline tests and feeds', () => {
  const a = snapshotOf({ title: 'Old title here', description: 'one\ntwo', categoryId: 'c' });
  const b = snapshotOf({ title: 'New title here', description: 'one\nthree', categoryId: 'c' });
  const diff = diffSnapshots(a, b);
  assert.deepEqual(diff.map((d) => d.field), ['title', 'description']);
  assert.ok(diff[0].diff.some((d) => d.type === 'del' && d.text === 'Old'));
  assert.deepEqual(diffLines('a\nb', 'a\nc').map((d) => d.type), ['same', 'del', 'add']);
  assert.equal(abLeader({ a: { impressions: 100, clicks: 5 }, b: { impressions: 100, clicks: 9 } }), 'b');
  assert.equal(abLeader({ a: { impressions: 3, clicks: 1 }, b: { impressions: 3, clicks: 2 } }), null);
  assert.equal(abVariant('c1', 'x'), abVariant('c1', 'x'));
  const ctx = { siteUrl: 'https://s.test', siteName: 'S', articleUrl: (s) => `https://s.test/a/${s}`, sectionUrl: (s) => `https://s.test/c/${s}`, feedUrl: () => 'https://s.test/feed.xml' };
  const item = { title: 'T & U', slug: 't-u', summary: 'Sum', publishedAt: '2026-01-01T00:00:00Z', tags: ['x'], kind: 'opinion' };
  assert.match(rssFeed([item], ctx), /T &amp; U/);
  assert.match(sitemapXml([item], [], ctx), /\/a\/t-u/);
  assert.equal(articleJsonLd(item, ctx)['@type'], 'OpinionNewsArticle');
});

test('sample content is original, complete and consistent', () => {
  const s = buildSampleContent(Date.UTC(2026, 5, 10));
  assert.ok(s.articles.length >= 40);
  assert.equal(new Set(s.articles.map((a) => a.slug)).size, s.articles.length, 'unique slugs');
  assert.ok(s.articles.every((a) => a.title && a.summary && a.description && s.sections.some((x) => x.name === a.section)));
  assert.ok(s.people.every((p) => /@example\.com$/.test(p.email)));
});
