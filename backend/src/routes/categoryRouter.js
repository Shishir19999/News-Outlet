import express from 'express';
import CategoryController from '../controller/CategoryController.js';
import Auth from '../middleware/Auth.js';

const categoryRouter = express.Router();
const cInstance = new CategoryController();

categoryRouter.get('/', cInstance.index);
categoryRouter.get('/menu', cInstance.menu);
categoryRouter.post('/',Auth.check, Auth.can('sections'), cInstance.store);
categoryRouter.get('/:id', cInstance.show);
categoryRouter.put('/:id',Auth.check, Auth.can('sections'), cInstance.update);
categoryRouter.delete('/:id',Auth.check, Auth.can('sections'), cInstance.destroy);
export default categoryRouter;
