import express from 'express';
import UserController from '../controller/UserController.js';
import UploadMiddleware from '../middleware/UploadMiddleware.js';
import Auth from '../middleware/Auth.js';

const userRoute = express.Router();
const uInstance = new UserController();
const uI = new UploadMiddleware();
const upload = uI.upload('users');

// Specific routes first, then parameterised routes.
userRoute.get('/', Auth.check, uInstance.index);
userRoute.post('/', upload.single('image'), uInstance.store);
userRoute.get('/profile/user', Auth.check, uInstance.getProfile);
userRoute.put('/upload-profile/:id', Auth.check, Auth.adminOrSelf, upload.single('image'), uInstance.uploadImage);
userRoute.delete('/delete-profile/:id', Auth.check, Auth.adminOrSelf, uInstance.deleteProfile);
userRoute.get('/:id', Auth.check, uInstance.show);
userRoute.put('/:id', Auth.check, Auth.adminOrSelf, uInstance.update);
userRoute.delete('/:id', Auth.check, Auth.adminOrSelf, uInstance.destroy);
export default userRoute;
