import mongoose from "mongoose";
import { STATUSES, KINDS, slugify } from "../shared/rules.js";

export const NEWS_STATUSES = STATUSES;

const counter = { impressions: { type: Number, default: 0 }, clicks: { type: Number, default: 0 } };

const newsSchema = new mongoose.Schema({
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: "Category", required: true },
    title: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    summary: { type: String, required: true },
    description: { type: String },
    image: { type: String },
    imageAlt: { type: String, default: "" },
    // draft -> submitted -> in_review -> (changes_requested) -> approved -> scheduled/published -> archived
    status: { type: String, enum: STATUSES, default: "draft" },
    kind: { type: String, enum: KINDS, default: "news" },
    tags: { type: [String], default: [] },
    sponsor: { type: String, default: "" },
    factCheck: { type: new mongoose.Schema({ claim: String, rating: String }, { _id: false }), default: undefined },
    embed: { type: new mongoose.Schema({ url: String, title: String }, { _id: false }), default: undefined },
    gallery: { type: [new mongoose.Schema({ src: String, alt: String, caption: String }, { _id: false })], default: [] },
    poll: {
        type: new mongoose.Schema({
            question: String,
            options: [new mongoose.Schema({ id: String, label: String }, { _id: false })],
            closesAt: Date,
        }, { _id: false }),
        default: undefined,
    },
    headlineB: { type: String, default: "" },
    abTest: {
        a: counter,
        b: counter,
        winner: { type: String, default: "" },
    },
    publishedAt: { type: Date, default: null },
    submittedAt: { type: Date, default: null },
    views: { type: Number, default: 0 },
    depth: { 25: { type: Number, default: 0 }, 50: { type: Number, default: 0 }, 75: { type: Number, default: 0 }, 100: { type: Number, default: 0 } },
    featured: { type: Boolean, default: false },
    breaking: { type: Boolean, default: false },
    author: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    assignedEditor: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    reviewNotes: [{
        by: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        byName: String,
        byRole: String,
        type: { type: String, enum: ["comment", "changes", "approval"], default: "comment" },
        body: String,
        at: { type: Date, default: Date.now },
    }],
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
});

const imgUrl = (file) => (file ? `${process.env.PUBLIC_URL}/users/${file}` : `${process.env.PUBLIC_URL}/icons/notfound.png`);

newsSchema.methods.toJSON = function () {
    const o = this.toObject();
    if (o.image && !/^(https?:|data:)/.test(o.image)) o.image = `${process.env.PUBLIC_URL}/news/${o.image}`;
    else if (!o.image) o.image = `${process.env.PUBLIC_URL}/icons/notfound.png`;
    if (o.author && o.author.name !== undefined) {
        o.author = { _id: o.author._id, name: o.author.name, bio: o.author.bio || "", role: o.author.role === "user" ? "reader" : o.author.role, image: imgUrl(o.author.image) };
    }
    if (o.assignedEditor && o.assignedEditor.name !== undefined) o.assignedEditor = { _id: o.assignedEditor._id, name: o.assignedEditor.name };
    if (o.poll && !o.poll.options) delete o.poll;
    return o;
};

newsSchema.pre("save", function () {
    this.slug = slugify(this.slug);
});

// Conditions that make an article visible on the site at `now`.
export function liveFilter(now = new Date()) {
    return {
        $or: [
            { status: "published" },
            { status: { $exists: false } },
            { status: "scheduled", publishedAt: { $lte: now } },
        ],
    };
}
// Live articles plus archived ones (the archive by date).
export function archiveFilter(now = new Date()) {
    return { $or: [...liveFilter(now).$or, { status: "archived" }] };
}

newsSchema.index({ views: -1 });
newsSchema.index({ publishedAt: -1 });
newsSchema.index({ status: 1, publishedAt: -1 });
newsSchema.index({ tags: 1 });

export default mongoose.model("News", newsSchema);
