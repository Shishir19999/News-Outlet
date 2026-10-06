import express from "express";
import ContactController from "../controller/ContactController.js";

const contactRoute = express.Router();
// Replaceable so tests can inject a stub mailer.
export const contactController = new ContactController();
const cInstance = contactController;


contactRoute.post('/', cInstance.index);

export default contactRoute;