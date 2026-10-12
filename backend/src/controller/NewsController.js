import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import News, { liveFilter, archiveFilter } from '../models/News.js';
import Comment from '../models/Comment.js';
import Bookmark from '../models/Bookmark.js';
import ViewStat from '../models/ViewStat.js';
import Category from '../models/Category.js';
import { Revision, LiveUpdate, Reaction, PollVote, ArticleView, DayStat } from '../models/Extra.js';
import {
    validateArticle, slugify, deriveTags, can, roleAtLeast, checkTransition, canEditArticle, canViewArticle, isOwner,
    rankSearch, vocabulary, didYouMean, trendingScore, forYouScore, STATUSES, SOURCES, DEPTHS, KINDS,
} from '../shared/rules.js';
import { str, isId, dayKey, pageParams, pageInfo, AUTHOR_FIELDS, audit, recordRevision, shapeArticle, engagementOf, voterOf } from '../lib/helpers.js';
import { emitSite } from '../realtime.js';

const NEWS_DIR = path.resolve('public', 'news');
function removeImage(filename) {
    if (!filename || /^(https?:|data:)/.test(filename)) return;
    fs.unlink(path.join(NEWS_DIR, path.basename(filename)), (err) => {
        if (err && err.code !== 'ENOENT') console.log('Failed to remove image:', err.message);
    });
}

const SORTS = {
    latest: { publishedAt: -1, createdAt: -1, _id: -1 },
    oldest: { publishedAt: 1, createdAt: 1, _id: 1 },
    popular: { views: -1, publishedAt: -1, _id: -1 },
};
const populateAuthor = (q) => q.populate('author', AUTHOR_FIELDS).populate('assignedEditor', 'name');
const sendList = (res, news, page, limit, total, actor, extra = {}) =>
    res.status(200).json({ news: news.map((n) => shapeArticle(n, actor)), ...pageInfo(page, limit, total), ...extra });

// Mongo conditions for the public list from the query string.
function publicFilter(q) {
    const and = [q.archived === '1' ? archiveFilter() : liveFilter()];
    if (isId(q.categoryId)) and.push({ categoryId: q.categoryId });
    if (isId(q.authorId)) and.push({ author: q.authorId });
    if (typeof q.tag === 'string' && q.tag) and.push({ tags: slugify(q.tag) });
    if (KINDS.includes(q.kind)) and.push({ kind: q.kind });
    if (q.featured === '1' || q.featured === 'true') and.push({ featured: true });
    if (typeof q.ids === 'string' && q.ids) and.push({ _id: { $in: q.ids.split(',').filter(isId).slice(0, 100) } });
    const period = parseInt(q.period, 10);
    if (period > 0) and.push({ publishedAt: { $gte: new Date(Date.now() - period * 86400000) } });
    const range = {};
    if (q.from && !Number.isNaN(Date.parse(q.from))) range.$gte = new Date(q.from);
    if (q.to && !Number.isNaN(Date.parse(q.to))) range.$lte = new Date(new Date(q.to).getTime() + 86400000 - 1);
    if (Object.keys(range).length) and.push({ publishedAt: range });
    return { $and: and };
}

async function categoryExists(id) {
    return isId(id) && (await Category.exists({ _id: id }));
}
const withOptionIds = (poll) => (poll ? { ...poll, options: poll.options.map((o, i) => ({ id: o.id || `o${i + 1}`, label: o.label })) } : poll);

// Editors (not authors) may set these; returns a message when the actor may not.
function restricted(values, role) {
    if (values.featured !== undefined && !can(role, 'breaking')) return 'Only editors can feature an article';
    if (values.breaking !== undefined && !can(role, 'breaking')) return 'Only editors can mark an article as breaking news';
    if (values.headlineB !== undefined && values.headlineB && !can(role, 'ab')) return 'Only editors can set an alternative headline';
    if (values.poll && !can(role, 'polls')) return 'Only editors can add a poll';
    return '';
}

