import slugify from "slugify";
import Category from "../../models/Category.js";
import News from "../../models/News.js";

const topics = {
    Education: ["Universities open new scholarship programs", "Schools adopt project based learning", "National exam results announced"],
    Sports: ["Local team wins the regional final", "Marathon draws record runners", "Youth league season kicks off"],
    Weathers: ["Heavy rain expected over the weekend", "Cold wave grips the northern hills", "Monsoon arrives earlier than usual"],
    Books: ["Debut novel tops the bestseller list", "Annual book fair opens downtown", "Poetry collection wins literary prize"],
    Technology: ["New open source framework released", "City rolls out free public wifi", "Startup unveils low cost solar charger"]
};

class NewsTableSeeder {
    // Idempotent: items are keyed by slug and only created when missing.
    static async run() {
        for (const [catName, titles] of Object.entries(topics)) {
            const cat = await Category.findOne({ name: catName });
            if (!cat) continue;
            for (const title of titles) {
                const slug = slugify(title, { lower: true, strict: true });
                if (await News.exists({ slug })) continue;
                await News.create({
                    categoryId: cat._id,
                    title,
                    slug,
                    summary: `${title}. A short summary of the story for the demo data.`,
                    description: `${title}.\n\nThis is demo content created by the seeder so the listing, search and pagination can be exercised.`,
                    image: ""
                });
            }
        }
    }
}

export default NewsTableSeeder;
