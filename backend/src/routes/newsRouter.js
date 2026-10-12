import express from 'express';
import NewsController from '../controller/NewsController.js';
import EditorialController from '../controller/EditorialController.js';
import UploadMiddleware from '../middleware/UploadMiddleware.js';
import Auth from '../middleware/Auth.js';

// Controller methods use `this`; bind them so they can be passed to the router directly.
export const bindAll = (obj) => {
    const out = {};
    for (const k of Object.getOwnPropertyNames(Object.getPrototypeOf(obj))) if (k !== 'constructor') out[k] = obj[k].bind(obj);
    return out;
};

const newsRouter = express.Router();
const n = bindAll(new NewsController());
const e = bindAll(new EditorialController());
const upload = new UploadMiddleware().upload('news');
const author = Auth.can('article.create');

// Specific routes first, then parameterised routes.
newsRouter.get('/', Auth.optional, n.index);
newsRouter.get('/trending', n.trending);
newsRouter.get('/for-you', n.forYou);
newsRouter.get('/breaking', n.breaking);
newsRouter.get('/archive', n.archive);
newsRouter.get('/manage/list', Auth.check, author, n.manage);
newsRouter.get('/news-details/:slug', Auth.optional, n.getNews);
newsRouter.post('/', Auth.check, author, upload.single('image'), n.store);
newsRouter.post('/ab/impressions', n.impressions);
newsRouter.post('/:id/view', n.view);
newsRouter.post('/:id/depth', n.depth);
newsRouter.get('/:id/engagement', Auth.optional, e.engagement);
newsRouter.put('/:id/reaction', Auth.optional, e.react);
newsRouter.post('/:id/poll/vote', Auth.optional, e.vote);
newsRouter.get('/:id/live', Auth.optional, e.liveList);
newsRouter.post('/:id/live', Auth.check, e.liveAdd);
newsRouter.put('/:id/live/:uid', Auth.check, e.liveEdit);
newsRouter.delete('/:id/live/:uid', Auth.check, e.liveDelete);
newsRouter.post('/:id/transition', Auth.check, author, e.transition);
newsRouter.post('/:id/notes', Auth.check, author, e.addNote);
newsRouter.put('/:id/assign', Auth.check, Auth.can('assign'), e.assign);
newsRouter.get('/:id/revisions', Auth.check, author, e.revisions);
newsRouter.post('/:id/revisions/:rid/restore', Auth.check, author, e.restore);
newsRouter.post('/:id/ab/winner', Auth.check, Auth.can('ab'), e.abWinner);
newsRouter.get('/:id', Auth.optional, n.show);
newsRouter.put('/:id', Auth.check, author, upload.single('image'), n.update);
newsRouter.delete('/:id', Auth.check, Auth.can('article.delete'), n.destroy);

export default newsRouter;
