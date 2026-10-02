import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ArrowLeft,
  Check,
  CheckCheck,
  Eye,
  EyeOff,
  Link2,
  MoreHorizontal,
  Send,
  Users,
  X,
} from "lucide-react";
import {
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";
import toast from "react-hot-toast";
import axiosInstance from "../lib/axios";
import { saveConversation } from "../lib/conversationStorage";
import {
  getNicknameColor,
  getNicknameInitials,
} from "../lib/identityUtils";
import useSocketStore from "../store/useSocketStore";
import ShareCard from "../components/ShareCard";
const NICKNAME_KEY = "drift_private_nickname";
function PrivateChatPage() {
  const { chatId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const socket = useSocketStore((state) => state.socket);
  const connect = useSocketStore((state) => state.connect);
  const isConnected = useSocketStore((state) => state.isConnected);
  const cleanChatId = useMemo(
    () => String(chatId || "").trim(),
    [chatId]
  );
  const [nickname, setNickname] = useState(() => {
    return (
      location.state?.nickname ||
      localStorage.getItem(NICKNAME_KEY) ||
      ""
    );
  });
  const [messages, setMessages] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [input, setInput] = useState("");
  const [joined, setJoined] = useState(false);
  const [joining, setJoining] = useState(false);
  const [online, setOnline] = useState(false);
  const [vanishMode, setVanishMode] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [typingUser, setTypingUser] = useState(null);
  const [isDriftingAway, setIsDriftingAway] = useState(false);
  const [error, setError] = useState("");
  const [loadingChat, setLoadingChat] = useState(cleanChatId !== "new");
  const inputRef = useRef(null);
  const bottomRef = useRef(null);
  const typingTimerRef = useRef(null);
  const nicknameRef = useRef(nickname);
  const joinedRef = useRef(false);
  const joiningRef = useRef(false);
  useEffect(() => {
    nicknameRef.current = nickname;
  }, [nickname]);
  useEffect(() => {
    if (nickname) {
      localStorage.setItem(NICKNAME_KEY, nickname);
    }
  }, [nickname]);
  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({
        behavior: "smooth",
      });
    });
  }, []);
  const chatLink = useMemo(() => {
    if (!cleanChatId || cleanChatId === "new") {
      return "";
    }
    return `${window.location.origin}/private/${encodeURIComponent(
      cleanChatId
    )}`;
  }, [cleanChatId]);
  // ==========================================
  // CREATE NEW PRIVATE CHAT
  // ==========================================
  useEffect(() => {
    if (cleanChatId !== "new") {
      return;
    }
    let cancelled = false;
    const createChat = async () => {
      try {
        setError("");
        const response = await axiosInstance.post("/private-chats");
        if (cancelled) return;
        const newChatId = response?.data?.chat?.chatId;
        if (!newChatId) {
          setError("Unable to create private chat.");
          return;
        }
        saveConversation({
          id: newChatId,
          chatId: newChatId,
          name: "Private Chat",
          private: true,
          nickname: nicknameRef.current || "",
        });
        navigate(`/private/${encodeURIComponent(newChatId)}`, {
          replace: true,
          state: {
            nickname:
              location.state?.nickname ||
              nicknameRef.current ||
              "",
          },
        });
      } catch (requestError) {
        console.error("Create private chat error:", requestError);
        if (!cancelled) {
          setError("Unable to create private chat.");
        }
      }
    };
    createChat();
    return () => {
      cancelled = true;
    };
  }, [cleanChatId, navigate, location.state]);
  // ==========================================
  // CHECK PRIVATE CHAT EXISTENCE
  // ==========================================
  useEffect(() => {
    if (!cleanChatId || cleanChatId === "new") {
      return;
    }
    let cancelled = false;
    const loadChat = async () => {
      setLoadingChat(true);
      try {
        setError("");
        const response = await axiosInstance.get(
          `/private-chats/${encodeURIComponent(cleanChatId)}`
        );
        if (cancelled) return;
        if (!response?.data?.chat) {
          setError("Private chat not found.");
        } else {
          saveConversation({
            id: cleanChatId,
            chatId: cleanChatId,
            name: "Private Chat",
            private: true,
            nickname: nicknameRef.current || "",
          });
        }
      } catch (requestError) {
        if (cancelled) return;
        console.error("Private chat lookup error:", requestError);
        if (requestError?.response?.status === 404) {
          setError("Private chat not found.");
        } else {
          setError("Unable to load private chat.");
        }
      } finally {
        if (!cancelled) {
          setLoadingChat(false);
        }
      }
    };
    loadChat();
    return () => {
      cancelled = true;
    };
  }, [cleanChatId]);
  // ==========================================
  // ENSURE SOCKET CONNECTED
  // ==========================================
  useEffect(() => {
    if (cleanChatId && cleanChatId !== "new") {
      connect();
    }
  }, [cleanChatId, connect]);
  // ==========================================
  // JOIN PRIVATE CHAT
  // ==========================================
  const joinChat = useCallback(() => {
    const activeSocket = useSocketStore.getState().socket;
    if (
      !activeSocket ||
      !activeSocket.connected ||
      !cleanChatId ||
      cleanChatId === "new" ||
      !nicknameRef.current ||
      joiningRef.current ||
      joinedRef.current
    ) {
      return;
    }
    joiningRef.current = true;
    setJoining(true);
    setError("");
    activeSocket.emit(
      "joinPrivateChat",
      {
        chatId: cleanChatId,
        nickname: nicknameRef.current,
      },
      (response) => {
        joiningRef.current = false;
        setJoining(false);
        if (!response || response.success === false) {
          joinedRef.current = false;
          setJoined(false);
          setError(
            response?.message || "Unable to join private chat."
          );
          return;
        }
        joinedRef.current = true;
        setJoined(true);
        setOnline(true);
        setError("");
        if (Array.isArray(response.messages)) {
          setMessages(response.messages);
        }
        if (Array.isArray(response.participants)) {
          setParticipants(response.participants);
        }
        if (typeof response.vanishMode === "boolean") {
          setVanishMode(response.vanishMode);
        }
        saveConversation({
          id: cleanChatId,
          chatId: cleanChatId,
          name: "Private Chat",
          private: true,
          nickname: nicknameRef.current,
        });
        activeSocket.emit("markPrivateMessagesSeen", {
          chatId: cleanChatId,
        });
        setTimeout(() => {
          inputRef.current?.focus();
          scrollToBottom();
        }, 100);
      }
    );
  }, [cleanChatId, scrollToBottom]);
  useEffect(() => {
    if (
      cleanChatId &&
      cleanChatId !== "new" &&
      !loadingChat &&
      !error &&
      isConnected &&
      socket?.connected &&
      nickname
    ) {
      joinChat();
    }
  }, [
    cleanChatId,
    loadingChat,
    error,
    isConnected,
    socket,
    nickname,
    joinChat,
  ]);
  // ==========================================
  // SOCKET LISTENERS
  // ==========================================
  useEffect(() => {
    const activeSocket =
      socket || useSocketStore.getState().socket;
    if (
      !activeSocket ||
      !cleanChatId ||
      cleanChatId === "new"
    ) {
      return;
    }
    const handleConnect = () => {
      setOnline(true);
      joinedRef.current = false;
      joiningRef.current = false;
      setJoined(false);
      if (nicknameRef.current && !error) {
        setTimeout(() => {
          joinChat();
        }, 100);
      }
    };
    const handleDisconnect = () => {
      setOnline(false);
      joinedRef.current = false;
      joiningRef.current = false;
      setJoined(false);
      setParticipants([]);
      setTypingUser(null);
    };
    const handleMessages = (payload) => {
      const list = Array.isArray(payload)
        ? payload
        : payload?.messages;
      if (Array.isArray(list)) {
        setMessages(list);
        scrollToBottom();
      }
    };
    const handleMessage = (message) => {
      if (!message?.id) return;
      setMessages((current) => {
        if (current.some((item) => item.id === message.id)) {
          return current;
        }
        return [...current, message];
      });
      if (message.nickname !== nicknameRef.current) {
        activeSocket.emit("markPrivateMessagesSeen", {
          chatId: cleanChatId,
        });
      }
      scrollToBottom();
    };
    const handleParticipants = (payload) => {
      const list = Array.isArray(payload)
        ? payload
        : payload?.members;
      if (Array.isArray(list)) {
        setParticipants(list);
      }
    };
    const handleJoined = ({ nickname: joinedNickname } = {}) => {
      if (
        !joinedNickname ||
        joinedNickname === nicknameRef.current
      ) {
        return;
      }
      toast.success(`${joinedNickname} joined`);
    };
    const handleLeft = ({ nickname: leftNickname } = {}) => {
      if (
        !leftNickname ||
        leftNickname === nicknameRef.current
      ) {
        return;
      }
      toast(`${leftNickname} left chat`);
    };
    const handleVanishMode = ({ enabled } = {}) => {
      setVanishMode(Boolean(enabled));
    };
    // IMPORTANT:
    // Only remove messages that were created while
    // Vanish Mode was active.
    //
    // Do NOT clear the complete message list.
    // Do NOT touch conversationStorage.
    const handleVanishCleared = () => {
      setMessages((current) =>
        current.filter((message) => !message?.isVanish)
      );
      toast("Vanish Mode: temporary messages cleared");
    };
    const handleChatFull = (payload) => {
      joinedRef.current = false;
      joiningRef.current = false;
      setJoined(false);
      setJoining(false);
      setError(
        payload?.message ||
          "This private chat is already full."
      );
    };
    const handleError = (payload) => {
      if (payload?.message) {
        setError(payload.message);
      }
    };
    const handleUserTyping = ({
      nickname: typingNick,
      socketId,
    }) => {
      if (socketId !== activeSocket.id) {
        setTypingUser(typingNick || "Participant");
      }
    };
    const handleUserStopTyping = ({ socketId }) => {
      if (socketId !== activeSocket.id) {
        setTypingUser(null);
      }
    };
    const handleMessagesSeen = () => {
      setMessages((previous) =>
        previous.map((message) => ({
          ...message,
          seen: true,
        }))
      );
    };
    activeSocket.on("connect", handleConnect);
    activeSocket.on("disconnect", handleDisconnect);
    activeSocket.on("privateMessages", handleMessages);
    activeSocket.on("privateChatHistory", handleMessages);
    activeSocket.on("privateMessage", handleMessage);
    activeSocket.on("newPrivateMessage", handleMessage);
    activeSocket.on("privateMembers", handleParticipants);
    activeSocket.on(
      "privateParticipantsUpdated",
      handleParticipants
    );
    activeSocket.on(
      "privateParticipantJoined",
      handleJoined
    );
    activeSocket.on(
      "privateParticipantLeft",
      handleLeft
    );
    activeSocket.on(
      "privateVanishMode",
      handleVanishMode
    );
    activeSocket.on(
      "privateVanishCleared",
      handleVanishCleared
    );
    activeSocket.on(
      "privateMessagesCleared",
      handleVanishCleared
    );
    activeSocket.on("privateChatFull", handleChatFull);
    activeSocket.on("privateChatError", handleError);
    activeSocket.on(
      "privateUserTyping",
      handleUserTyping
    );
    activeSocket.on(
      "privateUserStopTyping",
      handleUserStopTyping
    );
    activeSocket.on(
      "privateMessagesSeen",
      handleMessagesSeen
    );
    return () => {
      activeSocket.off("connect", handleConnect);
      activeSocket.off("disconnect", handleDisconnect);
      activeSocket.off(
        "privateMessages",
        handleMessages
      );
      activeSocket.off(
        "privateChatHistory",
        handleMessages
      );
      activeSocket.off(
        "privateMessage",
        handleMessage
      );
      activeSocket.off(
        "newPrivateMessage",
        handleMessage
      );
      activeSocket.off(
        "privateMembers",
        handleParticipants
      );
      activeSocket.off(
        "privateParticipantsUpdated",
        handleParticipants
      );
      activeSocket.off(
        "privateParticipantJoined",
        handleJoined
      );
      activeSocket.off(
        "privateParticipantLeft",
        handleLeft
      );
      activeSocket.off(
        "privateVanishMode",
        handleVanishMode
      );
      activeSocket.off(
        "privateVanishCleared",
        handleVanishCleared
      );
      activeSocket.off(
        "privateMessagesCleared",
        handleVanishCleared
      );
      activeSocket.off(
        "privateChatFull",
        handleChatFull
      );
      activeSocket.off(
        "privateChatError",
        handleError
      );
      activeSocket.off(
        "privateUserTyping",
        handleUserTyping
      );
      activeSocket.off(
        "privateUserStopTyping",
        handleUserStopTyping
      );
      activeSocket.off(
        "privateMessagesSeen",
        handleMessagesSeen
      );
    };
  }, [
    socket,
    cleanChatId,
    joinChat,
    scrollToBottom,
    error,
  ]);
  // ==========================================
  // TYPING INDICATOR
  // ==========================================
  const handleInputChange = (event) => {
    const value = event.target.value;
    setInput(value);
    const activeSocket =
      socket || useSocketStore.getState().socket;
    if (!activeSocket || !joined) {
      return;
    }
    if (value.trim()) {
      activeSocket.emit("privateTyping", {
        chatId: cleanChatId,
      });
      if (typingTimerRef.current) {
        clearTimeout(typingTimerRef.current);
      }
      typingTimerRef.current = setTimeout(() => {
        activeSocket.emit("privateStopTyping", {
          chatId: cleanChatId,
        });
      }, 2500);
    } else {
      if (typingTimerRef.current) {
        clearTimeout(typingTimerRef.current);
      }
      activeSocket.emit("privateStopTyping", {
        chatId: cleanChatId,
      });
    }
  };
  // ==========================================
  // TOGGLE VANISH MODE
  // ==========================================
  const handleToggleVanish = () => {
    const activeSocket =
      socket || useSocketStore.getState().socket;
    if (!activeSocket || !joined) {
      return;
    }
    const next = !vanishMode;
    activeSocket.emit(
      "setPrivateVanishMode",
      {
        chatId: cleanChatId,
        enabled: next,
      },
      (response) => {
        if (response?.success === false) {
          toast.error(
            response.message ||
              "Unable to change Vanish Mode."
          );
          return;
        }
        setVanishMode(next);
        toast.success(
          next
            ? "Vanish Mode ON"
            : "Vanish Mode OFF"
        );
      }
    );
  };
  // ==========================================
  // SEND MESSAGE
  // ==========================================
  const handleSend = (event) => {
    event?.preventDefault();
    const text = input.trim();
    const activeSocket =
      socket || useSocketStore.getState().socket;
    if (!text || !activeSocket || !joined) {
      return;
    }
    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
    }
    activeSocket.emit("privateStopTyping", {
      chatId: cleanChatId,
    });
    activeSocket.emit(
      "sendPrivateMessage",
      {
        chatId: cleanChatId,
        text,
        message: text,
        nickname: nicknameRef.current,
      },
      (response) => {
        if (response?.success === false) {
          toast.error(
            response.message ||
              "Message could not be sent."
          );
        }
      }
    );
    setInput("");
    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  };
  // ==========================================
  // SET NICKNAME
  // ==========================================
  const handleSetNickname = (event) => {
    event.preventDefault();
    const clean = nickname.trim();
    if (!clean) {
      toast.error("Please enter a nickname.");
      return;
    }
    setNickname(clean);
    nicknameRef.current = clean;
    localStorage.setItem(NICKNAME_KEY, clean);
    if (
      socket?.connected &&
      cleanChatId &&
      !joinedRef.current
    ) {
      joinChat();
    }
  };
  // ==========================================
  // DRIFT AWAY
  // ==========================================
  const leaveChat = () => {
    const activeSocket =
      socket || useSocketStore.getState().socket;
    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
    }
    if (activeSocket && joined) {
      activeSocket.emit("privateStopTyping", {
        chatId: cleanChatId,
      });
      activeSocket.emit("leavePrivateChat", {
        chatId: cleanChatId,
        vanishMode,
      });
    }
    joinedRef.current = false;
    joiningRef.current = false;
    const prefersReduced =
      window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches;
    if (prefersReduced) {
      setJoined(false);
      navigate("/conversations");
      return;
    }
    setIsDriftingAway(true);
    setTimeout(() => {
      setJoined(false);
      navigate("/conversations");
    }, 280);
  };
  // ==========================================
  // LOADING STATES
  // ==========================================
  if (cleanChatId === "new") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--bg)]">
        <div className="text-center">
          <div className="mx-auto h-7 w-7 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--text)]" />
          <p className="mt-4 text-sm text-[var(--text-muted)]">
            Creating private chat...
          </p>
        </div>
      </main>
    );
  }
  if (loadingChat) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--bg)]">
        <div className="text-center">
          <div className="mx-auto h-7 w-7 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--text)]" />
          <p className="mt-4 text-sm text-[var(--text-muted)]">
            Loading private chat...
          </p>
        </div>
      </main>
    );
  }
  if (error && !joined) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--bg)] px-4">
        <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-white p-8 text-center shadow-lg">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[#faf1f1] text-[var(--danger)]">
            <X size={22} />
          </div>
          <h2 className="mt-5 text-xl font-semibold tracking-[-0.03em]">
            Chat unavailable
          </h2>
          <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
            {error}
          </p>
          <button
            type="button"
            onClick={() => navigate("/conversations")}
            className="drift-button drift-primary mt-6 w-full"
          >
            Back to conversations
          </button>
        </div>
      </main>
    );
  }
  if (!nickname && !joined) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--bg)] px-4">
        <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-white p-8 shadow-lg">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Private Chat
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em]">
            Enter your nickname
          </h2>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            You are joining chat code{" "}
            <span className="font-mono font-semibold">
              {cleanChatId}
            </span>
            .
          </p>
          <form
            onSubmit={handleSetNickname}
            className="mt-6 space-y-4"
          >
            <div>
              <label className="mb-2 block text-xs font-medium text-[var(--text-secondary)]">
                Nickname
              </label>
              <input
                type="text"
                value={nickname}
                onChange={(event) =>
                  setNickname(event.target.value)
                }
                placeholder="What should people call you?"
                maxLength={24}
                autoFocus
                className="drift-input h-12 px-4 text-sm"
              />
            </div>
            <button
              type="submit"
              className="drift-button drift-primary w-full min-h-12"
            >
              Join private chat
            </button>
          </form>
        </div>
      </main>
    );
  }
  return (
    <main
      className={`flex h-[100dvh] flex-col overflow-hidden bg-[var(--bg)] transition-all duration-300 ${
        isDriftingAway
          ? "opacity-0 scale-[0.98] pointer-events-none"
          : "opacity-100 scale-100"
      }`}
    >
      {/* HEADER */}
      <header className="shrink-0 border-b border-[var(--border-soft)] bg-white">
        <div className="mx-auto flex h-[70px] w-full max-w-5xl items-center gap-3 px-4 sm:px-6">
          <button
            type="button"
            onClick={leaveChat}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
            title="Leave chat"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-sm font-semibold">
                Private chat
              </h1>
              <span className="font-mono text-xs text-[var(--text-muted)]">
                ({cleanChatId})
              </span>
            </div>
            <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-[var(--text-muted)]">
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  online
                    ? "bg-[var(--success)]"
                    : "bg-[#c8c8c2]"
                }`}
              />
              <span>
                {online ? "Connected" : "Connecting..."}
              </span>
            </div>
          </div>
          {/* VANISH */}
          <button
            type="button"
            onClick={handleToggleVanish}
            disabled={!joined}
            className={`flex h-10 shrink-0 items-center gap-2 rounded-full border px-3 text-xs sm:text-sm font-medium transition ${
              vanishMode
                ? "border-[var(--text)] bg-[var(--accent)] text-white"
                : "border-[var(--border)] bg-white text-[var(--text)] hover:bg-[var(--surface-hover)]"
            } disabled:cursor-not-allowed disabled:opacity-50`}
            title="Toggle Vanish Mode"
          >
            {vanishMode ? (
              <EyeOff size={16} />
            ) : (
              <Eye size={16} />
            )}
            <span className="hidden sm:inline">
              {vanishMode
                ? "Vanish Mode ON"
                : "Vanish Mode"}
            </span>
            <span className="sm:hidden">
              {vanishMode ? "ON" : "Vanish"}
            </span>
          </button>
          {/* MEMBERS */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setShowMembers((value) => !value);
                setShowShare(false);
                setShowMenu(false);
              }}
              className={`flex h-10 items-center gap-2 rounded-full border px-3 text-sm transition ${
                showMembers
                  ? "border-[var(--text)] bg-[var(--accent-soft)]"
                  : "border-[var(--border)] bg-white hover:bg-[var(--surface-hover)]"
              }`}
            >
              <Users size={16} />
              <span>{participants.length}/2</span>
            </button>
            {showMembers && (
              <>
                <button
                  type="button"
                  className="fixed inset-0 z-30 cursor-default"
                  onClick={() => setShowMembers(false)}
                />
                <div className="absolute right-0 top-12 z-40 w-[280px] overflow-hidden rounded-2xl border border-[var(--border)] bg-white shadow-xl">
                  <div className="flex items-center justify-between border-b border-[var(--border-soft)] px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold">
                        Participants
                      </p>
                      <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                        {participants.length}/2 people connected
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowMembers(false)}
                      className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-[var(--surface-hover)]"
                    >
                      <X size={15} />
                    </button>
                  </div>
                  <div className="p-2">
                    {participants.length === 0 ? (
                      <p className="px-3 py-6 text-center text-xs text-[var(--text-muted)]">
                        No active participants.
                      </p>
                    ) : (
                      participants.map((participant) => {
                        const isYou =
                          participant.nickname === nickname ||
                          participant.socketId === socket?.id;
                        const style = getNicknameColor(
                          participant.nickname
                        );
                        return (
                          <div
                            key={
                              participant.socketId ||
                              participant.nickname
                            }
                            className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-[var(--surface-soft)]"
                          >
                            <div
                              style={{
                                backgroundColor: style.bg,
                                color: style.text,
                              }}
                              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
                            >
                              {getNicknameInitials(
                                participant.nickname
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium">
                                {participant.nickname}
                              </p>
                              <p className="text-[11px] text-[var(--text-muted)]">
                                {isYou
                                  ? "You"
                                  : "Participant"}
                              </p>
                            </div>
                            {isYou && (
                              <Check
                                size={15}
                                className="text-[var(--success)]"
                              />
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
          {/* SHARE */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setShowShare((value) => !value);
                setShowMembers(false);
                setShowMenu(false);
              }}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-white hover:bg-[var(--surface-hover)]"
              title="Share chat"
            >
              <Link2 size={17} />
            </button>
            {showShare && (
              <>
                <button
                  type="button"
                  className="fixed inset-0 z-30 cursor-default"
                  onClick={() => setShowShare(false)}
                />
                <div className="absolute right-0 top-12 z-40">
                  <ShareCard
                    code={cleanChatId}
                    link={chatLink}
                    isPrivate={true}
                    onClose={() => setShowShare(false)}
                  />
                </div>
              </>
            )}
          </div>
          {/* MENU */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setShowMenu((value) => !value);
                setShowShare(false);
                setShowMembers(false);
              }}
              className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-[var(--surface-hover)]"
            >
              <MoreHorizontal size={18} />
            </button>
            {showMenu && (
              <>
                <button
                  type="button"
                  className="fixed inset-0 z-30 cursor-default"
                  onClick={() => setShowMenu(false)}
                />
                <div className="absolute right-0 top-12 z-40 w-44 rounded-xl border border-[var(--border)] bg-white p-1.5 shadow-xl">
                  <button
                    type="button"
                    onClick={() => {
                      setShowMenu(false);
                      leaveChat();
                    }}
                    className="w-full rounded-lg px-3 py-2 text-left text-sm text-[var(--danger)] hover:bg-[#faf1f1]"
                  >
                    Leave chat
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>
      {/* VANISH BANNER */}
      {vanishMode && (
        <div className="shrink-0 border-b border-[var(--border-soft)] bg-[var(--accent-soft)] px-4 py-2.5 text-center">
          <span className="inline-flex items-center gap-2 text-xs font-medium">
            <EyeOff size={14} />
            Vanish Mode is ON · new messages disappear when a participant leaves
          </span>
        </div>
      )}
      {/* CHAT */}
      <section className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col px-3 py-3 sm:px-5 sm:py-5">
        <div className="drift-card flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-7 sm:py-7">
            {messages.length === 0 ? (
              <div className="flex min-h-full items-center justify-center">
                <div className="text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--accent-soft)]">
                    {vanishMode ? (
                      <EyeOff size={20} />
                    ) : (
                      <Users size={20} />
                    )}
                  </div>
                  <h2 className="mt-4 text-base font-semibold">
                    {joining
                      ? "Joining private chat..."
                      : "Start the private conversation."}
                  </h2>
                  <p className="mx-auto mt-2 max-w-xs text-sm text-[var(--text-muted)]">
                    {joining
                      ? "Connecting you to the chat."
                      : "Share the code or invite link with one person to start messaging."}
                  </p>
                </div>
              </div>
            ) : (
              <div className="mx-auto flex max-w-3xl flex-col gap-3">
                {messages.map((item) => {
                  const mine =
                    item.nickname === nickname ||
                    item.socketId === socket?.id;
                  const textContent =
                    item.text || item.message || "";
                  const style = getNicknameColor(
                    item.nickname
                  );
                  return (
                    <div
                      key={item.id}
                      className={`flex gap-2.5 ${
                        mine
                          ? "justify-end"
                          : "justify-start"
                      }`}
                    >
                      {!mine && (
                        <div
                          style={{
                            backgroundColor: style.bg,
                            color: style.text,
                          }}
                          className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
                        >
                          {getNicknameInitials(
                            item.nickname
                          )}
                        </div>
                      )}
                      <div
                        className={`max-w-[85%] sm:max-w-[70%] ${
                          mine ? "text-right" : ""
                        }`}
                      >
                        {!mine && (
                          <p className="mb-1 ml-1 text-[11px] font-medium text-[var(--text-muted)]">
                            {item.nickname}
                          </p>
                        )}
                        <div
                          className={`inline-block rounded-[18px] px-4 py-3 ${
                            mine
                              ? "rounded-br-[6px] bg-[var(--accent)] text-white"
                              : "rounded-bl-[6px] bg-[var(--surface-soft)] text-[var(--text)]"
                          }`}
                        >
                          <p className="whitespace-pre-wrap break-words text-sm leading-6">
                            {textContent}
                          </p>
                        </div>
                        <div
                          className={`mt-1 flex items-center gap-1 px-1 text-[10px] text-[var(--text-muted)] ${
                            mine
                              ? "justify-end"
                              : "justify-start"
                          }`}
                        >
                          <span>
                            {item.createdAt
                              ? new Date(
                                  item.createdAt
                                ).toLocaleTimeString(
                                  [],
                                  {
                                    hour: "numeric",
                                    minute: "2-digit",
                                  }
                                )
                              : ""}
                          </span>
                          {mine && (
                            <span className="inline-flex items-center">
                              {item.seen ? (
                                <span
                                  className="flex items-center gap-0.5 font-medium text-[var(--success)]"
                                  title="Seen"
                                >
                                  <CheckCheck size={13} />
                                  <span>Seen</span>
                                </span>
                              ) : (
                                <span
                                  className="flex items-center gap-0.5 text-[var(--text-muted)]"
                                  title="Sent"
                                >
                                  <Check size={12} />
                                  <span>Sent</span>
                                </span>
                              )}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>
            )}
          </div>
          {/* TYPING */}
          {typingUser && (
            <div className="flex shrink-0 items-center gap-2 border-t border-[var(--border-soft)] bg-[var(--surface-soft)] px-4 py-1.5 text-xs italic text-[var(--text-muted)]">
              <span className="h-2 w-2 animate-ping rounded-full bg-[var(--text-muted)]" />
              <span>{typingUser} is typing…</span>
            </div>
          )}
          {/* INPUT */}
          <div className="border-t border-[var(--border-soft)] bg-white p-3 sm:p-4">
            <form
              onSubmit={handleSend}
              className="mx-auto flex max-w-3xl items-end gap-2"
            >
              <textarea
                ref={inputRef}
                value={input}
                onChange={handleInputChange}
                onKeyDown={(event) => {
                  if (
                    event.key === "Enter" &&
                    !event.shiftKey
                  ) {
                    event.preventDefault();
                    handleSend(event);
                  }
                }}
                disabled={!joined || joining}
                rows={1}
                maxLength={2000}
                placeholder={
                  joining
                    ? "Joining private chat..."
                    : "Write a message..."
                }
                className="drift-input max-h-32 min-h-[46px] resize-none px-4 py-3 text-sm"
              />
              <button
                type="submit"
                disabled={
                  !joined ||
                  joining ||
                  !input.trim()
                }
                className="drift-button drift-primary h-[46px] w-[46px] shrink-0 p-0"
                title="Send message"
              >
                <Send size={17} />
              </button>
            </form>
          </div>
        </div>
      </section>
    </main>
  );
}
export default PrivateChatPage;