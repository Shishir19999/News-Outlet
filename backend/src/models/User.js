import mongoose from "mongoose";
import bcrypt from "bcrypt";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import { ROLES, normalizeRole } from "../shared/rules.js";
dotenv.config();

const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    gender: { type: String, enum: ["male", "female"], default: "male" },
    // reader < author < editor < admin ("user" is the legacy name of reader)
    role: { type: String, enum: [...ROLES, "user"], default: "reader" },
    image: { type: String },
    bio: { type: String, default: "", maxlength: 300 },
    // topics (sections) and authors this person follows; feeds the "For you" page
    follows: {
        topics: [{ type: mongoose.Schema.Types.ObjectId, ref: "Category" }],
        authors: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    },
    // Incremented on logout; tokens carrying an older value are rejected.
    tokenVersion: { type: Number, default: 0 },
}, { timestamps: true, versionKey: false });

userSchema.pre("save", async function () {
    if (!this.isModified("password")) return;
    this.password = await bcrypt.hash(this.password, 10);
});

userSchema.methods.checkPassword = async function (password) {
    return bcrypt.compare(password, this.password);
};

userSchema.methods.toJSON = function () {
    const o = this.toObject();
    o.image = o.image ? `${process.env.PUBLIC_URL}/users/${o.image}` : `${process.env.PUBLIC_URL}/icons/notfound.png`;
    o.role = normalizeRole(o.role);
    o.follows = { topics: (o.follows && o.follows.topics || []).map(String), authors: (o.follows && o.follows.authors || []).map(String) };
    delete o.password;
    delete o.tokenVersion;
    return o;
};

userSchema.methods.generateToken = function () {
    const exp_date = process.env.JWT_EXPIRE || "1d";
    const secret = process.env.JWT_SECRET || "fdsdffdseds45fsdfds34cret";
    const pay_load = { _id: this._id, role: normalizeRole(this.role), tokenVersion: this.tokenVersion || 0 };
    return jwt.sign({ pay_load }, secret, { expiresIn: exp_date });
};

export default mongoose.model("User", userSchema);
