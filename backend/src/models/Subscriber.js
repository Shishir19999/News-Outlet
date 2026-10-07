import mongoose from "mongoose";

// Newsletter signups are only stored; nothing is ever sent from this app.
const subscriberSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
}, { timestamps: true, versionKey: false });

export default mongoose.model("Subscriber", subscriberSchema);
