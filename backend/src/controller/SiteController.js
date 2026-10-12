import News, { liveFilter } from '../models/News.js';
import Comment from '../models/Comment.js';
import User from '../models/User.js';
import Category from '../models/Category.js';
import Subscriber from '../models/Subscriber.js';
import ViewStat from '../models/ViewStat.js';
import { Settings, AuditLog, DayStat, Reaction } from '../models/Extra.js';
import { validateSettings, rankSearch, suggest, SOURCES, DEPTHS, roleAtLeast, abLeader } from '../shared/rules.js';
import { rssFeed, atomFeed, sitemapXml, robotsTxt, sharePage } from '../shared/feeds.js';
import { str, isId, dayKey, getSettings, publicSettings, audit, siteContext, pageParams, pageInfo, AUTHOR_FIELDS } from '../lib/helpers.js';
import { emitSite } from '../realtime.js';

const withSection = async (docs) => {
    const cats = await Category.find();
    const m = new Map(cats.map((c) => [String(c._id), c.toJSON()]));
    return docs.map((d) => ({ ...d.toObject(), category: m.get(String(d.categoryId)), author: d.author && d.author.name ? { name: d.author.name } : undefined }));
};
const liveDocs = (extra = {}, limit = 40) => News.find({ $and: [liveFilter(), extra] }).sort({ publishedAt: -1 }).limit(limit).populate('author', AUTHOR_FIELDS);
const xml = (res, type, body) => res.set('Content-Type', `${type}; charset=utf-8`).send(body);

class SiteController {
    async settings(req, res) {
        try {
            res.status(200).json(publicSettings(await getSettings()));
        } catch (e) {
            res.status(500).json({ message: e.message });
        }
    }

    async updateSettings(req, res) {
        try {
            const alertOnly = !roleAtLeast(req.user.role, 'admin');
            const { errors, values } = validateSettings(req.body, { alertOnly });
            if (Object.keys(errors).length) return res.status(422).json({ success: false, message: Object.values(errors)[0], errors });
            await getSettings();
            const set = {};
            for (const [k, v] of Object.entries(values)) {
                if (k === 'alert') for (const [ak, av] of Object.entries(v)) set[`alert.${ak}`] = av;
                else set[k] = v;
            }
            const s = await Settings.findOneAndUpdate({ key: 'site' }, { $set: set }, { returnDocument: 'after' });
            await audit(req.user, values.alert && Object.keys(values).length === 1 ? 'alert.update' : 'settings.update', { targetType: 'settings', targetLabel: 'site' });
            if (values.alert) emitSite('alert', publicSettings(s).alert);
            res.status(200).json(publicSettings(s));
        } catch (e) {
            res.status(500).json({ message: e.message });
        }
    }

    async audit(req, res) {
        try {
            const { page, limit, skip } = pageParams(req.query, 30, 100);
            const filter = typeof req.query.action === 'string' && req.query.action ? { action: req.query.action } : {};
            const [rows, total] = await Promise.all([AuditLog.find(filter).sort({ at: -1 }).skip(skip).limit(limit), AuditLog.countDocuments(filter)]);
            res.status(200).json({ entries: rows, ...pageInfo(page, limit, total) });
        } catch (e) {
            res.status(500).json({ message: e.message });
        }
    }

    // Search suggestions as you type.
    async suggest(req, res) {
        try {
            const q = str(req.query.q);
            if (q.length < 2) return res.status(200).json({ suggestions: [] });
            const [pool, cats] = await Promise.all([
                News.aggregate([{ $match: liveFilter() }, { $sort: { publishedAt: -1 } }, { $limit: 600 }, { $project: { title: 1, slug: 1, tags: 1, summary: 1, publishedAt: 1 } }]),
                Category.find(),
            ]);
            res.status(200).json({ suggestions: suggest(q, pool, cats.map((c) => c.toJSON())) });
        } catch (e) {
            res.status(500).json({ message: e.message });
        }
    }

