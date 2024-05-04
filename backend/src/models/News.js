import mongoose from "mongoose";

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


export default mongoose.model("News", newsSchema);