const STORAGE_KEY = "drift_saved_conversations";
const OLD_STORAGE_KEY = "drift_saved_rooms";
const MAX_SAVED = 50;

function readConversations() {
  try {
    let raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const legacyRaw = localStorage.getItem(OLD_STORAGE_KEY);
      if (legacyRaw) {
        raw = legacyRaw;
        try {
          localStorage.setItem(STORAGE_KEY, legacyRaw);
        } catch {
          // ignore
        }
      }
    }

    if (!raw) return [];

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeConversations(items) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(items.slice(0, MAX_SAVED))
    );
  } catch {
    // Ignore localStorage errors.
  }
}

function getCompositeKey(item) {
  const isPrivate = Boolean(item?.private || item?.type === "private" || item?.chatId);
  const rawId = String(item?.chatId || item?.roomId || item?.id || "").trim();
  return `${isPrivate ? "private" : "room"}:${rawId}`;
}

export function getSavedConversations() {
  return readConversations();
}

export function saveConversation(item) {
  if (!item?.roomId && !item?.chatId && !item?.id) {
    return;
  }

  const rawId = String(item.chatId || item.roomId || item.id).trim();
  if (!rawId) return;

  const current = readConversations();
  const isPrivate = Boolean(
    item.private || item.type === "private" || item.chatId
  );

  const key = getCompositeKey(item);

  const normalized = {
    ...item,
    id: rawId,
    roomId: isPrivate ? undefined : rawId,
    chatId: isPrivate ? rawId : undefined,
    roomName:
      item.roomName ||
      item.name ||
      (isPrivate ? "Private chat" : "Untitled room"),
    type: isPrivate ? "private" : item.type || "public",
    private: isPrivate,
    nickname: item.nickname || "",
    lastActivityAt:
      item.lastActivityAt ||
      item.lastMessageAt ||
      new Date().toISOString(),
    savedAt: item.savedAt || new Date().toISOString(),
  };

  const filtered = current.filter((existing) => getCompositeKey(existing) !== key);

  writeConversations([normalized, ...filtered]);
}

export function removeSavedConversation(id, type) {
  if (!id) return;
  const cleanId = String(id).trim();

  writeConversations(
    readConversations().filter((existing) => {
      const existingId = String(existing?.chatId || existing?.roomId || existing?.id || "").trim();
      if (existingId !== cleanId) {
        return true;
      }
      if (type) {
        const isPrivate = Boolean(existing?.private || existing?.type === "private" || existing?.chatId);
        const existingType = isPrivate ? "private" : "room";
        return existingType !== type;
      }
      return false;
    })
  );
}

export function clearSavedConversations() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore localStorage errors.
  }
}

// Backwards compatibility exports
export const getSavedRooms = getSavedConversations;
export const saveRoom = saveConversation;
export const removeSavedRoom = (id) => removeSavedConversation(id, "room");
export const clearSavedRooms = clearSavedConversations;
