import Category from '../models/Category.js';
import News, { liveFilter } from '../models/News.js';
import { validateSection } from '../shared/rules.js';
import { isId, audit } from '../lib/helpers.js';

class CategoryController {
    // Sections in navigation order.
    async index(req, res) {
        try {
            const [categories, counts] = await Promise.all([
                Category.find().sort({ order: 1, name: 1 }),
                News.aggregate([{ $match: liveFilter() }, { $group: { _id: '$categoryId', n: { $sum: 1 } } }]),
            ]);
            const byId = new Map(counts.map((c) => [String(c._id), c.n]));
            res.status(200).json(categories.map((c) => ({ ...c.toJSON(), newsCount: byId.get(String(c._id)) || 0 })));
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }

    // Mega-menu data: per section the newest stories and the most used tags.
    async menu(req, res) {
        try {
            const categories = await Category.find().sort({ order: 1, name: 1 });
            const out = [];
            for (const c of categories) {
                const [latest, tags] = await Promise.all([
                    News.find({ categoryId: c._id, ...liveFilter() }).sort({ publishedAt: -1 }).limit(3).select('title slug publishedAt'),
                    News.aggregate([{ $match: { categoryId: c._id, ...liveFilter() } }, { $unwind: '$tags' }, { $group: { _id: '$tags', n: { $sum: 1 } } }, { $sort: { n: -1, _id: 1 } }, { $limit: 5 }]),
                ]);
                out.push({ ...c.toJSON(), latest: latest.map((n) => ({ _id: n._id, title: n.title, slug: n.slug, publishedAt: n.publishedAt })), tags: tags.map((t) => t._id) });
            }
            res.status(200).json(out);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }

    async store(req, res) {
        try {
            const { errors, values } = validateSection(req.body);
            if (Object.keys(errors).length) return res.status(422).json({ success: false, message: Object.values(errors)[0], errors });
            if (await Category.findOne({ name: values.name })) return res.status(409).json({ success: false, message: 'Category already exists!' });
            const created = await Category.create({ ...values, ...(values.order === undefined ? { order: (await Category.countDocuments()) * 10 + 10 } : {}) });
            await audit(req.user, 'section.save', { targetType: 'section', targetId: created._id, targetLabel: created.name });
            res.status(201).json({ success: true, message: 'Category created successfully!' });
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }

    async show(req, res) {
        try {
            if (!isId(req.params.id)) return res.status(404).json({ message: 'Category not found' });
            const category = await Category.findById(req.params.id);
            if (!category) return res.status(404).json({ message: 'Category not found' });
            res.status(200).json(category);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }

    async update(req, res) {
        try {
            if (!isId(req.params.id)) return res.status(404).json({ success: false, message: 'Category not found' });
            const current = await Category.findById(req.params.id);
            if (!current) return res.status(404).json({ success: false, message: 'Category not found' });
            const { errors, values } = validateSection({ name: req.body.name ?? current.name, description: req.body.description ?? current.description, order: req.body.order });
            if (Object.keys(errors).length) return res.status(422).json({ success: false, message: Object.values(errors)[0], errors });
            if (await Category.exists({ name: values.name, _id: { $ne: req.params.id } })) return res.status(409).json({ success: false, message: 'Category already exists!' });
            await Category.updateOne({ _id: current._id }, values);
            await audit(req.user, 'section.save', { targetType: 'section', targetId: current._id, targetLabel: values.name });
            res.status(200).json({ success: true, message: 'Category updated successfully!' });
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }

    async destroy(req, res) {
        try {
            if (!isId(req.params.id)) return res.status(404).json({ success: false, message: 'Category not found' });
            if (await News.exists({ categoryId: req.params.id })) {
                return res.status(409).json({ success: false, message: 'Category still has news; delete or move them first' });
            }
            const deleted = await Category.findByIdAndDelete(req.params.id);
            if (!deleted) return res.status(404).json({ success: false, message: 'Category not found' });
            await audit(req.user, 'section.delete', { targetType: 'section', targetId: deleted._id, targetLabel: deleted.name });
            res.status(200).json({ success: true, message: 'Category deleted successfully!' });
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }
}

export default CategoryController;
