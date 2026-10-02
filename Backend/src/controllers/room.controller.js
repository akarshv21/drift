import crypto from "crypto";
import Room from "../models/Room.js";

const generateRoomId = () => {
  return crypto.randomBytes(6).toString("base64url");
};

const hashPasskey = (passkey) => {
  return crypto.createHash("sha256").update(passkey).digest("hex");
};

const calculateExpiresAt = (expiryOption) => {
  const now = Date.now();

  switch (expiryOption) {
    case "1h":
      return new Date(now + 60 * 60 * 1000);

    case "24h":
      return new Date(now + 24 * 60 * 60 * 1000);

    case "7d":
      return new Date(now + 7 * 24 * 60 * 60 * 1000);

    case "never":
    default:
      return null;
  }
};

const createRoom = async (req, res) => {
  try {
    const {
      name,
      type = "public",
      passkey = "",
      expiryOption = "never",
    } = req.body;

    const cleanName = typeof name === "string" ? name.trim() : "";
    const cleanType = typeof type === "string" ? type.trim() : "public";
    const cleanPasskey = typeof passkey === "string" ? passkey.trim() : "";

    if (!cleanName) {
      return res.status(400).json({
        success: false,
        message: "Room name is required",
      });
    }

    if (cleanName.length > 50) {
      return res.status(400).json({
        success: false,
        message: "Room name must be 50 characters or less",
      });
    }

    if (!["public", "private"].includes(cleanType)) {
      return res.status(400).json({
        success: false,
        message: "Invalid room type",
      });
    }

    if (cleanType === "private" && cleanPasskey.length < 4) {
      return res.status(400).json({
        success: false,
        message: "Private rooms require a passkey of at least 4 characters",
      });
    }

    let roomId;
    let existingRoom;

    do {
      roomId = generateRoomId();
      existingRoom = await Room.findOne({ roomId });
    } while (existingRoom);

    const expiresAt = calculateExpiresAt(expiryOption);

    const room = await Room.create({
      roomId,
      name: cleanName,
      type: cleanType,
      passkey: cleanType === "private" ? hashPasskey(cleanPasskey) : null,
      expiryOption,
      expiresAt,
    });

    console.log(`[ROOM CREATED] ${room.roomId}`);

    return res.status(201).json({
      success: true,
      message: "Room created",
      room: {
        roomId: room.roomId,
        name: room.name,
        type: room.type,
        expiryOption: room.expiryOption,
        expiresAt: room.expiresAt,
      },
    });
  } catch (error) {
    console.error("Create room error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create room",
    });
  }
};

const getRoom = async (req, res) => {
  try {
    // IMPORTANT:
    // Do not alter the room code other than removing accidental whitespace.
    const roomId =
      typeof req.params.roomId === "string"
        ? req.params.roomId.trim()
        : "";

    console.log(`[ROOM LOOKUP] "${roomId}"`);

    if (!roomId) {
      return res.status(400).json({
        success: false,
        message: "Room ID is required",
      });
    }

    const room = await Room.findOne({ roomId }).select(
      "roomId name type createdAt lastActivityAt expiryOption expiresAt"
    );

    if (!room) {
      console.log(`[ROOM NOT FOUND] "${roomId}"`);

      return res.status(404).json({
        success: false,
        message: "Room not found or has expired",
      });
    }

    if (room.expiresAt && new Date(room.expiresAt).getTime() <= Date.now()) {
      await Room.deleteOne({ roomId });

      console.log(`[ROOM EXPIRED] "${roomId}"`);

      return res.status(404).json({
        success: false,
        message: "This temporary room has expired.",
      });
    }

    return res.status(200).json({
      success: true,
      room: {
        roomId: room.roomId,
        name: room.name,
        type: room.type,
        createdAt: room.createdAt,
        lastActivityAt: room.lastActivityAt,
        expiryOption: room.expiryOption,
        expiresAt: room.expiresAt,
      },
    });
  } catch (error) {
    console.error("Get room error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to get room",
    });
  }
};

const verifyRoom = async (req, res) => {
  try {
    const roomId =
      typeof req.params.roomId === "string"
        ? req.params.roomId.trim()
        : "";

    const passkey =
      typeof req.body?.passkey === "string"
        ? req.body.passkey.trim()
        : "";

    if (!roomId) {
      return res.status(400).json({
        success: false,
        message: "Room ID is required",
      });
    }

    const room = await Room.findOne({ roomId });

    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Room not found or has expired",
      });
    }

    if (room.expiresAt && new Date(room.expiresAt).getTime() <= Date.now()) {
      await Room.deleteOne({ roomId });

      return res.status(404).json({
        success: false,
        message: "This temporary room has expired.",
      });
    }

    if (room.type === "private") {
      if (!passkey) {
        return res.status(401).json({
          success: false,
          message: "Passkey is required",
        });
      }

      const hashedPasskey = hashPasskey(passkey);

      if (hashedPasskey !== room.passkey) {
        return res.status(401).json({
          success: false,
          message: "Incorrect passkey",
        });
      }
    }

    room.lastActivityAt = new Date();
    await room.save();

    return res.status(200).json({
      success: true,
      message: "Room verified",
      room: {
        roomId: room.roomId,
        name: room.name,
        type: room.type,
        expiryOption: room.expiryOption,
        expiresAt: room.expiresAt,
      },
    });
  } catch (error) {
    console.error("Verify room error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to verify room",
    });
  }
};

const deleteRoom = async (req, res) => {
  try {
    const roomId =
      typeof req.params.roomId === "string"
        ? req.params.roomId.trim()
        : "";

    const deletedRoom = await Room.findOneAndDelete({ roomId });

    if (!deletedRoom) {
      return res.status(404).json({
        success: false,
        message: "Room not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Room deleted",
    });
  } catch (error) {
    console.error("Delete room error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete room",
    });
  }
};

export {
  createRoom,
  getRoom,
  verifyRoom,
  deleteRoom,
};