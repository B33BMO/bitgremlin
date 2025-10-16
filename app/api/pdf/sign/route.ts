import { NextRequest } from "next/server";
import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { plainAddPlaceholder } from "@signpdf/placeholder-plain";
import * as signer from "node-signpdf";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    if (!(req.headers.get("content-type") || "").includes("multipart/form-data")) {
      return txt(400, "Expected multipart/form-data");
    }
    const form = await req.formData();

    const file = form.get("file") as File | null;
    const p12 = form.get("p12") as File | null;
    const pass = String(form.get("pass") || "");
    const page = Math.max(1, parseInt(String(form.get("page") || "1"), 10));
    const x = parseInt(String(form.get("x") || "0"), 10);
    const y = parseInt(String(form.get("y") || "0"), 10);
    const widthPct = clamp(parseInt(String(form.get("widthPct") || "30"), 10), 5, 90);
    const text = String(form.get("text") || "").trim();
    const ttf = form.get("ttf") as File | null;

    if (!file || !p12) return txt(400, "Missing PDF or certificate");
    if (!text) return txt(400, "Missing signature text");

    const pdfBytes = Buffer.from(await file.arrayBuffer());
    const pdfDoc = await PDFDocument.load(pdfBytes);
    pdfDoc.registerFontkit(fontkit as any);

    // Target page & size
    const idx = Math.min(pdfDoc.getPageCount(), page) - 1;
    const pg = pdfDoc.getPage(idx);
    const { width: pw } = pg.getSize();

    // font: embed custom if provided, else Helvetica
        // @ts-expect-error signpdf types are wrong; shim supplied
    let font;
    if (ttf) {
      const ttfBytes = Buffer.from(await ttf.arrayBuffer());
      font = await pdfDoc.embedFont(ttfBytes, { subset: true });
    } else {
      // fallback to built-in (not handwritten, but ok if no TTF)
      font = await pdfDoc.embedStandardFont("Helvetica");
    }

    // Appearance sizing
    const targetWidth = (widthPct / 100) * pw;
    const size = fitTextToWidth(font, text, targetWidth);
    const textWidth = font.widthOfTextAtSize(text, size);
    const textHeight = font.heightAtSize(size);

    // Draw appearance
    pg.drawText(text, {
      x,
      y,
      size,
      font,
      color: rgb(0, 0, 0),
    });

    // Build a signature annotation rectangle
    const sigRect = { x, y: y - 2, width: Math.ceil(textWidth) + 4, height: Math.ceil(textHeight) + 6 };

    // Save incremental after appearance (unsigned bytes)
    let unsignedPdf = Buffer.from(await pdfDoc.save({ useObjectStreams: false }));

    // Add a signature placeholder
    unsignedPdf = plainAddPlaceholder({
      pdfBuffer: unsignedPdf,
      reason: "Digitally signed by BitGremlin",
      location: "Online",
      signatureLength: 8192,
      pageNumber: page,
      rect: [sigRect.x, sigRect.y, sigRect.x + sigRect.width, sigRect.y + sigRect.height],
    });

    // Sign using PKCS#7 from P12/PFX
    const p12buf = Buffer.from(await (p12 as File).arrayBuffer());
    const SignPdf = (signer as any).default || signer;
    const sp = new SignPdf();
    const signedPdf = sp.sign(unsignedPdf, p12buf, { passphrase: pass });

    return new Response(new Blob([signedPdf], { type: "application/pdf" }), {
      headers: {
        "Content-Type": "application/pdf",
        "Cache-Control": "no-store",
        "Content-Disposition": 'attachment; filename="signed.pdf"'
      }
    });
  } catch (e: any) {
    console.error("Signing error:", e);
    return txt(500, `Signing failed: ${e?.message || e}`);
  }
}

/* ---------- helpers ---------- */

function fitTextToWidth(font: any, text: string, targetWidth: number) {
  let size = 48;
  while (size > 6 && font.widthOfTextAtSize(text, size) > targetWidth) size -= 1;
  return size;
}

function clamp(n: number, a: number, b: number) { 
  return Math.max(a, Math.min(b, n)); 
}

function txt(status: number, msg: string) {
  return new Response(msg, { status, headers: { "Content-Type": "text/plain" } });
}
