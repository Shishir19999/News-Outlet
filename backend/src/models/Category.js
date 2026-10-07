import mongoose from "mongoose";
import slugify from "slugify";

const categorySchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true,
    },
    description: {
        type: String,
    },
}, {timestamps: true});

categorySchema.virtual("slug").get(function () {
    return slugify(this.name || "", { lower: true, strict: true });
});
categorySchema.set("toJSON", { virtuals: true, versionKey: false, transform: (doc, ret) => { delete ret.id; return ret; } });

export default mongoose.model("Category", categorySchema);
