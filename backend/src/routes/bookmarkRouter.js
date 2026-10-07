import express from 'express';
import BookmarkController from '../controller/BookmarkController.js';
import Auth from '../middleware/Auth.js';

const bookmarkRouter = express.Router();
const b = new BookmarkController();

bookmarkRouter.get('/', Auth.check, b.index);
bookmarkRouter.put('/:newsId', Auth.check, b.add);
bookmarkRouter.delete('/:newsId', Auth.check, b.remove);

export default bookmarkRouter;
