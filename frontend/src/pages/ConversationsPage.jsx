import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  MessageCircle,
  MoreHorizontal,
  Plus,
  Search,
  Users,
  X,
} from "lucide-react";

import {
  getSavedConversations,
  removeSavedConversation,
} from "../lib/conversationStorage";
import { getNicknameColor, getNicknameInitials } from "../lib/identityUtils";

function formatTime(value) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const now = new Date();

  if (date.toDateString() === now.toDateString()) {
    return new Intl.DateTimeFormat(undefined, {
      hour: "numeric",
      minute: "2-digit",
    }).format(date);
  }

  const difference = now.getTime() - date.getTime();

  if (difference < 7 * 24 * 60 * 60 * 1000) {
    return new Intl.DateTimeFormat(undefined, {
      weekday: "short",
    }).format(date);
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(date);
}

function ConversationsPage() {
  const navigate = useNavigate();

  const [rooms, setRooms] = useState([]);
  const [query, setQuery] = useState("");
  const [menuId, setMenuId] = useState(null);

  const loadRooms = () => {
    setRooms(getSavedConversations());
  };

  useEffect(() => {
    loadRooms();

    const handleUpdate = () => {
      loadRooms();
    };

    window.addEventListener("drift:conversations-updated", handleUpdate);
    window.addEventListener("storage", handleUpdate);

    return () => {
      window.removeEventListener("drift:conversations-updated", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, []);

  const filteredRooms = useMemo(() => {
    const search = query.trim().toLowerCase();

    if (!search) {
      return rooms;
    }

    return rooms.filter((room) => {
      const name = String(room?.roomName || room?.name || "").toLowerCase();
      const id = String(room?.roomId || room?.chatId || room?.id || "").toLowerCase();

      return name.includes(search) || id.includes(search);
    });
  }, [rooms, query]);

  const handleOpenRoom = (room) => {
    const targetId = room.roomId || room.chatId || room.id;

    if (!targetId) {
      return;
    }

    setMenuId(null);

    if (room.private || room.type === "private" || room.chatId) {
      navigate(`/private/${targetId}`, {
        state: {
          nickname: room.nickname || "",
        },
      });

      return;
    }

    navigate(`/room/${targetId}`, {
      state: {
        nickname: room.nickname || "",
        roomCode: targetId,
        roomType: room.type || "public",
        roomName: room.roomName || room.name || "Drift room",
        passkey: room.passkey || "",
      },
    });
  };

  const handleRemove = (id, isPrivate) => {
    removeSavedConversation(id, isPrivate ? "private" : "room");

    setRooms(getSavedConversations());
    setMenuId(null);

    window.dispatchEvent(new Event("drift:conversations-updated"));
  };

  return (
    <main className="min-h-screen bg-[var(--bg)]">
      {/* Header */}
      <header className="border-b border-[var(--border-soft)] bg-[var(--bg)]">
        <div className="mx-auto flex min-h-[72px] max-w-6xl items-center justify-between px-5 sm:px-8">
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border)] bg-white transition hover:bg-[var(--surface-hover)]"
              aria-label="Back"
            >
              <ArrowLeft size={17} />
            </Link>

            <Link
              to="/"
              className="text-xl font-semibold tracking-[-0.05em]"
            >
              drift.
            </Link>
          </div>

          <div className="flex items-center gap-2">
            <Link
              to="/private/new"
              className="hidden drift-button drift-secondary min-h-10 px-4 sm:inline-flex"
            >
              <MessageCircle size={16} />
              Private chat
            </Link>

            <Link
              to="/room/create"
              className="drift-button drift-primary min-h-10 px-4"
            >
              <Plus size={16} />
              <span className="hidden sm:inline">New room</span>
              <span className="sm:hidden">New</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Page Content */}
      <section className="mx-auto max-w-6xl px-5 py-8 sm:px-8 sm:py-12">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
            Your Drift
          </p>

          <h1 className="mt-3 text-3xl font-semibold tracking-[-0.05em] sm:text-5xl">
            Conversations
          </h1>

          <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)] sm:text-base">
            Rooms and private chats you've kept. Reopen them whenever you need to.
          </p>
        </div>

        {/* Search */}
        <div className="mt-8 max-w-xl">
          <div className="relative">
            <Search
              size={17}
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
            />

            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search conversations..."
              className="drift-input h-12 pl-11 pr-11 text-sm"
            />

            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)]"
                aria-label="Clear search"
              >
                <X size={15} />
              </button>
            )}
          </div>
        </div>

        {/* Conversations List */}
        <div className="mt-10">
          {filteredRooms.length === 0 ? (
            <div className="drift-card flex min-h-[360px] items-center justify-center px-6">
              <div className="max-w-sm text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-[18px] bg-[var(--accent-soft)]">
                  <MessageCircle size={23} />
                </div>

                <h2 className="mt-5 text-xl font-semibold tracking-[-0.03em]">
                  {rooms.length === 0 ? "Nothing here yet." : "No matches."}
                </h2>

                <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                  {rooms.length === 0
                    ? "Create or join a room or private chat and it will appear here automatically."
                    : "Try a different name or chat code."}
                </p>

                {rooms.length === 0 && (
                  <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
                    <Link
                      to="/room/create"
                      className="drift-button drift-primary"
                    >
                      <Plus size={16} />
                      Create room
                    </Link>

                    <Link
                      to="/room/join"
                      className="drift-button drift-secondary"
                    >
                      Join room
                    </Link>

                    <Link
                      to="/private/new"
                      className="drift-button drift-secondary"
                    >
                      <MessageCircle size={16} />
                      Private chat
                    </Link>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredRooms.map((room) => {
                const targetId = room.roomId || room.chatId || room.id;
                const isPrivate = Boolean(
                  room.private || room.type === "private" || room.chatId
                );
                const title = room.roomName || room.name || (isPrivate ? "Private chat" : "Untitled room");
                const style = getNicknameColor(title);

                return (
                  <div
                    key={targetId}
                    className="group relative flex items-center gap-3 rounded-[20px] border border-[var(--border)] bg-white p-3 transition hover:border-[#d5d5d0] hover:shadow-[0_8px_28px_rgba(0,0,0,.04)] sm:p-4"
                  >
                    <button
                      type="button"
                      onClick={() => handleOpenRoom(room)}
                      className="flex min-w-0 flex-1 items-center gap-3 text-left"
                    >
                      <div
                        style={isPrivate ? {} : { backgroundColor: style.bg, color: style.text }}
                        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-[15px] text-sm font-semibold ${
                          isPrivate ? "bg-[var(--accent-soft)]" : ""
                        }`}
                      >
                        {isPrivate ? (
                          <MessageCircle size={19} />
                        ) : (
                          getNicknameInitials(title)
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h2 className="truncate text-sm font-semibold">
                            {title}
                          </h2>

                          {isPrivate && (
                            <span className="shrink-0 rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[10px] font-medium text-[var(--text-secondary)]">
                              Private
                            </span>
                          )}
                        </div>

                        <div className="mt-1 flex items-center gap-2 text-xs text-[var(--text-muted)]">
                          {isPrivate ? (
                            <>
                              <MessageCircle size={12} />
                              <span>Private conversation</span>
                            </>
                          ) : (
                            <>
                              <Users size={12} />
                              <span>Room {targetId}</span>
                            </>
                          )}

                          <span>·</span>

                          <span>
                            {formatTime(
                              room.lastActivityAt ||
                                room.lastMessageAt ||
                                room.savedAt
                            )}
                          </span>
                        </div>
                      </div>
                    </button>

                    <div className="relative shrink-0">
                      <button
                        type="button"
                        onClick={() =>
                          setMenuId((current) =>
                            current === targetId ? null : targetId
                          )
                        }
                        className="flex h-10 w-10 items-center justify-center rounded-full text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)]"
                        aria-label="Conversation options"
                      >
                        <MoreHorizontal size={18} />
                      </button>

                      {menuId === targetId && (
                        <>
                          <button
                            type="button"
                            className="fixed inset-0 z-20 cursor-default"
                            onClick={() => setMenuId(null)}
                            aria-label="Close menu"
                          />

                          <div className="absolute right-0 top-11 z-30 w-44 rounded-[14px] border border-[var(--border)] bg-white p-1.5 shadow-[0_15px_45px_rgba(0,0,0,.10)]">
                            <button
                              type="button"
                              onClick={() => handleRemove(targetId, isPrivate)}
                              className="flex w-full items-center rounded-[10px] px-3 py-2.5 text-left text-sm text-[var(--danger)] hover:bg-[#faf1f1]"
                            >
                              Remove conversation
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

export default ConversationsPage;