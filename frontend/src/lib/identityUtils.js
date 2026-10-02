const PALETTE = [
  { bg: "#181818", text: "#ffffff", border: "#2e2e2e" },
  { bg: "#2563eb", text: "#ffffff", border: "#1d4ed8" },
  { bg: "#059669", text: "#ffffff", border: "#047857" },
  { bg: "#7c3aed", text: "#ffffff", border: "#6d28d9" },
  { bg: "#db2777", text: "#ffffff", border: "#be185d" },
  { bg: "#d97706", text: "#ffffff", border: "#b45309" },
  { bg: "#475569", text: "#ffffff", border: "#334155" },
  { bg: "#0891b2", text: "#ffffff", border: "#0e7490" },
];

export function getNicknameColor(nickname = "") {
  let hash = 0;
  const str = String(nickname || "Anonymous").trim().toLowerCase();
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % PALETTE.length;
  return PALETTE[index];
}

export function getNicknameInitials(nickname = "Anonymous") {
  const parts = String(nickname || "Anonymous")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!parts.length) return "A";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}
