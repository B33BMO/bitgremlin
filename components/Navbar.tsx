"use client";
import Link from "next/link";
import { Menu } from "lucide-react";
import { useState } from "react";

export default function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--border)] bg-[color:var(--bg)/0.7] backdrop-blur-md">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        <Link href="/" className="group flex items-center gap-2">
          <svg width="26" height="26" viewBox="0 0 24 24" className="shrink-0">
            <path d="M5 19c6-2 8-6 9-12l2 2c1 1 2 3 1 5-1 2-3 4-6 5-2 1-4 1-6 0z" fill="var(--accent)"/>
            <circle cx="16.5" cy="7.5" r="1.5" fill="var(--accent)"/>
          </svg>
          <span className="text-sm tracking-widest text-white/90 group-hover:text-[var(--accent)] transition">
            BITGREMLIN.IO
          </span>
        </Link>

        <div className="hidden gap-6 md:flex">
          <Link href="/tools" className="text-sm text-white/80 hover:text-[var(--accent)]">Tools</Link>
          <Link href="/about" className="text-sm text-white/80 hover:text-[var(--accent)]">About</Link>
          <Link href="/api" className="text-sm text-white/80 hover:text-[var(--accent)]">API</Link>
          <Link href="/contact" className="text-sm text-white/80 hover:text-[var(--accent)]">Contact</Link>
          <Link href="/app" className="btn rounded-md">Buy Me Coffee :)</Link>
        </div>

        <button className="md:hidden text-white/80" onClick={() => setOpen(v => !v)} aria-label="Toggle Menu">
          <Menu />
        </button>
      </nav>

      {open && (
        <div className="md:hidden border-t border-[var(--border)] bg-[var(--bg)]">
          <div className="mx-auto flex max-w-7xl flex-col px-4 py-2">
            <Link href="/tools" className="py-2 text-white/80 hover:text-[var(--accent)]">Tools</Link>
            <Link href="/about" className="py-2 text-white/80 hover:text-[var(--accent)]">About</Link>
            <Link href="/api" className="py-2 text-white/80 hover:text-[var(--accent)]">API</Link>
            <Link href="/contact" className="py-2 text-white/80 hover:text-[var(--accent)]">Contact</Link>
            <Link href="/app" className="mt-2 btn rounded-md w-full text-center">⚡ Launch App</Link>
          </div>
        </div>
      )}
    </header>
  );
}
