// Idempotent seeder: `npm run seed`. Safe to run repeatedly (only creates what is missing).
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import UserTableSeeder from './config/Seeder/UserTableSeeder.js';
import CategoryTableSeeder from './config/Seeder/CategoryTableSeeder.js';
import NewsTableSeeder from './config/Seeder/NewsTableSeeder.js';

dotenv.config();
await mongoose.connect(process.env.MONGODB_URL);
await UserTableSeeder.run({ force: true });
await CategoryTableSeeder.run();
await NewsTableSeeder.run();
console.log('Seeded: users', await mongoose.model('User').countDocuments(),
    'categories', await mongoose.model('Category').countDocuments(),
    'news', await mongoose.model('News').countDocuments());
await mongoose.disconnect();