class NewsController {
    // Public listing: live articles. Filters: search (typo tolerant), categoryId, tag, kind, authorId, featured,
    // ids, period, from/to, archived=1, sort (latest, oldest, popular).
    async index(req, res) {
        try {
            const { page, limit, skip } = pageParams(req.query, 9);
            const filter = publicFilter(req.query);
            const search = str(req.query.search);
            if (search) {
                const pool = await News.aggregate([
                    { $match: filter },
                    { $project: { title: 1, summary: 1, tags: 1, publishedAt: 1, description: { $substrCP: [{ $ifNull: ['$description', ''] }, 0, 1500] } } },
                ]);
                const ranked = rankSearch(search, pool);
                const total = ranked.length;
                const ids = ranked.slice(skip, skip + limit).map((r) => r.article._id);
                const docs = await populateAuthor(News.find({ _id: { $in: ids } }));
                const byId = new Map(docs.map((d) => [String(d._id), d]));
                const news = ids.map((i) => byId.get(String(i))).filter(Boolean);
                let suggestion = '';
                if (total < 3) suggestion = didYouMean(search, vocabulary(pool));
                return sendList(res, news, page, limit, total, req.user, { suggestion, fuzzy: ranked.some((r) => r.fuzzy) });
            }
            const sort = SORTS[req.query.sort] || SORTS.latest;
            const [news, total] = await Promise.all([
                populateAuthor(News.find(filter).sort(sort).skip(skip).limit(limit)),
                News.countDocuments(filter),
            ]);
            sendList(res, news, page, limit, total, req.user);
        } catch (e) {
            res.status(500).json({ message: e.message });
        }
    }

