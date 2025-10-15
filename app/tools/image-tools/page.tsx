"use client";

import { useMemo, useRef, useState } from "react";

type Fit = "cover" | "contain" | "inside" | "outside" | "fill";
type OutFormat = "auto" | "png" | "jpg" | "webp";

export default function ImageToolsPage() {
  const [file, setFile] = useState<File | null>(null);
  const [outUrl, setOutUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // controls
  const [width, setWidth] = useState<string>("");
  const [height, setHeight] = useState<string>("");
  const [fit, setFit] = useState<Fit>("inside");
  const [format, setFormat] = useState<OutFormat>("auto");
  const [quality, setQuality] = useState<number>(85);
  const [strip, setStrip] = useState<boolean>(true);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);

  function onPick(f: File) {
    setFile(f);
    setOutUrl(null);
    setErr(null);
  }

  async function run() {
    if (!file) return;
    setBusy(true); setErr(null); setOutUrl(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("width", width);
      fd.append("height", height);
      fd.append("fit", fit);
      fd.append("format", format);
      fd.append("quality", String(quality));
      fd.append("strip", String(strip));

      const res = await fetch("/api/image-tools", { method: "POST", body: fd });
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(t || `HTTP ${res.status}`);
      }
      const blob = await res.blob();
      setOutUrl(URL.createObjectURL(blob));
    } catch (e: any) {
      setErr(e?.message || "Processing failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-4xl px-4 pt-10">
      <h1 className="text-3xl font-semibold">Image Tools</h1>
      <p className="mt-2 text-white/70">Resize, compress, change format, and strip metadata. Quick and clean.</p>

      {/* picker */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const f = e.dataTransfer.files?.[0];
          if (f) onPick(f);
        }}
        className="mt-6 rounded-xl card p-6 text-center"
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onPick(f); }}
        />
        <div className="text-sm text-white/70">Drag & drop an image here</div>
        <div className="mt-2 text-xs text-white/40">PNG • JPG • WEBP • GIF • TIFF</div>
        <button className="btn rounded-md mt-4" onClick={() => inputRef.current?.click()}>
          Choose File
        </button>
      </div>

      {/* controls */}
      {file && (
        <section className="mt-6 grid gap-6 md:grid-cols-2">
          {/* left: preview */}
          <div className="rounded-xl card p-3">
            <div className="mb-2 text-sm text-white/70">Original</div>
            <div className="relative overflow-hidden rounded-lg min-h-[200px] flex items-center justify-center">
              <Checkerboard />
              <img src={previewUrl!} alt="original" className="relative z-10 max-h-[420px] w-full object-contain" />
            </div>
            <div className="mt-2 text-xs text-white/50 break-all">{file.name} • {(file.size/1024/1024).toFixed(2)} MB</div>
          </div>

          {/* right: options & output */}
          <div className="rounded-xl card p-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-white/60">Width (px)</label>
                <input
                  value={width}
                  onChange={(e) => setWidth(e.target.value.replace(/\D/g,""))}
                  placeholder="auto"
                  className="mt-1 w-full rounded-md border border-[var(--border)] bg-transparent px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                />
              </div>
              <div>
                <label className="text-xs text-white/60">Height (px)</label>
                <input
                  value={height}
                  onChange={(e) => setHeight(e.target.value.replace(/\D/g,""))}
                  placeholder="auto"
                  className="mt-1 w-full rounded-md border border-[var(--border)] bg-transparent px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                />
              </div>

              <div>
                <label className="text-xs text-white/60">Fit</label>
                <select
                  value={fit}
                  onChange={(e) => setFit(e.target.value as Fit)}
                  className="mt-1 w-full rounded-md border border-[var(--border)] bg-transparent px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                >
                  <option value="inside">Inside (no crop)</option>
                  <option value="cover">Cover (crop)</option>
                  <option value="contain">Contain (letterbox)</option>
                  <option value="outside">Outside</option>
                  <option value="fill">Fill (distort)</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-white/60">Format</label>
                <select
                  value={format}
                  onChange={(e) => setFormat(e.target.value as OutFormat)}
                  className="mt-1 w-full rounded-md border border-[var(--border)] bg-transparent px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                >
                  <option value="auto">Auto (keep)</option>
                  <option value="jpg">JPG</option>
                  <option value="png">PNG</option>
                  <option value="webp">WEBP</option>
                </select>
              </div>

              <div className="col-span-2">
                <label className="text-xs text-white/60 flex items-center justify-between">
                  <span>Quality {format === "png" ? "(compression level)" : ""}</span>
                  <span className="text-white/40">{quality}</span>
                </label>
                <input
                  type="range"
                  min={format === "png" ? 0 : 40}
                  max={format === "png" ? 9 : 100}
                  value={quality}
                  onChange={(e) => setQuality(Number(e.target.value))}
                  className="mt-1 w-full"
                />
              </div>

              <label className="col-span-2 flex items-center gap-2 text-sm text-white/80">
                <input
                  type="checkbox"
                  checked={strip}
                  onChange={(e) => setStrip(e.target.checked)}
                />
                Strip metadata (EXIF, GPS, etc.)
              </label>
            </div>

            <div className="mt-4 flex items-center gap-3">
              <button
                onClick={run}
                disabled={busy}
                className={`rounded-md px-4 py-2 text-sm font-medium border ${busy ? "opacity-50 cursor-not-allowed border-[var(--border)] text-white/40" : "btn"}`}
                style={busy ? {} : { borderColor: "var(--accent)", background: "var(--accent)", color: "#000" }}
              >
                {busy ? "Working…" : "Process"}
              </button>
              {outUrl && (
                <a
                  className="btn-ghost rounded-md"
                  href={outUrl}
                  download={downloadName(file?.name, format)}
                >
                  Download
                </a>
              )}
            </div>

            {err && (
              <div className="mt-3 rounded-md border border-red-500/30 bg-black/30 p-3 text-sm text-red-300">
                Error: {err}
              </div>
            )}
          </div>
        </section>
      )}
    </main>
  );
}

function Checkerboard() {
  return (
    <div
      aria-hidden
      className="absolute inset-0 z-0"
      style={{
        backgroundImage:
          "linear-gradient(45deg, #0c0f20 25%, transparent 25%), linear-gradient(-45deg, #0c0f20 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #0c0f20 75%), linear-gradient(-45deg, transparent 75%, #0c0f20 75%)",
        backgroundSize: "20px 20px",
        backgroundPosition: "0 0, 0 10px, 10px -10px, -10px 0px",
      }}
    />
  );
}

function downloadName(src?: string, fmt: OutFormat = "auto") {
  if (!src) return "output.png";
  const base = src.replace(/\.[^.]+$/,"");
  const ext = fmt === "auto" ? src.split(".").pop() || "png" : fmt;
  return `${base}.${ext}`;
}
