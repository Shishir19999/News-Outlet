import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import slugify from 'slugify';
import News, { liveFilter, NEWS_STATUSES } from '../models/News.js';
import Comment from '../models/Comment.js';
import Bookmark from '../models/Bookmark.js';
import ViewStat from '../models/ViewStat.js';
import Subscriber from '../models/Subscriber.js';
import User from '../models/User.js';
import Category from '../models/Category.js';

const NEWS_DIR = path.resolve('public', 'news');

function removeImage(filename) {
    if (!filename) return;
    const target = path.join(NEWS_DIR, path.basename(filename));
    fs.unlink(target, (err) => {
        if (err && err.code !== 'ENOENT') console.log('Failed to remove image:', err.message);
    });
}

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const makeSlug = (s) => slugify(String(s || ''), { lower: true, strict: true });
const str = (v) => (typeof v === 'string' ? v.trim() : '');

// Returns { errors, values }. For updates (partial = true) only supplied fields are validated.
async function validate(body, partial) {
    const errors = {};
    const values = {};

    if (!partial || body.categoryId !== undefined) {
        const categoryId = str(body.categoryId);
        if (!categoryId || !mongoose.Types.ObjectId.isValid(categoryId)) {
            errors.categoryId = 'A valid category is required';
        } else if (!(await Category.exists({ _id: categoryId }))) {
            errors.categoryId = 'Category does not exist';
        } else {
            values.categoryId = categoryId;
        }
    }
    if (!partial || body.title !== undefined) {
        const title = str(body.title);
        if (!title) errors.title = 'Title is required';
        else if (title.length > 200) errors.title = 'Title must be at most 200 characters';
        else values.title = title;
    }
    if (!partial || body.summary !== undefined) {
        const summary = str(body.summary);
        if (!summary) errors.summary = 'Summary is required';
        else if (summary.length > 1000) errors.summary = 'Summary must be at most 1000 characters';
        else values.summary = summary;
    }
    if (body.description !== undefined) {
        if (typeof body.description !== 'string') errors.description = 'Description must be text';
        else values.description = body.description;
    }
    if (body.status !== undefined) {
        const status = str(body.status);
        if (!NEWS_STATUSES.includes(status)) errors.status = 'Status must be draft, published or scheduled';
        else values.status = status;
    }
    if (body.publishedAt !== undefined && str(body.publishedAt) !== '') {
        const d = new Date(str(body.publishedAt));
        if (Number.isNaN(d.getTime())) errors.publishedAt = 'Publish date is not valid';
        else values.publishedAt = d;
    }
    if (body.featured !== undefined) {
        values.featured = body.featured === true || ['true', '1', 'on'].includes(str(String(body.featured)).toLowerCase());
    }
    if (values.status === 'scheduled' && !errors.publishedAt && !values.publishedAt && !partial) {
        errors.publishedAt = 'A publish date is required to schedule an article';
    }
    return { errors, values };
}

const isAdmin = (req) => !!(req.user && req.user.role === 'admin');
const dayKey = (d = new Date()) => d.toISOString().slice(0, 10);
const SORTS = {
    latest: { publishedAt: -1, createdAt: -1, _id: -1 },
    oldest: { publishedAt: 1, createdAt: 1, _id: 1 },
    popular: { views: -1, publishedAt: -1, _id: -1 },
};

// Drafts and future-dated articles are only visible to admins and their author.
async function canSee(news, req) {
    const live = news.status === 'draft' ? false : (news.status !== 'scheduled' || news.publishedAt <= new Date());
    if (live) return true;
    if (!req.user) return false;
    return isAdmin(req) || String(news.author) === String(req.user._id);
}

