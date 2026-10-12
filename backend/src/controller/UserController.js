import fs from "fs";
import User from "../models/User.js";
import News, { liveFilter } from "../models/News.js";
import Category from "../models/Category.js";
import { ROLES, normalizeRole, isEmail } from "../shared/rules.js";
import { isId, str, getSettings, audit } from "../lib/helpers.js";

const removeFile = (name) => {
    if (!name) return;
    const p = `./public/users/${name}`;
    if (fs.existsSync(p)) fs.unlinkSync(p);
};
const adminCount = () => User.countDocuments({ role: "admin" });

class UserController {
    // Admins: every other user. Everyone else: only themselves.
    async index(req, res) {
        try {
            if (normalizeRole(req.user.role) === "admin") {
                return res.status(200).json(await User.find({ _id: { $ne: req.user._id } }).sort({ createdAt: -1 }));
            }
            res.status(200).json([await User.findById(req.user._id)]);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }

    // Public registration always creates a reader.
    async store(req, res) {
        try {
            const settings = await getSettings();
            if (!settings.registrationOpen) return res.status(403).json({ message: "Registration is closed at the moment" });
            const image = req.file ? req.file.filename : "";
            const email = str(req.body.email).toLowerCase();
            const name = str(req.body.name);
            if (!name || !email || !req.body.password) return res.status(422).json({ message: "name, email and password are required" });
            if (!isEmail(email)) return res.status(422).json({ message: "A valid email address is required" });
            if (String(req.body.password).length < 6) return res.status(422).json({ message: "The password needs at least 6 characters" });
            if (await User.exists({ email })) return res.status(409).json({ email: "User already exists" });
            await User.create({ name, email, password: req.body.password, gender: req.body.gender === "female" ? "female" : "male", role: "reader", image });
            res.status(201).json({ success: true, message: "User created successfully" });
        } catch (error) {
            if (error.name === "ValidationError") return res.status(422).json({ message: error.message });
            res.status(500).json({ message: error.message });
        }
    }

    async show(req, res) {
        try {
            const user = isId(req.params.id) ? await User.findById(req.params.id) : null;
            if (!user) return res.status(404).json({ message: "User not found" });
            res.status(200).json(user);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }

    // Profile fields for the owner; roles only for admins (the last admin cannot be demoted).
    async update(req, res) {
        try {
            const user = isId(req.params.id) ? await User.findById(req.params.id) : null;
            if (!user) return res.status(404).json({ message: "User not found" });
            const isAdmin = normalizeRole(req.user.role) === "admin";
            const body = {};
            if (req.body.name !== undefined) { body.name = str(req.body.name); if (!body.name) return res.status(422).json({ message: "Name is required" }); }
            if (req.body.email !== undefined) {
                body.email = str(req.body.email).toLowerCase();
                if (!isEmail(body.email)) return res.status(422).json({ message: "A valid email address is required" });
                if (await User.exists({ email: body.email, _id: { $ne: user._id } })) return res.status(409).json({ message: "That email is already used" });
            }
            if (req.body.gender === "male" || req.body.gender === "female") body.gender = req.body.gender;
            if (req.body.bio !== undefined) { body.bio = str(req.body.bio); if (body.bio.length > 300) return res.status(422).json({ message: "The bio can have at most 300 characters" }); }
            if (req.body.password) {
                if (String(req.body.password).length < 6) return res.status(422).json({ message: "The password needs at least 6 characters" });
                body.password = req.body.password;
            }
            let roleChanged = null;
            if (req.body.role !== undefined && isAdmin) {
                if (!ROLES.includes(req.body.role)) return res.status(422).json({ message: "Role must be reader, author, editor or admin" });
                if (normalizeRole(user.role) === "admin" && req.body.role !== "admin" && (await adminCount()) <= 1) {
                    return res.status(409).json({ message: "The last admin cannot be demoted" });
                }
                if (normalizeRole(user.role) !== req.body.role) roleChanged = req.body.role;
                body.role = req.body.role;
            }
            user.set(body);
            await user.save();
            if (roleChanged) {
                await User.updateOne({ _id: user._id }, { $inc: { tokenVersion: 1 } });
                await audit(req.user, "user.role", { targetType: "user", targetId: user._id, targetLabel: user.name, detail: `-> ${roleChanged}` });
            }
            res.status(200).json({ success: true, message: "User updated successfully" });
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }

    async destroy(req, res) {
        try {
            const user = isId(req.params.id) ? await User.findById(req.params.id) : null;
            if (!user) return res.status(404).json({ message: "User not found" });
            if (normalizeRole(user.role) === "admin" && (await adminCount()) <= 1) return res.status(409).json({ message: "The last admin cannot be deleted" });
            removeFile(user.image);
            await User.findByIdAndDelete(user._id);
            await audit(req.user, "user.delete", { targetType: "user", targetId: user._id, targetLabel: user.name });
            res.status(200).json({ success: true, message: "User deleted successfully" });
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }

    async uploadImage(req, res) {
        try {
            const user = isId(req.params.id) ? await User.findById(req.params.id) : null;
            if (!user) return res.status(404).json({ message: "User not found" });
            if (!req.file) return res.status(400).json({ message: "Image file is required" });
            removeFile(user.image);
            await User.findByIdAndUpdate(user._id, { image: req.file.filename });
            res.status(200).json({ success: true, message: "Image uploaded successfully" });
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }

    async deleteProfile(req, res) {
        try {
            const user = isId(req.params.id) ? await User.findById(req.params.id) : null;
            if (!user) return res.status(404).json({ message: "User not found" });
            removeFile(user.image);
            await User.findByIdAndUpdate(user._id, { image: "" });
            res.status(200).json({ success: true, message: "Profile image deleted successfully" });
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }

    async getProfile(req, res) {
        try {
            const user = await User.findById(req.user._id);
            if (!user) return res.status(404).json({ message: "User not found" });
            res.status(200).json(user);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }

    // Topics and authors the reader follows (feeds "For you").
    async setFollows(req, res) {
        try {
            const topics = (Array.isArray(req.body.topics) ? req.body.topics : []).filter(isId).slice(0, 50);
            const authors = (Array.isArray(req.body.authors) ? req.body.authors : []).filter(isId).slice(0, 100);
            const okTopics = (await Category.find({ _id: { $in: topics } }).select("_id")).map((c) => c._id);
            const okAuthors = (await User.find({ _id: { $in: authors } }).select("_id")).map((u) => u._id);
            await User.updateOne({ _id: req.user._id }, { follows: { topics: okTopics, authors: okAuthors } });
            res.status(200).json({ success: true, topics: okTopics.map(String), authors: okAuthors.map(String) });
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }

    // Public: people who have published, with article and follower counts.
    async authors(req, res) {
        try {
            const rows = await News.aggregate([{ $match: liveFilter() }, { $group: { _id: "$author", articles: { $sum: 1 }, views: { $sum: "$views" } } }]);
            const users = await User.find({ _id: { $in: rows.map((r) => r._id).filter(Boolean) } });
            const followers = await User.aggregate([{ $unwind: "$follows.authors" }, { $group: { _id: "$follows.authors", n: { $sum: 1 } } }]);
            const fmap = new Map(followers.map((f) => [String(f._id), f.n]));
            const stat = new Map(rows.map((r) => [String(r._id), r]));
            const out = users.map((u) => ({ _id: u._id, name: u.name, bio: u.bio, role: normalizeRole(u.role), image: u.toJSON().image, articles: stat.get(String(u._id)).articles, followers: fmap.get(String(u._id)) || 0 }));
            out.sort((a, b) => b.articles - a.articles);
            res.status(200).json(out);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }

    async author(req, res) {
        try {
            const u = isId(req.params.id) ? await User.findById(req.params.id) : null;
            if (!u || !roleAtLeastAuthor(u)) return res.status(404).json({ message: "Author not found" });
            const [articles, followers] = await Promise.all([News.countDocuments({ author: u._id, ...liveFilter() }), User.countDocuments({ "follows.authors": u._id })]);
            const j = u.toJSON();
            res.status(200).json({ _id: u._id, name: u.name, bio: u.bio, role: j.role, image: j.image, articles, followers, since: u.createdAt });
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }
}
const roleAtLeastAuthor = (u) => ["author", "editor", "admin"].includes(normalizeRole(u.role));

export default UserController;
