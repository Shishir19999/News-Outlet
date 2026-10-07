import mongoose from "mongoose";

export const COMMENT_STATUSES = ["pending", "approved", "rejected"];

const commentSchema = new mongoose.Schema({
    newsId: { type: mongoose.Schema.Types.ObjectId, ref: "News", required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    name: { type: String, required: true },
    body: { type: String, required: true },
    status: { type: String, enum: COMMENT_STATUSES, default: "pending" },
}, { timestamps: true, versionKey: false });

export default mongoose.model("Comment", commentSchema);
