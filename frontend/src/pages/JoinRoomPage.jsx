import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Lock, Users, MessageCircle } from "lucide-react";

import axiosInstance from "../lib/axios";

const extractCode = (value) => {
  const input = String(value || "").trim();

  if (!input) return "";

  // Full private link:
  // http://localhost:5173/private/ABC123
  if (/^https?:\/\//i.test(input)) {
    try {
      const url = new URL(input);

      const privateMatch = url.pathname.match(/^\/private\/([^/]+)\/?$/);

      if (privateMatch?.[1]) {
        return {
          type: "private",
          code: decodeURIComponent(privateMatch[1]).trim(),
        };
      }

      const roomQueryCode = url.searchParams.get("code");

      if (roomQueryCode) {
        return {
          type: "unknown",
          code: decodeURIComponent(roomQueryCode).trim(),
        };
      }

      const roomMatch = url.pathname.match(/^\/room\/([^/]+)\/?$/);

      if (roomMatch?.[1] && roomMatch[1] !== "join") {
        return {
          type: "room",
          code: decodeURIComponent(roomMatch[1]).trim(),
        };
      }
    } catch {
      return {
        type: "unknown",
        code: input.replace(/\s+/g, ""),
      };
    }
  }

  // Relative private link
  if (input.startsWith("/private/")) {
    const match = input.match(/^\/private\/([^/]+)\/?$/);

    if (match?.[1]) {
      return {
        type: "private",
        code: decodeURIComponent(match[1]).trim(),
      };
    }
  }

  // Relative room link
  if (input.startsWith("/room/")) {
    try {
      const url = new URL(input, window.location.origin);

      const queryCode = url.searchParams.get("code");

      if (queryCode) {
        return {
          type: "unknown",
          code: decodeURIComponent(queryCode).trim(),
        };
      }

      const match = url.pathname.match(/^\/room\/([^/]+)\/?$/);

      if (match?.[1] && match[1] !== "join") {
        return {
          type: "room",
          code: decodeURIComponent(match[1]).trim(),
        };
      }
    } catch {
      // Fall through to raw code.
    }
  }

  // Raw code.
  return {
    type: "unknown",
    code: input.replace(/\s+/g, "").trim(),
  };
};

function JoinRoomPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const [nickname, setNickname] = useState("");
  const [codeInput, setCodeInput] = useState("");
  const [passkey, setPasskey] = useState("");

  const [room, setRoom] = useState(null);
  const [privateChat, setPrivateChat] = useState(null);

  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");

  // /room/join?code=ABC123
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const code = params.get("code");

    if (code) {
      setCodeInput(code);
    }
  }, [location.search]);

  const handleCodeChange = (event) => {
    setCodeInput(event.target.value);
    setRoom(null);
    setPrivateChat(null);
    setError("");
  };

  /*
   * Resolve the code.
   *
   * Private chat:
   * GET /private-chats/:chatId
   *
   * Room:
   * GET /rooms/:roomId
   */
  const resolveCode = async (rawValue) => {
    const parsed = extractCode(rawValue);

    if (!parsed.code) {
      throw new Error("Enter a room or private chat code.");
    }

    // If we already know it's a private link.
    if (parsed.type === "private") {
      const response = await axiosInstance.get(
        `/private-chats/${encodeURIComponent(parsed.code)}`
      );

      if (!response.data?.chat) {
        throw new Error("Private chat not found.");
      }

      return {
        type: "private",
        code: parsed.code,
        data: response.data.chat,
      };
    }

    // If we already know it's a room link.
    if (parsed.type === "room") {
      const response = await axiosInstance.get(
        `/rooms/${encodeURIComponent(parsed.code)}`
      );

      if (!response.data?.success || !response.data?.room) {
        throw new Error("Room not found or has expired.");
      }

      return {
        type: "room",
        code: String(
          response.data.room.roomId || parsed.code
        ).trim(),
        data: response.data.room,
      };
    }

    /*
     * RAW CODE:
     *
     * First check private chat.
     * If not found, check normal room.
     *
     * This is the important fix.
     */
    try {
      const privateResponse = await axiosInstance.get(
        `/private-chats/${encodeURIComponent(parsed.code)}`
      );

      if (privateResponse.data?.chat) {
        return {
          type: "private",
          code: parsed.code,
          data: privateResponse.data.chat,
        };
      }
    } catch {
      // Not a private chat. Try room next.
    }

    const roomResponse = await axiosInstance.get(
      `/rooms/${encodeURIComponent(parsed.code)}`
    );

    if (!roomResponse.data?.success || !roomResponse.data?.room) {
      throw new Error("Room not found or has expired.");
    }

    return {
      type: "room",
      code: String(
        roomResponse.data.room.roomId || parsed.code
      ).trim(),
      data: roomResponse.data.room,
    };
  };

  const handleCheckCode = async () => {
    if (!codeInput.trim()) {
      setRoom(null);
      setPrivateChat(null);
      return;
    }

    setChecking(true);
    setError("");
    setRoom(null);
    setPrivateChat(null);

    try {
      const result = await resolveCode(codeInput);

      if (result.type === "private") {
        setPrivateChat(result.data);
        setCodeInput(result.code);
      } else {
        setRoom(result.data);
        setCodeInput(result.code);
      }
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Code not found."
      );
    } finally {
      setChecking(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const cleanNickname = nickname.trim();

    if (!cleanNickname) {
      setError("Enter a nickname.");
      return;
    }

    if (cleanNickname.length > 24) {
      setError("Nickname must be 24 characters or less.");
      return;
    }

    if (!codeInput.trim()) {
      setError("Enter a room or private chat code.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const result = await resolveCode(codeInput);

      /*
       * ==========================================
       * PRIVATE CHAT
       * ==========================================
       */
      if (result.type === "private") {
        navigate(
          `/private/${encodeURIComponent(result.code)}`,
          {
            state: {
              nickname: cleanNickname,
            },
          }
        );

        return;
      }

      /*
       * ==========================================
       * NORMAL ROOM
       * ==========================================
       */
      const roomData = result.data;
      const canonicalRoomId = result.code;

      /*
       * Private temporary ROOM passkey.
       */
      if (roomData.type === "private") {
        if (!passkey.trim()) {
          setError("Enter the room passkey.");
          return;
        }

        const verifyResponse = await axiosInstance.post(
          `/rooms/${encodeURIComponent(canonicalRoomId)}/verify`,
          {
            passkey: passkey.trim(),
          }
        );

        if (!verifyResponse.data?.success) {
          throw new Error(
            verifyResponse.data?.message ||
              "Invalid room passkey."
          );
        }
      }

      navigate(
        `/room/${encodeURIComponent(canonicalRoomId)}`,
        {
          state: {
            nickname: cleanNickname,
            roomCode: canonicalRoomId,
            roomType: roomData.type,
            roomName: roomData.name,
            passkey:
              roomData.type === "private"
                ? passkey.trim()
                : "",
          },
        }
      );
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Unable to join."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen px-5 py-8 sm:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-2xl flex-col">

        {/* HEADER */}
        <header className="drift-fade flex items-center justify-between">
          <Link
            to="/"
            className="text-lg font-semibold tracking-[-0.03em]"
          >
            drift
          </Link>

          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-[var(--text-secondary)] transition hover:text-[var(--text)]"
          >
            <ArrowLeft size={16} />
            Home
          </Link>
        </header>

        {/* CONTENT */}
        <section className="flex flex-1 items-center justify-center py-16">
          <div className="drift-up w-full max-w-lg">

            <div className="mb-8">
              <p className="mb-3 text-sm font-medium text-[var(--text-secondary)]">
                Join a conversation
              </p>

              <h1 className="text-4xl font-semibold tracking-[-0.045em] sm:text-5xl">
                Pick up the conversation.
              </h1>

              <p className="mt-4 max-w-md text-base leading-7 text-[var(--text-secondary)]">
                Paste a room or private chat code.
                No account needed.
              </p>
            </div>

            <form
              onSubmit={handleSubmit}
              className="space-y-5"
            >

              {/* NICKNAME */}
              <div>
                <label className="mb-2 block text-sm font-medium">
                  Nickname
                </label>

                <input
                  type="text"
                  value={nickname}
                  onChange={(event) => {
                    setNickname(event.target.value);
                    setError("");
                  }}
                  placeholder="What should people call you?"
                  maxLength={24}
                  className="drift-input h-12 px-4 text-sm"
                  autoComplete="off"
                />
              </div>

              {/* CODE */}
              <div>
                <label className="mb-2 block text-sm font-medium">
                  Room or chat code
                </label>

                <input
                  type="text"
                  value={codeInput}
                  onChange={handleCodeChange}
                  placeholder="Paste the code or shared link"
                  className="drift-input h-12 px-4 text-sm"
                  autoComplete="off"
                  spellCheck="false"
                />

                <p className="mt-2 text-xs text-[var(--text-muted)]">
                  Room codes and private chat codes are both supported.
                </p>
              </div>

              {/* PRIVATE CHAT PREVIEW */}
              {privateChat && (
                <div className="drift-scale drift-card p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-lg font-medium">
                        Private Chat
                      </p>

                      <div className="mt-2 flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
                        <MessageCircle size={13} />
                        Private 1-to-1 conversation
                      </div>

                      <p className="mt-2 text-xs text-[var(--text-muted)]">
                        {codeInput}
                      </p>
                    </div>

                    <span className="rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs text-[var(--text-secondary)]">
                      Ready
                    </span>
                  </div>
                </div>
              )}

              {/* ROOM PREVIEW */}
              {room && (
                <div className="drift-scale drift-card p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-lg font-medium">
                        {room.name}
                      </p>

                      <div className="mt-2 flex items-center gap-4 text-xs text-[var(--text-secondary)]">
                        <span className="inline-flex items-center gap-1.5">
                          {room.type === "private" ? (
                            <Lock size={13} />
                          ) : (
                            <Users size={13} />
                          )}

                          {room.type === "private"
                            ? "Private room"
                            : "Public room"}
                        </span>

                        <span>{room.roomId}</span>
                      </div>
                    </div>

                    <span className="rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs text-[var(--text-secondary)]">
                      Ready
                    </span>
                  </div>
                </div>
              )}

              {/* TEMP PRIVATE ROOM PASSKEY */}
              {room?.type === "private" && (
                <div className="drift-scale">
                  <label className="mb-2 block text-sm font-medium">
                    Passkey
                  </label>

                  <input
                    type="password"
                    value={passkey}
                    onChange={(event) => {
                      setPasskey(event.target.value);
                      setError("");
                    }}
                    placeholder="Enter room passkey"
                    maxLength={64}
                    className="drift-input h-12 px-4 text-sm"
                    autoComplete="off"
                  />
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

              {/* BUTTON */}
              <button
                type="submit"
                disabled={loading || checking}
                className="drift-button drift-primary group w-full"
              >
                {loading ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Joining...
                  </>
                ) : checking ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Checking...
                  </>
                ) : (
                  <>
                    Join
                    <ArrowRight
                      size={18}
                      className="transition-transform group-hover:translate-x-0.5"
                    />
                  </>
                )}
              </button>
            </form>
          </div>
        </section>
      </div>
    </main>
  );
}

export default JoinRoomPage;