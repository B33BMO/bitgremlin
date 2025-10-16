"use client";

import { useEffect, useRef, useState, useCallback } from "react";

// Dynamic import wrapper with proper client-side checking
let pdfjsLib: any = null;
let pdfjsLoaded = false;
const PDFJS_WORKER_SRC = "/pdf.worker.min.mjs";

async function loadPdfjs() {
  if (pdfjsLoaded) return pdfjsLib;
  
  // Only load on client side
  if (typeof window === 'undefined') return null;
  
  try {
    const pdfjsModule = await import("pdfjs-dist/build/pdf");
    pdfjsLib = pdfjsModule;
    
    // Set worker source
    if (pdfjsLib.GlobalWorkerOptions) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_SRC;
    }
    
    pdfjsLoaded = true;
    return pdfjsLib;
  } catch (error) {
    console.error("Failed to load PDF.js:", error);
    return null;
  }
}

async function ensurePdfWorker() {
  return await loadPdfjs();
}

type Tab = "merge" | "split" | "compress" | "text" | "sign";

export default function PDFSuitePage() {
  const [tab, setTab] = useState<Tab>("merge");

  // Set worker once for all pdf.js usage (no bundling of worker needed).
  useEffect(() => {
    // runs client-side after hydration
    ensurePdfWorker();
  }, []);

  return (
    <main className="mx-auto max-w-4xl px-4 pt-10">
      <h1 className="text-3xl font-semibold">PDF Suite</h1>
      <p className="mt-2 text-white/70">
        Merge, split, compress, extract text, or sign with PKCS#7. All local, no uploads to third parties.
      </p>

      <div className="mt-6 flex gap-2">
        <TabBtn cur={tab} id="merge" setTab={setTab} label="Merge" />
        <TabBtn cur={tab} id="split" setTab={setTab} label="Split / Extract" />
        <TabBtn cur={tab} id="compress" setTab={setTab} label="Compress" />
        <TabBtn cur={tab} id="text" setTab={setTab} label="Extract Text" />
        <TabBtn cur={tab} id="sign" setTab={setTab} label="Sign (PKCS#7)" />
      </div>

      <div className="mt-4 rounded-xl card p-5">
        {tab === "merge" && <MergeTool />}
        {tab === "split" && <SplitTool />}
        {tab === "compress" && <CompressTool />}
        {tab === "text" && <TextTool />}
        {tab === "sign" && <SignTool />}
      </div>
    </main>
  );
}

