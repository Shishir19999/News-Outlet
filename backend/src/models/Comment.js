import mongoose from "mongoose";

export const COMMENT_STATUSES = ["pending", "approved", "rejected"];

const commentSchema = new mongoose.Schema({
    newsId: { type: mongoose.Schema.Types.ObjectId, ref: "News", required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    parentId: { type: mongoose.Schema.Types.ObjectId, ref: "Comment", default: null },
    name: { type: String, required: true },
    body: { type: String, required: true },
    status: { type: String, enum: COMMENT_STATUSES, default: "pending" },
    reports: { type: [{ voter: String, reason: String, at: { type: Date, default: Date.now }, _id: false }], default: [] },
}, { timestamps: true, versionKey: false });

export default mongoose.model("Comment", commentSchema);
