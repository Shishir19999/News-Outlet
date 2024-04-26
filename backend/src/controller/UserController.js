import User from "../models/User.js";
import fs from "fs";


class UserController{

    async index(req, res){
        try{
            const users = await User.find({});
            res.status(200).json(users);
        }catch(error){
            res.status(500).json({message: error});
        }
    }

    async store(req, res){
        try{
            let image ="";
            if(req.file){
                image = req.file.filename;
            }    
            await User.create({...req.body, image});
            res.status(201).json({success:true,message: "User created successfully"});

        }catch(error){
            res.status(500).json({message: error});
        }      
    }

    async show(req, res){
        try{
            const user = await User.findById(req.params.id);
            res.status(200).json(user);
        }catch(error){
            res.status(500).json({message: error});
        }
    }

    async update(req, res){
        try{
            let id = req.params.id;
            await User.findByIdAndUpdate(id, {...req.body});
            res.status(200).json({success:true,message: "User updated successfully"});
            
        }catch(error){
            res.status(500).json({message: error});
        }
    }

    async destroy(req, res){
        try{
            let id = req.params.id;
            let user = await User.findById(id);
            
            if(user.image){
                let path = `./public/users/${user.image}`;
                if(fs.existsSync(path)){
                    fs.unlinkSync(path);
                }
            }
            await User.findByIdAndDelete(id);
            res.status(200).json({success:true,message: "User deleted successfully"});

        }catch(error){
            res.status(500).json({message: error});
        }
    }


    async uploadImage(req, res){
        try{
            let id = req.params.id;
            let user = await User.findById(id);
            if(user.image){
                let path = `./public/users/${user.image}`;
                if(fs.existsSync(path)){
                    fs.unlinkSync(path);
                }
            }
            let image = req.file.filename;
            await User.findByIdAndUpdate(id, {image});
            res.status(200).json({success:true,message: "Image uploaded successfully"});
        }catch(error){
            res.status(500).json({message: error});
        }
    }

    async deleteProfile(req, res){
        try{
            let id = req.params.id;
            let user = await User.findById(id);
            if(user.image){
                let path = `./public/users/${user.image}`;
                if(fs.existsSync(path)){
                    fs.unlinkSync(path);
                }
            }
            await User.findByIdAndUpdate(id, {image:""});
            res.status(200).json({success:true,message: "Profile image deleted successfully"});
        }catch(error){
            res.status(500).json({message: error});
        }
    }
    

}

export default UserController;