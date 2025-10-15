import { NextRequest } from "next/server";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

export const runtime = "nodejs";
export const maxDuration = 90;

type Pos = "br" | "bl" | "tr" | "tl";

export async function POST(req: NextRequest) {
  try {
    if (!(req.headers.get("content-type") || "").includes("multipart/form-data")) {
      return txt(400, "Expected multipart/form-data");
    }
    const form = await req.formData();

    const file = form.get("file") as File | null;
    const sig = form.get("sig") as File | null;
    if (!file || !sig) return txt(400, "Missing file or signature");

    const pagesSpec = String(form.get("pages") || "last").trim();
    const pos = (String(form.get("pos") || "br") as Pos);
    const offsetX = toInt(form.get("offsetX")) ?? 24;
    const offsetY = toInt(form.get("offsetY")) ?? 24;
    const widthPct = clamp(toInt(form.get("widthPct")) ?? 30, 5, 90);
    const addDate = String(form.get("addDate") || "true") === "true";

    // Load PDF
    const srcBuf = Buffer.from(await file.arrayBuffer());
    const doc = await PDFDocument.load(srcBuf);

    // Embed signature image
    const sigBytes = Buffer.from(await sig.arrayBuffer());
    const isPng = (sig as any).type?.includes("png") || sigBytes[1] === 0x50; // lazy sniff
    const sigImg = isPng ? await doc.embedPng(sigBytes) : await doc.embedJpg(sigBytes);

    const pageCount = doc.getPageCount();
    const targets = parsePagesSpec(pagesSpec, pageCount);
    if (!targets.length) return txt(400, "No target pages resolved");

    // Optional font for date label
    const font = addDate ? await doc.embedFont(StandardFonts.Helvetica) : null;

    for (const idx of targets) {
      const page = doc.getPage(idx);
      const { width: pw, height: ph } = page.getSize();

      const sigW = Math.round((widthPct / 100) * pw);
      const sigH = Math.round((sigW / sigImg.width) * sigImg.height);

      // anchor calc
      let x = 0, y = 0;
      switch (pos) {
        case "br": x = pw - sigW - offsetX; y = offsetY; break;
        case "bl": x = offsetX; y = offsetY; break;
        case "tr": x = pw - sigW - offsetX; y = ph - sigH - offsetY; break;
        case "tl": x = offsetX; y = ph - sigH - offsetY; break;
      }

      // draw signature
      page.drawImage(sigImg, { x, y, width: sigW, height: sigH });

      // add date to the right of the signature (same baseline)
      if (addDate && font) {
        const dateStr = new Date().toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" });
        const fontSize = Math.max(10, Math.floor(sigH * 0.22));
        const pad = Math.max(8, Math.floor(sigH * 0.1));
        const textX = Math.min(pw - offsetX - 10, x + sigW + pad);
        const textY = y + Math.floor(sigH * 0.25);

        page.drawText(dateStr, {
          x: textX,
          y: textY,
          size: fontSize,
          font,
          color: rgb(1, 1, 1),
        });
      }
    }

    const bytes = await doc.save();
    return new Response(new Blob([bytes], { type: "application/pdf" }), {
      headers: {
        "Content-Type": "application/pdf",
        "Cache-Control": "no-store",
        "Content-Disposition": 'attachment; filename="signed.pdf"'
      }
    });
  } catch (e: any) {
    return txt(500, `Sign failed: ${e?.message || e}`);
  }
}

/* -------- helpers -------- */

function parsePagesSpec(spec: string, max: number): number[] {
  const s = spec.toLowerCase().trim();
  if (s === "all") return Array.from({ length: max }, (_, i) => i);
  if (s === "last") return [max - 1];
  const out: number[] = [];
  for (const part of s.split(",").map(v => v.trim()).filter(Boolean)) {
    if (part.includes("-")) {
      const [aStr, bStr] = part.split("-");
      const a = clamp(parseInt(aStr, 10), 1, max);
      const b = clamp(parseInt(bStr, 10), 1, max);
      const start = Math.min(a, b);
      const end = Math.max(a, b);
      for (let i = start; i <= end; i++) out.push(i - 1);
    } else {
      const n = parseInt(part, 10);
      if (Number.isFinite(n) && n >= 1 && n <= max) out.push(n - 1);
    }
  }
  return [...new Set(out)];
}

function toInt(v: FormDataEntryValue | null): number | undefined {
  if (!v) return undefined;
  const n = parseInt(String(v), 10);
  return Number.isFinite(n) ? n : undefined;
}
function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}
function txt(status: number, msg: string) {
  return new Response(msg, { status, headers: { "Content-Type": "text/plain" } });
}
