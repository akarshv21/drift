import crypto from "crypto";
import PrivateChat from "../models/PrivateChat.js";

const generateChatId = () => {
  return crypto.randomBytes(8).toString("base64url");
};

const sanitizeChat = (chat) => {
  if (!chat) return null;

  return {
    chatId: chat.chatId,
    status: chat.status,
    participantCount: chat.participants
      ? chat.participants.size
      : 0,
    createdAt: chat.createdAt,
    lastActivityAt: chat.lastActivityAt,
  };
};

export const createPrivateChat = async (req, res) => {
  try {
    let chatId;
    let exists = true;

    while (exists) {
      chatId = generateChatId();

      exists = await PrivateChat.exists({
        chatId,
      });
    }

    const chat = await PrivateChat.create({
      chatId,
      status: "waiting",
      participants: {},
      lastActivityAt: new Date(),
    });

    return res.status(201).json({
      success: true,
      chat: sanitizeChat(chat),
    });
  } catch (error) {
    console.error("Create private chat error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to create private chat.",
    });
  }
};

export const getPrivateChat = async (req, res) => {
  try {
    const { chatId } = req.params;

    if (!chatId) {
      return res.status(400).json({
        success: false,
        message: "Chat ID is required.",
      });
    }

    const chat = await PrivateChat.findOne({
      chatId,
    }).select(
      "chatId status createdAt lastActivityAt participants"
    );

    if (!chat) {
      return res.status(404).json({
        success: false,
        message: "Private chat not found or has expired.",
      });
    }

    return res.status(200).json({
      success: true,
      chat: sanitizeChat(chat),
    });
  } catch (error) {
    console.error("Get private chat error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to load private chat.",
    });
  }
};

export const deletePrivateChat = async (req, res) => {
  try {
    const { chatId } = req.params;

    if (!chatId) {
      return res.status(400).json({
        success: false,
        message: "Chat ID is required.",
      });
    }

    const result = await PrivateChat.deleteOne({
      chatId,
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Private chat not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Private chat deleted.",
    });
  } catch (error) {
    console.error("Delete private chat error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to delete private chat.",
    });
  }
};