import { Server } from "socket.io";

import PrivateChat from "../models/PrivateChat.js";
import Room from "../models/Room.js";

const roomUsers = new Map();
const privateChats = new Map();

let io;

const MAX_MESSAGE_LENGTH = 2000;
const PRIVATE_CHAT_MAX_PARTICIPANTS = 2;
const EMPTY_STATE_CLEANUP_DELAY = 60_000;

const createRoomState = () => ({
  users: new Map(),
  messages: [],
  typingUsers: new Map(),
});

const createPrivateState = () => ({
  users: new Map(),
  messages: [],
  vanishMode: false,
  typingUsers: new Map(),
});

const getRoomState = (roomId) => {
  if (!roomUsers.has(roomId)) {
    roomUsers.set(roomId, createRoomState());
  }

  return roomUsers.get(roomId);
};

const getPrivateState = (chatId) => {
  if (!privateChats.has(chatId)) {
    privateChats.set(chatId, createPrivateState());
  }

  return privateChats.get(chatId);
};

const serializeUsers = (users) =>
  Array.from(users.values()).map((user) => ({
    socketId: user.socketId,
    nickname: user.nickname,
    joinedAt: user.joinedAt,
  }));

const broadcastRoomMembers = (roomId) => {
  const state = roomUsers.get(roomId);

  if (!state || !io) {
    return;
  }

  const members = serializeUsers(state.users);

  io.to(roomId).emit("roomMembers", {
    members,
  });
};

const broadcastPrivateMembers = (chatId) => {
  const state = privateChats.get(chatId);

  if (!state || !io) {
    return;
  }

  const members = serializeUsers(state.users);

  io.to(chatId).emit("privateMembers", {
    members,
  });

  io.to(chatId).emit(
    "privateParticipantsUpdated",
    members
  );
};

const removeUserFromRoom = (socket) => {
  const roomId = socket.data.roomId;

  if (!roomId) {
    return;
  }

  const state = roomUsers.get(roomId);

  if (!state) {
    socket.data.roomId = null;
    return;
  }

  const user = state.users.get(socket.id);

  state.users.delete(socket.id);
  state.typingUsers.delete(socket.id);

  socket.leave(roomId);

  socket.data.roomId = null;

  broadcastRoomMembers(roomId);

  socket
    .to(roomId)
    .emit("roomUserStopTyping", {
      socketId: socket.id,
    });

  if (user?.nickname) {
    socket.to(roomId).emit("roomParticipantLeft", {
      nickname: user.nickname,
    });
  }

  /*
   * Temporary room socket state can disappear when empty.
   *
   * The MongoDB room itself is handled by the room
   * controller / expiry system.
   */
  if (state.users.size === 0) {
    setTimeout(() => {
      const currentState = roomUsers.get(roomId);

      if (
        currentState &&
        currentState.users.size === 0
      ) {
        roomUsers.delete(roomId);
      }
    }, EMPTY_STATE_CLEANUP_DELAY);
  }
};

const removeUserFromPrivateChat = (
  socket,
  clearVanishMessages = false
) => {
  const chatId = socket.data.privateChatId;

  if (!chatId) {
    return;
  }

  const state = privateChats.get(chatId);

  if (!state) {
    socket.data.privateChatId = null;
    return;
  }

  const user = state.users.get(socket.id);

  /*
   * IMPORTANT:
   *
   * Vanish Mode does NOT mean "delete every message".
   *
   * Only messages that were actually created while
   * Vanish Mode was ON receive isVanish=true.
   */
  if (clearVanishMessages && state.vanishMode) {
    state.messages = state.messages.filter(
      (message) => !message.isVanish
    );

    io.to(chatId).emit("privateVanishCleared");
    io.to(chatId).emit("privateMessagesCleared");
  }

  state.users.delete(socket.id);
  state.typingUsers.delete(socket.id);

  socket.leave(chatId);

  socket.data.privateChatId = null;

  broadcastPrivateMembers(chatId);

  if (user?.nickname) {
    socket
      .to(chatId)
      .emit("privateParticipantLeft", {
        nickname: user.nickname,
      });
  }

  socket
    .to(chatId)
    .emit("privateUserStopTyping", {
      socketId: socket.id,
    });

  /*
   * Private Chat itself is PERMANENT.
   *
   * We only remove the empty in-memory socket state
   * after a delay.
   *
   * The MongoDB PrivateChat record is NEVER deleted.
   */
  if (state.users.size === 0) {
    setTimeout(() => {
      const currentState = privateChats.get(chatId);

      if (
        currentState &&
        currentState.users.size === 0
      ) {
        privateChats.delete(chatId);
      }
    }, EMPTY_STATE_CLEANUP_DELAY);
  }
};

