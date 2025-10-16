"use client";

import { useCallback, useMemo, useRef, useState } from "react";

type JobState = "idle" | "uploading" | "processing" | "done" | "error";

export default function BackgroundRemoverPage() {
  const [file, setFile] = useState<File | null>(null);
  const [job, setJob] = useState<JobState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [outUrl, setOutUrl] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const onDrop = useCallback((f: File) => {
    setError(null);
    setOutUrl(null);
    setFile(f);
  }, []);

  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);

  async function run() {
    if (!file) return;
    setJob("uploading");
    setError(null);
    setOutUrl(null);

    try {
      const form = new FormData();
      form.append("image", file);

      setJob("processing");
      const res = await fetch("/api/remove-bg", { method: "POST", body: form });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }

      // we get back a Blob (image/png) or a JSON with url – this route sends a Blob
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setOutUrl(url);
      setJob("done");
    } catch (e: any) {
      setError(e?.message || "Unknown error");
      setJob("error");
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-4 pt-10">
      <h1 className="text-3xl font-semibold">Background Remover</h1>
      <p className="mt-2 text-white/70">
        Upload an image → get a transparent PNG. Runs locally via <code className="text-[var(--accent)]">rembg</code> 
      </p>

      {/* Drop / picker */}
<div
  onDragOver={(e) => e.preventDefault()}
  onDrop={(e) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) {
      inputRef.current!.value = ""; // reset so re-uploads work
      onDrop(f);
    }
  }}
  className="mt-6 rounded-xl card p-6 neon-edge text-center cursor-pointer hover:bg-white/5 transition-colors"
  onClick={() => inputRef.current?.click()}
>
  <input
    ref={inputRef}
    type="file"
    accept="image/*"
    className="hidden"
    onChange={(e) => {
      const f = e.target.files?.[0];
      if (f) {
        inputRef.current!.value = ""; // <-- force re-trigger on same file
        onDrop(f);
      }
    }}
  />

  <div className="text-sm text-white/60 select-none">
    Drag & drop an image here or click to choose
  </div>
  <div className="mt-2 text-xs text-white/40">
    PNG • JPG • WEBP — up to ~10MB
  </div>
  <div className="mt-4 flex justify-center">
    <button
      type="button"
      className="btn rounded-md"
      onClick={(e) => {
        e.stopPropagation(); // stop parent click
        inputRef.current?.click();
      }}
    >
      Choose File
    </button>
  </div>
</div>


      {/* Selected file preview */}
      {file && (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="rounded-xl card p-3">
            <div className="mb-2 text-sm text-white/70">Original</div>
            {/* checkerboard bg behind image */}
            <div className="relative overflow-hidden rounded-lg">
              <Checkerboard />
              {/* preview */}
              <img src={previewUrl!} alt="preview" className="relative z-10 max-h-[420px] w-full object-contain" />
            </div>
            <div className="mt-3 text-xs text-white/50 break-all">{file.name} • {(file.size/1024/1024).toFixed(2)} MB</div>
          </div>

          <div className="rounded-xl card p-3">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-sm text-white/70">Output (PNG, transparent)</div>
              <RunButton job={job} run={run} disabled={!file || job === "processing" || job === "uploading"} />
            </div>

            <div className="relative overflow-hidden rounded-lg min-h-[220px] flex items-center justify-center">
              <Checkerboard />
              {job === "idle" && <Hint text="Click Run to start" />}
              {job === "uploading" && <Hint text="Uploading…" />}
              {job === "processing" && <Hint text="Gremlin chewing pixels…" />}
              {job === "error" && <Hint text={`Error: ${error}`} error />}
              {job === "done" && outUrl && (
                <img src={outUrl} alt="result" className="relative z-10 max-h-[420px] w-full object-contain" />
              )}
            </div>

            {outUrl && (
              <div className="mt-3 flex gap-2">
                <a
                  href={outUrl}
                  download={downloadName(file?.name)}
                  className="btn rounded-md"
                >
                  Download PNG
                </a>
                <button
                  className="btn-ghost rounded-md"
                  onClick={() => { setFile(null); setOutUrl(null); setJob("idle"); setError(null); }}
                >
                  Reset
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}

function downloadName(name?: string) {
  if (!name) return "output.png";
  const base = name.replace(/\.[^.]+$/,"");
  return `${base}-no-bg.png`;
}

function RunButton({ job, run, disabled }: { job: string; run: () => void; disabled: boolean }) {
  return (
    <button
      onClick={run}
      disabled={disabled}
      className={`rounded-md px-4 py-2 text-sm font-medium border ${disabled ? "opacity-50 cursor-not-allowed" : "btn"} ${disabled ? "border-[var(--border)] text-white/40 bg-transparent" : ""}`}
      style={disabled ? {} : { borderColor: "var(--accent)", background: "var(--accent)", color: "#000" }}
    >
      {job === "processing" || job === "uploading" ? "Working…" : "Run"}
    </button>
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

function Hint({ text, error }: { text: string; error?: boolean }) {
  return (
    <div className={`relative z-10 rounded-md px-3 py-1 text-xs ${error ? "text-red-300" : "text-white/70"} bg-black/30 border border-[var(--border)]`}>
      {text}
    </div>
  );
}
