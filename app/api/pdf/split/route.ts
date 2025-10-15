import { NextRequest } from "next/server";
import { PDFDocument } from "pdf-lib";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    if (!(req.headers.get("content-type") || "").includes("multipart/form-data")) {
      return text(400, "Expected multipart/form-data");
    }
    const form = await req.formData();
    const file = form.get("file") as File | null;
    const ranges = String(form.get("ranges") || "").trim();
    if (!file) return text(400, "Missing file");
    if (!ranges) return text(400, "Missing ranges");

    const src = await PDFDocument.load(new Uint8Array(await file.arrayBuffer()));
    const out = await PDFDocument.create();

    const wanted = parseRanges(ranges, src.getPageCount()); // 1-based to 0-based indices
    const pages = await out.copyPages(src, wanted);
    pages.forEach(p => out.addPage(p));

    const bytes = await out.save();
    return new Response(new Blob([bytes], { type: "application/pdf" }), {
      headers: {
        "Cache-Control": "no-store",
        "Content-Disposition": 'attachment; filename="extracted.pdf"'
      }
    });
  } catch (e: any) {
    return text(500, `Split failed: ${e?.message || e}`);
  }
}

function parseRanges(r: string, max: number) {
  const out: number[] = [];
  for (const part of r.split(",").map(s => s.trim()).filter(Boolean)) {
    if (part.includes("-")) {
      const [a, b] = part.split("-").map(n => parseInt(n, 10));
      const start = Math.max(1, Math.min(a, b));
      const end = Math.min(max, Math.max(a, b));
      for (let i = start; i <= end; i++) out.push(i - 1);
    } else {
      const n = parseInt(part, 10);
      if (Number.isFinite(n) && n >= 1 && n <= max) out.push(n - 1);
    }
  }
  // dedupe, preserve order
  return [...new Set(out)];
}

function text(status: number, msg: string) {
  return new Response(msg, { status, headers: { "Content-Type": "text/plain" } });
}
