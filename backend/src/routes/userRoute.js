import express from 'express';
import UserController from '../controller/UserController.js';
import UploadMiddleware from '../middleware/UploadMiddleware.js';

const userRoute = express.Router();
const uInstance = new UserController();
const uI = new UploadMiddleware();
const upload = uI.upload('users');
import Auth from '../middleware/Auth.js';

userRoute.get('/',Auth.check, uInstance.index);
userRoute.post('/',upload.single('image'), uInstance.store);
userRoute.get('/:id', uInstance.show);
userRoute.put('/:id',Auth.check, uInstance.update);
userRoute.delete('/:id',Auth.check, uInstance.destroy);
userRoute.get('/profile/user',Auth.check, uInstance.getProfile);
userRoute.put('/upload-profile/:id',Auth.check,upload.single('image'), uInstance.uploadImage);
userRoute.delete('/delete-profile/:id',Auth.check, uInstance.deleteProfile);
export default userRoute;