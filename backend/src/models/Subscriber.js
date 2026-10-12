import mongoose from "mongoose";

// Double opt-in: an address is "pending" until the link in the confirmation e-mail is opened.
const subscriberSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    confirmed: { type: Boolean, default: false },
    token: { type: String, index: true },
    topics: { type: [String], default: [] },
    confirmedAt: { type: Date, default: null },
    lastSentAt: { type: Date, default: null },
}, { timestamps: true, versionKey: false });

subscriberSchema.methods.toJSON = function () {
    const o = this.toObject();
    delete o.token;
    return o;
};

export default mongoose.model("Subscriber", subscriberSchema);