function TabBtn({
  cur,
  id,
  setTab,
  label,
}: {
  cur: Tab;
  id: Tab;
  setTab: (t: Tab) => void;
  label: string;
}) {
  const active = cur === id;
  return (
    <button
      onClick={() => setTab(id)}
      className={`rounded-md px-3 py-1 text-sm border ${
        active ? "btn" : "border-[var(--border)] text-white/70 hover:text-[var(--accent)]"
      }`}
      style={
        active
          ? { borderColor: "var(--accent)", background: "var(--accent)", color: "#000" }
          : {}
      }
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
    setErr(null);
    setUrl(null);
    setFiles(
      Array.from(list).filter(
        (f) => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf")
      )
    );
  }

  async function run() {
    setBusy(true);
    setErr(null);
    setUrl(null);
    try {
      const fd = new FormData();
      files.forEach((f) => fd.append("files", f));
      const res = await fetch("/api/pdf/merge", { method: "POST", body: fd });
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      setUrl(URL.createObjectURL(blob));
    } catch (e: any) {
      setErr(e?.message || "Merge failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <h2 className="text-xl font-medium">Merge PDFs</h2>
      <p className="mt-1 text-white/60">Order matters. First = first in output.</p>

      <div className="mt-4 flex gap-3">
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="application/pdf"
          className="hidden"
          onChange={(e) => pick(e.target.files)}
        />
        <button className="btn rounded-md" onClick={() => inputRef.current?.click()}>
          Choose PDFs
        </button>
        <button className="btn-ghost rounded-md" onClick={() => setFiles([])}>
          Clear
        </button>
        <button
          className="ml-auto rounded-md px-4 py-2 text-sm font-medium border"
          disabled={!files.length || busy}
          onClick={run}
          style={
            !files.length || busy
              ? {}
              : { borderColor: "var(--accent)", background: "var(--accent)", color: "#000" }
          }
        >
          {busy ? "Working…" : "Merge"}
        </button>
      </div>

      {!!files.length && (
        <ul className="mt-3 text-xs text-white/60 space-y-1">
          {files.map((f, i) => (
            <li key={i} className="truncate">
              {i + 1}. {f.name}
            </li>
          ))}
        </ul>
      )}

      {err && <ErrorBox msg={err} />}
      {url && (
        <a className="btn rounded-md mt-3 inline-block" href={url} download="merged.pdf">
          Download merged.pdf
        </a>
      )}
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
    setBusy(true);
    setErr(null);
    setUrl(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("ranges", ranges);
      const res = await fetch("/api/pdf/split", { method: "POST", body: fd });
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      setUrl(URL.createObjectURL(blob));
    } catch (e: any) {
      setErr(e?.message || "Extract failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <h2 className="text-xl font-medium">Split / Extract pages</h2>
      <p className="mt-1 text-white/60">
        Use ranges like <code>1,3-5,10</code>.
      </p>
      <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto] items-end">
        <div className="flex gap-3">
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
          <button className="btn rounded-md" onClick={() => inputRef.current?.click()}>
            Choose PDF
          </button>
          {file && (
            <span className="text-xs text-white/50 self-center truncate max-w-[16rem]">
              {file.name}
            </span>
          )}
        </div>
        <div className="flex gap-3">
          <input
            value={ranges}
            onChange={(e) => setRanges(e.target.value)}
            placeholder="1,3-5,10"
            className="rounded-md border border-[var(--border)] bg-transparent px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
          />
          <button
            className="rounded-md px-4 py-2 text-sm font-medium border"
            disabled={!file || !ranges || busy}
            onClick={run}
            style={
              !file || !ranges || busy
                ? {}
                : { borderColor: "var(--accent)", background: "var(--accent)", color: "#000" }
            }
          >
            {busy ? "Working…" : "Extract"}
          </button>
        </div>
      </div>
      {err && <ErrorBox msg={err} />}
      {url && (
        <a className="btn rounded-md mt-3 inline-block" href={url} download="extracted.pdf">
          Download extracted.pdf
        </a>
      )}
    </>
  );
}

/* ---------- Sign (PKCS#7 with click-to-place) ---------- */

function SignTool() {
  const [pdf, setPdf] = useState<File | null>(null);
  const [page, setPage] = useState<number>(1);

  const [pfx, setPfx] = useState<File | null>(null);
  const [pass, setPass] = useState("");

  const [text, setText] = useState("John Q. Gremlin");
  const [ttf, setTtf] = useState<File | null>(null); // optional handwritten TTF
  const [widthPct, setWidthPct] = useState(28); // % of page width to occupy

  const [clickPt, setClickPt] = useState<{ x: number; y: number } | null>(null); // PDF coords
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);

  const { canvasRef, pageSize, pageCount, reload } = usePdfPagePreview(pdf, page);

  // Only reload when pdf or page actually changes, not on every render
  useEffect(() => {
    if (pdf && page) {
      reload();
    }
  }, [pdf, page]); // Remove reload from dependencies

  function onCanvasClick(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!pageSize) return;
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    // pdfjs renders origin at top-left; PDF uses bottom-left
    setClickPt({ x: cx, y: pageSize.h - cy });
  }

  async function run() {
    setErr(null);
    setUrl(null);
    if (!pdf) return setErr("Choose a PDF.");
    if (!pfx) return setErr("Choose a .p12/.pfx certificate.");
    if (!clickPt) return setErr("Click on the page to place the signature.");
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", pdf);
      fd.append("p12", pfx);
      fd.append("pass", pass);
      fd.append("page", String(page));
      fd.append("x", String(Math.round(clickPt.x)));
      fd.append("y", String(Math.round(clickPt.y)));
      fd.append("widthPct", String(widthPct));
      fd.append("text", text);
      if (ttf) fd.append("ttf", ttf);

      const res = await fetch("/api/pdf/pkcs7-sign", { method: "POST", body: fd });
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      setUrl(URL.createObjectURL(blob));
    } catch (e: any) {
      setErr(e?.message || "Signing failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <h2 className="text-xl font-medium">Sign (PKCS#7)</h2>
      
      {/* WARNING BANNER */}
      <div className="mt-2 p-3 rounded-md border border-yellow-500/50 bg-yellow-500/10">
        <div className="flex items-center gap-2">
          <span className="text-yellow-300 font-semibold">⚠️ WARNING!</span>
          <span className="text-yellow-200 text-sm">
            I am still trying to debug and make sure this tool works!! It is a HUGE WIP.
          </span>
        </div>
      </div>
      
      <p className="mt-1 text-white/60">
        Type your name/initials, (optionally) pick a handwritten TTF, click on the page to place, and sign with a
        .p12/.pfx certificate.
      </p>

      <div className="mt-4 grid gap-6 md:grid-cols-[1.2fr,1fr]">
        {/* Left: preview */}
        <div className="rounded-xl card p-4">
          <div className="flex flex-wrap items-center gap-3">
            <label className="btn rounded-md cursor-pointer">
              <input
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(e) => setPdf(e.target.files?.[0] || null)}
              />
              Choose PDF
            </label>
            <span className="text-xs text-white/60 truncate max-w-[18rem]">
              {pdf ? pdf.name : "No file selected"}
            </span>

            <div className="flex items-center gap-2 ml-auto">
              <span className="text-xs text-white/60">Page</span>
              <input
                type="number"
                min={1}
                max={pageCount || 999}
                value={page}
                onChange={(e) => setPage(Math.max(1, parseInt(e.target.value || "1", 10)))}
                className="w-20 rounded-md border border-[var(--border)] bg-transparent px-2 py-1 text-sm outline-none"
              />
              <span className="text-xs text-white/40">/ {pageCount || "?"}</span>
            </div>
          </div>

          <div className="mt-4 overflow-auto rounded-md border border-[var(--border)] bg-black/20">
            <canvas ref={canvasRef} onClick={onCanvasClick} className="cursor-crosshair block" />
          </div>

          {clickPt && (
            <div className="mt-2 text-xs text-white/50">
              Placed at (x: {clickPt.x}, y: {clickPt.y}) on page {page}
            </div>
          )}
        </div>

        {/* Right: settings */}
        <div className="rounded-xl card p-4 grid gap-4">
          <div>
            <label className="text-xs text-white/60">Name / Initials (rendered)</label>
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="mt-1 w-full rounded-md border border-[var(--border)] bg-transparent px-3 py-2 text-sm outline-none"
              placeholder="e.g., John Q. Gremlin"
            />
          </div>

          <div>
            <label className="text-xs text-white/60">Handwritten font (.ttf, optional)</label>
            <input
              type="file"
              accept=".ttf"
              className="mt-1 w-full text-xs"
              onChange={(e) => setTtf(e.target.files?.[0] || null)}
            />
          </div>

          <div>
            <label className="text-xs text-white/60 flex items-center justify-between">
              <span>Signature width (% of page width)</span>
              <span className="text-white/40">{widthPct}%</span>
            </label>
            <input
              type="range"
              min={10}
              max={60}
              value={widthPct}
              onChange={(e) => setWidthPct(parseInt(e.target.value, 10))}
              className="mt-1 w-full"
            />
          </div>

          <div className="grid gap-3">
            <div>
              <label className="text-xs text-white/60">Certificate (.p12 / .pfx)</label>
              <input
                type="file"
                accept=".p12,.pfx"
                className="mt-1 w-full text-xs"
                onChange={(e) => setPfx(e.target.files?.[0] || null)}
              />
            </div>
            <div>
              <label className="text-xs text-white/60">Passphrase</label>
              <input
                type="password"
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                className="mt-1 w-full rounded-md border border-[var(--border)] bg-transparent px-3 py-2 text-sm outline-none"
              />
            </div>
          </div>

          <button
            onClick={run}
            disabled={busy}
            className={`rounded-md px-4 py-2 text-sm font-medium border ${
              busy ? "opacity-50 cursor-not-allowed border-[var(--border)] text-white/40" : "btn"
            }`}
            style={
              busy ? {} : { borderColor: "var(--accent)", background: "var(--accent)", color: "#000" }
            }
          >
            {busy ? "Signing…" : "Apply & Sign"}
          </button>

          {err && <ErrorBox msg={err} />}
          {url && (
            <a className="btn rounded-md" href={url} download="signed.pdf">
              Download signed.pdf
            </a>
          )}
        </div>
      </div>
    </>
  );
}

/* ---------- Compress ---------- */

function CompressTool() {
  const [file, setFile] = useState<File | null>(null);
  const [preset, setPreset] = useState<"/screen" | "/ebook" | "/printer" | "/prepress">(
    "/ebook"
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  async function run() {
    if (!file) return;
    setBusy(true);
    setErr(null);
    setUrl(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("preset", preset);
      const res = await fetch("/api/pdf/compress", { method: "POST", body: fd });
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      setUrl(URL.createObjectURL(blob));
    } catch (e: any) {
      setErr(e?.message || "Compress failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <h2 className="text-xl font-medium">Compress</h2>
      <p className="mt-1 text-white/60">Uses Ghostscript if available. Falls back to linearize only.</p>
      <div className="mt-4 flex flex-wrap gap-3 items-end">
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
        />
        <button className="btn rounded-md" onClick={() => inputRef.current?.click()}>
          Choose PDF
        </button>
        {file && (
          <span className="text-xs text-white/50 self-center truncate max-w-[16rem]">
            {file.name}
          </span>
        )}
        <select
          value={preset}
          onChange={(e) => setPreset(e.target.value as any)}
          className="rounded-md border border-[var(--border)] bg-transparent px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
        >
          <option value="/screen">Screen (smallest)</option>
          <option value="/ebook">eBook (good)</option>
          <option value="/printer">Printer</option>
          <option value="/prepress">Prepress (largest)</option>
        </select>
        <button
          className="rounded-md px-4 py-2 text-sm font-medium border"
          disabled={!file || busy}
          onClick={run}
          style={
            !file || busy
              ? {}
              : { borderColor: "var(--accent)", background: "var(--accent)", color: "#000" }
          }
        >
          {busy ? "Working…" : "Compress"}
        </button>
      </div>
      {err && <ErrorBox msg={err} />}
      {url && (
        <a className="btn rounded-md mt-3 inline-block" href={url} download="compressed.pdf">
          Download compressed.pdf
        </a>
      )}
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
    setBusy(true);
    setErr(null);
    setUrl(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/pdf/text", { method: "POST", body: fd });
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      setUrl(URL.createObjectURL(blob));
    } catch (e: any) {
      setErr(e?.message || "Extract failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <h2 className="text-xl font-medium">Extract Text</h2>
      <p className="mt-1 text-white/60">Gets raw text; scans/images won’t produce text (needs OCR).</p>
      <div className="mt-4 flex gap-3 items-end">
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
        />
        <button className="btn rounded-md" onClick={() => inputRef.current?.click()}>
          Choose PDF
        </button>
        {file && (
          <span className="text-xs text-white/50 self-center truncate max-w-[16rem]">
            {file.name}
          </span>
        )}
        <button
          className="rounded-md px-4 py-2 text-sm font-medium border"
          disabled={!file || busy}
          onClick={run}
          style={
            !file || busy
              ? {}
              : { borderColor: "var(--accent)", background: "var(--accent)", color: "#000" }
          }
        >
          {busy ? "Working…" : "Extract"}
        </button>
      </div>
      {err && <ErrorBox msg={err} />}
      {url && (
        <a className="btn rounded-md mt-3 inline-block" href={url} download="extracted.txt">
          Download extracted.txt
        </a>
      )}
    </>
  );
}

/* ---------- Shared UI ---------- */

function ErrorBox({ msg }: { msg: string }) {
  return (
    <div className="mt-3 rounded-md border border-red-500/30 bg-black/30 p-3 text-sm text-red-300">
      Error: {msg}
    </div>
  );
}

/* ---------- pdf.js preview hook (client-only) ---------- */

function usePdfPagePreview(file: File | null, pageNum: number) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [pageSize, setPageSize] = useState<{ w: number; h: number } | null>(null);
  const [pageCount, setPageCount] = useState<number | null>(null);

  // Keep refs to cancel/cleanup between renders
  const loadingTaskRef = useRef<any | null>(null);
  const renderTaskRef = useRef<any | null>(null);
  const pdfDocRef = useRef<any | null>(null);
  const seqRef = useRef(0); // ignore stale async work

  // Memoize the reload function to prevent infinite re-renders
  const reload = useCallback(async () => {
    if (!file || !canvasRef.current) return;
    
    const pdfjs = await loadPdfjs();
    if (!pdfjs) return;
    
    const currentSeq = ++seqRef.current; // tag latest request

    // Tear down any previous doc and its pending tasks
    if (renderTaskRef.current) {
      try { await renderTaskRef.current.cancel(); } catch {}
      renderTaskRef.current = null;
    }
    if (pdfDocRef.current) {
      try { await pdfDocRef.current.destroy(); } catch {}
      pdfDocRef.current = null;
    }

    try {
      // Load the new/updated doc
      const data = await file.arrayBuffer();
      const loadingTask = pdfjs.getDocument({ data });
      loadingTaskRef.current = loadingTask;

      const pdf = await loadingTask.promise;
      
      // Only proceed if this is still the latest request
      if (seqRef.current !== currentSeq) {
        await pdf.destroy();
        return;
      }
      
      pdfDocRef.current = pdf;
      setPageCount(pdf.numPages);

      const n = Math.min(Math.max(1, pageNum), pdf.numPages);
      
      // Render the page
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Cancel any existing render task
      if (renderTaskRef.current) {
        try { await renderTaskRef.current.cancel(); } catch {}
        renderTaskRef.current = null;
      }

      const page = await pdf.getPage(n);
      const viewport = page.getViewport({ scale: 1.2 });

      // (Re)size canvas before render
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      const renderTask = page.render({ canvasContext: ctx, viewport });
      renderTaskRef.current = renderTask;

      await renderTask.promise;
      
      // Only commit state if this render is still the latest
      if (seqRef.current === currentSeq) {
        setPageSize({ w: viewport.width, h: viewport.height });
      }
      
      try { page.cleanup(); } catch {}
    } catch (err: any) {
      // Ignore expected cancellation between rapid changes
      if (err?.name !== "RenderingCancelledException" && seqRef.current === currentSeq) {
        console.error("PDF rendering error:", err);
      }
    }
  }, [file, pageNum]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      (async () => {
        if (renderTaskRef.current) { try { await renderTaskRef.current.cancel(); } catch {} }
        if (pdfDocRef.current) { try { await pdfDocRef.current.destroy(); } catch {} }
      })();
    };
  }, []);

  return { canvasRef, pageSize, pageCount, reload };
}
