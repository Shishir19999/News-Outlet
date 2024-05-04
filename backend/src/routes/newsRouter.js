import express from 'express';
import NewsController from '../controller/NewsController.js';
import UploadMiddleware from '../middleware/UploadMiddleware.js';
import Auth from '../middleware/Auth.js';
const newsRouter = express.Router();

const nInstance = new NewsController();
const uI = new UploadMiddleware();
const upload = uI.upload('news');

newsRouter.get('/', nInstance.index);
newsRouter.get('/:id', nInstance.show);
newsRouter.post('/',upload.single('image'),Auth.check, nInstance.store);
newsRouter.put('/:id',Auth.check, nInstance.update);
newsRouter.delete('/:id',Auth.check, nInstance.destroy);

export default newsRouter;