class NewsController {
    // Public listing: only live articles. Filters: search, categoryId, featured, ids, period (days), sort.
    async index(req, res) {
        try {
            const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
            const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 9, 1), 50);
            const and = [liveFilter()];
            const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
            if (search) {
                const re = { $regex: escapeRegex(search), $options: 'i' };
                and.push({ $or: [{ title: re }, { summary: re }] });
            }
            if (req.query.categoryId && mongoose.Types.ObjectId.isValid(req.query.categoryId)) {
                and.push({ categoryId: req.query.categoryId });
            }
            if (req.query.featured === '1' || req.query.featured === 'true') and.push({ featured: true });
            if (typeof req.query.ids === 'string' && req.query.ids) {
                const ids = req.query.ids.split(',').filter((i) => mongoose.Types.ObjectId.isValid(i)).slice(0, 100);
                and.push({ _id: { $in: ids } });
            }
            const period = parseInt(req.query.period, 10);
            if (period > 0) and.push({ publishedAt: { $gte: new Date(Date.now() - period * 86400000) } });
            const filter = { $and: and };
            const sort = SORTS[req.query.sort] || SORTS.latest;
            const [news, total] = await Promise.all([
                News.find(filter).sort(sort).skip((page - 1) * limit).limit(limit),
                News.countDocuments(filter)
            ]);
            res.status(200).json({ news, page, limit, total, pages: Math.max(Math.ceil(total / limit), 1) });
        } catch (e) {
            res.status(500).json({ message: e.message });
        }
    }

    // Management listing: admins see everything, other users only their own articles.
    async manage(req, res) {
        try {
            const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
            const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 50);
            const filter = {};
            if (!isAdmin(req)) filter.author = req.user._id;
            const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
            if (search) {
                const re = { $regex: escapeRegex(search), $options: 'i' };
                filter.$or = [{ title: re }, { summary: re }];
            }
            if (NEWS_STATUSES.includes(req.query.status)) filter.status = req.query.status;
            const [news, total] = await Promise.all([
                News.find(filter).sort(SORTS.latest).skip((page - 1) * limit).limit(limit),
                News.countDocuments(filter)
            ]);
            res.status(200).json({ news, page, limit, total, pages: Math.max(Math.ceil(total / limit), 1) });
        } catch (e) {
            res.status(500).json({ message: e.message });
        }
    }

    // Counts one view for a live article (per day and category).
    async view(req, res) {
        try {
            if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
                return res.status(404).json({ message: 'News not found' });
            }
            const news = await News.findOneAndUpdate({ _id: req.params.id, ...liveFilter() }, { $inc: { views: 1 } }, { returnDocument: 'after' });
            if (!news) return res.status(404).json({ message: 'News not found' });
            await ViewStat.updateOne({ date: dayKey(), categoryId: news.categoryId }, { $inc: { count: 1 } }, { upsert: true });
            res.status(200).json({ success: true, views: news.views });
        } catch (e) {
            res.status(500).json({ message: e.message });
        }
    }

    // Admin dashboard numbers: totals, views per category and views per day.
    async stats(req, res) {
        try {
            const days = Math.min(Math.max(parseInt(req.query.days, 10) || 14, 1), 90);
            const [categories, byCat, perDay, statuses, users, pendingComments, subscribers, top] = await Promise.all([
                Category.find(),
                News.aggregate([{ $group: { _id: '$categoryId', views: { $sum: '$views' }, articles: { $sum: 1 } } }]),
                ViewStat.aggregate([{ $group: { _id: '$date', views: { $sum: '$count' } } }]),
                News.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]),
                User.countDocuments(),
                Comment.countDocuments({ status: 'pending' }),
                Subscriber.countDocuments(),
                News.find(liveFilter()).sort(SORTS.popular).limit(5),
            ]);
            const catMap = new Map(byCat.map((c) => [String(c._id), c]));
            const dayMap = new Map(perDay.map((d) => [d._id, d.views]));
            const viewsByDay = [];
            for (let i = days - 1; i >= 0; i--) {
                const date = dayKey(new Date(Date.now() - i * 86400000));
                viewsByDay.push({ date, views: dayMap.get(date) || 0 });
            }
            const st = Object.fromEntries(statuses.map((s) => [s._id || 'published', s.n]));
            const viewsByCategory = categories.map((c) => ({
                categoryId: c._id, name: c.name,
                views: (catMap.get(String(c._id)) || {}).views || 0,
                articles: (catMap.get(String(c._id)) || {}).articles || 0,
            }));
            res.status(200).json({
                totals: {
                    articles: statuses.reduce((s, x) => s + x.n, 0),
                    published: st.published || 0, drafts: st.draft || 0, scheduled: st.scheduled || 0,
                    views: byCat.reduce((s, c) => s + c.views, 0),
                    users, pendingComments, subscribers,
                },
                viewsByCategory, viewsByDay,
                topArticles: top.map((t) => ({ _id: t._id, title: t.title, slug: t.slug, views: t.views })),
            });
        } catch (e) {
            res.status(500).json({ message: e.message });
        }
    }

    async show(req, res) {
        try {
            if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
                return res.status(404).json({ message: 'News not found' });
            }
            let news = await News.findById(req.params.id);
            if (!news || !(await canSee(news, req))) return res.status(404).json({ message: 'News not found' });
            res.status(200).json(news);
        } catch (e) {
            res.status(500).json({ message: e.message });
        }
    }

    async getNews(req, res) {
        try {
            let slug = req.params.slug;
            let findNews = await News.findOne({ slug });
            if (!findNews || !(await canSee(findNews, req))) return res.status(404).json({ message: 'News not found' });
            let relatedNews = await News.find({ categoryId: findNews.categoryId, _id: { $ne: findNews._id }, ...liveFilter() })
                .sort(SORTS.popular).limit(4);
            res.status(200).json({ findNews, relatedNews });
        } catch (e) {
            res.status(500).json({ message: e.message });
        }

    }

    async store(req, res) {
        const image = req.file ? req.file.filename : "";
        try {
            const { errors, values } = await validate(req.body, false);
            // Slug: use the supplied one, otherwise derive from the title.
            const slug = makeSlug(str(req.body.slug) || values.title);
            if (!slug) errors.slug = 'Slug is required';
            if (Object.keys(errors).length) {
                removeImage(image);
                return res.status(422).json({ success: false, message: 'Validation failed', errors });
            }
            if (await News.exists({ slug })) {
                removeImage(image);
                return res.status(409).json({ success: false, message: 'Slug already exists', errors: { slug: 'Slug already exists' } });
            }
            const data = { ...values, slug, image, author: req.user && req.user._id };
            if (data.status === 'published' && !values.publishedAt) data.publishedAt = new Date();
            const created = await News.create(data);
            res.status(201).json({ success: true, message: "News created successfully", id: created._id, slug });
        } catch (error) {
            removeImage(image);
            if (error.code === 11000) {
                return res.status(409).json({ success: false, message: 'Slug already exists', errors: { slug: 'Slug already exists' } });
            }
            res.status(500).json({ message: error.message });
        }
    }

    // Slug rules: an existing slug is kept unless the request supplies a `slug`.
    // A non-empty `slug` is slugified and must be unique (excluding this item);
    // an empty `slug` regenerates it from the (new) title.
    async update(req, res) {
        const newImage = req.file ? req.file.filename : undefined;
        try {
            const id = req.params.id;
            if (!mongoose.Types.ObjectId.isValid(id)) {
                removeImage(newImage);
                return res.status(404).json({ success: false, message: 'News not found' });
            }
            const news = await News.findById(id);
            if (!news) {
                removeImage(newImage);
                return res.status(404).json({ success: false, message: 'News not found' });
            }

            const { errors, values } = await validate(req.body, true);
            let slug;
            if (req.body.slug !== undefined) {
                slug = makeSlug(str(req.body.slug) || values.title || news.title);
                if (!slug) errors.slug = 'Slug is required';
            }
            if (Object.keys(errors).length) {
                removeImage(newImage);
                return res.status(422).json({ success: false, message: 'Validation failed', errors });
            }
            if (slug && slug !== news.slug) {
                if (await News.exists({ slug, _id: { $ne: id } })) {
                    removeImage(newImage);
                    return res.status(409).json({ success: false, message: 'Slug already exists', errors: { slug: 'Slug already exists' } });
                }
                values.slug = slug;
            }

            const oldImage = news.image;
            if (newImage) values.image = newImage;
            if (values.status === 'published' && !values.publishedAt && news.status !== 'published') values.publishedAt = new Date();
            values.updatedAt = new Date();
            await News.findByIdAndUpdate(id, values);
            if (newImage && oldImage) removeImage(oldImage);
            res.status(200).json({ success: true, message: "News updated successfully" });
        } catch (error) {
            removeImage(newImage);
            if (error.code === 11000) {
                return res.status(409).json({ success: false, message: 'Slug already exists', errors: { slug: 'Slug already exists' } });
            }
            res.status(500).json({ message: error.message });
        }
    }

    async destroy(req, res) {
        try {
            const id = req.params.id;
            if (!mongoose.Types.ObjectId.isValid(id)) {
                return res.status(404).json({ success: false, message: 'News not found' });
            }
            const news = await News.findByIdAndDelete(id);
            if (!news) return res.status(404).json({ success: false, message: 'News not found' });
            removeImage(news.image);
            await Promise.all([Comment.deleteMany({ newsId: id }), Bookmark.deleteMany({ newsId: id })]);
            res.status(200).json({ success: true, message: "News deleted successfully" });
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }

}

export default NewsController;
