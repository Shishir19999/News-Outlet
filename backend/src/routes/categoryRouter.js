import express from 'express';
import CategoryController from '../controller/CategoryController.js';
import Auth from '../middleware/Auth.js';

const categoryRouter = express.Router();
const cInstance = new CategoryController();

categoryRouter.get('/', cInstance.index);
categoryRouter.post('/',Auth.check, cInstance.store);
categoryRouter.get('/:id', cInstance.show);
categoryRouter.put('/:id',Auth.check, cInstance.update);
categoryRouter.delete('/:id',Auth.check, cInstance.destroy);
export default categoryRouter;