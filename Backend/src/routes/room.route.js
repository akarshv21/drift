import express from "express";

import {
  createRoom,
  getRoom,
  verifyRoom,
  deleteRoom,
} from "../controllers/room.controller.js";

const router = express.Router();

router.post("/", createRoom);

router.get("/:roomId", getRoom);

router.post("/:roomId/verify", verifyRoom);

router.delete("/:roomId", deleteRoom);

export default router;