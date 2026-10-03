import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import http from "http";

import startRoomCleanup from "./lib/room.cleanup.js";
import privateChatRoutes from "./routes/privateChat.route.js";
import { connectDB } from "./lib/db.js";
import { initializeSocket } from "./lib/socket.js";
import roomRoutes from "./routes/room.route.js";

dotenv.config();

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 8000;

const allowedOrigins = [
   "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:5174",
  "http://127.0.0.1:5174",
   "https://drift-talk.vercel.app",
  
];

app.set("trust proxy", 1);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests without an Origin header
      // such as server-to-server requests or local tools.
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      console.warn(`CORS blocked origin: ${origin}`);
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);

app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true }));

app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Drift API is running",
  });
});

app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    service: "drift-api",
    status: "healthy",
  });
});

app.use("/api/rooms", roomRoutes);
app.use("/api/private-chats", privateChatRoutes);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

app.use((error, req, res, next) => {
  console.error("Server error:", error);

  if (error.message === "Not allowed by CORS") {
    return res.status(403).json({
      success: false,
      message: "CORS origin not allowed",
    });
  }

  return res.status(500).json({
    success: false,
    message: "Internal server error",
  });
});

initializeSocket(server);

const startServer = async () => {
  try {
    await connectDB();

    startRoomCleanup();

    server.listen(PORT, () => {
      console.log(`Drift API running on port ${PORT}`);
      console.log(`Drift Socket.IO running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start Drift API:", error);
    process.exit(1);
  }
};

startServer();