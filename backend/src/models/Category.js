import mongoose from "mongoose";
import { slugify } from "../shared/rules.js";

const categorySchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    description: { type: String },
    order: { type: Number, default: 100 },
}, { timestamps: true });

categorySchema.virtual("slug").get(function () {
    return slugify(this.name || "");
});
categorySchema.set("toJSON", { virtuals: true, versionKey: false, transform: (doc, ret) => { delete ret.id; return ret; } });

export default mongoose.model("Category", categorySchema);
