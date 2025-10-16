"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Format = "mp3" | "mp4" | "wav";

export default function YTDownloaderPage() {
  const [url, setUrl] = useState("");
  const [format, setFormat] = useState<Format>("mp3");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outUrl, setOutUrl] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null); // null = idle/indeterminate
  const [status, setStatus] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Extract YouTube video ID for thumbnail preview
  const videoId = useMemo(() => extractYouTubeId(url) || null, [url]);

  useEffect(() => {
    return () => {
      // cleanup any object URL
      if (outUrl) URL.revokeObjectURL(outUrl);
    };
  }, [outUrl]);

  async function run() {
    if (!isValidYouTubeUrl(url)) {
      setError("Please enter a valid YouTube URL.");
      return;
    }

    setBusy(true);
    setError(null);
    setOutUrl(null);
    setProgress(0);
    setStatus("Starting…");

    const ac = new AbortController();
    abortRef.current = ac;

    try {
      const res = await fetch("/api/yt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, format }),
        signal: ac.signal,
      });

      if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try {
          const j = await res.json();
          if (j?.error) msg = j.error;
        } catch {}
        throw new Error(msg);
      }

      // Stream the body to show real progress (if Content-Length exists)
      const contentLen = Number(res.headers.get("content-length") || 0);
      const reader = res.body?.getReader();
      if (!reader) {
        // Fallback: just blob it
        const blob = await res.blob();
        setProgress(100);
        const dlUrl = URL.createObjectURL(blob);
        setOutUrl(dlUrl);
        setStatus("Done");
        return;
      }

      const chunks: Uint8Array[] = [];
      let received = 0;
      setStatus("Downloading…");

      // Read stream
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value) {
          chunks.push(value);
          received += value.byteLength;
          if (contentLen > 0) {
            setProgress(Math.min(99, Math.round((received / contentLen) * 100)));
          } else {
            // No content-length: show indeterminate-ish
            setProgress(null);
          }
        }
      }

      // Merge chunks → Blob → URL
      const merged = mergeUint8Arrays(chunks, received);
      setProgress(100);
      setStatus("Finalizing…");
      const blob = new Blob([merged], {
        type: format === "mp4" ? "video/mp4" : "audio/" + (format === "mp3" ? "mpeg" : "wav"),
      });
      const dlUrl = URL.createObjectURL(blob);
      setOutUrl(dlUrl);
      setStatus("Done");
    } catch (e: any) {
      if (e?.name === "AbortError") {
        setError("Canceled.");
      } else {
        setError(e?.message || "Unknown error");
      }
    } finally {
      setBusy(false);
      abortRef.current = null;
      if (progress !== 100) setProgress(null);
    }
  }

  function cancel() {
    abortRef.current?.abort();
  }

  async function onChooseFile(file: File | null) {
    if (!file) return;
    try {
      const text = await file.text();
      // find first URL-looking thing
      const match = text.match(/https?:\/\/[^\s]+/i);
      if (!match) throw new Error("No URL found in file.");
      setUrl(match[0]);
      setError(null);
    } catch (e: any) {
      setError(e?.message || "Failed to read file");
    } finally {
      // Reset the file input so same file can be picked again later
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-4 pt-10">
      <h1 className="text-3xl font-semibold">YouTube → MP3 / MP4 / WAV</h1>
      <p className="mt-2 text-white/70">
        Paste a YouTube link or choose a file containing one, pick a format, and download.
        Please only download content you have the rights to use.
      </p>

      <div className="mt-6 grid gap-4 rounded-xl card p-5">
        {/* URL + file chooser row */}
        <div className="flex flex-wrap gap-3 items-center">
          <label className="text-sm text-white/70">YouTube URL</label>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=..."
            className="flex-1 min-w-[14rem] rounded-md border border-[var(--border)] bg-transparent px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
          />
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt"
            className="hidden"
            onChange={(e) => onChooseFile(e.target.files?.[0] || null)}
          />
          <button
            className="btn-ghost rounded-md px-3 py-2 text-sm"
            onClick={() => fileInputRef.current?.click()}
            title="Choose a .txt file containing the URL"
          >
            Choose file
          </button>
        </div>

        {/* Format + actions */}
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm text-white/70">Format</label>
          <select
            value={format}
            onChange={(e) => setFormat(e.target.value as Format)}
            className="rounded-md border border-[var(--border)] bg-transparent px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
          >
            <option value="mp3">MP3 (audio)</option>
            <option value="wav">WAV (audio)</option>
            <option value="mp4">MP4 (video)</option>
          </select>

          <div className="ml-auto flex gap-2">
            {!busy ? (
              <button
                onClick={run}
                disabled={!url}
                className={`rounded-md px-4 py-2 text-sm font-medium border ${
                  !url ? "opacity-50 cursor-not-allowed border-[var(--border)] text-white/40" : "btn"
                }`}
                style={
                  !url ? {} : { borderColor: "var(--accent)", background: "var(--accent)", color: "#000" }
                }
              >
                Fetch
              </button>
            ) : (
              <button
                onClick={cancel}
                className="rounded-md px-4 py-2 text-sm font-medium border border-red-500/50 text-red-200 hover:bg-red-500/10"
                title="Cancel download"
              >
                Cancel
              </button>
            )}
          </div>
        </div>

        {/* Pretty preview */}
        {videoId && (
          <div className="mt-2 flex items-center gap-4">
            <img
              src={`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`}
              alt="thumbnail"
              className="w-40 h-24 object-cover rounded-md border border-[var(--border)]"
            />
            <div className="text-xs text-white/60">
              <div>Preview thumbnail</div>
              <div className="opacity-60">{videoId}</div>
            </div>
          </div>
        )}

        {/* Progress bar */}
        {busy && (
          <div className="mt-2">
            <div className="flex items-center justify-between text-xs text-white/60">
              <span>{status || "Working…"}</span>
              <span>{progress != null ? `${progress}%` : "…"}</span>
            </div>
            <div className="mt-1 h-2 w-full rounded-full bg-white/10 overflow-hidden">
              {progress == null ? (
                // indeterminate shimmer
                <div className="h-full w-1/3 animate-pulse rounded-full" style={{ background: "var(--accent)" }} />
              ) : (
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${progress}%`, background: "var(--accent)" }}
                />
              )}
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="rounded-md border border-red-500/30 bg-black/30 p-3 text-sm text-red-300">
            Error: {error}
          </div>
        )}

        {/* Download */}
        {outUrl && !busy && (
          <div className="flex items-center gap-3">
            <a className="btn rounded-md" href={outUrl} download={`download.${format}`}>
              Download {format.toUpperCase()}
            </a>
            <button className="btn-ghost rounded-md" onClick={() => setOutUrl(null)}>
              Clear
            </button>
          </div>
        )}
      </div>
    </main>
  );
}

/* ---------------- helpers ---------------- */

function isValidYouTubeUrl(s: string) {
  try {
    const u = new URL(s);
    return /(^|\.)youtube\.com$/.test(u.hostname) || u.hostname === "youtu.be";
  } catch {
    return false;
  }
}

function extractYouTubeId(s: string): string | null {
  try {
    const u = new URL(s);
    if (u.hostname === "youtu.be") return u.pathname.slice(1) || null;
    if (/youtube\.com$/.test(u.hostname)) {
      if (u.pathname === "/watch") return u.searchParams.get("v");
      if (u.pathname.startsWith("/shorts/")) return u.pathname.split("/")[2] || null;
    }
    return null;
  } catch {
    return null;
  }
}

function mergeUint8Arrays(chunks: Uint8Array[], total: number) {
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.byteLength;
  }
  return out;
}
