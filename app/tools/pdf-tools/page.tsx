"use client";

import { useEffect, useRef, useState } from "react";

// Client-only preview via pdf.js
// If you're on pdfjs-dist 4.x, these two imports work in Next (client components).
// Don’t import them anywhere server-side.
import * as pdfjsLib from "pdfjs-dist/build/pdf";
import "pdfjs-dist/build/pdf.worker.entry";

type ClickPt = { x: number; y: number };

export default function PdfSignPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 pt-10">
      <h1 className="text-3xl font-semibold">Sign (PKCS#7)</h1>
      <p className="mt-2 text-white/70">
        Type your name/initials, choose a handwritten font (optional), click on the page to place,
        and we’ll create a real PKCS#7 digital signature.
      </p>
      <div className="mt-6">
        <ESignTool />
      </div>
    </main>
  );
}

function ESignTool() {
  const [pdf, setPdf] = useState<File | null>(null);
  const [page, setPage] = useState<number>(1);

  const [pfx, setPfx] = useState<File | null>(null);
  const [pass, setPass] = useState("");

  const [text, setText] = useState("John Q. Gremlin");
  const [ttf, setTtf] = useState<File | null>(null); // optional handwritten TTF
  const [widthPct, setWidthPct] = useState(28); // % of page width to occupy

  const [clickPt, setClickPt] = useState<ClickPt | null>(null); // PDF coords (origin bottom-left)

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [dlUrl, setDlUrl] = useState<string | null>(null);

  const { canvasRef, pageSize, pageCount, reload } = usePdfPagePreview(pdf, page);

  useEffect(() => {
    if (pdf && page) reload();
  }, [pdf, page, reload]);

  function onCanvasClick(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!pageSize) return;
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    // pdfjs canvas origin is top-left, PDF uses bottom-left.
    const x = cx;
    const y = pageSize.h - cy;
    setClickPt({ x, y });
  }

  async function runSign() {
    setErr(null);
    setDlUrl(null);
    if (!pdf) return setErr("Select a PDF.");
    if (!pfx) return setErr("Select a .p12/.pfx certificate.");
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
      setDlUrl(URL.createObjectURL(blob));
    } catch (e: any) {
      setErr(e?.message || "Signing failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="grid gap-6 md:grid-cols-[1.2fr,1fr]">
      {/* Left: preview + pickers */}
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

      {/* Right: signature settings */}
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
          <p className="mt-1 text-xs text-white/40">
            Tip: Google “handwritten TTF” (Patrick Hand, Shadows Into Light, etc.)
          </p>
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
          onClick={runSign}
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

        {err && (
          <div className="rounded-md border border-red-500/30 bg-black/30 p-3 text-sm text-red-300">
            Error: {err}
          </div>
        )}
        {dlUrl && (
          <a className="btn rounded-md" href={dlUrl} download="signed.pdf">
            Download signed.pdf
          </a>
        )}
      </div>
    </section>
  );
}

/* ---------------- preview hook ---------------- */

function usePdfPagePreview(file: File | null, pageNum: number) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [pageSize, setPageSize] = useState<{ w: number; h: number } | null>(null);
  const [pageCount, setPageCount] = useState<number | null>(null);

  const reload = async () => {
    if (!file || !canvasRef.current) return;
    const data = await file.arrayBuffer();
    const pdf = await (pdfjsLib as any).getDocument({ data }).promise;
    setPageCount(pdf.numPages);

    const n = Math.min(Math.max(1, pageNum), pdf.numPages);
    const page = await pdf.getPage(n);
    const viewport = page.getViewport({ scale: 1.2 });
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    setPageSize({ w: viewport.width, h: viewport.height });
    await page.render({ canvasContext: ctx, viewport }).promise;
  };

  return { canvasRef, pageSize, pageCount, reload };
}
