import express from 'express';
import newsRouter from './newsRouter.js';
import categoryRouter from './categoryRouter.js';
import userRoute from './userRoute.js';
import loginRouter from './loginRouter.js';
const router = express.Router();





router.get('/', (req, res) => {
    res.send('Hello World!');
});
router.use('/login', loginRouter);
router.use('/user', userRoute);
router.use('/category', categoryRouter);
router.use('/news', newsRouter);

export default router;