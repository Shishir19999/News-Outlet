import News, { liveFilter } from '../models/News.js';
import User from '../models/User.js';
import { Revision, LiveUpdate, Reaction, PollVote } from '../models/Extra.js';
import {
    checkTransition, transitionsFor, canEditArticle, canViewArticle, isOwner, roleAtLeast, can, snapshotOf, validateLiveUpdate,
    abLeader, REACTIONS, normalizeRole,
} from '../shared/rules.js';
import { str, isId, audit, recordRevision, shapeArticle, engagementOf, voterOf, AUTHOR_FIELDS } from '../lib/helpers.js';
import { emitLive, emitSite } from '../realtime.js';

const load = async (id) => (isId(String(id)) ? News.findById(id).populate('author', AUTHOR_FIELDS).populate('assignedEditor', 'name') : null);
const raw = (n) => ({ ...n.toObject(), author: n.author && n.author._id ? n.author._id : n.author });
const notFound = (res) => res.status(404).json({ success: false, message: 'News not found' });

class EditorialController {
    // Moves an article through the editorial workflow (rules live in shared/rules.js).
    async transition(req, res) {
        try {
            const news = await load(req.params.id);
            if (!news || !canViewArticle(raw(news), req.user)) return notFound(res);
            const to = str(req.body.to);
            const note = str(req.body.note);
            const moved = checkTransition(raw(news), to, req.user, { note, publishedAt: req.body.publishedAt });
            if (!moved.ok) return res.status(moved.status).json({ success: false, message: moved.message, errors: moved.errors });
            const from = news.status;
            const set = { ...moved.patch, updatedAt: new Date() };
            if (to === 'submitted') set.submittedAt = new Date();
            if (to === 'in_review' && !news.assignedEditor && roleAtLeast(req.user.role, 'editor')) set.assignedEditor = req.user._id;
            const push = {};
            if (note || to === 'approved') {
                push.reviewNotes = { by: req.user._id, byName: req.user.name, byRole: req.user.role, type: to === 'changes_requested' ? 'changes' : to === 'approved' ? 'approval' : 'comment', body: note || 'Approved', at: new Date() };
            }
            await News.updateOne({ _id: news._id }, { $set: set, ...(Object.keys(push).length ? { $push: push } : {}) });
            const fresh = await News.findById(news._id);
            if (to === 'published') await recordRevision(fresh, req.user, 'Published', { force: true });
            await audit(req.user, 'article.transition', { targetType: 'article', targetId: news._id, targetLabel: news.title, detail: `${from} -> ${to}` });
            if (to === 'published' && fresh.breaking) emitSite('breaking', { _id: fresh._id, title: fresh.title, slug: fresh.slug });
            const out = await load(news._id);
            res.status(200).json({ success: true, message: 'Status updated', status: out.status, article: shapeArticle(out, req.user), transitions: transitionsFor(raw(out), req.user) });
        } catch (e) {
            { console.error('ERR', e); res.status(500).json({ message: e.message }); }
        }
    }

    // Review conversation: editors comment, authors reply.
    async addNote(req, res) {
        try {
            const news = await load(req.params.id);
            if (!news || !canViewArticle(raw(news), req.user)) return notFound(res);
            if (!roleAtLeast(req.user.role, 'editor') && !isOwner(raw(news), req.user)) return res.status(403).json({ success: false, message: 'Forbidden' });
            const body = str(req.body.body);
            if (!body || body.length > 2000) return res.status(422).json({ success: false, message: 'Write a note of up to 2000 characters', errors: { body: 'Write a note of up to 2000 characters' } });
            await News.updateOne({ _id: news._id }, { $push: { reviewNotes: { by: req.user._id, byName: req.user.name, byRole: req.user.role, type: 'comment', body, at: new Date() } } });
            const out = await load(news._id);
            res.status(201).json({ success: true, notes: shapeArticle(out, req.user).reviewNotes });
        } catch (e) {
            { console.error('ERR', e); res.status(500).json({ message: e.message }); }
        }
    }

    async assign(req, res) {
        try {
            const news = await load(req.params.id);
            if (!news) return notFound(res);
            let editor = null;
            if (req.body.editorId) {
                editor = isId(String(req.body.editorId)) ? await User.findById(req.body.editorId).select('name role') : null;
                if (!editor || !roleAtLeast(editor.role, 'editor')) return res.status(422).json({ success: false, message: 'Pick an editor or an admin', errors: { editorId: 'Pick an editor or an admin' } });
            }
            await News.updateOne({ _id: news._id }, { assignedEditor: editor ? editor._id : null });
            await audit(req.user, 'article.assign', { targetType: 'article', targetId: news._id, targetLabel: news.title, detail: editor ? editor.name : 'unassigned' });
            res.status(200).json({ success: true, assignedEditor: editor ? { _id: editor._id, name: editor.name } : null });
        } catch (e) {
            { console.error('ERR', e); res.status(500).json({ message: e.message }); }
        }
    }

