import Category from '../models/Category.js';

class CategoryController {

    async index(req, res) {
        try {
            const categories = await Category.find();
            res.status(200).json(categories);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }

    async store(req, res) {
        try {
            let name = req.body.name;
            const categoryExist = await Category.findOne({ name });
            if (categoryExist) {
                return res.status(501).json({ success: false, message: 'Category already exists!' });
            } else {
                await Category.create({ ...req.body });
                res.status(201).json({ success: true, message: 'Category created successfully!' });
            }
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }

    async show(req, res) {
        try {
            const category = await Category.findById(req.params.id);
            res.status(200).json(category);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }

    async update(req, res) {
        try {
            await Category.findByIdAndUpdate(req.params.id, { ...req.body });
            res.status(200).json({ success: true, message: 'Category updated successfully!' });
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }

    async destroy(req, res) {
        try {
            await Category.findByIdAndDelete(req.params.id);
            res.status(200).json({ success: true, message: 'Category deleted successfully!' });
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }

}

export default CategoryController;