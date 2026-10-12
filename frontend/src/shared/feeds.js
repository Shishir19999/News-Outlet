// Syndication and search-engine output shared by the API server and the static build:
// RSS 2.0 and Atom feeds, sitemap.xml, robots.txt, NewsArticle JSON-LD and share pages
// (Open Graph / Twitter tags). Pure string builders, no dependencies.
import { excerpt, stripMarkdown } from './rules.js';

export const escapeXml = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')
  // eslint-disable-next-line no-control-regex
  .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');
const iso = (v) => new Date(v || Date.now()).toISOString();
const rfc822 = (v) => new Date(v || Date.now()).toUTCString();
const authorName = (a) => (a && a.author && a.author.name) || (a && a.authorName) || '';
const sectionOf = (a) => (a.category && a.category.name) || (a.categoryId && a.categoryId.name) || '';

// ctx: { siteUrl, siteName, tagline, articleUrl(slug), sectionUrl(slug), feedUrl(kind, slug?) }
export function rssFeed(articles, ctx, section) {
  const title = section ? `${ctx.siteName}: ${section.name}` : ctx.siteName;
  const link = section ? ctx.sectionUrl(section.slug) : ctx.siteUrl;
  const items = articles.map((a) => `    <item>
      <title>${escapeXml(a.title)}</title>
      <link>${escapeXml(ctx.articleUrl(a.slug))}</link>
      <guid isPermaLink="true">${escapeXml(ctx.articleUrl(a.slug))}</guid>
      <pubDate>${rfc822(a.publishedAt)}</pubDate>
      ${authorName(a) ? `<dc:creator>${escapeXml(authorName(a))}</dc:creator>` : ''}
      ${sectionOf(a) ? `<category>${escapeXml(sectionOf(a))}</category>` : ''}
      ${(a.tags || []).map((t) => `<category>${escapeXml(t)}</category>`).join('\n      ')}
      <description>${escapeXml(a.summary || excerpt(a.description, 200))}</description>
    </item>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>${escapeXml(title)}</title>
    <link>${escapeXml(link)}</link>
    <description>${escapeXml(ctx.tagline || title)}</description>
    <language>en</language>
    <lastBuildDate>${rfc822(articles[0] && articles[0].publishedAt)}</lastBuildDate>
    <atom:link href="${escapeXml(ctx.feedUrl('rss', section && section.slug))}" rel="self" type="application/rss+xml"/>
${items}
  </channel>
</rss>
`;
}

export function atomFeed(articles, ctx, section) {
  const title = section ? `${ctx.siteName}: ${section.name}` : ctx.siteName;
  const self = ctx.feedUrl('atom', section && section.slug);
  const entries = articles.map((a) => `  <entry>
    <title>${escapeXml(a.title)}</title>
    <link href="${escapeXml(ctx.articleUrl(a.slug))}"/>
    <id>${escapeXml(ctx.articleUrl(a.slug))}</id>
    <published>${iso(a.publishedAt)}</published>
    <updated>${iso(a.updatedAt || a.publishedAt)}</updated>
    ${authorName(a) ? `<author><name>${escapeXml(authorName(a))}</name></author>` : ''}
    ${sectionOf(a) ? `<category term="${escapeXml(sectionOf(a))}"/>` : ''}
    <summary>${escapeXml(a.summary || excerpt(a.description, 200))}</summary>
  </entry>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>${escapeXml(title)}</title>
  <subtitle>${escapeXml(ctx.tagline || '')}</subtitle>
  <link href="${escapeXml(self)}" rel="self"/>
  <link href="${escapeXml(section ? ctx.sectionUrl(section.slug) : ctx.siteUrl)}"/>
  <id>${escapeXml(self)}</id>
  <updated>${iso(articles[0] && (articles[0].updatedAt || articles[0].publishedAt))}</updated>
${entries}
</feed>
`;
}

export function sitemapXml(articles, sections, ctx, extraPaths = []) {
  const urls = [
    { loc: ctx.siteUrl, changefreq: 'hourly', priority: '1.0' },
    ...sections.map((s) => ({ loc: ctx.sectionUrl(s.slug), changefreq: 'daily', priority: '0.7' })),
    ...extraPaths.map((loc) => ({ loc, changefreq: 'monthly', priority: '0.3' })),
    ...articles.map((a) => ({ loc: ctx.articleUrl(a.slug), lastmod: iso(a.updatedAt || a.publishedAt), changefreq: 'weekly', priority: '0.8' })),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${escapeXml(u.loc)}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}<changefreq>${u.changefreq}</changefreq><priority>${u.priority}</priority></url>`).join('\n')}
</urlset>
`;
}

export function robotsTxt(ctx, sitemapUrl) {
  return `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /login\nSitemap: ${sitemapUrl || `${ctx.siteUrl}/sitemap.xml`}\n`;
}

// schema.org NewsArticle (opinion, analysis, fact-check and live pieces use their specific types).
export function articleJsonLd(a, ctx) {
  const type = a.kind === 'live' ? 'LiveBlogPosting' : a.kind === 'opinion' ? 'OpinionNewsArticle' : a.kind === 'analysis' ? 'AnalysisNewsArticle' : 'NewsArticle';
  const out = {
    '@context': 'https://schema.org',
    '@type': type,
    headline: String(a.title || '').slice(0, 110),
    description: a.summary,
    mainEntityOfPage: ctx.articleUrl(a.slug),
    datePublished: iso(a.publishedAt),
    dateModified: iso(a.updatedAt || a.publishedAt),
    articleSection: sectionOf(a) || undefined,
    keywords: (a.tags || []).join(', ') || undefined,
    wordCount: stripMarkdown(a.description).split(' ').filter(Boolean).length || undefined,
    inLanguage: 'en',
    author: authorName(a) ? { '@type': 'Person', name: authorName(a) } : { '@type': 'Organization', name: ctx.siteName },
    publisher: { '@type': 'Organization', name: ctx.siteName },
    isAccessibleForFree: true,
  };
  if (ctx.imageUrl) out.image = [ctx.imageUrl];
  if (a.kind === 'sponsored') out.sponsor = { '@type': 'Organization', name: a.sponsor || 'Sponsor' };
  if (a.kind === 'fact-check' && a.factCheck) {
    out.about = { '@type': 'Claim', text: a.factCheck.claim };
    out.backstory = `Rating: ${a.factCheck.rating}`;
  }
  return out;
}

// Static page for crawlers and social cards: real meta tags and structured data, then it sends
// people on to the app.
export function sharePage(a, ctx, appUrl) {
  const title = `${a.title} | ${ctx.siteName}`;
  const desc = a.summary || excerpt(a.description, 160);
  const url = ctx.articleUrl(a.slug);
  const ld = JSON.stringify(articleJsonLd(a, ctx)).replace(/</g, '\\u003c');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeXml(title)}</title>
<meta name="description" content="${escapeXml(desc)}">
<link rel="canonical" href="${escapeXml(url)}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="${escapeXml(ctx.siteName)}">
<meta property="og:title" content="${escapeXml(a.title)}">
<meta property="og:description" content="${escapeXml(desc)}">
<meta property="og:url" content="${escapeXml(url)}">
<meta property="article:published_time" content="${iso(a.publishedAt)}">
${sectionOf(a) ? `<meta property="article:section" content="${escapeXml(sectionOf(a))}">` : ''}
${ctx.imageUrl ? `<meta property="og:image" content="${escapeXml(ctx.imageUrl)}">` : ''}
<meta name="twitter:card" content="${ctx.imageUrl ? 'summary_large_image' : 'summary'}">
<meta name="twitter:title" content="${escapeXml(a.title)}">
<meta name="twitter:description" content="${escapeXml(desc)}">
<link rel="alternate" type="application/rss+xml" href="${escapeXml(ctx.feedUrl('rss'))}">
<script type="application/ld+json">${ld}</script>
<meta http-equiv="refresh" content="0;url=${escapeXml(appUrl)}">
</head>
<body>
<h1>${escapeXml(a.title)}</h1>
<p>${escapeXml(desc)}</p>
<p><a href="${escapeXml(appUrl)}">Read the full story</a></p>
</body>
</html>
`;
}
