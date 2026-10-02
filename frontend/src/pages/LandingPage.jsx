import { Link } from "react-router-dom";
import {
  ArrowRight,
  LockKeyhole,
  MessageCircle,
  Plus,
  Sparkles,
} from "lucide-react";

function LandingPage() {
  return (
    <main className="min-h-screen bg-[var(--bg)]">
      {/* Header */}
      <header className="border-b border-[var(--border-soft)]">
        <div className="mx-auto flex min-h-[72px] max-w-6xl items-center justify-between px-5 sm:px-8">
          <Link
            to="/"
            className="text-xl font-semibold tracking-[-0.05em]"
          >
            drift.
          </Link>

          <nav className="flex items-center gap-4 sm:gap-6">
            <Link
              to="/conversations"
              className="text-sm text-[var(--text-secondary)] transition hover:text-[var(--text)]"
            >
              Conversations
            </Link>

            <Link
              to="/private/new"
              className="hidden text-sm text-[var(--text-secondary)] transition hover:text-[var(--text)] sm:block"
            >
              Private chat
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-5 pb-20 pt-20 sm:px-8 sm:pb-28 sm:pt-28">
        <div className="max-w-4xl drift-up">
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)]">
            <Sparkles size={13} />
            Temporary conversations
          </div>

          <h1 className="max-w-4xl text-[clamp(3.2rem,8vw,7rem)] font-semibold leading-[0.92] tracking-[-0.065em]">
            Talk for a while.
            <br />
            Then leave it behind.
          </h1>

          <p className="mt-7 max-w-2xl text-base leading-7 text-[var(--text-secondary)] sm:text-lg sm:leading-8">
           For conversations you’ll remember, not accounts you’ll maintain. Create, share, talk, and drift away.
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link
              to="/room/create"
              className="drift-button drift-primary min-h-12 px-6"
            >
              <Plus size={17} />
              Create a room
              <ArrowRight size={16} />
            </Link>

            <Link
              to="/room/join"
              className="drift-button drift-secondary min-h-12 px-6"
            >
              Join a room
            </Link>

            <Link
              to="/private/new"
              className="drift-button drift-secondary min-h-12 px-6 sm:hidden"
            >
              <MessageCircle size={16} />
              Private chat
            </Link>
          </div>
        </div>
      </section>

      {/* Principles */}
      <section className="border-y border-[var(--border-soft)] bg-white">
        <div className="mx-auto grid max-w-6xl grid-cols-1 px-5 sm:grid-cols-3 sm:px-8">
          <div className="border-b border-[var(--border-soft)] py-9 sm:border-b-0 sm:border-r sm:pr-10">
            <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-[12px] bg-[var(--accent-soft)]">
              <MessageCircle size={18} />
            </div>

            <h2 className="text-lg font-semibold tracking-[-0.03em]">
              Temporary
            </h2>

            <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
              Conversations are meant to exist for as long as
              you need them.
            </p>
          </div>

          <div className="border-b border-[var(--border-soft)] py-9 sm:border-b-0 sm:border-r sm:px-10">
            <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-[12px] bg-[var(--accent-soft)]">
              <ArrowRight size={18} />
            </div>

            <h2 className="text-lg font-semibold tracking-[-0.03em]">
              Just share
            </h2>

            <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
              No accounts or setup. Send the room link and
              start talking.
            </p>
          </div>

          <div className="py-9 sm:pl-10">
            <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-[12px] bg-[var(--accent-soft)]">
              <LockKeyhole size={18} />
            </div>

            <h2 className="text-lg font-semibold tracking-[-0.03em]">
              Private by default
            </h2>

            <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
              Your conversation isn't a social feed. It's just
              you and the people you invited.
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-28">
        <div className="drift-card overflow-hidden px-6 py-10 text-center sm:px-10 sm:py-16">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
            No account required
          </p>

          <h2 className="mx-auto mt-4 max-w-2xl text-3xl font-semibold tracking-[-0.05em] sm:text-5xl">
            Create a room.
            <br />
            Send the link.
            <br />
            Start talking.
          </h2>

          <div className="mt-8">
            <Link
              to="/room/create"
              className="drift-button drift-primary min-h-12 px-6"
            >
              <Plus size={17} />
              Create a room
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[var(--border-soft)]">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-5 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <Link
            to="/"
            className="text-lg font-semibold tracking-[-0.05em]"
          >
            drift.
          </Link>

          <p className="text-xs text-[var(--text-muted)]">
            Talk. Leave. Forget.
          </p>
        </div>
      </footer>
    </main>
  );
}

export default LandingPage;