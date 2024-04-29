import express from "express";
import AuthController from "../controller/AuthController.js"

const loginRouter = express.Router();


loginRouter.post("/", AuthController.login);
loginRouter.post('/toke-check',AuthController.tokenCheck);
export default loginRouter;