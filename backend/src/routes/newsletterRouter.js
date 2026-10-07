import express from 'express';
import NewsletterController from '../controller/NewsletterController.js';
import Auth from '../middleware/Auth.js';

const newsletterRouter = express.Router();
const n = new NewsletterController();

newsletterRouter.post('/', n.subscribe);
newsletterRouter.get('/', Auth.check, Auth.admin, n.index);
newsletterRouter.delete('/:id', Auth.check, Auth.admin, n.destroy);

export default newsletterRouter;
