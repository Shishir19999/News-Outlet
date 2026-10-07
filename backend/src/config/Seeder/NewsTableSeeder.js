import slugify from "slugify";
import Category from "../../models/Category.js";
import News from "../../models/News.js";
import ViewStat from "../../models/ViewStat.js";

const topics = {
    Education: ["Universities open new scholarship programs", "Schools adopt project based learning", "National exam results announced"],
    Sports: ["Local team wins the regional final", "Marathon draws record runners", "Youth league season kicks off"],
    Weathers: ["Heavy rain expected over the weekend", "Cold wave grips the northern hills", "Monsoon arrives earlier than usual"],
    Books: ["Debut novel tops the bestseller list", "Annual book fair opens downtown", "Poetry collection wins literary prize"],
    Technology: ["New open source framework released", "City rolls out free public wifi", "Startup unveils low cost solar charger"]
};

const dayKey = (d) => d.toISOString().slice(0, 10);

class NewsTableSeeder {
    // Idempotent: items are keyed by slug and only created when missing.
    static async run() {
        let n = 0;
        for (const [catName, titles] of Object.entries(topics)) {
            const cat = await Category.findOne({ name: catName });
            if (!cat) continue;
            for (const title of titles) {
                n++;
                const slug = slugify(title, { lower: true, strict: true });
                if (await News.exists({ slug })) continue;
                const views = 40 + ((n * 37) % 260);
                await News.create({
                    categoryId: cat._id,
                    title,
                    slug,
                    summary: `${title}. Read the full story and the context behind it.`,
                    description: `## ${title}\n\nSample story used to try out the listing, search, categories and the reading view.\n\n- Edit or delete it from the admin panel\n- Write your own articles in Markdown\n\nReaders can comment, bookmark and share it.`,
                    image: "",
                    views,
                    featured: n === 1 || n === 8,
                    publishedAt: new Date(Date.now() - n * 3600 * 1000 * 7),
                });
                // spread the views over the last two weeks so the dashboard charts have data
                for (let d = 0; d < 14; d++) {
                    const date = dayKey(new Date(Date.now() - d * 86400000));
                    await ViewStat.updateOne({ date, categoryId: cat._id }, { $inc: { count: Math.round(views / 14) } }, { upsert: true });
                }
            }
        }
    }
}

export default NewsTableSeeder;
