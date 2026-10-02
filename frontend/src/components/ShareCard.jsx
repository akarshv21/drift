import { useState } from "react";
import { Check, Copy, Share2, X } from "lucide-react";
import toast from "react-hot-toast";

export default function ShareCard({
  code,
  link,
  isPrivate = false,
  onClose,
}) {
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(true);
      toast.success("Code copied");
      setTimeout(() => setCopiedCode(false), 1500);
    } catch {
      toast.error("Could not copy code");
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopiedLink(true);
      toast.success("Invite link copied");
      setTimeout(() => setCopiedLink(false), 1500);
    } catch {
      toast.error("Could not copy link");
    }
  };

  const handleNativeShare = async () => {
    const text = isPrivate
      ? `Join my private Drift chat:\n${link}\n\nChat code: ${code}`
      : `Join my Drift room:\n${link}\n\nRoom code: ${code}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: "drift.",
          text,
          url: link,
        });
        return;
      } catch {
        // Fallback to clipboard
      }
    }

    try {
      await navigator.clipboard.writeText(text);
      toast.success("Invite copied to clipboard");
    } catch {
      toast.error("Could not copy invite");
    }
  };

  return (
    <div className="w-[320px] rounded-2xl border border-[var(--border)] bg-white p-5 shadow-2xl">
      <div className="flex items-center justify-between border-b border-[var(--border-soft)] pb-3">
        <div>
          <span className="text-lg font-bold tracking-tight">drift.</span>
          <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
            Join my conversation
          </p>
        </div>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-[var(--surface-hover)] text-[var(--text-muted)] hover:text-[var(--text)]"
          >
            <X size={16} />
          </button>
        )}
      </div>

      <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          CODE
        </p>

        <div className="mt-1 flex items-center justify-between">
          <p className="font-mono text-base font-bold tracking-wider">
            {code}
          </p>

          <button
            type="button"
            onClick={handleCopyCode}
            className="flex h-8 items-center gap-1.5 rounded-lg border border-[var(--border)] bg-white px-2.5 text-xs font-medium hover:bg-[var(--surface-hover)]"
          >
            {copiedCode ? <Check size={13} className="text-[var(--success)]" /> : <Copy size={13} />}
            <span>{copiedCode ? "Copied" : "Copy"}</span>
          </button>
        </div>
      </div>

      <div className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          INVITE LINK
        </p>

        <div className="mt-1 flex items-center justify-between gap-2">
          <p className="min-w-0 flex-1 truncate text-xs text-[var(--text-secondary)]">
            {link}
          </p>

          <button
            type="button"
            onClick={handleCopyLink}
            className="flex h-8 items-center gap-1.5 shrink-0 rounded-lg border border-[var(--border)] bg-white px-2.5 text-xs font-medium hover:bg-[var(--surface-hover)]"
          >
            {copiedLink ? <Check size={13} className="text-[var(--success)]" /> : <Copy size={13} />}
            <span>{copiedLink ? "Copied" : "Copy"}</span>
          </button>
        </div>
      </div>

      <button
        type="button"
        onClick={handleNativeShare}
        className="drift-button drift-primary mt-4 w-full"
      >
        <Share2 size={16} />
        Share
      </button>
    </div>
  );
}
