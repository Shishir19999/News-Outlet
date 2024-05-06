import mongoose from "mongoose";
import slugfy from "slugify";

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

newsSchema.pre("save", function(next){
    this.slug = slugfy(this.slug, { lower: true });
    next();
});


export default mongoose.model("News", newsSchema);