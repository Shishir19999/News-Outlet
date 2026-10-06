import express from 'express';
import cors from 'cors';
import router from './routes/index.js';

// Express app without any DB connection or listener (used by index.js and the tests).
const app = express();
app.use(express.json());
// Express 5 leaves req.body undefined when no body is sent; keep the Express 4 behavior (empty object).
app.use((req, res, next) => { if (req.body === undefined) req.body = {}; next(); });
app.use(cors());
// redirect:false so static dirs (public/news, public/users) do not hijack the /news API route
app.use(express.static('public', { redirect: false }));
app.use(router);

export default app;
