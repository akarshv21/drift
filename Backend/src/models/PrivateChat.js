import mongoose from "mongoose";

const privateChatSchema = new mongoose.Schema(
  {
    chatId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    status: {
      type: String,
      enum: ["waiting", "active"],
      default: "waiting",
      index: true,
    },

    participants: {
      type: Map,
      of: {
        nickname: {
          type: String,
          required: true,
          maxlength: 24,
        },
        joinedAt: {
          type: Date,
          default: Date.now,
        },
      },
      default: {},
    },

    createdAt: {
      type: Date,
      default: Date.now,
    },

    lastActivityAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    versionKey: false,
  }
);

const PrivateChat = mongoose.model(
  "PrivateChat",
  privateChatSchema
);

export default PrivateChat;