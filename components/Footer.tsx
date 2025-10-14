export default function Footer() {
  return (
    <footer className="mt-16 border-t border-[var(--border)]">
      <div className="mx-auto max-w-7xl px-4 py-8 text-sm text-white/60">
        <div>BITGREMLIN.IO © 2025 — built with caffeine and contempt.</div>
        <div className="mt-2 flex flex-wrap gap-4">
          <a className="hover:text-[var(--accent)]" href="/privacy">Privacy</a>
          <a className="hover:text-[var(--accent)]" href="/terms">Terms</a>
          <a className="hover:text-[var(--accent)]" href="/api">API</a>
          <a className="hover:text-[var(--accent)]" href="https://github.com/">GitHub</a>
        </div>
      </div>
    </footer>
  );
}
