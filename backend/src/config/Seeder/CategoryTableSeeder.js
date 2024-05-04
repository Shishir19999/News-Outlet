import Category from "../../models/Category.js";

class CategoryTableSeeder{

    static async run(){
        let categoryData = [
            {
                name: "Education",
                description: "This is an education category"
            },
            {
                name: "Sports",
                description: "This is a sports category"
            },
            {
                name: "Weathers",
                description: "This is a weathers category"
            },
            {
                name: "Books",
                description: "This is a books category"
            }

        ];

        categoryData.forEach(async (cat) => {
            let findCat = await Category.findOne({name: cat.name});
            if(!findCat){
                let newCat = new Category(cat);
                await newCat.save();
            }
        })
    }


}

export default CategoryTableSeeder;