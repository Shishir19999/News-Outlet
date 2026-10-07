import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderMarkdown } from '../src/lib/markdown.js';
import {
  slugify, readingTime, stripMarkdown, excerpt, highlightParts, timeAgo, toLocalInput, fromLocalInput, isLive, statusOf, formatNumber,
} from '../src/lib/text.js';

test('slugify', () => {
  assert.equal(slugify('  Hello, World & Co!  '), 'hello-world-and-co');
  assert.equal(slugify('Café déjà vu'), 'cafe-deja-vu');
  assert.equal(slugify('***'), '');
});

test('readingTime: at least one minute, 200 words per minute', () => {
  assert.equal(readingTime(''), 1);
  assert.equal(readingTime('word '.repeat(200)), 1);
  assert.equal(readingTime('word '.repeat(201)), 2);
  assert.equal(readingTime('## Heading\n\n' + 'word '.repeat(400)), 3);
});

test('stripMarkdown and excerpt', () => {
  assert.equal(stripMarkdown('## Title\n\n**bold** and [a link](http://x.io) ![img](a.png)'), 'Title bold and a link img');
  assert.equal(excerpt('short text', 50), 'short text');
  const long = excerpt('alpha beta gamma delta epsilon '.repeat(20), 60);
  assert.ok(long.endsWith('…'));
  assert.ok(long.length <= 61);
});

test('highlightParts splits on case-insensitive matches and escapes the query', () => {
  assert.deepEqual(highlightParts('Open Data portal', 'data'), [
    { text: 'Open ', match: false }, { text: 'Data', match: true }, { text: ' portal', match: false },
  ]);
  assert.deepEqual(highlightParts('nothing here', 'zzz'), [{ text: 'nothing here', match: false }]);
  assert.deepEqual(highlightParts('a.b (c)', '(c)'), [{ text: 'a.b ', match: false }, { text: '(c)', match: true }]);
  assert.deepEqual(highlightParts('plain', ''), [{ text: 'plain', match: false }]);
  const multi = highlightParts('rail freight deal', 'rail deal');
  assert.deepEqual(multi.filter((p) => p.match).map((p) => p.text), ['rail', 'deal']);
});

test('markdown: basic blocks and inline formatting', () => {
  const html = renderMarkdown('# Title\n\nSome **bold** and *italic* with `code`.\n\n- one\n- two\n\n1. first\n2. second\n\n> quoted');
  assert.match(html, /<h2>Title<\/h2>/);
  assert.match(html, /<strong>bold<\/strong>/);
  assert.match(html, /<em>italic<\/em>/);
  assert.match(html, /<code>code<\/code>/);
  assert.match(html, /<ul><li>one<\/li><li>two<\/li><\/ul>/);
  assert.match(html, /<ol><li>first<\/li><li>second<\/li><\/ol>/);
  assert.match(html, /<blockquote>quoted<\/blockquote>/);
});

test('markdown: HTML and unsafe URLs are neutralised', () => {
  const html = renderMarkdown('<script>alert(1)</script>\n\n[x](javascript:alert(1))\n\n![y](javascript:alert(2))\n\n<img src=x onerror=alert(3)>');
  assert.ok(!html.includes('<script'));
  assert.ok(!html.includes('<img src=x'));
  assert.ok(!/href="javascript/i.test(html));
  assert.ok(!/src="javascript/i.test(html));
  assert.match(html, /&lt;script&gt;/);
});

test('markdown: safe links get rel, images allow data URLs, code is escaped', () => {
  const html = renderMarkdown('[site](https://example.com/a?b=1&c=2) ![pic](data:image/png;base64,AAAA)\n\n```\n<b>x</b>\n```');
  assert.match(html, /<a href="https:\/\/example.com\/a\?b=1&amp;c=2" target="_blank" rel="noopener noreferrer">site<\/a>/);
  assert.match(html, /<img src="data:image\/png;base64,AAAA" alt="pic"/);
  assert.match(html, /<pre><code>&lt;b&gt;x&lt;\/b&gt;<\/code><\/pre>/);
});

test('dates: timeAgo, local input round trip, live/status', () => {
  const now = Date.parse('2026-01-10T12:00:00Z');
  assert.equal(timeAgo('2026-01-10T11:59:40Z', now), 'just now');
  assert.equal(timeAgo('2026-01-10T11:30:00Z', now), '30 min ago');
  assert.equal(timeAgo('2026-01-10T09:00:00Z', now), '3 hr ago');
  assert.equal(timeAgo('2026-01-08T12:00:00Z', now), '2 days ago');
  const iso = '2026-03-05T08:15:00.000Z';
  assert.equal(fromLocalInput(toLocalInput(iso)), iso);
  assert.equal(fromLocalInput(''), '');

  const future = new Date(now + 1000).toISOString();
  const past = new Date(now - 1000).toISOString();
  assert.equal(isLive({ status: 'draft' }, now), false);
  assert.equal(isLive({ status: 'scheduled', publishedAt: future }, now), false);
  assert.equal(isLive({ status: 'scheduled', publishedAt: past }, now), true);
  assert.equal(isLive({ status: 'published' }, now), true);
  assert.equal(statusOf({ status: 'scheduled', publishedAt: future }, now), 'scheduled');
  assert.equal(statusOf({ status: 'scheduled', publishedAt: past }, now), 'published');
});

test('formatNumber', () => {
  assert.equal(formatNumber(950), '950');
  assert.equal(formatNumber(1500), '1.5k');
  assert.equal(formatNumber(2000), '2k');
  assert.equal(formatNumber(2500000), '2.5M');
});
