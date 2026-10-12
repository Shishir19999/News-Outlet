import express from 'express';
import NewsletterController from '../controller/NewsletterController.js';
import Auth from '../middleware/Auth.js';

const newsletterRouter = express.Router();
const n = new NewsletterController();

newsletterRouter.post('/', n.subscribe);
newsletterRouter.post('/confirm', n.confirm);
newsletterRouter.post('/unsubscribe', n.unsubscribe);
newsletterRouter.get('/preferences', n.preferences);
newsletterRouter.put('/preferences', n.preferences);
newsletterRouter.post('/send', Auth.check, Auth.can('newsletter'), n.send);
newsletterRouter.get('/', Auth.check, Auth.can('subscribers'), n.index);
newsletterRouter.delete('/:id', Auth.check, Auth.can('subscribers'), n.destroy);

export default newsletterRouter;
