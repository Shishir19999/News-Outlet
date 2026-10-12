import express from 'express';
import CommentController from '../controller/CommentController.js';
import Auth from '../middleware/Auth.js';

const commentRouter = express.Router();
const c = new CommentController();
const mod = Auth.can('comments.moderate');

commentRouter.get('/', c.index);
commentRouter.post('/', Auth.optional, c.store);
commentRouter.post('/:id/report', Auth.optional, c.report);
commentRouter.get('/manage/list', Auth.check, mod, c.manage);
commentRouter.put('/:id', Auth.check, mod, c.update);
commentRouter.delete('/:id', Auth.check, mod, c.destroy);

export default commentRouter;
