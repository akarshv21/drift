import express from "express";

import {
  createPrivateChat,
  getPrivateChat,
  deletePrivateChat,
} from "../controllers/privateChat.controller.js";

const router = express.Router();

router.post("/", createPrivateChat);

router.get("/:chatId", getPrivateChat);

router.delete("/:chatId", deletePrivateChat);

export default router;