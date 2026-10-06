import TokenMiddleware from "../middleware/TokenMiddleware.js";
import User from "../models/User.js";
import fs from "fs";
import mongoose from "mongoose";


class UserController {

    async index(req, res) {
        try {
            let token = req.headers.authorization;
            let response =await TokenMiddleware.check(token);
            if(response){
               let role = response.pay_load.role;
                if(role === "admin"){
                    let id = response.pay_load._id;
                    let users = await User.find({ _id: { $ne: id } });
                    res.status(200).json(users);
                }else{
                    let user = await User.findById(response.pay_load._id);
                    let users = [];
                    users.push(user);
                    res.status(200).json(users);
                }
            }else{
                res.status(500).json({ message: "Token not valid" });
            }
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }

    async store(req, res) {
        try {
            let image = "";
            if (req.file) {
                image = req.file.filename;
            }
            let email = req.body.email;
            let user = await User.findOne({ email }).countDocuments();
            if (user > 0) {
                return res.status(409).json({ email: "User already exists" });
            } else {
                // never let public registration choose a role
                const { role, ...body } = req.body;
                await User.create({ ...body, image });
                res.status(201).json({ success: true, message: "User created successfully" });
            }
        } catch (error) {
            if (error.name === 'ValidationError') {
                return res.status(422).json({ message: error.message });
            }
            res.status(500).json({ message: error.message });
        }
    }

    async show(req, res) {
        try {
            const user = mongoose.Types.ObjectId.isValid(req.params.id) ? await User.findById(req.params.id) : null;
            if (!user) return res.status(404).json({ message: "User not found" });
            res.status(200).json(user);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }

    async update(req, res) {
        try {
            let id = req.params.id;
            let body = { ...req.body };
            // only admins may change roles; password is hashed only on save(), so go through it
            if (req.user.role !== 'admin') delete body.role;
            let user = await User.findById(id);
            if (!user) return res.status(404).json({ message: "User not found" });
            user.set(body);
            await user.save();
            res.status(200).json({ success: true, message: "User updated successfully" });

        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }

    async destroy(req, res) {
        try {
            let id = req.params.id;
            let user = await User.findById(id);
            if (!user) return res.status(404).json({ message: "User not found" });

            if (user.image) {
                let path = `./public/users/${user.image}`;
                if (fs.existsSync(path)) {
                    fs.unlinkSync(path);
                }
            }
            await User.findByIdAndDelete(id);
            res.status(200).json({ success: true, message: "User deleted successfully" });

        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }


    async uploadImage(req, res) {
        try {
            let id = req.params.id;
            let user = await User.findById(id);
            if (!user) return res.status(404).json({ message: "User not found" });
            if (user.image) {
                let path = `./public/users/${user.image}`;
                if (fs.existsSync(path)) {
                    fs.unlinkSync(path);
                }
            }
            if (!req.file) return res.status(400).json({ message: "Image file is required" });
            let image = req.file.filename;
            await User.findByIdAndUpdate(id, { image });
            res.status(200).json({ success: true, message: "Image uploaded successfully" });
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }

    async deleteProfile(req, res) {
        try {
            let id = req.params.id;
            let user = await User.findById(id);
            if (!user) return res.status(404).json({ message: "User not found" });
            if (user.image) {
                let path = `./public/users/${user.image}`;
                if (fs.existsSync(path)) {
                    fs.unlinkSync(path);
                }
            }
            await User.findByIdAndUpdate(id, { image: "" });
            res.status(200).json({ success: true, message: "Profile image deleted successfully" });
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }

    async getProfile(req, res) {
        try {
            let token = req.headers.authorization;
            let response =await TokenMiddleware.check(token);
            if(response){
                let id = response.pay_load._id;
                let user = await User.findById(id);
                res.status(200).json(user);
            }else{
                res.status(500).json({ message: "Token not valid" });
            }
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }

}

export default UserController;