import Comment, { COMMENT_STATUSES } from '../models/Comment.js';
import News, { liveFilter } from '../models/News.js';
import User from '../models/User.js';
import { validateComment, roleAtLeast, COMMENT_MAX_DEPTH, REPORT_REASONS, REPORT_THRESHOLD } from '../shared/rules.js';
import { str, isId, getSettings, audit, pageParams, pageInfo, voterOf } from '../lib/helpers.js';

const pub = (c) => ({ _id: c._id, newsId: c.newsId, parentId: c.parentId || null, name: c.name, body: c.body, createdAt: c.createdAt, isStaff: !!c.isStaff });

async function depthOf(parent) {
    let depth = 1;
    let cur = parent;
    while (cur && cur.parentId && depth < 10) {
        cur = await Comment.findById(cur.parentId);
        depth++;
    }
    return depth;
}

class CommentController {
    // Public: approved comments of one article (threads are built by the client from parentId).
    async index(req, res) {
        try {
            if (!isId(req.query.newsId)) return res.status(422).json({ success: false, message: 'newsId is required' });
            const comments = await Comment.find({ newsId: req.query.newsId, status: 'approved' }).sort({ createdAt: 1 });
            const users = await User.find({ _id: { $in: comments.map((c) => c.userId).filter(Boolean) } }).select('role');
            const staff = new Set(users.filter((u) => roleAtLeast(u.role, 'editor')).map((u) => String(u._id)));
            res.status(200).json(comments.map((c) => pub({ ...c.toObject(), isStaff: c.userId && staff.has(String(c.userId)) })));
        } catch (e) {
            res.status(500).json({ message: e.message });
        }
    }

    // Anyone may comment; new comments wait in the moderation queue (editors and admins are auto-approved).
    async store(req, res) {
        try {
            const settings = await getSettings();
            if (!settings.commentsOpen) return res.status(403).json({ success: false, message: 'Comments are closed at the moment' });
            const newsId = str(req.body.newsId);
            const { errors, values } = validateComment(req.body);
            if (!isId(newsId)) errors.newsId = 'A valid article is required';
            let user = null;
            if (req.user) user = await User.findById(req.user._id).select('name');
            const name = user ? user.name : values.name;
            if (!name) errors.name = 'Name is required';
            let parent = null;
            if (values.parentId) {
                parent = isId(values.parentId) ? await Comment.findOne({ _id: values.parentId, newsId, status: 'approved' }) : null;
                if (!parent) errors.parentId = 'The comment you reply to is not available';
                else if ((await depthOf(parent)) >= COMMENT_MAX_DEPTH) errors.parentId = 'Replies can only go three levels deep';
            }
            if (Object.keys(errors).length) return res.status(422).json({ success: false, message: 'Validation failed', errors });
            if (!(await News.exists({ _id: newsId, ...liveFilter() }))) return res.status(404).json({ success: false, message: 'News not found' });
            const approved = !!(req.user && roleAtLeast(req.user.role, 'editor'));
            const comment = await Comment.create({ newsId, userId: user ? user._id : undefined, parentId: parent ? parent._id : null, name, body: values.body, status: approved ? 'approved' : 'pending' });
            res.status(201).json({ success: true, message: approved ? 'Comment published' : 'Thanks! Your comment is awaiting moderation', status: comment.status, id: comment._id });
        } catch (e) {
            res.status(500).json({ message: e.message });
        }
    }

    // Any reader can report a comment once. Enough reports send it back to the moderation queue.
    async report(req, res) {
        try {
            const voter = voterOf(req);
            const reason = REPORT_REASONS.includes(req.body.reason) ? req.body.reason : 'other';
            if (!voter) return res.status(422).json({ success: false, message: 'Missing client id' });
            const c = isId(req.params.id) ? await Comment.findOne({ _id: req.params.id, status: 'approved' }) : null;
            if (!c) return res.status(404).json({ success: false, message: 'Comment not found' });
            if (c.reports.some((r) => r.voter === voter)) return res.status(200).json({ success: true, message: 'You already reported this comment' });
            c.reports.push({ voter, reason });
            if (c.reports.length >= REPORT_THRESHOLD) c.status = 'pending';
            await c.save();
            res.status(201).json({ success: true, message: 'Thanks, an editor will take a look', hidden: c.status === 'pending' });
        } catch (e) {
            res.status(500).json({ message: e.message });
        }
    }

    // Editors and admins: moderation queue. ?status=pending|approved|rejected|reported
    async manage(req, res) {
        try {
            const { page, limit, skip } = pageParams(req.query, 20, 100);
            const filter = {};
            if (COMMENT_STATUSES.includes(req.query.status)) filter.status = req.query.status;
            if (req.query.status === 'reported') filter['reports.0'] = { $exists: true };
            const [rows, total, pending, reported] = await Promise.all([
                Comment.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('newsId', 'title slug'),
                Comment.countDocuments(filter),
                Comment.countDocuments({ status: 'pending' }),
                Comment.countDocuments({ 'reports.0': { $exists: true } }),
            ]);
            const comments = rows.map((c) => ({
                _id: c._id, name: c.name, body: c.body, status: c.status, createdAt: c.createdAt, parentId: c.parentId || null,
                reports: c.reports.map((r) => ({ reason: r.reason, at: r.at })),
                news: c.newsId ? { _id: c.newsId._id, title: c.newsId.title, slug: c.newsId.slug } : null,
            }));
            res.status(200).json({ comments, ...pageInfo(page, limit, total), pending, reported });
        } catch (e) {
            res.status(500).json({ message: e.message });
        }
    }

    async update(req, res) {
        try {
            if (!isId(req.params.id)) return res.status(404).json({ success: false, message: 'Comment not found' });
            const set = {};
            if (req.body.status !== undefined) {
                if (!COMMENT_STATUSES.includes(req.body.status)) return res.status(422).json({ success: false, message: 'Status must be pending, approved or rejected' });
                set.status = req.body.status;
            }
            if (req.body.clearReports) set.reports = [];
            const updated = await Comment.findByIdAndUpdate(req.params.id, set);
            if (!updated) return res.status(404).json({ success: false, message: 'Comment not found' });
            await audit(req.user, 'comment.moderate', { targetType: 'comment', targetId: updated._id, targetLabel: updated.body.slice(0, 60), detail: set.status || 'reports cleared' });
            res.status(200).json({ success: true, message: 'Comment updated' });
        } catch (e) {
            res.status(500).json({ message: e.message });
        }
    }

    async destroy(req, res) {
        try {
            if (!isId(req.params.id)) return res.status(404).json({ success: false, message: 'Comment not found' });
            const deleted = await Comment.findByIdAndDelete(req.params.id);
            if (!deleted) return res.status(404).json({ success: false, message: 'Comment not found' });
            await Comment.updateMany({ parentId: deleted._id }, { parentId: deleted.parentId || null });
            await audit(req.user, 'comment.moderate', { targetType: 'comment', targetId: deleted._id, targetLabel: deleted.body.slice(0, 60), detail: 'deleted' });
            res.status(200).json({ success: true, message: 'Comment deleted' });
        } catch (e) {
            res.status(500).json({ message: e.message });
        }
    }
}

export default CommentController;