    async revisions(req, res) {
        try {
            const news = await load(req.params.id);
            if (!news || !(roleAtLeast(req.user.role, 'editor') || isOwner(raw(news), req.user))) return notFound(res);
            const rows = await Revision.find({ newsId: news._id }).sort({ version: -1 }).limit(100);
            res.status(200).json({ revisions: rows });
        } catch (e) {
            { console.error('ERR', e); res.status(500).json({ message: e.message }); }
        }
    }

    async restore(req, res) {
        try {
            const news = await load(req.params.id);
            if (!news || !canViewArticle(raw(news), req.user)) return notFound(res);
            if (!canEditArticle(raw(news), req.user)) return res.status(403).json({ success: false, message: 'You cannot edit this article right now' });
            const rev = isId(req.params.rid) ? await Revision.findOne({ _id: req.params.rid, newsId: news._id }) : null;
            if (!rev) return res.status(404).json({ success: false, message: 'Version not found' });
            const snap = rev.snapshot;
            const set = { updatedAt: new Date() };
            for (const k of Object.keys(snap)) if (!['poll', 'factCheck', 'embed'].includes(k) || snap[k]) set[k] = snap[k];
            const unset = {};
            for (const k of ['poll', 'factCheck', 'embed']) if (!snap[k]) unset[k] = 1;
            await News.updateOne({ _id: news._id }, { $set: set, ...(Object.keys(unset).length ? { $unset: unset } : {}) });
            const fresh = await News.findById(news._id);
            await recordRevision(fresh, req.user, `Restored version ${rev.version}`, { force: true });
            await audit(req.user, 'article.restore', { targetType: 'article', targetId: news._id, targetLabel: news.title, detail: `version ${rev.version}` });
            res.status(200).json({ success: true, message: `Version ${rev.version} restored` });
        } catch (e) {
            { console.error('ERR', e); res.status(500).json({ message: e.message }); }
        }
    }

    // Ends a headline test: the chosen headline becomes the title.
    async abWinner(req, res) {
        try {
            const news = await load(req.params.id);
            if (!news) return notFound(res);
            const variant = req.body.variant === 'b' ? 'b' : req.body.variant === 'a' ? 'a' : abLeader(news.abTest);
            if (!variant || !news.headlineB) return res.status(422).json({ success: false, message: 'Choose a headline (a or b) to keep' });
            const set = { 'abTest.winner': variant, updatedAt: new Date() };
            if (variant === 'b') { set.title = news.headlineB; set.headlineB = news.title; }
            await News.updateOne({ _id: news._id }, { $set: set });
            await recordRevision(await News.findById(news._id), req.user, `Headline test finished: ${variant.toUpperCase()} wins`, { force: true });
            await audit(req.user, 'ab.winner', { targetType: 'article', targetId: news._id, targetLabel: news.title, detail: variant });
            res.status(200).json({ success: true, winner: variant });
        } catch (e) {
            { console.error('ERR', e); res.status(500).json({ message: e.message }); }
        }
    }

    // ---- live blog ------------------------------------------------------------------------------
    async liveList(req, res) {
        try {
            const news = await load(req.params.id);
            if (!news || !canViewArticle(raw(news), req.user)) return notFound(res);
            const rows = await LiveUpdate.find({ newsId: news._id }).sort({ pinned: -1, createdAt: -1 }).limit(200);
            res.status(200).json({ updates: rows });
        } catch (e) {
            { console.error('ERR', e); res.status(500).json({ message: e.message }); }
        }
    }

    async liveAllowed(req, res) {
        const news = await load(req.params.id);
        if (!news) { notFound(res); return null; }
        const ok = news.kind === 'live' && (can(req.user.role, 'live.any') || (can(req.user.role, 'live.own') && isOwner(raw(news), req.user)));
        if (!ok) { res.status(403).json({ success: false, message: news.kind === 'live' ? 'Only the author or an editor can post live updates' : 'This article is not a live blog' }); return null; }
        return news;
    }

