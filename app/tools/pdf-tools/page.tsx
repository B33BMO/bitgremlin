"use client";

import { useEffect, useRef, useState } from "react";
// Fix 1: Use the correct import for pdfjs-dist
import * as pdfjsLib from "pdfjs-dist/build/pdf";
import { GlobalWorkerOptions } from "pdfjs-dist/types/src/display/worker_options";

// Fix 2: Correct worker path (adjust based on your actual path)
const PDFJS_WORKER_SRC = "/pdf.worker.min.mjs";

// Fix 3: Improved worker initialization
function ensurePdfWorker() {
  if (!GlobalWorkerOptions.workerSrc) {
    GlobalWorkerOptions.workerSrc = PDFJS_WORKER_SRC;
  }
}

type Tab = "merge" | "split" | "compress" | "text" | "sign";

export default function PDFSuitePage() {
  const [tab, setTab] = useState<Tab>("merge");

  useEffect(() => {
    ensurePdfWorker();
  }, []);

  return (
    <main className="mx-auto max-w-4xl px-4 pt-10">
      <h1 className="text-3xl font-semibold">PDF Suite</h1>
      <p className="mt-2 text-white/70">
        Merge, split, compress, extract text, or sign with PKCS#7. All local, no uploads to third parties.
      </p>

      <div className="mt-6 flex gap-2 flex-wrap">
        <TabBtn cur={tab} id="merge" setTab={setTab} label="Merge" />
        <TabBtn cur={tab} id="split" setTab={setTab} label="Split / Extract" />
        <TabBtn cur={tab} id="compress" setTab={setTab} label="Compress" />
        <TabBtn cur={tab} id="text" setTab={setTab} label="Extract Text" />
        <TabBtn cur={tab} id="sign" setTab={setTab} label="Sign (PKCS#7)" />
      </div>

      <div className="mt-4 rounded-xl card p-5">
        {tab === "merge" && <div>Merge Tool Content</div>}
        {tab === "split" && <div>Split Tool Content</div>}
        {tab === "compress" && <div>Compress Tool Content</div>}
        {tab === "text" && <div>Text Tool Content</div>}
        {tab === "sign" && <div>Sign Tool Content</div>}
      </div>
    </main>
  );
}

// Fix 4: Improved typing
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

// Fix 5: Added missing components (placeholders - implement as needed)
function MergeTool() {
  return <div>Merge Tool Implementation</div>;
}

function SplitTool() {
  return <div>Split Tool Implementation</div>;
}

function CompressTool() {
  return <div>Compress Tool Implementation</div>;
}

function TextTool() {
  return <div>Text Tool Implementation</div>;
}

function SignTool() {
  return <div>Sign Tool Implementation</div>;
}

function ErrorBox({ msg }: { msg: string }) {
  return (
    <div className="mt-3 rounded-md border border-red-500/30 bg-black/30 p-3 text-sm text-red-300">
      Error: {msg}
    </div>
  );
}

// Fix 6: Improved pdf.js preview hook with proper typing
function usePdfPagePreview(file: File | null, pageNum: number) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [pageSize, setPageSize] = useState<{ w: number; h: number } | null>(null);
  const [pageCount, setPageCount] = useState<number | null>(null);

  const loadingTaskRef = useRef<pdfjsLib.PDFDocumentLoadingTask | null>(null);
  const renderTaskRef = useRef<pdfjsLib.RenderTask | null>(null);
  const pdfDocRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);
  const seqRef = useRef(0);

  async function renderPage(n: number) {
    if (!canvasRef.current || !pdfDocRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Cancel previous render task
    if (renderTaskRef.current) {
      try {
        await renderTaskRef.current.cancel();
      } catch {}
      renderTaskRef.current = null;
    }

    try {
      const page = await pdfDocRef.current.getPage(n);
      const viewport = page.getViewport({ scale: 1.2 });

      canvas.width = viewport.width;
      canvas.height = viewport.height;

      const renderContext = {
        canvasContext: ctx,
        viewport: viewport,
      };

      const renderTask = page.render(renderContext);
      renderTaskRef.current = renderTask;

      await renderTask.promise;
      
      if (seqRef.current === n) {
        setPageSize({ w: viewport.width, h: viewport.height });
      }
    } catch (err: any) {
      if (err?.name !== "RenderingCancelledException") {
        console.error("Rendering error:", err);
      }
    } finally {
      renderTaskRef.current = null;
    }
  }

  const reload = async () => {
    if (!file || !canvasRef.current) return;
    ensurePdfWorker();
    seqRef.current = pageNum;

    // Cleanup previous tasks
    if (renderTaskRef.current) {
      try {
        await renderTaskRef.current.cancel();
      } catch {}
      renderTaskRef.current = null;
    }
    if (loadingTaskRef.current) {
      try {
        await loadingTaskRef.current.destroy();
      } catch {}
      loadingTaskRef.current = null;
    }
    if (pdfDocRef.current) {
      try {
        await pdfDocRef.current.destroy();
      } catch {}
      pdfDocRef.current = null;
    }

    try {
      const data = await file.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({ data });
      loadingTaskRef.current = loadingTask;

      const pdf = await loadingTask.promise;
      pdfDocRef.current = pdf;
      setPageCount(pdf.numPages);

      const n = Math.min(Math.max(1, pageNum), pdf.numPages);
      await renderPage(n);
    } catch (err) {
      console.error("PDF loading error:", err);
    }
  };

  useEffect(() => {
    return () => {
      (async () => {
        if (renderTaskRef.current) {
          try {
            await renderTaskRef.current.cancel();
          } catch {}
        }
        if (loadingTaskRef.current) {
          try {
            await loadingTaskRef.current.destroy();
          } catch {}
        }
        if (pdfDocRef.current) {
          try {
            await pdfDocRef.current.destroy();
          } catch {}
        }
      })();
    };
  }, []);

  return { canvasRef, pageSize, pageCount, reload };
}
