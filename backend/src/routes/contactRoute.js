import express from "express";
import ContactController from "../controller/ContactController.js";

const contactRoute = express.Router();
const cInstance = new ContactController();


contactRoute.post('/', cInstance.index);

export default contactRoute;