    // Editors and admins: the analytics dashboard.
    async stats(req, res) {
        try {
            const days = Math.min(Math.max(parseInt(req.query.days, 10) || 14, 1), 90);
            const since = dayKey(new Date(Date.now() - (days - 1) * 86400000));
            const [categories, byCat, perDay, statuses, users, pendingComments, reported, subs, top, dayStats, allSubs] = await Promise.all([
                Category.find().sort({ order: 1, name: 1 }),
                News.aggregate([{ $group: { _id: '$categoryId', views: { $sum: '$views' }, articles: { $sum: 1 } } }]),
                ViewStat.aggregate([{ $group: { _id: '$date', views: { $sum: '$count' } } }]),
                News.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]),
                User.countDocuments(),
                Comment.countDocuments({ status: 'pending' }),
                Comment.countDocuments({ 'reports.0': { $exists: true } }),
                Subscriber.aggregate([{ $group: { _id: '$confirmed', n: { $sum: 1 } } }]),
                News.find(liveFilter()).sort({ views: -1, publishedAt: -1 }).limit(5),
                DayStat.find({ date: { $gte: since } }),
                Subscriber.find().select('confirmed confirmedAt createdAt'),
            ]);
            const catMap = new Map(byCat.map((c) => [String(c._id), c]));
            const dayMap = new Map(perDay.map((d) => [d._id, d.views]));
            const viewsByDay = [];
            const growth = [];
            let base = allSubs.filter((s) => s.confirmed && dayKey(s.confirmedAt || s.createdAt) < since).length;
            for (let i = days - 1; i >= 0; i--) {
                const date = dayKey(new Date(Date.now() - i * 86400000));
                viewsByDay.push({ date, views: dayMap.get(date) || 0 });
                base += allSubs.filter((s) => s.confirmed && dayKey(s.confirmedAt || s.createdAt) === date).length;
                growth.push({ date, subscribers: base, added: allSubs.filter((s) => s.confirmed && dayKey(s.confirmedAt || s.createdAt) === date).length });
            }
            const st = Object.fromEntries(statuses.map((s) => [s._id || 'published', s.n]));
            const sources = Object.fromEntries(SOURCES.map((s) => [s, 0]));
            const depth = Object.fromEntries(DEPTHS.map((d) => [d, 0]));
            for (const d of dayStats) {
                for (const [k, v] of d.sources) if (k in sources) sources[k] += v;
                for (const [k, v] of d.depth) if (k in depth) depth[k] += v;
            }
            const sub = Object.fromEntries(subs.map((s) => [s._id ? 'confirmed' : 'pending', s.n]));
            res.status(200).json({
                totals: {
                    articles: statuses.reduce((s, x) => s + x.n, 0), published: st.published || 0, drafts: st.draft || 0, scheduled: st.scheduled || 0,
                    inReview: (st.submitted || 0) + (st.in_review || 0) + (st.changes_requested || 0) + (st.approved || 0), archived: st.archived || 0,
                    views: byCat.reduce((s, c) => s + c.views, 0), users, pendingComments, reportedComments: reported,
                    subscribers: sub.confirmed || 0, pendingSubscribers: sub.pending || 0,
                },
                viewsByCategory: categories.map((c) => ({ categoryId: c._id, name: c.name, views: (catMap.get(String(c._id)) || {}).views || 0, articles: (catMap.get(String(c._id)) || {}).articles || 0 })),
                viewsByDay, sources, depth, newsletterGrowth: growth,
                topArticles: top.map((t) => ({ _id: t._id, title: t.title, slug: t.slug, views: t.views })),
            });
        } catch (e) {
            res.status(500).json({ message: e.message });
        }
    }

    // Authors: numbers for their own articles.
    async statsMe(req, res) {
        try {
            const mine = await News.find({ author: req.user._id }).select('title slug status views depth publishedAt');
            const ids = mine.map((m) => m._id);
            const byStatus = {};
            for (const m of mine) byStatus[m.status] = (byStatus[m.status] || 0) + 1;
            const d = { 25: 0, 50: 0, 75: 0, 100: 0 };
            for (const m of mine) for (const k of DEPTHS) d[k] += (m.depth && m.depth[k]) || 0;
            const [followers, comments, reactions] = await Promise.all([
                User.countDocuments({ 'follows.authors': req.user._id }),
                Comment.countDocuments({ newsId: { $in: ids }, status: 'approved' }),
                Reaction.countDocuments({ newsId: { $in: ids } }),
            ]);
            const live = mine.filter((m) => m.status === 'published' || m.status === 'archived');
            res.status(200).json({
                totals: { articles: mine.length, published: byStatus.published || 0, drafts: byStatus.draft || 0, inReview: (byStatus.submitted || 0) + (byStatus.in_review || 0), changesRequested: byStatus.changes_requested || 0, views: mine.reduce((s, m) => s + m.views, 0), followers, comments, reactions },
                depth: d,
                top: [...live].sort((a, b) => b.views - a.views).slice(0, 5).map((m) => ({ _id: m._id, title: m.title, slug: m.slug, views: m.views })),
            });
        } catch (e) {
            res.status(500).json({ message: e.message });
        }
    }

    // ---- feeds, sitemap, share pages -----------------------------------------------------------
    async feed(req, res, kind) {
        try {
            const settings = await getSettings();
            const ctx = siteContext(settings);
            const slug = req.params.slug;
            let section = null;
            let extra = {};
            if (slug) {
                const cats = await Category.find();
                const c = cats.map((x) => x.toJSON()).find((x) => x.slug === slug);
                if (!c) return res.status(404).send('Unknown section');
                section = c;
                extra = { categoryId: c._id };
            }
            const items = await withSection(await liveDocs(extra));
            xml(res, kind === 'atom' ? 'application/atom+xml' : 'application/rss+xml', (kind === 'atom' ? atomFeed : rssFeed)(items, ctx, section));
        } catch (e) {
            res.status(500).send(e.message);
        }
    }

    async sitemap(req, res) {
        try {
            const ctx = siteContext(await getSettings());
            const [items, cats] = await Promise.all([liveDocs({}, 1000), Category.find().sort({ order: 1 })]);
            xml(res, 'application/xml', sitemapXml(items, cats.map((c) => c.toJSON()), ctx, [`${ctx.siteUrl}/archive`, `${ctx.siteUrl}/about`]));
        } catch (e) {
            res.status(500).send(e.message);
        }
    }

    robots(req, res) {
        const ctx = siteContext(null);
        xml(res, 'text/plain', robotsTxt(ctx, `${(process.env.PUBLIC_URL || '').replace(/\/$/, '')}/sitemap.xml`));
    }

    // Crawler-friendly page with Open Graph / Twitter tags and NewsArticle JSON-LD.
    async share(req, res) {
        try {
            const doc = await News.findOne({ slug: req.params.slug, ...liveFilter() }).populate('author', AUTHOR_FIELDS);
            if (!doc) return res.status(404).send('Not found');
            const ctx = siteContext(await getSettings());
            const [item] = await withSection([doc]);
            const img = doc.image && /^https?:/.test(doc.toJSON().image) && !/notfound/.test(doc.toJSON().image) ? doc.toJSON().image : '';
            res.set('Content-Type', 'text/html; charset=utf-8').send(sharePage(item, { ...ctx, imageUrl: img }, ctx.articleUrl(doc.slug)));
        } catch (e) {
            res.status(500).send(e.message);
        }
    }
}

export default SiteController;
export { isId, rankSearch, abLeader };
