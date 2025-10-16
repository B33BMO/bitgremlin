"use client";

import { useState } from "react";

export default function ContactForm() {
  const [status, setStatus] = useState<"idle"|"sending"|"ok"|"err">("idle");
  const [msg, setMsg] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("sending");
    setMsg("");

    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/contact", { method: "POST", body: form });
      const text = await res.text();
      if (!res.ok) throw new Error(text || `HTTP ${res.status}`);
      setStatus("ok");
      setMsg("Thanks! We’ll get back to you soon.");
      e.currentTarget.reset();
    } catch (err: any) {
      setStatus("err");
      setMsg(err?.message || "Something went wrong.");
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 card rounded-xl p-6 space-y-4">
      <input type="text" name="website" className="hidden" tabIndex={-1} autoComplete="off" />

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="text-sm text-white/70">Name</label>
          <input name="name" required className="mt-1 w-full rounded-md border border-[var(--border)] bg-transparent px-3 py-2 text-sm outline-none focus:border-[var(--accent)]" />
        </div>
        <div>
          <label className="text-sm text-white/70">Email</label>
          <input type="email" name="email" required className="mt-1 w-full rounded-md border border-[var(--border)] bg-transparent px-3 py-2 text-sm outline-none focus:border-[var(--accent)]" />
        </div>
      </div>

      <div>
        <label className="text-sm text-white/70">Subject</label>
        <input name="subject" required className="mt-1 w-full rounded-md border border-[var(--border)] bg-transparent px-3 py-2 text-sm outline-none focus:border-[var(--accent)]" />
      </div>

      <div>
        <label className="text-sm text-white/70">Message</label>
        <textarea name="message" required rows={6} className="mt-1 w-full rounded-md border border-[var(--border)] bg-transparent px-3 py-2 text-sm outline-none focus:border-[var(--accent)]" />
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          className="btn rounded-md"
          disabled={status === "sending"}
        >
          {status === "sending" ? "Sending..." : "Send"}
        </button>
        {msg && (
          <span className={`text-sm ${status === "ok" ? "text-emerald-300" : "text-red-300"}`}>
            {msg}
          </span>
        )}
      </div>

      <p className="mt-4 text-xs text-white/40">
        We’ll only use your info to reply to your message.
      </p>
    </form>
  );
}
