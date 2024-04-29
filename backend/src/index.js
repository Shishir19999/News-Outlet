import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import Connection from './config/Connection.js';
import router from './routes/index.js';
import UserTableSeeder from './config/Seeder/UserTableSeeder.js';

dotenv.config();
Connection.connect();
UserTableSeeder.run();
const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static('public'));
app.use(router);
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