    // Most read right now: views per day decayed by age.
    async trending(req, res) {
        try {
            const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 5, 1), 20);
            const now = Date.now();
            const filter = { $and: [liveFilter(), ...(isId(req.query.categoryId) ? [{ categoryId: req.query.categoryId }] : [])] };
            const docs = await populateAuthor(News.find(filter).sort({ publishedAt: -1 }).limit(150));
            const since = dayKey(new Date(now - 14 * 86400000));
            const rows = await ArticleView.find({ date: { $gte: since }, newsId: { $in: docs.map((d) => d._id) } });
            const daily = new Map();
            for (const r of rows) {
                const k = String(r.newsId);
                if (!daily.has(k)) daily.set(k, {});
                daily.get(k)[r.date] = r.count;
            }
            const scored = docs.map((d) => ({ d, s: trendingScore({ daily: daily.get(String(d._id)), views: d.views, publishedAt: d.publishedAt }, now) }));
            scored.sort((a, b) => b.s - a.s);
            res.status(200).json({ news: scored.slice(0, limit).map((x) => shapeArticle(x.d, req.user)) });
        } catch (e) {
            res.status(500).json({ message: e.message });
        }
    }

    // Personalised feed from the topics, authors and tags the reader follows.
    async forYou(req, res) {
        try {
            const split = (v) => (typeof v === 'string' && v ? v.split(',').slice(0, 50) : []);
            const prefs = { topics: split(req.query.topics), authors: split(req.query.authors), tags: split(req.query.tags) };
            const exclude = new Set(split(req.query.exclude));
            const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 12, 1), 30);
            const docs = await populateAuthor(News.find(liveFilter()).sort({ publishedAt: -1 }).limit(120));
            const now = Date.now();
            const ranked = docs.filter((d) => !exclude.has(String(d._id)))
                .map((d) => ({ d, ...forYouScore({ ...d.toObject(), author: d.author && d.author._id }, prefs, now) }))
                .sort((a, b) => b.score - a.score).slice(0, limit);
            res.status(200).json({ news: ranked.map((r) => ({ ...shapeArticle(r.d, req.user), reasons: r.reasons })), personalised: prefs.topics.length + prefs.authors.length > 0 });
        } catch (e) {
            res.status(500).json({ message: e.message });
        }
    }

    // Breaking-news ticker: live articles flagged as breaking in the last 48 hours.
    async breaking(req, res) {
        try {
            const filter = { $and: [liveFilter(), { breaking: true }, { publishedAt: { $gte: new Date(Date.now() - 48 * 3600000) } }] };
            const news = await News.find(filter).sort({ publishedAt: -1 }).limit(5);
            res.status(200).json({ news: news.map((n) => ({ _id: n._id, title: n.title, slug: n.slug, kind: n.kind, publishedAt: n.publishedAt })) });
        } catch (e) {
            res.status(500).json({ message: e.message });
        }
    }

    // Months that have articles (live and archived) for the archive page.
    async archive(req, res) {
        try {
            const rows = await News.aggregate([
                { $match: archiveFilter() },
                { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$publishedAt' } }, count: { $sum: 1 } } },
                { $sort: { _id: -1 } },
            ]);
            res.status(200).json({ months: rows.filter((r) => r._id).map((r) => ({ key: r._id, count: r.count })) });
        } catch (e) {
            res.status(500).json({ message: e.message });
        }
    }

    // Management listing: editors and admins see everything, authors only their own articles.
    async manage(req, res) {
        try {
            const { page, limit, skip } = pageParams(req.query, 10);
            const editorial = roleAtLeast(req.user.role, 'editor');
            const base = editorial ? {} : { author: req.user._id };
            const filter = { ...base };
            const search = str(req.query.search);
            if (search) {
                const re = { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
                filter.$or = [{ title: re }, { summary: re }];
            }
            if (STATUSES.includes(req.query.status)) filter.status = req.query.status;
            if (req.query.status === 'review') filter.status = { $in: ['submitted', 'in_review', 'changes_requested', 'approved'] };
            if (req.query.assignee === 'me') filter.assignedEditor = req.user._id;
            if (req.query.assignee === 'none') filter.assignedEditor = null;
            const [news, total, counts] = await Promise.all([
                populateAuthor(News.find(filter).sort({ updatedAt: -1, _id: -1 }).skip(skip).limit(limit)),
                News.countDocuments(filter),
                News.aggregate([{ $match: base }, { $group: { _id: '$status', n: { $sum: 1 } } }]),
            ]);
            sendList(res, news, page, limit, total, req.user, { counts: Object.fromEntries(counts.map((c) => [c._id || 'published', c.n])) });
        } catch (e) {
            res.status(500).json({ message: e.message });
        }
    }

    // Counts one view of a live article (day, category, article, traffic source) and a headline click.
    async view(req, res) {
        try {
            if (!isId(req.params.id)) return res.status(404).json({ message: 'News not found' });
            const news = await News.findOneAndUpdate({ _id: req.params.id, ...archiveFilter() }, { $inc: { views: 1 } }, { returnDocument: 'after' });
            if (!news) return res.status(404).json({ message: 'News not found' });
            const date = dayKey();
            const source = SOURCES.includes(req.body.source) ? req.body.source : 'direct';
            await Promise.all([
                ViewStat.updateOne({ date, categoryId: news.categoryId }, { $inc: { count: 1 } }, { upsert: true }),
                ArticleView.updateOne({ date, newsId: news._id }, { $inc: { count: 1 } }, { upsert: true }),
                DayStat.updateOne({ date }, { $inc: { views: 1, [`sources.${source}`]: 1 } }, { upsert: true }),
            ]);
            const v = req.body.variant;
            if ((v === 'a' || v === 'b') && news.headlineB && !news.abTest.winner) {
                await News.updateOne({ _id: news._id }, { $inc: { [`abTest.${v}.clicks`]: 1 } });
            }
            res.status(200).json({ success: true, views: news.views });
        } catch (e) {
            res.status(500).json({ message: e.message });
        }
    }

    // Reading depth reached (25, 50, 75 or 100 percent).
    async depth(req, res) {
        try {
            const d = Number(req.body.depth);
            if (!isId(req.params.id) || !DEPTHS.includes(d)) return res.status(422).json({ success: false, message: 'depth must be 25, 50, 75 or 100' });
            const done = await News.updateOne({ _id: req.params.id, ...archiveFilter() }, { $inc: { [`depth.${d}`]: 1 } });
            if (!done.matchedCount) return res.status(404).json({ message: 'News not found' });
            await DayStat.updateOne({ date: dayKey() }, { $inc: { [`depth.${d}`]: 1 } }, { upsert: true });
            res.status(200).json({ success: true });
        } catch (e) {
            res.status(500).json({ message: e.message });
        }
    }

    // Headline test impressions in a batch: { items: [{ id, variant }] }.
    async impressions(req, res) {
        try {
            const items = Array.isArray(req.body.items) ? req.body.items.slice(0, 40) : [];
            await Promise.all(items.filter((i) => i && isId(i.id) && (i.variant === 'a' || i.variant === 'b')).map((i) =>
                News.updateOne({ _id: i.id, headlineB: { $ne: '' }, 'abTest.winner': '' }, { $inc: { [`abTest.${i.variant}.impressions`]: 1 } })));
            res.status(200).json({ success: true });
        } catch (e) {
            res.status(500).json({ message: e.message });
        }
    }

    async show(req, res) {
        try {
            if (!isId(req.params.id)) return res.status(404).json({ message: 'News not found' });
            const news = await populateAuthor(News.findById(req.params.id));
            if (!news || !canViewArticle(news.toObject(), req.user)) return res.status(404).json({ message: 'News not found' });
            res.status(200).json(shapeArticle(news, req.user));
        } catch (e) {
            res.status(500).json({ message: e.message });
        }
    }

    async getNews(req, res) {
        try {
            const news = await populateAuthor(News.findOne({ slug: req.params.slug }));
            if (!news || !canViewArticle(news.toObject(), req.user)) return res.status(404).json({ message: 'News not found' });
            const [related, engagement] = await Promise.all([
                populateAuthor(News.find({ categoryId: news.categoryId, _id: { $ne: news._id }, ...liveFilter() }).sort(SORTS.popular).limit(4)),
                engagementOf(news._id, voterOf(req), news.poll),
            ]);
            res.status(200).json({ findNews: shapeArticle(news, req.user), relatedNews: related.map((r) => shapeArticle(r, req.user)), engagement });
        } catch (e) {
            res.status(500).json({ message: e.message });
        }
    }

    async store(req, res) {
        const image = req.file ? req.file.filename : '';
        const fail = (status, body) => { removeImage(image); return res.status(status).json(body); };
        try {
            const { errors, values } = validateArticle(req.body, { partial: false });
            if (values.categoryId && !(await categoryExists(values.categoryId))) errors.categoryId = 'Category does not exist';
            const slug = slugify(str(req.body.slug) || values.title);
            if (!slug) errors.slug = 'Slug is required';
            if (Object.keys(errors).length) return fail(422, { success: false, message: 'Validation failed', errors });
            const denied = restricted(values, req.user.role);
            if (denied) return fail(403, { success: false, message: denied });
            if (await News.exists({ slug })) return fail(409, { success: false, message: 'Slug already exists', errors: { slug: 'Slug already exists' } });
            const data = {
                ...values, slug, image, author: req.user._id, status: 'draft', publishedAt: null,
                tags: values.tags && values.tags.length ? values.tags : deriveTags(values.title),
                poll: withOptionIds(values.poll) || undefined,
            };
            const wanted = str(req.body.status);
            if (wanted && wanted !== 'draft') {
                const moved = checkTransition({ status: 'draft', author: req.user._id }, wanted, req.user, { note: req.body.note, publishedAt: req.body.publishedAt });
                if (!moved.ok) return fail(moved.status, { success: false, message: moved.message, errors: moved.errors });
                Object.assign(data, moved.patch);
                if (wanted === 'submitted') data.submittedAt = new Date();
            }
            const created = await News.create(data);
            await recordRevision(created, req.user, 'First version');
            await audit(req.user, 'article.create', { targetType: 'article', targetId: created._id, targetLabel: created.title });
            res.status(201).json({ success: true, message: 'News created successfully', id: created._id, slug, status: created.status });
        } catch (error) {
            removeImage(image);
            if (error.code === 11000) return res.status(409).json({ success: false, message: 'Slug already exists', errors: { slug: 'Slug already exists' } });
            res.status(500).json({ message: error.message });
        }
    }

    // Authors edit their own drafts and returned articles; editors and admins edit any article.
    // An existing slug is kept unless the request supplies one. Every content change is saved as a revision.
    async update(req, res) {
        const newImage = req.file ? req.file.filename : undefined;
        const fail = (status, body) => { removeImage(newImage); return res.status(status).json(body); };
        try {
            const id = req.params.id;
            const news = isId(id) ? await News.findById(id) : null;
            if (!news) return fail(404, { success: false, message: 'News not found' });
            if (!canViewArticle(news.toObject(), req.user)) return fail(404, { success: false, message: 'News not found' });
            if (!canEditArticle(news.toObject(), req.user)) return fail(403, { success: false, message: 'This article can no longer be edited by you. Withdraw it first, or ask an editor.' });
            const { errors, values } = validateArticle(req.body, { partial: true });
            if (values.categoryId && !(await categoryExists(values.categoryId))) errors.categoryId = 'Category does not exist';
            if (values.kind === 'sponsored' || (values.kind === undefined && news.kind === 'sponsored')) {
                if (!(values.sponsor ?? news.sponsor)) errors.sponsor = 'Name the sponsor of a sponsored article';
            }
            let slug;
            if (req.body.slug !== undefined) {
                slug = slugify(str(req.body.slug) || values.title || news.title);
                if (!slug) errors.slug = 'Slug is required';
            }
            if (Object.keys(errors).length) return fail(422, { success: false, message: 'Validation failed', errors });
            const denied = restricted(values, req.user.role);
            if (denied) return fail(403, { success: false, message: denied });
            if (slug && slug !== news.slug) {
                if (await News.exists({ slug, _id: { $ne: id } })) return fail(409, { success: false, message: 'Slug already exists', errors: { slug: 'Slug already exists' } });
                values.slug = slug;
            }
            if (values.poll) values.poll = withOptionIds(values.poll);
            if (values.poll === null) values.$unset = { poll: 1 };
            if (values.factCheck === null) { values.$unset = { ...(values.$unset || {}), factCheck: 1 }; delete values.factCheck; }
            if (values.embed === null) { values.$unset = { ...(values.$unset || {}), embed: 1 }; delete values.embed; }
            if (values.poll === null) delete values.poll;
            if (values.headlineB !== undefined && values.headlineB !== news.headlineB) values.abTest = { a: { impressions: 0, clicks: 0 }, b: { impressions: 0, clicks: 0 }, winner: '' };
            const oldImage = news.image;
            if (newImage) values.image = newImage;
            values.updatedAt = new Date();
            const { $unset, ...set } = values;
            await News.updateOne({ _id: id }, { $set: set, ...($unset ? { $unset } : {}) });
            if (newImage && oldImage) removeImage(oldImage);
            const fresh = await News.findById(id);
            await recordRevision(fresh, req.user, str(req.body.revisionNote));
            await audit(req.user, 'article.update', { targetType: 'article', targetId: id, targetLabel: fresh.title });
            if (fresh.breaking && !news.breaking && fresh.status === 'published') emitSite('breaking', { _id: fresh._id, title: fresh.title, slug: fresh.slug });
            res.status(200).json({ success: true, message: 'News updated successfully' });
        } catch (error) {
            removeImage(newImage);
            if (error.code === 11000) return res.status(409).json({ success: false, message: 'Slug already exists', errors: { slug: 'Slug already exists' } });
            res.status(500).json({ message: error.message });
        }
    }

    async destroy(req, res) {
        try {
            const id = req.params.id;
            if (!isId(id)) return res.status(404).json({ success: false, message: 'News not found' });
            const news = await News.findByIdAndDelete(id);
            if (!news) return res.status(404).json({ success: false, message: 'News not found' });
            removeImage(news.image);
            await Promise.all([
                Comment.deleteMany({ newsId: id }), Bookmark.deleteMany({ newsId: id }), Revision.deleteMany({ newsId: id }),
                LiveUpdate.deleteMany({ newsId: id }), Reaction.deleteMany({ newsId: id }), PollVote.deleteMany({ newsId: id }), ArticleView.deleteMany({ newsId: id }),
            ]);
            await audit(req.user, 'article.delete', { targetType: 'article', targetId: id, targetLabel: news.title });
            res.status(200).json({ success: true, message: 'News deleted successfully' });
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }

    // Image upload for galleries and the editor: returns a URL to store in the article.
    async upload(req, res) {
        if (!req.file) return res.status(422).json({ success: false, message: 'Choose a picture (PNG, JPG, GIF, WebP or SVG up to 8 MB)' });
        res.status(201).json({ success: true, url: `${process.env.PUBLIC_URL}/news/${req.file.filename}` });
    }
}

export default NewsController;
export { isOwner };
