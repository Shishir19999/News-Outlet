import dotenv from 'dotenv';
import http from 'http';
import Connection from './config/Connection.js';
import app from './app.js';
import ContentSeeder from './config/Seeder/ContentSeeder.js';
import User from './models/User.js';
import News from './models/News.js';
import { logMailStartupChecks } from './config/mail.js';
import { attachRealtime } from './realtime.js';

dotenv.config();
logMailStartupChecks();
try{
    await Connection.connect();
    // Sample accounts only on an empty users collection; sample articles only when there is no news at all.
    if(await User.countDocuments() === 0 || await News.countDocuments() === 0){
        await ContentSeeder.run({ withUsers: await User.countDocuments() === 0 });
    }
}catch(error){
    console.log(error);
}
const port = process.env.PORT || 3000;
const server = http.createServer(app);
attachRealtime(server, { origin: process.env.SITE_URL || '*' });
server.listen(port, () => {
    console.log(`Server is running on ${process.env.HTTP_S}:${port}`);
});
