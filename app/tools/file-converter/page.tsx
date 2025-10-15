"use client";

import { useMemo, useRef, useState } from "react";

type Kind = "image" | "audio" | "video";

const IMAGE_OUT = ["png", "jpg", "webp"] as const;
const AUDIO_OUT = ["mp3", "wav", "flac"] as const;
const VIDEO_OUT = ["mp4", "webm"] as const;

export default function FileConverterPage() {
  const [file, setFile] = useState<File | null>(null);
  const [kind, setKind] = useState<Kind | null>(null);
  const [target, setTarget] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outUrl, setOutUrl] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const targets = useMemo(() => {
    if (kind === "image") return [...IMAGE_OUT];
    if (kind === "audio") return [...AUDIO_OUT];
    if (kind === "video") return [...VIDEO_OUT];
    return [];
  }, [kind]);

  function detectKind(f: File): Kind | null {
    const t = (f.type || "").toLowerCase();
    if (t.startsWith("image/")) return "image";
    if (t.startsWith("audio/")) return "audio";
    if (t.startsWith("video/")) return "video";
    // fallback by extension
    const name = f.name.toLowerCase();
    if (/\.(png|jpe?g|webp|gif|bmp|tiff?)$/.test(name)) return "image";
    if (/\.(mp3|wav|flac|m4a|ogg|opus|aac)$/.test(name)) return "audio";
    if (/\.(mp4|mov|m4v|webm|mkv|avi)$/.test(name)) return "video";
    return null;
  }

  function onPick(f: File) {
    setError(null);
    setOutUrl(null);
    setFile(f);
    const k = detectKind(f);
    setKind(k);
    const defaultOut = k === "image" ? "png" : k === "audio" ? "mp3" : k === "video" ? "mp4" : "";
    setTarget(defaultOut);
  }

  async function run() {
    if (!file || !target || !kind) return;
    setBusy(true);
    setError(null);
    setOutUrl(null);

    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("target", target);
      fd.append("kind", kind);

      const res = await fetch("/api/convert", { method: "POST", body: fd });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `HTTP ${res.status}`);
      }
      const blob = await res.blob();
      setOutUrl(URL.createObjectURL(blob));
    } catch (e: any) {
      setError(e?.message || "Conversion failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-4 pt-10">
      <h1 className="text-3xl font-semibold">File Converter</h1>
      <p className="mt-2 text-white/70">Convert images, audio, and video with zero BS. Private, fast, and neat.</p>

      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const f = e.dataTransfer.files?.[0];
          if (f) onPick(f);
        }}
        className="mt-6 rounded-xl card p-6 neon-edge text-center"
      >
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onPick(f);
          }}
        />
        <div className="text-sm text-white/70">Drag & drop a file here</div>
        <div className="mt-2 text-xs text-white/40">Images, audio, or video</div>
        <button className="btn rounded-md mt-4" onClick={() => inputRef.current?.click()}>
          Choose File
        </button>
      </div>

      {file && (
        <div className="mt-6 rounded-xl card p-5">
          <div className="text-sm text-white/70">Source</div>
          <div className="mt-1 text-xs text-white/50 break-all">
            {file.name} • {(file.size / 1024 / 1024).toFixed(2)} MB
            {kind ? ` • ${kind.toUpperCase()}` : ""}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <label className="text-sm text-white/70">Target format</label>
            <select
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              className="rounded-md border border-[var(--border)] bg-transparent px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
            >
              {targets.map((t) => (
                <option key={t} value={t}>{t.toUpperCase()}</option>
              ))}
            </select>

            <button
              onClick={run}
              disabled={busy || !target}
              className={`ml-auto rounded-md px-4 py-2 text-sm font-medium border ${
                busy || !target
                  ? "opacity-50 cursor-not-allowed border-[var(--border)] text-white/40"
                  : "btn"
              }`}
              style={busy || !target ? {} : { borderColor: "var(--accent)", background: "var(--accent)", color: "#000" }}
            >
              {busy ? "Working…" : "Convert"}
            </button>
          </div>

          {error && (
            <div className="mt-4 rounded-md border border-red-500/30 bg-black/30 p-3 text-sm text-red-300">
              Error: {error}
            </div>
          )}
          {outUrl && (
            <div className="mt-4">
              <a className="btn rounded-md" href={outUrl} download={downloadName(file.name, target)}>
                Download .{target.toUpperCase()}
              </a>
              <button className="btn-ghost rounded-md ml-2" onClick={() => { setFile(null); setOutUrl(null); }}>
                Reset
              </button>
            </div>
          )}
        </div>
      )}
    </main>
  );
}

function downloadName(srcName: string, ext: string) {
  const base = srcName.replace(/\.[^.]+$/, "");
  return `${base}.${ext}`;
}
