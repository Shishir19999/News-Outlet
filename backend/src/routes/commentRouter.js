import express from 'express';
import CommentController from '../controller/CommentController.js';
import Auth from '../middleware/Auth.js';

const commentRouter = express.Router();
const c = new CommentController();

commentRouter.get('/', c.index);
commentRouter.post('/', Auth.optional, c.store);
commentRouter.get('/manage/list', Auth.check, Auth.admin, c.manage);
commentRouter.put('/:id', Auth.check, Auth.admin, c.update);
commentRouter.delete('/:id', Auth.check, Auth.admin, c.destroy);

export default commentRouter;
