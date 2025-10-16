"use client";

import { useMemo, useRef, useState } from "react";

type Job = "idle"|"uploading"|"processing"|"done"|"error";

export default function AudioToolsPage() {
  const [file, setFile] = useState<File|null>(null);
  const [format, setFormat] = useState<"mp3"|"wav"|"flac"|"ogg"|"aac">("mp3");
  const [normalize, setNormalize] = useState(true);
  const [start, setStart] = useState(""); // mm:ss or seconds
  const [end, setEnd] = useState("");     // mm:ss or seconds
  const [bitrate, setBitrate] = useState("192"); // kbps (mp3/aac)
  const [sampleRate, setSampleRate] = useState("44100"); // 44100 / 48000
  const [job, setJob] = useState<Job>("idle");
  const [error, setError] = useState<string|null>(null);
  const [outUrl, setOutUrl] = useState<string|null>(null);
  const inputRef = useRef<HTMLInputElement|null>(null);

  const nameHint = useMemo(() => file ? safeOutName(file.name, format) : `output.${format}`, [file, format]);

  function onPick(f?: File) {
    if (!f) return;
    setFile(f);
    setOutUrl(null);
    setError(null);
    setJob("idle");
  }

  async function run() {
    if (!file) return;
    setJob("uploading");
    setError(null);
    setOutUrl(null);

    const fd = new FormData();
    fd.append("file", file);
    fd.append("format", format);
    fd.append("normalize", String(normalize ? 1 : 0));
    if (start.trim()) fd.append("start", toSeconds(start.trim()).toString());
    if (end.trim()) fd.append("end", toSeconds(end.trim()).toString());
    if (["mp3","aac"].includes(format) && bitrate.trim()) fd.append("bitrate", bitrate.trim());
    if (sampleRate) fd.append("samplerate", sampleRate);

    try {
      setJob("processing");
      const res = await fetch("/api/audio/process", { method: "POST", body: fd });
      if (!res.ok) {
        const t = await res.text().catch(()=> "");
        throw new Error(t || `HTTP ${res.status}`);
      }
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
      <h1 className="text-3xl font-semibold">Audio Tools</h1>
      <p className="mt-2 text-white/70">
        Trim, normalize, and convert audio (MP3/WAV/FLAC/OGG/AAC). Processing runs server-side via ffmpeg.
      </p>

      {/* Drop zone */}
      <div
        onDragOver={(e)=>e.preventDefault()}
        onDrop={(e)=>{e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) onPick(f);}}
        className="mt-6 rounded-xl card p-6 text-center neon-edge"
      >
        <input
          ref={inputRef}
          type="file"
          accept="audio/*,video/*"
          className="hidden"
          onChange={(e)=>onPick(e.target.files?.[0] || undefined)}
        />
        <div className="text-sm text-white/70">Drag & drop a file here</div>
        <div className="mt-1 text-xs text-white/40">MP3 • WAV • FLAC • OGG • AAC • (most video files too)</div>
        <button className="btn rounded-md mt-4" onClick={()=>inputRef.current?.click()}>Choose File</button>
        {file && <div className="mt-3 text-xs text-white/60 break-all">{file.name} • {(file.size/1024/1024).toFixed(2)} MB</div>}
      </div>

      {/* Options */}
      {file && (
        <div className="mt-6 rounded-xl card p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm text-white/70">Output format</label>
              <select
                value={format}
                onChange={(e)=>setFormat(e.target.value as any)}
                className="mt-1 w-full rounded-md border border-[var(--border)] bg-transparent px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
              >
                <option value="mp3">MP3</option>
                <option value="wav">WAV</option>
                <option value="flac">FLAC</option>
                <option value="ogg">OGG (Vorbis)</option>
                <option value="aac">AAC (m4a)</option>
              </select>
            </div>
            <div>
              <label className="text-sm text-white/70">Sample rate</label>
              <select
                value={sampleRate}
                onChange={(e)=>setSampleRate(e.target.value)}
                className="mt-1 w-full rounded-md border border-[var(--border)] bg-transparent px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
              >
                <option value="44100">44.1 kHz</option>
                <option value="48000">48 kHz</option>
              </select>
            </div>

            {["mp3","aac"].includes(format) && (
              <div>
                <label className="text-sm text-white/70">Bitrate (kbps)</label>
                <input
                  value={bitrate}
                  onChange={(e)=>setBitrate(e.target.value)}
                  placeholder="192"
                  className="mt-1 w-full rounded-md border border-[var(--border)] bg-transparent px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                />
              </div>
            )}

            <div className="flex items-center gap-3">
              <input
                id="normalize"
                type="checkbox"
                checked={normalize}
                onChange={(e)=>setNormalize(e.target.checked)}
                className="h-4 w-4"
              />
              <label htmlFor="normalize" className="text-sm text-white/80">Normalize loudness</label>
            </div>

            <div>
              <label className="text-sm text-white/70">Trim start (mm:ss or seconds)</label>
              <input
                value={start}
                onChange={(e)=>setStart(e.target.value)}
                placeholder="0:00"
                className="mt-1 w-full rounded-md border border-[var(--border)] bg-transparent px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
              />
            </div>
            <div>
              <label className="text-sm text-white/70">Trim end (mm:ss or seconds)</label>
              <input
                value={end}
                onChange={(e)=>setEnd(e.target.value)}
                placeholder="1:23"
                className="mt-1 w-full rounded-md border border-[var(--border)] bg-transparent px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
              />
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              onClick={run}
              disabled={job==="processing"||job==="uploading"}
              className={`rounded-md px-4 py-2 text-sm font-medium border ${job==="processing"||job==="uploading" ? "opacity-50 cursor-not-allowed border-[var(--border)] text-white/40" : "btn"}`}
              style={job==="processing"||job==="uploading" ? {} : { borderColor: "var(--accent)", background: "var(--accent)", color: "#000" }}
            >
              {job==="processing"||job==="uploading" ? "Working…" : "Run"}
            </button>

            {outUrl && (
              <a className="btn rounded-md" href={outUrl} download={nameHint}>Download</a>
            )}

            <button className="btn-ghost rounded-md" onClick={()=>{setFile(null); setOutUrl(null); setError(null); setJob("idle");}}>
              Reset
            </button>
          </div>

          {error && <div className="mt-4 rounded-md border border-red-500/30 bg-black/30 p-3 text-sm text-red-300">Error: {error}</div>}
        </div>
      )}
    </main>
  );
}

function toSeconds(x: string) {
  if (!x) return 0;
  if (/^\d+(\.\d+)?$/.test(x)) return parseFloat(x);
  const m = x.split(":").map(Number);
  if (m.length === 2) return m[0]*60 + m[1];
  if (m.length === 3) return m[0]*3600 + m[1]*60 + m[2];
  return 0;
}

function safeOutName(name: string, fmt: string) {
  const base = name.replace(/\.[^.]+$/,"");
  const ext = fmt === "aac" ? "m4a" : fmt;
  return `${base}-edited.${ext}`;
}
