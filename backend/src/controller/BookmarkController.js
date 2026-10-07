import mongoose from 'mongoose';
import Bookmark from '../models/Bookmark.js';
import News, { liveFilter } from '../models/News.js';

class BookmarkController {
    // The caller's "read later" list: { ids, news } (newest bookmark first, live articles only).
    async index(req, res) {
        try {
            const marks = await Bookmark.find({ userId: req.user._id }).sort({ createdAt: -1 });
            const news = await News.find({ _id: { $in: marks.map((m) => m.newsId) }, ...liveFilter() });
            const byId = new Map(news.map((n) => [String(n._id), n]));
            const ordered = marks.map((m) => byId.get(String(m.newsId))).filter(Boolean);
            res.status(200).json({ ids: ordered.map((n) => String(n._id)), news: ordered });
        } catch (e) {
            res.status(500).json({ message: e.message });
        }
    }

    // Idempotent add.
    async add(req, res) {
        try {
            const { newsId } = req.params;
            if (!mongoose.Types.ObjectId.isValid(newsId) || !(await News.exists({ _id: newsId, ...liveFilter() }))) {
                return res.status(404).json({ success: false, message: 'News not found' });
            }
            await Bookmark.updateOne({ userId: req.user._id, newsId }, { $setOnInsert: { userId: req.user._id, newsId } }, { upsert: true });
            res.status(200).json({ success: true, bookmarked: true });
        } catch (e) {
            res.status(500).json({ message: e.message });
        }
    }

    // Idempotent remove.
    async remove(req, res) {
        try {
            if (!mongoose.Types.ObjectId.isValid(req.params.newsId)) return res.status(404).json({ success: false, message: 'News not found' });
            await Bookmark.deleteOne({ userId: req.user._id, newsId: req.params.newsId });
            res.status(200).json({ success: true, bookmarked: false });
        } catch (e) {
            res.status(500).json({ message: e.message });
        }
    }
}

export default BookmarkController;