export const initializeSocket = (httpServer) => {
  const allowedOrigins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
    "http://localhost:3000",
    "https://drift.netlify.app",
  ];

  io = new Server(httpServer, {
    cors: {
      /*
       * Keep local development working on both
       * Vite 5173 and 5174.
       *
       * The fallback is intentionally not used.
       */
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
          return;
        }

        callback(
          new Error("Not allowed by CORS")
        );
      },

      credentials: true,
    },

    transports: ["websocket", "polling"],
  });

  io.on("connection", (socket) => {
    // ==================================================
    // TEMPORARY ROOM SYSTEM
    // ==================================================

    socket.on(
      "joinRoom",
      async (payload, ack) => {
        const callback =
          typeof ack === "function" ? ack : null;

        const {
          roomId,
          nickname,
          passkey,
        } = payload || {};

        const cleanRoomId = String(
          roomId || ""
        ).trim();

        const cleanNickname = String(
          nickname || ""
        )
          .trim()
          .slice(0, 24);

        if (!cleanRoomId || !cleanNickname) {
          const response = {
            success: false,
            message:
              "Room code and nickname are required.",
          };

          socket.emit("roomError", response);

          if (callback) {
            callback(response);
          }

          return;
        }

        /*
         * Verify the room still exists and has not expired.
         */
        let roomDoc;

        try {
          roomDoc = await Room.findOne({
            roomId: cleanRoomId,
          });

          if (!roomDoc) {
            const response = {
              success: false,
              message:
                "Room not found or has expired.",
            };

            socket.emit("roomError", response);

            if (callback) {
              callback(response);
            }

            return;
          }

          if (
            roomDoc.expiresAt &&
            new Date(roomDoc.expiresAt) < new Date()
          ) {
            const response = {
              success: false,
              message:
                "This temporary room has expired.",
            };

            socket.emit("roomError", response);

            if (callback) {
              callback(response);
            }

            return;
          }

          /*
           * Private rooms require their passkey.
           */
          if (
            roomDoc.type === "private" &&
            roomDoc.passkey &&
            String(passkey || "") !==
              String(roomDoc.passkey)
          ) {
            const response = {
              success: false,
              message: "Invalid room passkey.",
            };

            socket.emit("roomError", response);

            if (callback) {
              callback(response);
            }

            return;
          }
        } catch (error) {
          console.error(
            "joinRoom database error:",
            error
          );

          const response = {
            success: false,
            message:
              "Unable to verify the room.",
          };

          socket.emit("roomError", response);

          if (callback) {
            callback(response);
          }

          return;
        }

        /*
         * Leave previous room if the socket was
         * already inside another room.
         */
        if (
          socket.data.roomId &&
          socket.data.roomId !== cleanRoomId
        ) {
          removeUserFromRoom(socket);
        }

        const state = getRoomState(cleanRoomId);

        /*
         * Prevent the same socket from creating
         * duplicate membership.
         */
        if (!state.users.has(socket.id)) {
          state.users.set(socket.id, {
            socketId: socket.id,
            nickname: cleanNickname,
            joinedAt: new Date().toISOString(),
          });
        } else {
          state.users.get(socket.id).nickname =
            cleanNickname;
        }

        socket.data.roomId = cleanRoomId;
        socket.data.nickname = cleanNickname;

        socket.join(cleanRoomId);

        /*
         * Update activity.
         */
        try {
          await Room.updateOne(
            {
              roomId: cleanRoomId,
            },
            {
              $set: {
                lastActivityAt: new Date(),
              },
            }
          );
        } catch (error) {
          console.error(
            "Room activity update error:",
            error
          );
        }

        socket.emit("roomMessages", {
          messages: state.messages,
        });

        broadcastRoomMembers(cleanRoomId);

        socket
          .to(cleanRoomId)
          .emit("roomParticipantJoined", {
            nickname: cleanNickname,
          });

        const response = {
          success: true,
          roomId: cleanRoomId,
          messages: state.messages,
          participants: serializeUsers(
            state.users
          ),
        };

        if (callback) {
          callback(response);
        }
      }
    );

    socket.on(
      "sendMessage",
      (payload, ack) => {
        const callback =
          typeof ack === "function" ? ack : null;

        const {
          roomId,
          message,
          nickname,
        } = payload || {};

        const cleanRoomId = String(
          roomId || socket.data.roomId || ""
        ).trim();

        const cleanText = String(
          message || ""
        ).trim();

        if (!cleanRoomId || !cleanText) {
          if (callback) {
            callback({
              success: false,
              message:
                "Message cannot be empty.",
            });
          }

          return;
        }

        if (
          cleanText.length >
          MAX_MESSAGE_LENGTH
        ) {
          if (callback) {
            callback({
              success: false,
              message:
                "Message is too long.",
            });
          }

          return;
        }

        const state =
          roomUsers.get(cleanRoomId);

        if (!state) {
          if (callback) {
            callback({
              success: false,
              message:
                "Room session not found.",
            });
          }

          return;
        }

        /*
         * Only allow the socket's actual room
         * membership to send messages.
         */
        if (
          !state.users.has(socket.id)
        ) {
          if (callback) {
            callback({
              success: false,
              message:
                "You are not in this room.",
            });
          }

          return;
        }

        const newMessage = {
          id: `${Date.now()}-${Math.random()
            .toString(36)
            .substring(2, 9)}`,

          message: cleanText,
          text: cleanText,

          nickname:
            nickname ||
            socket.data.nickname ||
            "Anonymous",

          socketId: socket.id,

          createdAt:
            new Date().toISOString(),
        };

        state.messages.push(newMessage);

        /*
         * Keep temporary in-memory history bounded.
         */
        if (state.messages.length > 500) {
          state.messages.shift();
        }

        state.typingUsers.delete(socket.id);

        io.to(cleanRoomId).emit(
          "newMessage",
          newMessage
        );

        io.to(cleanRoomId).emit(
          "roomUserStopTyping",
          {
            socketId: socket.id,
          }
        );

        if (callback) {
          callback({
            success: true,
            message: newMessage,
          });
        }
      }
    );

    socket.on(
      "roomTyping",
      ({ roomId } = {}) => {
        const cleanRoomId = String(
          roomId ||
            socket.data.roomId ||
            ""
        ).trim();

        if (!cleanRoomId) {
          return;
        }

        const state =
          roomUsers.get(cleanRoomId);

        if (!state) {
          return;
        }

        if (
          !state.users.has(socket.id)
        ) {
          return;
        }

        const typingNickname =
          socket.data.nickname ||
          "Someone";

        state.typingUsers.set(
          socket.id,
          typingNickname
        );

        socket
          .to(cleanRoomId)
          .emit("roomUserTyping", {
            socketId: socket.id,
            nickname: typingNickname,
          });
      }
    );

    socket.on(
      "roomStopTyping",
      ({ roomId } = {}) => {
        const cleanRoomId = String(
          roomId ||
            socket.data.roomId ||
            ""
        ).trim();

        if (!cleanRoomId) {
          return;
        }

        const state =
          roomUsers.get(cleanRoomId);

        if (!state) {
          return;
        }

        state.typingUsers.delete(
          socket.id
        );

        socket
          .to(cleanRoomId)
          .emit("roomUserStopTyping", {
            socketId: socket.id,
          });
      }
    );

    socket.on("leaveRoom", () => {
      removeUserFromRoom(socket);
    });

    // ==================================================
    // PRIVATE CHAT SYSTEM
    // ==================================================

    socket.on(
      "joinPrivateChat",
      async (payload, ack) => {
        const callback =
          typeof ack === "function" ? ack : null;

        const {
          chatId,
          nickname,
        } = payload || {};

        const cleanChatId = String(
          chatId || ""
        ).trim();

        const cleanNickname = String(
          nickname || ""
        )
          .trim()
          .slice(0, 24);

        if (
          !cleanChatId ||
          !cleanNickname
        ) {
          const response = {
            success: false,
            message:
              "Chat ID and nickname are required.",
          };

          socket.emit(
            "privateChatError",
            response
          );

          if (callback) {
            callback(response);
          }

          return;
        }

        /*
         * Private Chat records are permanent.
         *
         * We check MongoDB existence, but NEVER
         * expire/delete the record here.
         */
        try {
          const existingChat =
            await PrivateChat.findOne({
              chatId: cleanChatId,
            }).select("chatId status");

          if (!existingChat) {
            const response = {
              success: false,
              message:
                "Private chat not found.",
            };

            socket.emit(
              "privateChatError",
              response
            );

            if (callback) {
              callback(response);
            }

            return;
          }
        } catch (error) {
          console.error(
            "Database lookup error in joinPrivateChat:",
            error
          );

          const response = {
            success: false,
            message:
              "Unable to load private chat.",
          };

          socket.emit(
            "privateChatError",
            response
          );

          if (callback) {
            callback(response);
          }

          return;
        }

        /*
         * If socket is currently in another private
         * chat, leave that one first.
         */
        if (
          socket.data.privateChatId &&
          socket.data.privateChatId !==
            cleanChatId
        ) {
          removeUserFromPrivateChat(
            socket,
            false
          );
        }

        const state =
          getPrivateState(cleanChatId);

        const isAlreadyIn =
          state.users.has(socket.id);

        /*
         * Exactly two ACTIVE connections.
         *
         * Historical participants do not count.
         */
        if (
          !isAlreadyIn &&
          state.users.size >=
            PRIVATE_CHAT_MAX_PARTICIPANTS
        ) {
          const response = {
            success: false,
            message:
              "This private chat is already full.",
          };

          socket.emit(
            "privateChatFull",
            response
          );

          socket.emit(
            "privateChatError",
            response
          );

          if (callback) {
            callback(response);
          }

          return;
        }

        /*
         * Prevent duplicate nickname among currently
         * active participants.
         */
        const nicknameTaken =
          Array.from(
            state.users.values()
          ).some(
            (user) =>
              user.socketId !== socket.id &&
              user.nickname.toLowerCase() ===
                cleanNickname.toLowerCase()
          );

        if (nicknameTaken) {
          const response = {
            success: false,
            message:
              "That nickname is already in use.",
          };

          socket.emit(
            "privateChatError",
            response
          );

          if (callback) {
            callback(response);
          }

          return;
        }

        state.users.set(socket.id, {
          socketId: socket.id,
          nickname: cleanNickname,
          joinedAt: new Date().toISOString(),
        });

        socket.data.privateChatId =
          cleanChatId;

        socket.data.nickname =
          cleanNickname;

        socket.join(cleanChatId);

        /*
         * If another participant is present,
         * existing messages become seen.
         */
        if (state.users.size > 1) {
          state.messages.forEach(
            (message) => {
              message.seen = true;
            }
          );

          io.to(cleanChatId).emit(
            "privateMessagesSeen",
            {
              chatId: cleanChatId,
            }
          );
        }

        /*
         * Update persistent metadata only.
         * The PrivateChat record remains permanent.
         */
        try {
          await PrivateChat.updateOne(
            {
              chatId: cleanChatId,
            },
            {
              $set: {
                status:
                  state.users.size > 1
                    ? "active"
                    : "waiting",

                lastActivityAt:
                  new Date(),
              },
            }
          );
        } catch (error) {
          console.error(
            "Private chat activity update error:",
            error
          );
        }

        const serializedMembers =
          serializeUsers(state.users);

        /*
         * Send current history to the joining
         * participant.
         */
        socket.emit("privateMessages", {
          messages: state.messages,
        });

        socket.emit(
          "privateChatHistory",
          state.messages
        );

        socket.emit(
          "privateVanishMode",
          {
            enabled: state.vanishMode,
          }
        );

        broadcastPrivateMembers(
          cleanChatId
        );

        socket
          .to(cleanChatId)
          .emit(
            "privateParticipantJoined",
            {
              nickname: cleanNickname,
            }
          );

        const response = {
          success: true,
          messages: state.messages,
          participants:
            serializedMembers,
          vanishMode: state.vanishMode,
        };

        if (callback) {
          callback(response);
        }
      }
    );

    socket.on(
      "sendPrivateMessage",
      (payload, ack) => {
        const callback =
          typeof ack === "function" ? ack : null;

        const {
          chatId,
          message,
          text,
          nickname,
        } = payload || {};

        const cleanChatId = String(
          chatId ||
            socket.data.privateChatId ||
            ""
        ).trim();

        const content = String(
          text || message || ""
        ).trim();

        if (!cleanChatId || !content) {
          if (callback) {
            callback({
              success: false,
              message:
                "Invalid message payload.",
            });
          }

          return;
        }

        if (
          content.length >
          MAX_MESSAGE_LENGTH
        ) {
          if (callback) {
            callback({
              success: false,
              message:
                "Message is too long.",
            });
          }

          return;
        }

        const state =
          privateChats.get(cleanChatId);

        if (!state) {
          if (callback) {
            callback({
              success: false,
              message:
                "Private chat session not found.",
            });
          }

          return;
        }

        /*
         * The socket must actually be a current
         * participant.
         */
        if (
          !state.users.has(socket.id)
        ) {
          if (callback) {
            callback({
              success: false,
              message:
                "You are not in this private chat.",
            });
          }

          return;
        }

        const isOtherPresent =
          state.users.size > 1;

        /*
         * CRITICAL VANISH FIX:
         *
         * Only messages created while Vanish Mode
         * is ON are marked isVanish=true.
         *
         * Old messages are therefore preserved when
         * Vanish Mode later clears.
         */
        const newMessage = {
          id: `${Date.now()}-${Math.random()
            .toString(36)
            .substring(2, 9)}`,

          message: content,
          text: content,

          nickname:
            nickname ||
            socket.data.nickname ||
            "Anonymous",

          socketId: socket.id,

          createdAt:
            new Date().toISOString(),

          seen: isOtherPresent,

          isVanish: Boolean(
            state.vanishMode
          ),
        };

        state.messages.push(newMessage);

        /*
         * Keep memory bounded.
         */
        if (
          state.messages.length > 200
        ) {
          state.messages.shift();
        }

        state.typingUsers.delete(
          socket.id
        );

        io.to(cleanChatId).emit(
          "privateMessage",
          newMessage
        );

        io.to(cleanChatId).emit(
          "newPrivateMessage",
          newMessage
        );

        io.to(cleanChatId).emit(
          "privateUserStopTyping",
          {
            socketId: socket.id,
          }
        );

        /*
         * Update persistent last activity.
         */
        PrivateChat.updateOne(
          {
            chatId: cleanChatId,
          },
          {
            $set: {
              lastActivityAt:
                new Date(),
            },
          }
        ).catch((error) => {
          console.error(
            "Private chat message activity update error:",
            error
          );
        });

        if (callback) {
          callback({
            success: true,
            message: newMessage,
          });
        }
      }
    );

    // ==================================================
    // PRIVATE CHAT READ STATE
    // ==================================================

    socket.on(
      "markPrivateMessagesSeen",
      ({ chatId } = {}) => {
        const cleanChatId = String(
          chatId ||
            socket.data.privateChatId ||
            ""
        ).trim();

        const state =
          privateChats.get(cleanChatId);

        if (!state) {
          return;
        }

        if (
          !state.users.has(socket.id)
        ) {
          return;
        }

        let changed = false;

        state.messages.forEach(
          (message) => {
            if (!message.seen) {
              message.seen = true;
              changed = true;
            }
          }
        );

        if (changed) {
          io.to(cleanChatId).emit(
            "privateMessagesSeen",
            {
              chatId: cleanChatId,
            }
          );
        }
      }
    );

    // ==================================================
    // PRIVATE CHAT TYPING
    // ==================================================

    socket.on(
      "privateTyping",
      ({ chatId } = {}) => {
        const cleanChatId = String(
          chatId ||
            socket.data.privateChatId ||
            ""
        ).trim();

        if (!cleanChatId) {
          return;
        }

        const state =
          privateChats.get(cleanChatId);

        if (!state) {
          return;
        }

        if (
          !state.users.has(socket.id)
        ) {
          return;
        }

        const typingNickname =
          socket.data.nickname ||
          "Participant";

        state.typingUsers.set(
          socket.id,
          typingNickname
        );

        socket
          .to(cleanChatId)
          .emit(
            "privateUserTyping",
            {
              socketId: socket.id,
              nickname:
                typingNickname,
            }
          );
      }
    );

    socket.on(
      "privateStopTyping",
      ({ chatId } = {}) => {
        const cleanChatId = String(
          chatId ||
            socket.data.privateChatId ||
            ""
        ).trim();

        if (!cleanChatId) {
          return;
        }

        const state =
          privateChats.get(cleanChatId);

        if (!state) {
          return;
        }

        state.typingUsers.delete(
          socket.id
        );

        socket
          .to(cleanChatId)
          .emit(
            "privateUserStopTyping",
            {
              socketId: socket.id,
            }
          );
      }
    );

    // ==================================================
    // VANISH MODE
    // ==================================================

    socket.on(
      "setPrivateVanishMode",
      (payload, ack) => {
        const callback =
          typeof ack === "function"
            ? ack
            : null;

        const {
          chatId,
          enabled,
        } = payload || {};

        const cleanChatId = String(
          chatId ||
            socket.data.privateChatId ||
            ""
        ).trim();

        const state =
          privateChats.get(cleanChatId);

        if (!state) {
          if (callback) {
            callback({
              success: false,
              message:
                "Private chat not found.",
            });
          }

          return;
        }

        if (
          !state.users.has(socket.id)
        ) {
          if (callback) {
            callback({
              success: false,
              message:
                "You are not in this private chat.",
            });
          }

          return;
        }

        state.vanishMode =
          Boolean(enabled);

        /*
         * Changing Vanish Mode does NOT clear
         * existing messages.
         *
         * Existing messages keep their original
         * isVanish value.
         */
        io.to(cleanChatId).emit(
          "privateVanishMode",
          {
            enabled:
              state.vanishMode,
          }
        );

        if (callback) {
          callback({
            success: true,
            enabled:
              state.vanishMode,
          });
        }
      }
    );

    // ==================================================
    // LEAVE PRIVATE CHAT
    // ==================================================

    socket.on(
      "leavePrivateChat",
      (payload = {}) => {
        const {
          chatId,
          vanishMode,
        } = payload;

        const targetChatId =
          String(
            chatId ||
              socket.data.privateChatId ||
              ""
          ).trim();

        if (!targetChatId) {
          return;
        }

        const state =
          privateChats.get(targetChatId);

        /*
         * Clear Vanish messages only if:
         *
         * 1. caller says Vanish is active OR
         * 2. server state says Vanish is active.
         */
        const shouldClear =
          Boolean(
            vanishMode ||
              (state &&
                state.vanishMode)
          );

        removeUserFromPrivateChat(
          socket,
          shouldClear
        );
      }
    );

    // ==================================================
    // DISCONNECT
    // ==================================================

    socket.on("disconnect", () => {
      removeUserFromRoom(socket);

      /*
       * A browser/network disconnect should behave
       * like leaving the private chat while Vanish
       * Mode is active.
       *
       * This means temporary messages disappear,
       * while normal messages remain.
       */
      const chatId =
        socket.data.privateChatId;

      if (chatId) {
        const state =
          privateChats.get(chatId);

        removeUserFromPrivateChat(
          socket,
          Boolean(state?.vanishMode)
        );
      }
    });
  });

  return io;
};

export const getIO = () => io;