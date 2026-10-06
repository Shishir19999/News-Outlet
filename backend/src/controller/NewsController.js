import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import slugify from 'slugify';
import News from '../models/News.js';
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
    return { errors, values };
}

class NewsController {
    async index(req, res) {
        try {
            const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
            const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 9, 1), 50);
            const filter = {};
            const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
            if (search) {
                const re = { $regex: escapeRegex(search), $options: 'i' };
                filter.$or = [{ title: re }, { summary: re }];
            }
            if (req.query.categoryId && mongoose.Types.ObjectId.isValid(req.query.categoryId)) {
                filter.categoryId = req.query.categoryId;
            }
            const [news, total] = await Promise.all([
                News.find(filter).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit),
                News.countDocuments(filter)
            ]);
            res.status(200).json({ news, page, limit, total, pages: Math.max(Math.ceil(total / limit), 1) });
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
            if (!news) return res.status(404).json({ message: 'News not found' });
            res.status(200).json(news);
        } catch (e) {
            res.status(500).json({ message: e.message });
        }
    }

    async getNews(req, res) {
        try {
            let slug = req.params.slug;
            let findNews = await News.findOne({ slug });
            if (!findNews) return res.status(404).json({ message: 'News not found' });
            let categoryId = findNews.categoryId;
            let relatedNews = await News.find({ categoryId: categoryId, _id: { $ne: findNews._id } });
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
            await News.create({ ...values, slug, image });
            res.status(201).json({ success: true, message: "News created successfully" });
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
            res.status(200).json({ success: true, message: "News deleted successfully" });
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }

}

export default NewsController;
