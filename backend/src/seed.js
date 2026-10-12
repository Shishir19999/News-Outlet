// Idempotent seeder: `npm run seed`. Safe to run repeatedly (only creates what is missing).
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import ContentSeeder from './config/Seeder/ContentSeeder.js';

dotenv.config();
await mongoose.connect(process.env.MONGODB_URL);
await ContentSeeder.run({ withUsers: true });
console.log('Seeded: users', await mongoose.model('User').countDocuments(),
    'sections', await mongoose.model('Category').countDocuments(),
    'articles', await mongoose.model('News').countDocuments());
await mongoose.disconnect();
