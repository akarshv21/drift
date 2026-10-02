import mongoose from "mongoose";

const roomSchema = new mongoose.Schema(
  {
    roomId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50,
    },

    type: {
      type: String,
      enum: ["public", "private"],
      default: "public",
      required: true,
    },

    passkey: {
      type: String,
      default: null,
      maxlength: 64,
    },

    expiryOption: {
      type: String,
      enum: ["never", "1h", "24h", "7d"],
      default: "never",
    },

    expiresAt: {
      type: Date,
      default: null,
    },

    participants: {
      type: Map,
      of: {
        nickname: {
          type: String,
          required: true,
          maxlength: 24,
        },
        socketId: {
          type: String,
          default: null,
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

const Room = mongoose.model("Room", roomSchema);

export default Room;