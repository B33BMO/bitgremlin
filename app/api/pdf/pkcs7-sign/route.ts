import type { NextRequest } from "next/server";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { plainAddPlaceholder } from "@signpdf/placeholder-plain";
import signer from "node-signpdf";
import { Buffer as NodeBuffer } from "node:buffer";

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

    const pdfBytesU8 = new Uint8Array(await file.arrayBuffer());
    const pdfDoc = await PDFDocument.load(pdfBytesU8);
    pdfDoc.registerFontkit(fontkit as any);

    const idx = Math.min(pdfDoc.getPageCount(), page) - 1;
    const pg = pdfDoc.getPage(idx);
    const { width: pw } = pg.getSize();

    // font: embed custom if provided, else Helvetica
    let font;
    if (ttf) {
      const ttfBytes = new Uint8Array(await ttf.arrayBuffer());
      font = await pdfDoc.embedFont(ttfBytes, { subset: true });
    } else {
      font = await pdfDoc.embedStandardFont(StandardFonts.Helvetica);
    }

    // Appearance sizing
    const targetWidth = (widthPct / 100) * pw;
    const size = fitTextToWidth(font, text, targetWidth);
    const textWidth = font.widthOfTextAtSize(text, size);
    const textHeight = font.heightAtSize(size);

    pg.drawText(text, { x, y, size, font, color: rgb(0, 0, 0) });

    const sigRect = { x, y: y - 2, width: Math.ceil(textWidth) + 4, height: Math.ceil(textHeight) + 6 };

    // Save unsigned bytes as a true Node buffer
    let unsignedPdf: NodeJS.Buffer = NodeBuffer.from(await pdfDoc.save({ useObjectStreams: false }));

    // Ensure the placeholder sees a Node Buffer, not a browser polyfill type
    unsignedPdf = plainAddPlaceholder({
      pdfBuffer: NodeBuffer.from(unsignedPdf),
      reason: "Digitally signed by BitGremlin",
      location: "Online",
      signatureLength: 8192,
      pageNumber: page,
      rect: [sigRect.x, sigRect.y, sigRect.x + sigRect.width, sigRect.y + sigRect.height],
    }) as unknown as NodeJS.Buffer;

    // Sign (p12 as Node Buffer)
    const p12buf: NodeJS.Buffer = NodeBuffer.from(await (p12 as File).arrayBuffer());
    const SignPdf = (signer as any).default || (signer as any);
    const sp = new SignPdf();
    const signedPdf: NodeJS.Buffer = sp.sign(unsignedPdf, p12buf, { passphrase: pass });

    // You can return a Buffer directly
    return new Response(signedPdf, {
      headers: {
        "Content-Type": "application/pdf",
        "Cache-Control": "no-store",
        "Content-Disposition": 'attachment; filename="signed.pdf"',
      },
    });
  } catch (e: any) {
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
