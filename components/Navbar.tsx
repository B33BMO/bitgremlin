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
          <img
            src="/logo.png"
            alt="BitGremlin logo"
            className="h-6 w-auto shrink-0 transition-transform group-hover:scale-105"
          />
          <span className="text-sm tracking-widest text-white/90 group-hover:text-[var(--accent)] transition">
            BITGREMLIN.IO
          </span>
        </Link>

        {/* desktop nav */}
        <div className="hidden md:flex items-center gap-6">
          <Link href="/tools" className="text-sm text-white/80 hover:text-[var(--accent)]">Tools</Link>
          <Link href="/about" className="text-sm text-white/80 hover:text-[var(--accent)]">About</Link>
          <Link href="/api" className="text-sm text-white/80 hover:text-[var(--accent)]">API</Link>
          <Link href="/contact" className="text-sm text-white/80 hover:text-[var(--accent)]">Contact</Link>

          {/* external button — align with links */}
          <a
            href="https://buymeacoffee.com/Bmoo"
            target="_blank"
            rel="noopener noreferrer"
            className="btn rounded-md inline-flex h-9 items-center justify-center px-4 text-center"
          >
            Buy me a coffee :)
          </a>
        </div>

        <button
          className="md:hidden text-white/80"
          onClick={() => setOpen(v => !v)}
          aria-label="Toggle Menu"
        >
          <Menu />
        </button>
      </nav>

      {/* mobile dropdown (keep full-width + spacing here) */}
      {open && (
        <div className="md:hidden border-t border-[var(--border)] bg-[var(--bg)]">
          <div className="mx-auto flex max-w-7xl flex-col px-4 py-2">
            <Link href="/tools" className="py-2 text-white/80 hover:text-[var(--accent)]">Tools</Link>
            <Link href="/about" className="py-2 text-white/80 hover:text-[var(--accent)]">About</Link>
            <Link href="/api" className="py-2 text-white/80 hover:text-[var(--accent)]">API</Link>
            <Link href="/contact" className="py-2 text-white/80 hover:text-[var(--accent)]">Contact</Link>
            <a
              href="https://buymeacoffee.com/Bmoo"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 btn rounded-md w-full text-center"
            >
              Buy me a coffee :)
            </a>
          </div>
        </div>
      )}
    </header>
  );
}
