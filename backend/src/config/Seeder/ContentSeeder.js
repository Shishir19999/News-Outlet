// Idempotent seeder for sample accounts, sections and original sample articles (shared/sample.js).
// Existing records are never duplicated or overwritten: users are keyed by e-mail, sections by name,
// articles by slug.
import User from '../../models/User.js';
import Category from '../../models/Category.js';
import News from '../../models/News.js';
import Comment from '../../models/Comment.js';
import ViewStat from '../../models/ViewStat.js';
import Subscriber from '../../models/Subscriber.js';
import { Revision, LiveUpdate, Reaction, PollVote, ArticleView, DayStat, Settings } from '../../models/Extra.js';
import { buildSampleContent, dailyViews, DEMO_PASSWORDS } from '../../shared/sample.js';
import { snapshotOf, SOURCES } from '../../shared/rules.js';
import crypto from 'crypto';

const dayKey = (t) => new Date(t).toISOString().slice(0, 10);

// Dev defaults are for local development only; set SEED_* in .env otherwise.
const passwordFor = (role) => ({
    admin: process.env.SEED_ADMIN_PASSWORD || DEMO_PASSWORDS.admin,
    editor: process.env.SEED_EDITOR_PASSWORD || DEMO_PASSWORDS.editor,
    author: process.env.SEED_AUTHOR_PASSWORD || DEMO_PASSWORDS.author,
    reader: process.env.SEED_USER_PASSWORD || DEMO_PASSWORDS.reader,
}[role]);

class ContentSeeder {
    static async users(sample) {
        const byKey = {};
        for (const p of sample.people) {
            let u = await User.findOne({ email: p.email });
            if (!u) u = await new User({ name: p.name, email: p.email, password: passwordFor(p.role), gender: p.gender, role: p.role, bio: p.bio, image: '' }).save();
            byKey[p.key] = u;
        }
        return byKey;
    }

    static async sections(sample) {
        const byName = {};
        for (const s of sample.sections) {
            let c = await Category.findOne({ name: s.name });
            if (!c) c = await Category.create(s);
            byName[s.name] = c;
        }
        return byName;
    }

