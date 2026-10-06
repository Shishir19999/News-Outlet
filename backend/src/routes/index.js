import express from 'express';
import newsRouter from './newsRouter.js';
import categoryRouter from './categoryRouter.js';
import userRoute from './userRoute.js';
import loginRouter from './loginRouter.js';
import contactRoute from './contactRoute.js';
import Auth from '../middleware/Auth.js';
import AuthController from '../controller/AuthController.js';
const router = express.Router();





router.get('/', (req, res) => {
    res.send('Hello World!');
});
router.post('/logout', Auth.check, AuthController.logout);
router.use('/login', loginRouter);
router.use('/user', userRoute);
router.use('/category', categoryRouter);
router.use('/news', newsRouter);
router.use('/contact', contactRoute);

export default router;