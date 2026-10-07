import mongoose from "mongoose";

// One document per day (UTC, YYYY-MM-DD) and category with the number of article views.
const viewStatSchema = new mongoose.Schema({
    date: { type: String, required: true },
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: "Category", required: true },
    count: { type: Number, default: 0 },
}, { versionKey: false });

viewStatSchema.index({ date: 1, categoryId: 1 }, { unique: true });

export default mongoose.model("ViewStat", viewStatSchema);
