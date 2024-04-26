import express from 'express';
import NewsController from '../controller/NewsController.js';
const newsRouter = express.Router();

const nInstance = new NewsController();

newsRouter.get('/', nInstance.index);
newsRouter.get('/:id', nInstance.show);
newsRouter.post('/', nInstance.store);
newsRouter.put('/:id', nInstance.update);
newsRouter.delete('/:id', nInstance.destroy);

export default newsRouter;