    // `articles`: create the sample stories that are missing (by slug).
    static async run({ withUsers = true } = {}) {
        const now = Date.now();
        const sample = buildSampleContent(now);
        const people = withUsers ? await ContentSeeder.users(sample) : {};
        const sections = await ContentSeeder.sections(sample);
        await Settings.updateOne({ key: 'site' }, { $setOnInsert: { key: 'site' } }, { upsert: true });
        const staff = await User.find({ role: { $in: ['admin', 'editor', 'author'] } });
        const fallback = staff[0];
        const bySlug = {};
        let index = 0;
        for (const a of sample.articles) {
            index++;
            const existing = await News.findOne({ slug: a.slug });
            if (existing) { bySlug[a.slug] = existing; continue; }
            const author = people[a.author] || fallback;
            const doc = await News.create({
                categoryId: sections[a.section]._id, title: a.title, slug: a.slug, summary: a.summary, description: a.description,
                image: a.image || '', imageAlt: a.imageAlt || '', status: a.status, kind: a.kind, tags: a.tags, sponsor: a.sponsor || '',
                factCheck: a.factCheck, embed: a.embed, gallery: a.gallery || [], headlineB: a.headlineB || '',
                abTest: { a: (a.ab && a.ab.a) || {}, b: (a.ab && a.ab.b) || {}, winner: '' },
                poll: a.poll ? { question: a.poll.question, options: a.poll.options.map((o) => ({ id: o.id, label: o.label })), closesAt: a.poll.closesAt } : undefined,
                publishedAt: a.publishedAt, submittedAt: ['submitted', 'in_review', 'changes_requested', 'approved'].includes(a.status) ? new Date(now - 6 * 3600000) : null,
                views: a.views || 0, depth: { 25: Math.round((a.views || 0) * 0.6), 50: Math.round((a.views || 0) * 0.42), 75: Math.round((a.views || 0) * 0.27), 100: Math.round((a.views || 0) * 0.15) },
                featured: !!a.featured, breaking: !!a.breaking, author: author && author._id,
                assignedEditor: a.editor && people[a.editor] ? people[a.editor]._id : null,
                reviewNotes: (a.notes || []).map((n) => ({ by: people[n.by] && people[n.by]._id, byName: people[n.by] && people[n.by].name, byRole: people[n.by] && people[n.by].role, type: n.type, body: n.body, at: new Date(now - n.hoursAgo * 3600000) })),
                createdAt: a.createdAt, updatedAt: a.publishedAt || a.createdAt,
            });
            bySlug[a.slug] = doc;
            // revisions: older versions first, then the current one
            let v = 0;
            for (const h of a.history || []) {
                v++;
                await Revision.create({ newsId: doc._id, version: v, snapshot: { ...snapshotOf(doc.toObject()), ...h.override, categoryId: String(doc.categoryId) }, by: people[h.by] && people[h.by]._id, byName: people[h.by] && people[h.by].name, note: h.note, createdAt: new Date(now - h.daysAgo * 86400000) });
            }
            await Revision.create({ newsId: doc._id, version: v + 1, snapshot: snapshotOf(doc.toObject()), by: author && author._id, byName: author && author.name, note: v ? 'Current version' : 'First version', createdAt: new Date(a.createdAt) });
            // engagement and analytics
            if (a.status === 'published' && a.views) {
                const daily = dailyViews(index, a.views, now);
                for (const [date, count] of Object.entries(daily)) await ArticleView.updateOne({ date, newsId: doc._id }, { $inc: { count } }, { upsert: true });
                for (const [date, count] of Object.entries(daily)) await ViewStat.updateOne({ date, categoryId: doc.categoryId }, { $inc: { count } }, { upsert: true });
                for (const [date, count] of Object.entries(daily)) {
                    const inc = { views: count };
                    SOURCES.forEach((s, i) => { inc[`sources.${s}`] = Math.round(count * [0.34, 0.26, 0.14, 0.08, 0.14, 0.04][i]); });
                    ['25', '50', '75', '100'].forEach((d, i) => { inc[`depth.${d}`] = Math.round(count * [0.6, 0.42, 0.27, 0.15][i]); });
                    await DayStat.updateOne({ date }, { $inc: inc }, { upsert: true });
                }
                const mix = { like: 9 + (index % 7), insightful: 3 + (index % 4), sad: index % 3, surprised: 1 + (index % 3) };
                for (const [type, n] of Object.entries(mix)) for (let i = 0; i < n; i++) await Reaction.create({ newsId: doc._id, voter: `seed:${type}:${i}`, type });
            }
            if (a.poll) for (const o of a.poll.options) for (let i = 0; i < (a.poll.votes[o.id] || 0); i++) await PollVote.create({ newsId: doc._id, voter: `seed:${o.id}:${i}`, optionId: o.id });
            for (const [i, u] of (a.live || []).entries()) {
                await LiveUpdate.create({ newsId: doc._id, body: u[1], important: u[2], pinned: u[3], by: author && author._id, byName: author && author.name, createdAt: new Date(now - u[0] * 60000 + i) });
            }
        }
        if (!(await Comment.estimatedDocumentCount())) {
            const made = [];
            for (const c of sample.comments) {
                const doc = bySlug[c.article];
                if (!doc) { made.push(null); continue; }
                const row = await Comment.create({ newsId: doc._id, name: c.name, body: c.body, status: c.status, parentId: c.parentIndex !== null && made[c.parentIndex] ? made[c.parentIndex]._id : null, reports: Array.from({ length: c.reports }, (_, i) => ({ voter: `seed:${i}`, reason: 'spam' })), createdAt: new Date(c.createdAt) });
                made.push(row);
            }
        }
        if (!(await Subscriber.estimatedDocumentCount())) {
            const cats = await Category.find();
            const id = new Map(cats.map((c) => [c.name, String(c._id)]));
            for (const s of sample.subscribers) {
                const at = new Date(now - s.daysAgo * 86400000);
                await Subscriber.create({ email: s.email, confirmed: s.confirmed, token: crypto.randomBytes(24).toString('hex'), topics: s.topics.map((t) => id.get(t)).filter(Boolean), confirmedAt: s.confirmed ? at : null, createdAt: at });
            }
        }
    }
}

export default ContentSeeder;
export { dayKey };
