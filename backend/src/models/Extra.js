import mongoose from "mongoose";
const { Schema } = mongoose;
const oid = (ref, extra = {}) => ({ type: Schema.Types.ObjectId, ref, ...extra });

// Every saved version of an article (snapshot of its editable fields).
const revisionSchema = new Schema({
    newsId: oid("News", { required: true, index: true }),
    version: { type: Number, required: true },
    snapshot: { type: Schema.Types.Mixed, required: true },
    by: oid("User"),
    byName: String,
    note: { type: String, default: "" },
    createdAt: { type: Date, default: Date.now },
}, { versionKey: false });
export const Revision = mongoose.model("Revision", revisionSchema);

const auditSchema = new Schema({
    action: { type: String, required: true, index: true },
    by: oid("User"),
    byName: String,
    byRole: String,
    targetType: String,
    targetId: String,
    targetLabel: String,
    detail: { type: String, default: "" },
    at: { type: Date, default: Date.now, index: true },
}, { versionKey: false });
export const AuditLog = mongoose.model("AuditLog", auditSchema);

const settingsSchema = new Schema({
    key: { type: String, default: "site", unique: true },
    siteName: { type: String, default: "News Outlet" },
    tagline: { type: String, default: "Independent reporting on technology, business, science, sports, culture and the world." },
    commentsOpen: { type: Boolean, default: true },
    newsletterEnabled: { type: Boolean, default: true },
    registrationOpen: { type: Boolean, default: true },
    alert: {
        active: { type: Boolean, default: false },
        text: { type: String, default: "" },
        link: { type: String, default: "" },
        level: { type: String, default: "breaking" },
    },
}, { versionKey: false });
export const Settings = mongoose.model("Settings", settingsSchema);

const liveSchema = new Schema({
    newsId: oid("News", { required: true, index: true }),
    body: { type: String, required: true },
    important: { type: Boolean, default: false },
    pinned: { type: Boolean, default: false },
    by: oid("User"),
    byName: String,
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
}, { versionKey: false });
export const LiveUpdate = mongoose.model("LiveUpdate", liveSchema);

// One reaction and one poll vote per reader (signed-in user or anonymous client id).
const reactionSchema = new Schema({ newsId: oid("News", { required: true }), voter: { type: String, required: true }, type: { type: String, required: true } }, { versionKey: false });
reactionSchema.index({ newsId: 1, voter: 1 }, { unique: true });
export const Reaction = mongoose.model("Reaction", reactionSchema);

const pollVoteSchema = new Schema({ newsId: oid("News", { required: true }), voter: { type: String, required: true }, optionId: { type: String, required: true } }, { versionKey: false });
pollVoteSchema.index({ newsId: 1, voter: 1 }, { unique: true });
export const PollVote = mongoose.model("PollVote", pollVoteSchema);

// Views per article and day (feeds the trending score).
const articleViewSchema = new Schema({ date: { type: String, required: true }, newsId: oid("News", { required: true }), count: { type: Number, default: 0 } }, { versionKey: false });
articleViewSchema.index({ date: 1, newsId: 1 }, { unique: true });
export const ArticleView = mongoose.model("ArticleView", articleViewSchema);

// Site-wide numbers per day: views, traffic sources and how far readers scrolled.
const dayStatSchema = new Schema({
    date: { type: String, required: true, unique: true },
    views: { type: Number, default: 0 },
    sources: { type: Map, of: Number, default: {} },
    depth: { type: Map, of: Number, default: {} },
}, { versionKey: false });
export const DayStat = mongoose.model("DayStat", dayStatSchema);
