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

    const password = String(form.get("password") || "");
    const ignore = String(form.get("ignore") || "false") === "true";

    const out = await PDFDocument.create();
    const failures: string[] = [];

    for (const f of files) {
      const name = (f as any).name || "file.pdf";
      const bytes = new Uint8Array(await f.arrayBuffer());

      let doc: PDFDocument | null = null;

      // 1) plain
      try {
        doc = await PDFDocument.load(bytes);
      } catch (e1: any) {
        // 2) with password (if provided)
        if (password) {
          try {
            doc = await PDFDocument.load(bytes, { password });
          } catch (e2: any) {
            // 3) ignoreEncryption (if toggled)
            if (ignore) {
              try {
                doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
              } catch (e3: any) {
                failures.push(`${name}: ${e3?.message || e3}`);
              }
            } else {
              failures.push(`${name}: ${e2?.message || e2}`);
            }
          }
        } else if (ignore) {
          try {
            doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
          } catch (e3: any) {
            failures.push(`${name}: ${e3?.message || e3}`);
          }
        } else {
          failures.push(`${name}: ${e1?.message || e1}`);
        }
      }

      if (!doc) continue;

      const pages = await out.copyPages(doc, doc.getPageIndices());
      pages.forEach(p => out.addPage(p));
    }

    if (out.getPageCount() === 0) {
      const msg = failures.length
        ? `Could not open any PDFs:\n- ${failures.join("\n- ")}`
        : "No pages merged.";
      return text(400, msg);
    }

    const pdfBytes = await out.save();

    const headers = new Headers({
      "Content-Type": "application/pdf",
      "Cache-Control": "no-store",
      "Content-Disposition": 'attachment; filename="merged.pdf"'
    });
    if (failures.length) {
      headers.set("X-Merge-Warnings", encodeURIComponent(failures.join(" | ")));
    }

    return new Response(new Blob([pdfBytes], { type: "application/pdf" }), { headers });
  } catch (e: any) {
    return text(500, `Merge failed: ${e?.message || e}`);
  }
}

function text(status: number, msg: string) {
  return new Response(msg, { status, headers: { "Content-Type": "text/plain" } });
}
