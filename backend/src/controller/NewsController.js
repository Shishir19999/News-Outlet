class NewsController{
    async index(req,res){
        res.send('Hello News World!');
    }

    async show(req,res){
        res.send('Hello News Show World!');
    }

    async store(req,res){
        res.send('Hello News Store World!');
    }


    async update(req,res){
        res.send('Hello News Update World!');
    }

    async destroy(req,res){
        res.send('Hello News Destroy World!');
    }

}

export default NewsController;