import News from '../models/News.js';

class NewsController{
    async index(req,res){
        try{
            let news = await News.find({});
            res.status(200).json(news);
        }catch(e){
            res.status(500).json({message: e.message});
        }
    }

    async show(req,res){
        try{
            let news = await News.findById(req.params.id);
            res.status(200).json(news);
        }catch(e){
            res.status(500).json({message: e.message});
        }
    }

    async store(req,res){
        try {
            let image = "";
            if (req.file) {
                image = req.file.filename;
            }
            let slug = req.body.slug;
            let nRes = await News.findOne({ slug }).countDocuments();
            if (nRes > 0) {
                return res.status(500).json({ email: "Slug already exists" });
            } else {
                await News.create({ ...req.body, image });
                res.status(201).json({ success: true, message: "News created successfully" });
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


    async update(req,res){
        res.send('Hello News Update World!');
    }

    async destroy(req,res){
        res.send('Hello News Destroy World!');
    }

}

export default NewsController;