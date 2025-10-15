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
    const files = form.getAll("files").filter(Boolean) as File[];
    if (!files.length) return text(400, "No files");

    const out = await PDFDocument.create();
    for (const f of files) {
      const bytes = new Uint8Array(await f.arrayBuffer());
      const doc = await PDFDocument.load(bytes);
      const pages = await out.copyPages(doc, doc.getPageIndices());
      pages.forEach(p => out.addPage(p));
    }
    const pdfBytes = await out.save();

    return new Response(new Blob([pdfBytes], { type: "application/pdf" }), {
      headers: {
        "Cache-Control": "no-store",
        "Content-Disposition": 'attachment; filename="merged.pdf"'
      }
    });
  } catch (e: any) {
    return text(500, `Merge failed: ${e?.message || e}`);
  }
}

function text(status: number, msg: string) {
  return new Response(msg, { status, headers: { "Content-Type": "text/plain" } });
}
