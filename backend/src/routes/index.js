import express from 'express';
import newsRouter from './newsRouter.js';
import categoryRouter from './categoryRouter.js';
import userRoute from './userRoute.js';
import loginRouter from './loginRouter.js';
import contactRoute from './contactRoute.js';
import commentRouter from './commentRouter.js';
import bookmarkRouter from './bookmarkRouter.js';
import newsletterRouter from './newsletterRouter.js';
import Auth from '../middleware/Auth.js';
import AuthController from '../controller/AuthController.js';
import NewsController from '../controller/NewsController.js';
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
router.use('/comments', commentRouter);
router.use('/bookmarks', bookmarkRouter);
router.use('/newsletter', newsletterRouter);
router.get('/stats', Auth.check, Auth.admin, new NewsController().stats);

export default router;
