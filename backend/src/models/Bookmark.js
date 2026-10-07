import mongoose from "mongoose";

const bookmarkSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    newsId: { type: mongoose.Schema.Types.ObjectId, ref: "News", required: true },
}, { timestamps: true, versionKey: false });

bookmarkSchema.index({ userId: 1, newsId: 1 }, { unique: true });

export default mongoose.model("Bookmark", bookmarkSchema);
