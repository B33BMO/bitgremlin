"use client";
import { useEffect, useState } from "react";

export default function CookieConsentBar() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      const v = localStorage.getItem("bg_consent");
      if (!v) setShow(true);
    } catch { /* ignore */ }
  }, []);

  if (!show) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[100] border-t border-[var(--border)] bg-[color:var(--bg)]/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-white/80">
          We use a few cookies to run <strong>non-intrusive</strong> ads. Choose your preference.
        </div>
        <div className="flex gap-2">
          <button
            className="btn-ghost rounded-md"
            onClick={() => { localStorage.setItem("bg_consent", "denied"); setShow(false); }}
          >
            No ads
          </button>
          <button
            className="btn-ghost rounded-md"
            onClick={() => { localStorage.setItem("bg_consent", "npa"); setShow(false); }}
          >
            Non-personalized
          </button>
          <button
            className="btn rounded-md"
            onClick={() => { localStorage.setItem("bg_consent", "granted"); setShow(false); }}
          >
            Personalized
          </button>
        </div>
      </div>
    </div>
  );
}
