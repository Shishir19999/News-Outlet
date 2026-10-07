import mongoose from 'mongoose';
import Category from '../models/Category.js';
import News, { liveFilter } from '../models/News.js';

class CategoryController {

    async index(req, res) {
        try {
            const [categories, counts] = await Promise.all([
                Category.find(),
                News.aggregate([{ $match: liveFilter() }, { $group: { _id: '$categoryId', n: { $sum: 1 } } }]),
            ]);
            const byId = new Map(counts.map((c) => [String(c._id), c.n]));
            res.status(200).json(categories.map((c) => ({ ...c.toJSON(), newsCount: byId.get(String(c._id)) || 0 })));
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }

    async store(req, res) {
        try {
            let name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
            if (!name) {
                return res.status(422).json({ success: false, message: 'Name is required' });
            }
            const categoryExist = await Category.findOne({ name });
            if (categoryExist) {
                return res.status(409).json({ success: false, message: 'Category already exists!' });
            } else {
                await Category.create({ name, description: req.body.description });
                res.status(201).json({ success: true, message: 'Category created successfully!' });
            }
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }

    async show(req, res) {
        try {
            if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
                return res.status(404).json({ message: 'Category not found' });
            }
            const category = await Category.findById(req.params.id);
            if (!category) return res.status(404).json({ message: 'Category not found' });
            res.status(200).json(category);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }

    async update(req, res) {
        try {
            if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
                return res.status(404).json({ success: false, message: 'Category not found' });
            }
            const { name, description } = req.body;
            if (name !== undefined && (typeof name !== 'string' || !name.trim())) {
                return res.status(422).json({ success: false, message: 'Name is required' });
            }
            if (name && await Category.exists({ name: name.trim(), _id: { $ne: req.params.id } })) {
                return res.status(409).json({ success: false, message: 'Category already exists!' });
            }
            const updated = await Category.findByIdAndUpdate(req.params.id, { ...(name !== undefined && { name: name.trim() }), ...(description !== undefined && { description }) });
            if (!updated) return res.status(404).json({ success: false, message: 'Category not found' });
            res.status(200).json({ success: true, message: 'Category updated successfully!' });
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }

    async destroy(req, res) {
        try {
            if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
                return res.status(404).json({ success: false, message: 'Category not found' });
            }
            if (await News.exists({ categoryId: req.params.id })) {
                return res.status(409).json({ success: false, message: 'Category still has news; delete or move them first' });
            }
            const deleted = await Category.findByIdAndDelete(req.params.id);
            if (!deleted) return res.status(404).json({ success: false, message: 'Category not found' });
            res.status(200).json({ success: true, message: 'Category deleted successfully!' });
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }

}

export default CategoryController;