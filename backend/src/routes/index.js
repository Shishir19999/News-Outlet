import express from 'express';
import newsRouter, { bindAll } from './newsRouter.js';
import categoryRouter from './categoryRouter.js';
import userRoute from './userRoute.js';
import loginRouter from './loginRouter.js';
import contactRoute from './contactRoute.js';
import commentRouter from './commentRouter.js';
import bookmarkRouter from './bookmarkRouter.js';
import newsletterRouter from './newsletterRouter.js';
import Auth from '../middleware/Auth.js';
import AuthController from '../controller/AuthController.js';
import SiteController from '../controller/SiteController.js';
import UserController from '../controller/UserController.js';
import NewsController from '../controller/NewsController.js';
import UploadMiddleware from '../middleware/UploadMiddleware.js';

const router = express.Router();
const site = bindAll(new SiteController());
const users = new UserController();
const upload = new UploadMiddleware().upload('news');

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

router.get('/authors', users.authors);
router.get('/authors/:id', users.author);
router.get('/search/suggest', site.suggest);
router.get('/settings', site.settings);
router.put('/settings', Auth.check, Auth.can('alert'), site.updateSettings);
router.get('/audit', Auth.check, Auth.can('audit'), site.audit);
router.get('/stats', Auth.check, Auth.can('analytics'), site.stats);
router.get('/stats/me', Auth.check, Auth.can('stats.own'), site.statsMe);
router.post('/upload', Auth.check, Auth.can('upload'), upload.single('image'), new NewsController().upload);

// feeds, sitemap, robots and crawler-friendly share pages
router.get('/feed.xml', (req, res) => site.feed(req, res, 'rss'));
router.get('/atom.xml', (req, res) => site.feed(req, res, 'atom'));
router.get('/rss/:slug.xml', (req, res) => site.feed(req, res, 'rss'));
router.get('/atom/:slug.xml', (req, res) => site.feed(req, res, 'atom'));
router.get('/sitemap.xml', site.sitemap);
router.get('/robots.txt', site.robots);
router.get('/share/:slug', site.share);

export default router;
