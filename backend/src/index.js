import express from 'express';
import dotenv from 'dotenv';
import Connection from './config/Connection.js';
import router from './routes/index.js';

dotenv.config();
Connection.connect();
const app = express();
app.use(express.json());
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
