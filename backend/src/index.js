import dotenv from 'dotenv';
import Connection from './config/Connection.js';
import app from './app.js';
import UserTableSeeder from './config/Seeder/UserTableSeeder.js';
import CategoryTableSeeder from './config/Seeder/CategoryTableSeeder.js';
import NewsTableSeeder from './config/Seeder/NewsTableSeeder.js';
import News from './models/News.js';
import { logMailStartupChecks } from './config/mail.js';

dotenv.config();
logMailStartupChecks();
try{
    await Connection.connect();
    await UserTableSeeder.run();
    await CategoryTableSeeder.run();
    if(await News.countDocuments() === 0){
        await NewsTableSeeder.run();
    }
}catch(error){
    console.log(error);
}
const mode = process.env.MODE;
const http =process.env.HTTP_S;
const port = process.env.PORT || 3000;

if(mode === 'development') {
    app.listen(port, () => {
        console.log(`Server is running on ${http}:${port}`);
    });
}else{
    app.listen(port, () => {
        console.log(`Server is running on ${http}:${port}`);
    });
}