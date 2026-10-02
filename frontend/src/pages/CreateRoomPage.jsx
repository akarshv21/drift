import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Globe,
  LockKeyhole,
} from "lucide-react";

import axiosInstance from "../lib/axios";

function CreateRoomPage() {
  const navigate = useNavigate();

  const [nickname, setNickname] = useState("");
  const [roomName, setRoomName] = useState("");
  const [roomType, setRoomType] = useState("public");
  const [expiryOption, setExpiryOption] = useState("never");

  const [error, setError] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    const cleanNickname = nickname.trim();
    const cleanRoomName = roomName.trim();

    if (!cleanNickname) {
      setError("Enter a nickname to continue.");
      return;
    }

    if (cleanNickname.length > 24) {
      setError("Nickname must be 24 characters or less.");
      return;
    }

    /*
     * ==========================================
     * PRIVATE CONVERSATION
     * ==========================================
     *
     * Private conversations are NOT rooms.
     * They use /private-chats and /private/:chatId.
     */
    if (roomType === "private") {
      setIsCreating(true);

      try {
        const response = await axiosInstance.post("/private-chats");

        const chatId = response?.data?.chat?.chatId;

        if (!chatId) {
          throw new Error("Unable to create private conversation.");
        }

        navigate(`/private/${encodeURIComponent(chatId)}`, {
          replace: true,
          state: {
            nickname: cleanNickname,
          },
        });
      } catch (requestError) {
        console.error(
          "Create private conversation error:",
          requestError
        );

        setError(
          requestError.response?.data?.message ||
            "Unable to create private conversation. Please try again."
        );
      } finally {
        setIsCreating(false);
      }

      return;
    }

    /*
     * ==========================================
     * PUBLIC TEMPORARY ROOM
     * ==========================================
     */

    if (!cleanRoomName) {
      setError("Give your room a name.");
      return;
    }

    if (cleanRoomName.length > 50) {
      setError("Room name must be 50 characters or less.");
      return;
    }

    setIsCreating(true);

    try {
      const response = await axiosInstance.post("/rooms", {
        name: cleanRoomName,
        type: "public",
        expiryOption,
      });

      const room = response.data?.room;

      if (!room?.roomId) {
        throw new Error("Invalid room response.");
      }

      navigate(`/room/${encodeURIComponent(room.roomId)}`, {
        state: {
          nickname: cleanNickname,
          roomCode: room.roomId,
          roomType: "public",
          roomName: room.name,
          passkey: "",
        },
      });
    } catch (requestError) {
      console.error("Create room error:", requestError);

      setError(
        requestError.response?.data?.message ||
          "Unable to create the room. Please try again."
      );
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      {/* HEADER */}
      <header className="mx-auto flex w-full max-w-5xl items-center px-5 py-6 sm:px-8">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:text-[var(--text)]"
        >
          <ArrowLeft size={18} />
          <span>Back</span>
        </Link>

        <Link
          to="/"
          className="mx-auto -translate-x-1/2 text-lg font-semibold tracking-[-0.04em]"
        >
          drift<span className="text-[var(--text-muted)]">.</span>
        </Link>

        <div className="w-12" />
      </header>

      {/* CONTENT */}
      <main className="mx-auto w-full max-w-2xl px-5 pb-16 pt-10 sm:px-8 sm:pt-16">
        <div className="drift-up">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
            New conversation
          </p>

          <h1 className="mt-4 text-4xl font-semibold tracking-[-0.055em] sm:text-5xl">
            Start a conversation.
          </h1>

          <p className="mt-4 max-w-lg text-sm leading-6 text-[var(--text-secondary)] sm:text-base">
            Choose a nickname and start talking. No account required.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-10 space-y-7">
          {/* NICKNAME */}
          <div className="drift-up">
            <label
              htmlFor="nickname"
              className="mb-2.5 block text-sm font-medium"
            >
              Your nickname
            </label>

            <input
              id="nickname"
              type="text"
              value={nickname}
              onChange={(event) => {
                setNickname(event.target.value);
                setError("");
              }}
              placeholder="e.g. Akarsh"
              maxLength={24}
              autoComplete="nickname"
              className="drift-input h-12 px-4 text-sm"
            />

            <p className="mt-2 text-xs text-[var(--text-muted)]">
              No account. This name only exists inside the conversation.
            </p>
          </div>

          {/* CONVERSATION TYPE */}
          <div className="drift-up">
            <div className="mb-3 text-sm font-medium">
              Conversation type
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {/* TEMPORARY ROOM */}
              <button
                type="button"
                onClick={() => {
                  setRoomType("public");
                  setError("");
                }}
                className={`rounded-[var(--radius-md)] border p-4 text-left transition-all ${
                  roomType === "public"
                    ? "border-[var(--text)] bg-[var(--surface)] shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
                    : "border-[var(--border)] bg-[var(--surface-soft)] hover:border-[var(--text-muted)]"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--accent-soft)]">
                    <Globe size={17} />
                  </div>

                  <div>
                    <p className="text-sm font-semibold">
                      Temporary room
                    </p>

                    <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                      Anyone with the link can join.
                    </p>
                  </div>
                </div>
              </button>

              {/* PRIVATE CONVERSATION */}
              <button
                type="button"
                onClick={() => {
                  setRoomType("private");
                  setError("");
                }}
                className={`rounded-[var(--radius-md)] border p-4 text-left transition-all ${
                  roomType === "private"
                    ? "border-[var(--text)] bg-[var(--surface)] shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
                    : "border-[var(--border)] bg-[var(--surface-soft)] hover:border-[var(--text-muted)]"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--accent-soft)]">
                    <LockKeyhole size={17} />
                  </div>

                  <div>
                    <p className="text-sm font-semibold">
                      Private conversation
                    </p>

                    <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                      Invite someone with a private link.
                    </p>
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* PUBLIC ROOM NAME */}
          {roomType === "public" && (
            <div className="drift-up">
              <label
                htmlFor="roomName"
                className="mb-2.5 block text-sm font-medium"
              >
                Room name
              </label>

              <input
                id="roomName"
                type="text"
                value={roomName}
                onChange={(event) => {
                  setRoomName(event.target.value);
                  setError("");
                }}
                placeholder="e.g. Coffee shop ideas"
                maxLength={50}
                className="drift-input h-12 px-4 text-sm"
              />
            </div>
          )}

          {/* PUBLIC ROOM EXPIRY */}
          {roomType === "public" && (
            <div className="drift-up">
              <label
                htmlFor="roomExpiry"
                className="mb-2.5 block text-sm font-medium"
              >
                Temporary room expiry
              </label>

              <select
                id="roomExpiry"
                value={expiryOption}
                onChange={(event) =>
                  setExpiryOption(event.target.value)
                }
                className="drift-input h-12 px-4 text-sm"
              >
                <option value="never">
                  Until everyone leaves
                </option>

                <option value="1h">
                  1 Hour
                </option>

                <option value="24h">
                  24 Hours
                </option>

                <option value="7d">
                  7 Days
                </option>
              </select>

              <p className="mt-2 text-xs text-[var(--text-muted)]">
                The room disappears when everyone leaves or when its
                expiry is reached.
              </p>
            </div>
          )}

          {/* PRIVATE INFORMATION */}
          {roomType === "private" && (
            <div className="drift-scale rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-soft)] px-4 py-4">
              <p className="text-sm font-medium">
                Private conversation
              </p>

              <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
                Create the conversation and share its invite link.
                No passkey or manual code is required.
              </p>
            </div>
          )}

          {/* ERROR */}
          {error && (
            <div
              role="alert"
              className="rounded-[var(--radius-md)] border border-[var(--danger)]/20 bg-[var(--danger)]/5 px-4 py-3 text-sm text-[var(--danger)]"
            >
              {error}
            </div>
          )}

          {/* CREATE BUTTON */}
          <div className="pt-1">
            <button
              type="submit"
              disabled={isCreating}
              className="drift-button drift-primary group flex min-h-12 w-full items-center justify-center gap-2 px-5 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isCreating ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />

                  {roomType === "private"
                    ? "Creating conversation..."
                    : "Creating room..."}
                </>
              ) : (
                <>
                  {roomType === "private"
                    ? "Create private conversation"
                    : "Create room"}

                  <span className="transition-transform duration-200 group-hover:translate-x-0.5">
                    <ArrowRight size={18} />
                  </span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* FOOTER */}
        <div className="mt-8 border-t border-[var(--border)] pt-6">
          <p className="text-center text-xs leading-5 text-[var(--text-muted)]">
            Temporary rooms disappear when they're done.
            <br className="sm:hidden" />
            Private conversations stay available.
          </p>
        </div>
      </main>
    </div>
  );
}

export default CreateRoomPage;