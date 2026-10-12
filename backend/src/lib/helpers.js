import mongoose from 'mongoose';
import News from '../models/News.js';
import { Revision, AuditLog, Settings, Reaction, PollVote } from '../models/Extra.js';
import { abActive, isOwner, roleAtLeast, snapshotOf, sameSnapshot, REACTIONS } from '../shared/rules.js';

export const str = (v) => (typeof v === 'string' ? v.trim() : '');
export const isId = (v) => typeof v === 'string' && mongoose.Types.ObjectId.isValid(v) && String(new mongoose.Types.ObjectId(v)) === v;
export const dayKey = (d = new Date()) => d.toISOString().slice(0, 10);
export const AUTHOR_FIELDS = 'name image bio role';

export function pageParams(query, defLimit, maxLimit = 50) {
    const page = Math.max(parseInt(query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(query.limit, 10) || defLimit, 1), maxLimit);
    return { page, limit, skip: (page - 1) * limit };
}
export const pageInfo = (page, limit, total) => ({ page, limit, total, pages: Math.max(Math.ceil(total / limit), 1) });

// Who is voting: a signed-in user, or an anonymous browser that sends a random client id.
export function voterOf(req) {
    if (req.user) return `u:${req.user._id}`;
    const id = req.headers['x-client-id'];
    if (typeof id === 'string' && /^[A-Za-z0-9_-]{8,64}$/.test(id)) return `c:${id}`;
    return null;
}

export async function getSettings() {
    return Settings.findOneAndUpdate({ key: 'site' }, { $setOnInsert: { key: 'site' } }, { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true });
}
export const publicSettings = (s) => ({
    siteName: s.siteName, tagline: s.tagline, commentsOpen: s.commentsOpen, newsletterEnabled: s.newsletterEnabled,
    registrationOpen: s.registrationOpen, alert: { active: !!s.alert.active, text: s.alert.text, link: s.alert.link, level: s.alert.level },
});

export async function audit(actor, action, { targetType = '', targetId = '', targetLabel = '', detail = '' } = {}) {
    try {
        await AuditLog.create({ action, by: actor && actor._id, byName: actor && actor.name, byRole: actor && actor.role, targetType, targetId: String(targetId || ''), targetLabel, detail });
    } catch (e) {
        console.log('audit failed:', e.message);
    }
}

// Stores a new revision when the editable content changed (or always with force).
export async function recordRevision(news, actor, note = '', { force = false } = {}) {
    const snapshot = snapshotOf(news.toObject ? news.toObject() : news);
    const last = await Revision.findOne({ newsId: news._id }).sort({ version: -1 });
    if (last && !force && sameSnapshot(last.snapshot, snapshot)) return last;
    return Revision.create({ newsId: news._id, version: (last ? last.version : 0) + 1, snapshot, by: actor && actor._id, byName: actor && actor.name, note });
}

// JSON for the client. Review notes, the assigned editor and headline test numbers are only for
// the article's author and the editorial team.
export function shapeArticle(doc, actor) {
    const o = doc.toJSON ? doc.toJSON() : { ...doc };
    const privileged = !!actor && (roleAtLeast(actor.role, 'editor') || isOwner(o, actor));
    const editorial = !!actor && roleAtLeast(actor.role, 'editor');
    if (!privileged) {
        delete o.reviewNotes;
        delete o.assignedEditor;
        delete o.submittedAt;
        delete o.depth;
    }
    const ab = o.abTest || {};
    if (!editorial && !abActive({ headlineB: o.headlineB, abTest: ab })) o.headlineB = '';
    if (!editorial) o.abTest = { winner: ab.winner || '' };
    return o;
}

export async function engagementOf(newsId, voter, poll) {
    const [reacts, mine, votes, myVote] = await Promise.all([
        Reaction.aggregate([{ $match: { newsId: new mongoose.Types.ObjectId(String(newsId)) } }, { $group: { _id: '$type', n: { $sum: 1 } } }]),
        voter ? Reaction.findOne({ newsId, voter }) : null,
        poll ? PollVote.aggregate([{ $match: { newsId: new mongoose.Types.ObjectId(String(newsId)) } }, { $group: { _id: '$optionId', n: { $sum: 1 } } }]) : [],
        voter && poll ? PollVote.findOne({ newsId, voter }) : null,
    ]);
    const reactions = Object.fromEntries(REACTIONS.map((r) => [r, 0]));
    for (const r of reacts) if (r._id in reactions) reactions[r._id] = r.n;
    let pollOut = null;
    if (poll && poll.options) {
        const counts = new Map(votes.map((v) => [v._id, v.n]));
        const total = votes.reduce((s, v) => s + v.n, 0);
        pollOut = {
            question: poll.question,
            closesAt: poll.closesAt || null,
            closed: !!(poll.closesAt && new Date(poll.closesAt) <= new Date()),
            total,
            myVote: myVote ? myVote.optionId : null,
            options: poll.options.map((o) => ({ id: o.id, label: o.label, votes: counts.get(o.id) || 0 })),
        };
    }
    return { reactions, mine: mine ? mine.type : null, poll: pollOut };
}

export async function findArticle(idOrSlug) {
    if (isId(idOrSlug)) return News.findById(idOrSlug);
    return News.findOne({ slug: String(idOrSlug) });
}

// Public site URLs for feeds, the sitemap and share pages.
export function siteContext(settings) {
    const site = (process.env.SITE_URL || process.env.PUBLIC_URL || 'http://localhost:5173').replace(/\/$/, '');
    const api = (process.env.PUBLIC_URL || '').replace(/\/$/, '');
    return {
        siteUrl: site,
        siteName: settings ? settings.siteName : 'News Outlet',
        tagline: settings ? settings.tagline : '',
        articleUrl: (slug) => `${site}/news-details/${slug}`,
        sectionUrl: (slug) => `${site}/category/${slug}`,
        feedUrl: (kind, slug) => (slug ? `${api}/${kind === 'atom' ? 'atom' : 'rss'}/${slug}.xml` : `${api}/${kind === 'atom' ? 'atom' : 'feed'}.xml`),
    };
}
