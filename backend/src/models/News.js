import mongoose from "mongoose";
import slugfy from "slugify";

export const NEWS_STATUSES = ["draft", "published", "scheduled"];

const newsSchema = new mongoose.Schema({
    categoryId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Category",
        required: true,
    },
    title: {
        type: String,
        required: true,
    },
    slug:{
        type: String,
        required: true,
        unique: true,
    },
    summary:{
        type: String,
        required: true,
    },
    description: {
        type: String,
    },
    image: {
        type: String,
    },
    // draft: hidden; published: live; scheduled: live once publishedAt has passed.
    status: {
        type: String,
        enum: NEWS_STATUSES,
        default: "published",
    },
    publishedAt: {
        type: Date,
        default: Date.now,
    },
    views: {
        type: Number,
        default: 0,
    },
    featured: {
        type: Boolean,
        default: false,
    },
    author: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
    },
    createdAt:{
        type: Date,
        default: Date.now,
    },
    updatedAt:{
        type: Date,
        default: Date.now
    }


});


newsSchema.methods.toJSON = function(){
    const obN = this.toObject();
    if(obN.image){
        obN.image = `${process.env.PUBLIC_URL}/news/${obN.image}`;
    }else{
        obN.image = `${process.env.PUBLIC_URL}/icons/notfound.png`;
    }
    return obN;
}

newsSchema.pre("save", function(){
    this.slug = slugfy(this.slug, { lower: true });
});

// Conditions that make an article visible to the public at `now`.
export function liveFilter(now = new Date()) {
    return {
        $or: [
            { status: { $nin: ["draft", "scheduled"] } },
            { status: "scheduled", publishedAt: { $lte: now } },
        ],
    };
}

newsSchema.index({ views: -1 });
newsSchema.index({ publishedAt: -1 });

export default mongoose.model("News", newsSchema);
