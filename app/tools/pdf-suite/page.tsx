"use client";

import { useMemo, useRef, useState } from "react";

type Tab = "merge" | "split" | "compress" | "text";

export default function PDFSuitePage() {
  const [tab, setTab] = useState<Tab>("merge");

  return (
    <main className="mx-auto max-w-4xl px-4 pt-10">
      <h1 className="text-3xl font-semibold">PDF Suite</h1>
      <p className="mt-2 text-white/70">Merge, split, compress, or extract text. All local, no uploads to third parties.</p>

      <div className="mt-6 flex gap-2">
        <TabBtn cur={tab} id="merge" setTab={setTab} label="Merge" />
        <TabBtn cur={tab} id="split" setTab={setTab} label="Split / Extract" />
        <TabBtn cur={tab} id="compress" setTab={setTab} label="Compress" />
        <TabBtn cur={tab} id="text" setTab={setTab} label="Extract Text" />
      </div>

      <div className="mt-4 rounded-xl card p-5">
        {tab === "merge" && <MergeTool />}
        {tab === "split" && <SplitTool />}
        {tab === "compress" && <CompressTool />}
        {tab === "text" && <TextTool />}
      </div>
    </main>
  );
}

function TabBtn({ cur, id, setTab, label }: { cur: Tab; id: Tab; setTab: (t: Tab)=>void; label: string }) {
  const active = cur === id;
  return (
    <button
      onClick={() => setTab(id)}
      className={`rounded-md px-3 py-1 text-sm border ${active ? "btn" : "border-[var(--border)] text-white/70 hover:text-[var(--accent)]"}`}
      style={active ? { borderColor: "var(--accent)", background: "var(--accent)", color: "#000" } : {}}
    >
      {label}
    </button>
  );
}

/* ---------- Merge ---------- */

function MergeTool() {
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  function pick(list: FileList | null) {
    if (!list) return;
    setErr(null); setUrl(null);
    setFiles(Array.from(list).filter(f => f.type === "application/pdf" || f.name.endsWith(".pdf")));
  }

  async function run() {
    setBusy(true); setErr(null); setUrl(null);
    try {
      const fd = new FormData();
      files.forEach(f => fd.append("files", f));
      const res = await fetch("/api/pdf/merge", { method: "POST", body: fd });
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      setUrl(URL.createObjectURL(blob));
    } catch (e: any) { setErr(e?.message || "Merge failed"); }
    finally { setBusy(false); }
  }

  return (
    <>
      <h2 className="text-xl font-medium">Merge PDFs</h2>
      <p className="mt-1 text-white/60">Order matters. First = first in output.</p>

      <div className="mt-4 flex gap-3">
        <input ref={inputRef} type="file" multiple accept="application/pdf" className="hidden" onChange={(e)=>pick(e.target.files)} />
        <button className="btn rounded-md" onClick={()=>inputRef.current?.click()}>Choose PDFs</button>
        <button className="btn-ghost rounded-md" onClick={()=>setFiles([])}>Clear</button>
        <button className="ml-auto rounded-md px-4 py-2 text-sm font-medium border" disabled={!files.length || busy}
          onClick={run}
          style={!files.length || busy ? {} : { borderColor: "var(--accent)", background: "var(--accent)", color: "#000" }}>
          {busy ? "Working…" : "Merge"}
        </button>
      </div>

      {!!files.length && (
        <ul className="mt-3 text-xs text-white/60 space-y-1">
          {files.map((f, i) => <li key={i} className="truncate">{i+1}. {f.name}</li>)}
        </ul>
      )}

      {err && <ErrorBox msg={err} />}
      {url && <a className="btn rounded-md mt-3 inline-block" href={url} download="merged.pdf">Download merged.pdf</a>}
    </>
  );
}

/* ---------- Split ---------- */

function SplitTool() {
  const [file, setFile] = useState<File | null>(null);
  const [ranges, setRanges] = useState("1"); // e.g. 1,3-5,10
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  async function run() {
    if (!file) return;
    setBusy(true); setErr(null); setUrl(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("ranges", ranges);
      const res = await fetch("/api/pdf/split", { method: "POST", body: fd });
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      setUrl(URL.createObjectURL(blob));
    } catch (e: any) { setErr(e?.message || "Split failed"); }
    finally { setBusy(false); }
  }

  return (
    <>
      <h2 className="text-xl font-medium">Split / Extract pages</h2>
      <p className="mt-1 text-white/60">Use ranges like <code>1,3-5,10</code>.</p>
      <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto] items-end">
        <div className="flex gap-3">
          <input ref={inputRef} type="file" accept="application/pdf" className="hidden" onChange={(e)=> setFile(e.target.files?.[0] || null)} />
          <button className="btn rounded-md" onClick={()=>inputRef.current?.click()}>Choose PDF</button>
          {file && <span className="text-xs text-white/50 self-center truncate max-w-[16rem]">{file.name}</span>}
        </div>
        <div className="flex gap-3">
          <input value={ranges} onChange={(e)=>setRanges(e.target.value)} placeholder="1,3-5,10" className="rounded-md border border-[var(--border)] bg-transparent px-3 py-2 text-sm outline-none focus:border-[var(--accent)]" />
          <button className="rounded-md px-4 py-2 text-sm font-medium border" disabled={!file || !ranges || busy}
            onClick={run}
            style={!file || !ranges || busy ? {} : { borderColor: "var(--accent)", background: "var(--accent)", color: "#000" }}>
            {busy ? "Working…" : "Extract"}
          </button>
        </div>
      </div>
      {err && <ErrorBox msg={err} />}
      {url && <a className="btn rounded-md mt-3 inline-block" href={url} download="extracted.pdf">Download extracted.pdf</a>}
    </>
  );
}

