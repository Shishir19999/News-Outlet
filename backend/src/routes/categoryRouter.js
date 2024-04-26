import express from 'express';

const categoryRouter = express.Router();

categoryRouter.get('/', (req, res) => {
    res.send('Category Router');
});

export default categoryRouter;