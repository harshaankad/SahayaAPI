import express from "express";
import { sendMail } from "../utils/mail";

const router = express.Router();

router.post("/sendMail", sendMail);

export default router;
