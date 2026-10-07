import mongoose from 'mongoose';
import Comment, { COMMENT_STATUSES } from '../models/Comment.js';
import News, { liveFilter } from '../models/News.js';
import User from '../models/User.js';

const str = (v) => (typeof v === 'string' ? v.trim() : '');

class CommentController {
    // Public: approved comments of one article, oldest first.
    async index(req, res) {
        try {
            if (!mongoose.Types.ObjectId.isValid(req.query.newsId)) {
                return res.status(422).json({ success: false, message: 'newsId is required' });
            }
            const comments = await Comment.find({ newsId: req.query.newsId, status: 'approved' }).sort({ createdAt: 1 });
            res.status(200).json(comments.map((c) => ({ _id: c._id, newsId: c.newsId, name: c.name, body: c.body, createdAt: c.createdAt })));
        } catch (e) {
            res.status(500).json({ message: e.message });
        }
    }

    // Anyone may comment; new comments wait in the moderation queue (admins are auto-approved).
    async store(req, res) {
        try {
            const errors = {};
            const newsId = str(req.body.newsId);
            const body = str(req.body.body);
            let name = str(req.body.name);
            if (!mongoose.Types.ObjectId.isValid(newsId)) errors.newsId = 'A valid article is required';
            if (!body) errors.body = 'Comment is required';
            else if (body.length > 1000) errors.body = 'Comment must be at most 1000 characters';
            let user = null;
            if (req.user) user = await User.findById(req.user._id).select('name');
            if (user) name = user.name;
            if (!name) errors.name = 'Name is required';
            else if (name.length > 60) errors.name = 'Name must be at most 60 characters';
            if (Object.keys(errors).length) {
                return res.status(422).json({ success: false, message: 'Validation failed', errors });
            }
            if (!(await News.exists({ _id: newsId, ...liveFilter() }))) {
                return res.status(404).json({ success: false, message: 'News not found' });
            }
            const approved = !!(req.user && req.user.role === 'admin');
            const comment = await Comment.create({ newsId, userId: user ? user._id : undefined, name, body, status: approved ? 'approved' : 'pending' });
            res.status(201).json({
                success: true,
                message: approved ? 'Comment published' : 'Thanks! Your comment is awaiting moderation',
                status: comment.status,
                id: comment._id,
            });
        } catch (e) {
            res.status(500).json({ message: e.message });
        }
    }

    // Admin: moderation queue. ?status=pending|approved|rejected (default: all)
    async manage(req, res) {
        try {
            const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
            const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
            const filter = {};
            if (COMMENT_STATUSES.includes(req.query.status)) filter.status = req.query.status;
            const [rows, total, pending] = await Promise.all([
                Comment.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).populate('newsId', 'title slug'),
                Comment.countDocuments(filter),
                Comment.countDocuments({ status: 'pending' }),
            ]);
            const comments = rows.map((c) => ({
                _id: c._id, name: c.name, body: c.body, status: c.status, createdAt: c.createdAt,
                news: c.newsId ? { _id: c.newsId._id, title: c.newsId.title, slug: c.newsId.slug } : null,
            }));
            res.status(200).json({ comments, page, limit, total, pages: Math.max(Math.ceil(total / limit), 1), pending });
        } catch (e) {
            res.status(500).json({ message: e.message });
        }
    }

    async update(req, res) {
        try {
            if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(404).json({ success: false, message: 'Comment not found' });
            if (!COMMENT_STATUSES.includes(req.body.status)) {
                return res.status(422).json({ success: false, message: 'Status must be pending, approved or rejected' });
            }
            const updated = await Comment.findByIdAndUpdate(req.params.id, { status: req.body.status });
            if (!updated) return res.status(404).json({ success: false, message: 'Comment not found' });
            res.status(200).json({ success: true, message: 'Comment updated' });
        } catch (e) {
            res.status(500).json({ message: e.message });
        }
    }

    async destroy(req, res) {
        try {
            if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(404).json({ success: false, message: 'Comment not found' });
            const deleted = await Comment.findByIdAndDelete(req.params.id);
            if (!deleted) return res.status(404).json({ success: false, message: 'Comment not found' });
            res.status(200).json({ success: true, message: 'Comment deleted' });
        } catch (e) {
            res.status(500).json({ message: e.message });
        }
    }
}

export default CommentController;
