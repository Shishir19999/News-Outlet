import mongoose from "mongoose";
import bcrypt from "bcrypt";
import dotenv from "dotenv";

dotenv.config();

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
    },
    email: {
        type: String,
        required: true,
        unique: true,
    },
    password: {
        type: String,
        required: true,
    },
    gender:{
        type: String,
        enum: ["male", "female"],
        required: true,

    },
    role:{
        type: String,
        enum: ["user", "admin"],
        default: "user",
    },
    image:{
        type: String,
    }

}, {
    timestamps: true,
    versionKey: false
});

userSchema.pre("save", async function(next){
    if(!this.isModified("password")){
        next();
    }
    this.password = await bcrypt.hash(this.password, 10);
});

userSchema.methods.checkPassword = async function(password){
    const result = await bcrypt.compare(password, this.password);
    return result;
}


userSchema.methods.toJSON = function(){
    const userObject = this.toObject();
    if(userObject.image){
        userObject.image = `${process.env.PUBLIC_URL}/users/${userObject.image}`;
    }else{
        userObject.image = `${process.env.PUBLIC_URL}/icons/notfound.png`;
    }
    delete userObject.password;
    return userObject;
}

export default mongoose.model("User", userSchema);