/* ---------- Compress ---------- */

function CompressTool() {
  const [file, setFile] = useState<File | null>(null);
  const [preset, setPreset] = useState<"/screen"|"/ebook"|"/printer"|"/prepress">("/ebook");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  async function run() {
    if (!file) return;
    setBusy(true); setErr(null); setUrl(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("preset", preset);
      const res = await fetch("/api/pdf/compress", { method: "POST", body: fd });
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      setUrl(URL.createObjectURL(blob));
    } catch (e: any) { setErr(e?.message || "Compress failed"); }
    finally { setBusy(false); }
  }

  return (
    <>
      <h2 className="text-xl font-medium">Compress</h2>
      <p className="mt-1 text-white/60">Uses Ghostscript if available. Falls back to linearize only.</p>
      <div className="mt-4 flex flex-wrap gap-3 items-end">
        <input ref={inputRef} type="file" accept="application/pdf" className="hidden" onChange={(e)=> setFile(e.target.files?.[0] || null)} />
        <button className="btn rounded-md" onClick={()=>inputRef.current?.click()}>Choose PDF</button>
        {file && <span className="text-xs text-white/50 self-center truncate max-w-[16rem]">{file.name}</span>}
        <select value={preset} onChange={(e)=>setPreset(e.target.value as any)} className="rounded-md border border-[var(--border)] bg-transparent px-3 py-2 text-sm outline-none focus:border-[var(--accent)]">
          <option value="/screen">Screen (smallest)</option>
          <option value="/ebook">eBook (good)</option>
          <option value="/printer">Printer</option>
          <option value="/prepress">Prepress (largest)</option>
        </select>
        <button className="rounded-md px-4 py-2 text-sm font-medium border" disabled={!file || busy}
          onClick={run}
          style={!file || busy ? {} : { borderColor: "var(--accent)", background: "var(--accent)", color: "#000" }}>
          {busy ? "Working…" : "Compress"}
        </button>
      </div>
      {err && <ErrorBox msg={err} />}
      {url && <a className="btn rounded-md mt-3 inline-block" href={url} download="compressed.pdf">Download compressed.pdf</a>}
    </>
  );
}

/* ---------- Text ---------- */

function TextTool() {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  async function run() {
    if (!file) return;
    setBusy(true); setErr(null); setUrl(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/pdf/text", { method: "POST", body: fd });
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      setUrl(URL.createObjectURL(blob));
    } catch (e: any) { setErr(e?.message || "Extract failed"); }
    finally { setBusy(false); }
  }

  return (
    <>
      <h2 className="text-xl font-medium">Extract Text</h2>
      <p className="mt-1 text-white/60">Gets raw text; scans/images won’t produce text (needs OCR).</p>
      <div className="mt-4 flex gap-3 items-end">
        <input ref={inputRef} type="file" accept="application/pdf" className="hidden" onChange={(e)=> setFile(e.target.files?.[0] || null)} />
        <button className="btn rounded-md" onClick={()=>inputRef.current?.click()}>Choose PDF</button>
        {file && <span className="text-xs text-white/50 self-center truncate max-w-[16rem]">{file.name}</span>}
        <button className="rounded-md px-4 py-2 text-sm font-medium border" disabled={!file || busy}
          onClick={run}
          style={!file || busy ? {} : { borderColor: "var(--accent)", background: "var(--accent)", color: "#000" }}>
          {busy ? "Working…" : "Extract"}
        </button>
      </div>
      {err && <ErrorBox msg={err} />}
      {url && <a className="btn rounded-md mt-3 inline-block" href={url} download="extracted.txt">Download extracted.txt</a>}
    </>
  );
}

function ErrorBox({ msg }: { msg: string }) {
  return <div className="mt-3 rounded-md border border-red-500/30 bg-black/30 p-3 text-sm text-red-300">Error: {msg}</div>;
}
