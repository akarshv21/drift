import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Clock,
  LogOut,
  MessageCircle,
  Send,
  Share2,
  Users,
  X,
} from "lucide-react";
import toast from "react-hot-toast";

import axiosInstance from "../lib/axios";
import useSocketStore from "../store/useSocketStore";
import {
  removeSavedConversation,
  saveConversation,
} from "../lib/conversationStorage";
import { getNicknameColor, getNicknameInitials } from "../lib/identityUtils";
import ShareCard from "../components/ShareCard";

const RoomPage = () => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const socket = useSocketStore((state) => state.socket);
  const connect = useSocketStore((state) => state.connect);

  const [nickname] = useState(
    () =>
      location.state?.nickname ||
      localStorage.getItem("drift_nickname") ||
      "Guest"
  );

  const [messages, setMessages] = useState([]);
  const [members, setMembers] = useState([]);
  const [message, setMessage] = useState("");

  const [showMembers, setShowMembers] = useState(false);
  const [showShare, setShowShare] = useState(false);

  const [roomDetails, setRoomDetails] = useState(null);
  const [typingUser, setTypingUser] = useState(null);
  const [isDriftingAway, setIsDriftingAway] = useState(false);
  const [error, setError] = useState("");

  const bottomRef = useRef(null);
  const typingTimerRef = useRef(null);

  const roomName = roomDetails?.name || location.state?.roomName || "Drift Room";
  const roomCode = roomId;
  const inviteLink = `${window.location.origin}/room/${roomCode}`;

  useEffect(() => {
    localStorage.setItem("drift_nickname", nickname);
  }, [nickname]);

  // Load room details & check expiry
  useEffect(() => {
    let active = true;
    axiosInstance
      .get(`/rooms/${roomId}`)
      .then((res) => {
        if (!active) return;
        if (res.data?.room) {
          setRoomDetails(res.data.room);
          saveConversation({
            id: roomId,
            roomId,
            code: roomId,
            name: res.data.room.name,
            type: res.data.room.type,
            nickname,
          });
        }
      })
      .catch((err) => {
        if (!active) return;
        setError(err.response?.data?.message || "Room not found or has expired.");
      });

    return () => {
      active = false;
    };
  }, [roomId, nickname]);

  useEffect(() => {
    const activeSocket = socket || connect();

    if (!activeSocket) return;

    const handleMessages = (payload) => {
      const list = Array.isArray(payload) ? payload : payload?.messages;
      setMessages(list || []);
    };

    const handleNewMessage = (newMessage) => {
      if (!newMessage?.id) return;
      setMessages((prev) => {
        if (prev.some((msg) => msg.id === newMessage.id)) {
          return prev;
        }
        return [...prev, newMessage];
      });
    };

    const handleMembers = (payload) => {
      const list = Array.isArray(payload) ? payload : payload?.members;
      setMembers(list || []);
    };

    const handleUserTyping = ({ nickname: typingNick, socketId }) => {
      if (socketId !== activeSocket.id) {
        setTypingUser(typingNick || "Someone");
      }
    };

    const handleUserStopTyping = ({ socketId }) => {
      if (socketId !== activeSocket.id) {
        setTypingUser(null);
      }
    };

    const handleRoomError = (err) => {
      if (err?.message) {
        setError(err.message);
      }
    };

    activeSocket.on("roomMessages", handleMessages);
    activeSocket.on("newMessage", handleNewMessage);
    activeSocket.on("roomMembers", handleMembers);
    activeSocket.on("roomUserTyping", handleUserTyping);
    activeSocket.on("roomUserStopTyping", handleUserStopTyping);
    activeSocket.on("roomError", handleRoomError);

    activeSocket.emit("joinRoom", {
      roomId,
      nickname,
    });

    return () => {
      activeSocket.off("roomMessages", handleMessages);
      activeSocket.off("newMessage", handleNewMessage);
      activeSocket.off("roomMembers", handleMembers);
      activeSocket.off("roomUserTyping", handleUserTyping);
      activeSocket.off("roomUserStopTyping", handleUserStopTyping);
      activeSocket.off("roomError", handleRoomError);
    };
  }, [roomId, nickname, socket, connect]);

  useEffect(() => {
    requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({
        behavior: "smooth",
      });
    });
  }, [messages]);

  const handleInputChange = (e) => {
    const val = e.target.value;
    setMessage(val);

    const activeSocket = socket || connect();
    if (!activeSocket) return;

    if (val.trim()) {
      activeSocket.emit("roomTyping", { roomId });
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => {
        activeSocket.emit("roomStopTyping", { roomId });
      }, 2500);
    } else {
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      activeSocket.emit("roomStopTyping", { roomId });
    }
  };

  const sendMessage = (event) => {
    event.preventDefault();

    const cleanMessage = message.trim();
    if (!cleanMessage) return;

    const activeSocket = socket || connect();
    if (!activeSocket) return;

    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    activeSocket.emit("roomStopTyping", { roomId });

    activeSocket.emit("sendMessage", {
      roomId,
      message: cleanMessage,
      nickname,
    });

    setMessage("");
  };

  const leaveRoom = () => {
    const activeSocket = socket || connect();

    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    if (activeSocket) {
      activeSocket.emit("roomStopTyping", { roomId });
      activeSocket.emit("leaveRoom");
    }

    removeSavedConversation(roomId, "room");

    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) {
      navigate("/conversations");
      return;
    }

    setIsDriftingAway(true);
    setTimeout(() => {
      navigate("/conversations");
    }, 280);
  };

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--bg)] px-4">
        <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-white p-8 text-center shadow-lg">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[#faf1f1] text-[var(--danger)]">
            <X size={22} />
          </div>
          <h2 className="mt-5 text-xl font-semibold tracking-[-0.03em]">Room Unavailable</h2>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">{error}</p>
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

  return (
    <div
      className={`min-h-screen bg-[var(--bg)] text-[var(--text)] transition-all duration-300 ${
        isDriftingAway ? "opacity-0 scale-[0.98] pointer-events-none" : "opacity-100 scale-100"
      }`}
    >
      <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--surface)]">
        <div className="mx-auto flex h-[72px] max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => navigate("/conversations")}
              className="drift-button drift-secondary !h-10 !min-h-10 !w-10 !p-0"
              title="Back"
            >
              <ArrowLeft size={18} />
            </button>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <MessageCircle size={17} />
                <h1 className="truncate text-[15px] font-semibold">
                  {roomName}
                </h1>
                {roomDetails?.expiryOption && roomDetails.expiryOption !== "never" && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[10px] font-medium text-[var(--text-secondary)]">
                    <Clock size={11} />
                    {roomDetails.expiryOption}
                  </span>
                )}
              </div>

              <p className="mt-0.5 truncate text-xs text-[var(--text-muted)]">
                {roomCode}
              </p>
            </div>
          </div>

          <div className="relative flex items-center gap-2">
            {/* MEMBERS */}
            <button
              type="button"
              onClick={() => {
                setShowMembers((prev) => !prev);
                setShowShare(false);
              }}
              className={`drift-button drift-secondary !h-10 !min-h-10 !px-3 ${
                showMembers ? "!bg-[var(--accent-soft)]" : ""
              }`}
              title="Members"
            >
              <Users size={17} />
              <span className="hidden sm:inline">Members</span>
              <span className="rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-xs">
                {members.length}
              </span>
            </button>

            {/* MEMBER PANEL */}
            {showMembers && (
              <div className="absolute right-0 top-12 z-50 w-[280px] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[0_18px_50px_rgba(0,0,0,.12)]">
                <div className="flex items-center justify-between border-b border-[var(--border-soft)] px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold">Members</p>
                    <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                      {members.length}{" "}
                      {members.length === 1 ? "person" : "people"} here
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowMembers(false)}
                    className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)]"
                  >
                    <X size={16} />
                  </button>
                </div>

                <div className="max-h-[320px] overflow-y-auto p-2">
                  {members.length === 0 ? (
                    <div className="px-3 py-8 text-center text-sm text-[var(--text-muted)]">
                      No members yet
                    </div>
                  ) : (
                    members.map((member) => {
                      const isYou =
                        member.socketId === socket?.id ||
                        member.nickname === nickname;
                      const style = getNicknameColor(member.nickname);

                      return (
                        <div
                          key={member.socketId || member.nickname}
                          className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-[var(--surface-soft)]"
                        >
                          <div
                            style={{ backgroundColor: style.bg, color: style.text }}
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold"
                          >
                            {getNicknameInitials(member.nickname)}
                          </div>

                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">
                              {member.nickname}
                            </p>
                            {isYou && (
                              <p className="text-xs text-[var(--text-muted)]">
                                You
                              </p>
                            )}
                          </div>

                          <span className="h-2 w-2 rounded-full bg-[var(--success)]" />
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* SHARE */}
            <button
              type="button"
              onClick={() => {
                setShowShare((prev) => !prev);
                setShowMembers(false);
              }}
              className="drift-button drift-secondary !h-10 !min-h-10 !w-10 !px-0 sm:!w-auto sm:!px-3"
              title="Share"
            >
              <Share2 size={17} />
              <span className="hidden sm:inline">Share</span>
            </button>

            {showShare && (
              <div className="absolute right-0 top-12 z-50">
                <ShareCard
                  code={roomCode}
                  link={inviteLink}
                  isPrivate={false}
                  onClose={() => setShowShare(false)}
                />
              </div>
            )}

            <button
              type="button"
              onClick={leaveRoom}
              className="drift-button !h-10 !min-h-10 !w-10 !px-0 !border-[#ead2d2] !bg-[#fff7f7] !text-[var(--danger)] sm:!w-auto sm:!px-3"
              title="Leave room"
            >
              <LogOut size={17} />
              <span className="hidden sm:inline">Leave</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto flex min-h-[calc(100vh-72px)] max-w-4xl flex-col px-4 py-4 sm:px-6">
        <div className="mb-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users size={16} />
            <span className="text-sm font-medium">
              {members.length} {members.length === 1 ? "member" : "members"} in this room
            </span>
          </div>

          {roomDetails?.expiryOption && roomDetails.expiryOption !== "never" && (
            <span className="text-xs text-[var(--text-muted)] flex items-center gap-1">
              <Clock size={12} />
              Expiry: {roomDetails.expiryOption}
            </span>
          )}
        </div>

        <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[24px] border border-[var(--border)] bg-[var(--surface)]">
          <div className="flex-1 overflow-y-auto p-4 sm:p-6">
            {messages.length === 0 ? (
              <div className="flex min-h-[55vh] items-center justify-center text-center">
                <div>
                  <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--accent-soft)]">
                    <MessageCircle size={20} />
                  </div>

                  <h2 className="text-base font-semibold">
                    Nothing here yet
                  </h2>

                  <p className="mt-1 text-sm text-[var(--text-muted)]">
                    Start the conversation.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((item) => {
                  const isYou =
                    item.socketId === socket?.id ||
                    item.nickname === nickname;
                  const textContent = item.message || item.text || "";
                  const style = getNicknameColor(item.nickname);

                  return (
                    <div
                      key={item.id}
                      className={`flex gap-2.5 ${
                        isYou ? "justify-end" : "justify-start"
                      }`}
                    >
                      {!isYou && (
                        <div
                          style={{ backgroundColor: style.bg, color: style.text }}
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold mt-1"
                        >
                          {getNicknameInitials(item.nickname)}
                        </div>
                      )}

                      <div className="max-w-[82%]">
                        {!isYou && (
                          <p className="mb-1 px-1 text-xs font-medium text-[var(--text-secondary)]">
                            {item.nickname}
                          </p>
                        )}

                        <div
                          className={`rounded-2xl px-4 py-2.5 text-sm leading-6 ${
                            isYou
                              ? "bg-[var(--accent)] text-white"
                              : "bg-[var(--surface-soft)] text-[var(--text)]"
                          }`}
                        >
                          {textContent}
                        </div>
                      </div>
                    </div>
                  );
                })}

                <div ref={bottomRef} />
              </div>
            )}
          </div>

          {/* TYPING INDICATOR */}
          {typingUser && (
            <div className="shrink-0 px-4 py-1.5 text-xs text-[var(--text-muted)] bg-[var(--surface-soft)] border-t border-[var(--border-soft)] italic flex items-center gap-2">
              <span className="h-2 w-2 animate-ping rounded-full bg-[var(--text-muted)]" />
              <span>{typingUser} is typing…</span>
            </div>
          )}

          <form
            onSubmit={sendMessage}
            className="border-t border-[var(--border)] p-3 sm:p-4"
          >
            <div className="flex items-end gap-2">
              <textarea
                value={message}
                onChange={handleInputChange}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    sendMessage(event);
                  }
                }}
                placeholder="Write a message..."
                rows={1}
                className="drift-input min-h-[46px] resize-none px-4 py-3 text-sm"
              />

              <button
                type="submit"
                disabled={!message.trim()}
                className="drift-button drift-primary !h-[46px] !min-h-[46px] !w-[46px] !p-0"
                title="Send"
              >
                <Send size={17} />
              </button>
            </div>
          </form>
        </section>
      </main>
    </div>
  );
};

export default RoomPage;