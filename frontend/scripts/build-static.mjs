// Runs after `vite build --mode pages`: writes the files a static host needs for syndication and
// search engines into dist/ (RSS and Atom feeds per section, sitemap.xml, robots.txt and one share
// page per story with Open Graph / Twitter tags and NewsArticle JSON-LD).
// The sample stories come from the same data as the live preview. SITE_URL sets the public address.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSeed } from '../src/demo/seed.js';
import { isLive, slugify } from '../src/shared/rules.js';
import { rssFeed, atomFeed, sitemapXml, robotsTxt, sharePage } from '../src/shared/feeds.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const site = (process.env.SITE_URL || 'https://shishir19999.github.io/News-Outlet').replace(/\/$/, '');
if (!fs.existsSync(dist)) throw new Error('Run the pages build first (dist/ is missing).');

const state = buildSeed(Date.now());
const sections = [...state.categories].sort((a, b) => a.order - b.order).map((c) => ({ ...c, slug: slugify(c.name) }));
const catOf = (id) => sections.find((s) => s._id === id);
const userOf = (id) => state.users.find((u) => u._id === id);
const now = Date.now();
const articles = state.news
  .filter((n) => isLive(n, now))
  .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))
  .map((n) => ({ ...n, category: catOf(n.categoryId), author: { name: (userOf(n.author) || {}).name } }));

const ctx = {
  siteUrl: site,
  siteName: state.settings.siteName,
  tagline: state.settings.tagline,
  articleUrl: (slug) => `${site}/a/${slug}/`,
  sectionUrl: (slug) => `${site}/#/category/${slug}`,
  feedUrl: (kind, slug) => (slug ? `${site}/${kind}/${slug}.xml` : `${site}/${kind === 'atom' ? 'atom' : 'feed'}.xml`),
};
const write = (rel, content) => {
  const file = path.join(dist, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
};

write('feed.xml', rssFeed(articles.slice(0, 30), ctx));
write('atom.xml', atomFeed(articles.slice(0, 30), ctx));
for (const s of sections) {
  const items = articles.filter((a) => a.categoryId === s._id).slice(0, 30);
  write(`rss/${s.slug}.xml`, rssFeed(items, ctx, s));
  write(`atom/${s.slug}.xml`, atomFeed(items, ctx, s));
}
write('sitemap.xml', sitemapXml(articles, sections, ctx, [`${site}/#/archive`, `${site}/#/about`]));
write('robots.txt', robotsTxt(ctx, `${site}/sitemap.xml`));
for (const a of articles) write(`a/${a.slug}/index.html`, sharePage(a, ctx, `${site}/#/news-details/${a.slug}`));
// unknown paths on a static host fall back to the app
fs.copyFileSync(path.join(dist, 'index.html'), path.join(dist, '404.html'));
console.log(`Static files written: ${articles.length} share pages, ${sections.length * 2 + 2} feeds, sitemap, robots, 404.`);
