import TokenMiddleware from "../middleware/TokenMiddleware.js";
import User from "../models/User.js";
import fs from "fs";


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
            res.status(500).json({ message: error });
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
                return res.status(500).json({ email: "User already exists" });
            } else {
                await User.create({ ...req.body, image });
                res.status(201).json({ success: true, message: "User created successfully" });
            }
        } catch (error) {
            res.status(500).json({ message: error });
        }
    }

    async show(req, res) {
        try {
            const user = await User.findById(req.params.id);
            res.status(200).json(user);
        } catch (error) {
            res.status(500).json({ message: error });
        }
    }

    async update(req, res) {
        try {
            let id = req.params.id;
            await User.findByIdAndUpdate(id, { ...req.body });
            res.status(200).json({ success: true, message: "User updated successfully" });

        } catch (error) {
            res.status(500).json({ message: error });
        }
    }

    async destroy(req, res) {
        try {
            let id = req.params.id;
            let user = await User.findById(id);

            if (user.image) {
                let path = `./public/users/${user.image}`;
                if (fs.existsSync(path)) {
                    fs.unlinkSync(path);
                }
            }
            await User.findByIdAndDelete(id);
            res.status(200).json({ success: true, message: "User deleted successfully" });

        } catch (error) {
            res.status(500).json({ message: error });
        }
    }


    async uploadImage(req, res) {
        try {
            let id = req.params.id;
            let user = await User.findById(id);
            if (user.image) {
                let path = `./public/users/${user.image}`;
                if (fs.existsSync(path)) {
                    fs.unlinkSync(path);
                }
            }
            let image = req.file.filename;
            await User.findByIdAndUpdate(id, { image });
            res.status(200).json({ success: true, message: "Image uploaded successfully" });
        } catch (error) {
            res.status(500).json({ message: error });
        }
    }

    async deleteProfile(req, res) {
        try {
            let id = req.params.id;
            let user = await User.findById(id);
            if (user.image) {
                let path = `./public/users/${user.image}`;
                if (fs.existsSync(path)) {
                    fs.unlinkSync(path);
                }
            }
            await User.findByIdAndUpdate(id, { image: "" });
            res.status(200).json({ success: true, message: "Profile image deleted successfully" });
        } catch (error) {
            res.status(500).json({ message: error });
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
            res.status(500).json({ message: error });
        }
    }

}

export default UserController;