import express from 'express';
import NewsController from '../controller/NewsController.js';
import UploadMiddleware from '../middleware/UploadMiddleware.js';
import Auth from '../middleware/Auth.js';
const newsRouter = express.Router();

const nInstance = new NewsController();
const uI = new UploadMiddleware();
const upload = uI.upload('news');

// Specific routes first, then parameterised routes.
newsRouter.get('/', nInstance.index);
newsRouter.get('/news-details/:slug', nInstance.getNews);
newsRouter.post('/', Auth.check, upload.single('image'), nInstance.store);
newsRouter.get('/:id', nInstance.show);
newsRouter.put('/:id', Auth.check, Auth.admin, upload.single('image'), nInstance.update);
newsRouter.delete('/:id', Auth.check, Auth.admin, nInstance.destroy);

export default newsRouter;