    async liveAdd(req, res) {
        try {
            const news = await this.liveAllowed(req, res);
            if (!news) return;
            const { errors, values } = validateLiveUpdate(req.body);
            if (Object.keys(errors).length) return res.status(422).json({ success: false, message: 'Validation failed', errors });
            const row = await LiveUpdate.create({ newsId: news._id, ...values, by: req.user._id, byName: req.user.name });
            emitLive(news._id, { type: 'add', update: row.toJSON() });
            await audit(req.user, 'live.post', { targetType: 'article', targetId: news._id, targetLabel: news.title });
            res.status(201).json({ success: true, update: row });
        } catch (e) {
            { console.error('ERR', e); res.status(500).json({ message: e.message }); }
        }
    }

    async liveEdit(req, res) {
        try {
            const news = await this.liveAllowed(req, res);
            if (!news) return;
            const { errors, values } = validateLiveUpdate({ ...req.body, body: req.body.body ?? 'x' });
            if (Object.keys(errors).length) return res.status(422).json({ success: false, message: 'Validation failed', errors });
            const set = { updatedAt: new Date(), important: values.important, pinned: values.pinned };
            if (req.body.body !== undefined) set.body = values.body;
            const row = isId(req.params.uid) ? await LiveUpdate.findOneAndUpdate({ _id: req.params.uid, newsId: news._id }, set, { returnDocument: 'after' }) : null;
            if (!row) return res.status(404).json({ success: false, message: 'Update not found' });
            emitLive(news._id, { type: 'edit', update: row.toJSON() });
            res.status(200).json({ success: true, update: row });
        } catch (e) {
            { console.error('ERR', e); res.status(500).json({ message: e.message }); }
        }
    }

    async liveDelete(req, res) {
        try {
            const news = await this.liveAllowed(req, res);
            if (!news) return;
            const row = isId(req.params.uid) ? await LiveUpdate.findOneAndDelete({ _id: req.params.uid, newsId: news._id }) : null;
            if (!row) return res.status(404).json({ success: false, message: 'Update not found' });
            emitLive(news._id, { type: 'delete', update: { _id: row._id } });
            res.status(200).json({ success: true });
        } catch (e) {
            { console.error('ERR', e); res.status(500).json({ message: e.message }); }
        }
    }

    // ---- reactions and polls --------------------------------------------------------------------
    async engagement(req, res) {
        try {
            const news = await load(req.params.id);
            if (!news || !canViewArticle(raw(news), req.user)) return notFound(res);
            res.status(200).json(await engagementOf(news._id, voterOf(req), news.poll));
        } catch (e) {
            { console.error('ERR', e); res.status(500).json({ message: e.message }); }
        }
    }

    // PUT { type } sets or changes the reaction; { type: null } removes it.
    async react(req, res) {
        try {
            const news = await load(req.params.id);
            const voter = voterOf(req);
            if (!news || !(await News.exists({ _id: news._id, ...liveFilter() }))) return notFound(res);
            if (!voter) return res.status(422).json({ success: false, message: 'Missing client id' });
            const type = req.body.type;
            if (type === null || type === undefined || type === '') await Reaction.deleteOne({ newsId: news._id, voter });
            else if (!REACTIONS.includes(type)) return res.status(422).json({ success: false, message: 'Unknown reaction' });
            else await Reaction.updateOne({ newsId: news._id, voter }, { $set: { type } }, { upsert: true });
            res.status(200).json(await engagementOf(news._id, voter, news.poll));
        } catch (e) {
            { console.error('ERR', e); res.status(500).json({ message: e.message }); }
        }
    }

    async vote(req, res) {
        try {
            const news = await load(req.params.id);
            const voter = voterOf(req);
            if (!news || !news.poll || !(await News.exists({ _id: news._id, ...liveFilter() }))) return notFound(res);
            if (!voter) return res.status(422).json({ success: false, message: 'Missing client id' });
            if (news.poll.closesAt && new Date(news.poll.closesAt) <= new Date()) return res.status(409).json({ success: false, message: 'This poll is closed' });
            const optionId = str(req.body.optionId);
            if (!news.poll.options.some((o) => o.id === optionId)) return res.status(422).json({ success: false, message: 'Choose one of the answers' });
            const r = await PollVote.updateOne({ newsId: news._id, voter }, { $setOnInsert: { optionId } }, { upsert: true });
            const out = await engagementOf(news._id, voter, news.poll);
            if (!r.upsertedCount) return res.status(409).json({ success: false, message: 'You have already voted', ...out });
            res.status(200).json({ success: true, ...out });
        } catch (e) {
            { console.error('ERR', e); res.status(500).json({ message: e.message }); }
        }
    }
}

export default EditorialController;
export { normalizeRole, snapshotOf };
