import { create } from "zustand";
import { io } from "socket.io-client";

const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL || "http://localhost:8000";

const useSocketStore = create((set, get) => ({
  socket: null,
  isConnected: false,

  connect: () => {
    const currentSocket = get().socket;

    if (currentSocket) {
      if (!currentSocket.connected) {
        currentSocket.connect();
      }

      return currentSocket;
    }

    const socket = io(SOCKET_URL, {
      withCredentials: true,
      transports: ["websocket", "polling"],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    socket.on("connect", () => {
      set({ isConnected: true });
    });

    socket.on("disconnect", () => {
      set({ isConnected: false });
    });

    socket.on("connect_error", () => {
      set({ isConnected: false });
    });

    set({
      socket,
      isConnected: socket.connected,
    });

    return socket;
  },

  disconnect: () => {
    const socket = get().socket;

    if (socket) {
      socket.removeAllListeners();
      socket.disconnect();
    }

    set({
      socket: null,
      isConnected: false,
    });
  },

  getSocket: () => get().socket,
}));

export default useSocketStore;