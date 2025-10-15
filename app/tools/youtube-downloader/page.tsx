"use client";

import { useState } from "react";

export default function YTDownloaderPage() {
  const [url, setUrl] = useState("");
  const [format, setFormat] = useState<"mp3"|"mp4"|"wav">("mp3");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outUrl, setOutUrl] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    setOutUrl(null);

    try {
      const res = await fetch("/api/yt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, format })
      });

      if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try {
          const j = await res.json();
          if (j?.error) msg = j.error;
        } catch {}
        throw new Error(msg);
      }

      const blob = await res.blob();
      const dlUrl = URL.createObjectURL(blob);
      setOutUrl(dlUrl);
    } catch (e: any) {
      setError(e?.message || "Unknown error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-4 pt-10">
      <h1 className="text-3xl font-semibold">YouTube → MP3/MP4/WAV</h1>
      <p className="mt-2 text-white/70">
        Paste a YouTube link, pick a format, and download. Please only download content you have rights to use.
      </p>

      <div className="mt-6 rounded-xl card p-5">
        <label className="text-sm text-white/70">YouTube URL</label>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://www.youtube.com/watch?v=..."
          className="mt-2 w-full rounded-md border border-[var(--border)] bg-transparent px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
        />

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <label className="text-sm text-white/70">Format</label>
          <select
            value={format}
            onChange={(e) => setFormat(e.target.value as any)}
            className="rounded-md border border-[var(--border)] bg-transparent px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
          >
            <option value="mp3">MP3 (audio)</option>
            <option value="wav">WAV (audio)</option>
            <option value="mp4">MP4 (video)</option>
          </select>

          <button
            onClick={run}
            disabled={busy || !url}
            className={`ml-auto rounded-md px-4 py-2 text-sm font-medium border ${busy || !url ? "opacity-50 cursor-not-allowed border-[var(--border)] text-white/40" : "btn"}`}
            style={busy || !url ? {} : { borderColor: "var(--accent)", background: "var(--accent)", color: "#000" }}
          >
            {busy ? "Working…" : "Fetch"}
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-md border border-red-500/30 bg-black/30 p-3 text-sm text-red-300">
            Error: {error}
          </div>
        )}

        {outUrl && (
          <div className="mt-4 flex items-center gap-3">
            <a
              className="btn rounded-md"
              href={outUrl}
              download={`download.${format}`}
            >
              Download {format.toUpperCase()}
            </a>
            <button
              className="btn-ghost rounded-md"
              onClick={() => setOutUrl(null)}
            >
              Clear
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
