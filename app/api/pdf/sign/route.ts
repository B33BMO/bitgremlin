import { NextRequest } from "next/server";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { plainAddPlaceholder } from "@signpdf/placeholder-plain";
// node-signpdf export shape varies; handle both CJS/ESM:
import _SignPdf from "node-signpdf";

export const runtime = "nodejs";
export const maxDuration = 120;

type SignerCtor = new () => { sign: (pdf: Buffer, p12: Buffer, opts?: { passphrase?: string }) => Buffer };

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
    const widthPct = clamp(parseInt(String(form.get("widthPct") || "28"), 10), 5, 90);
    const text = String(form.get("text") || "").trim();
    const ttf = form.get("ttf") as File | null;

    if (!file) return txt(400, "Missing PDF");
    if (!p12) return txt(400, "Missing P12/PFX");
    if (!text) return txt(400, "Missing signature text");

    // 1) Load PDF
    const pdfBytes = Buffer.from(await file.arrayBuffer());
    const doc = await PDFDocument.load(pdfBytes);
    doc.registerFontkit(fontkit as any);

    // 2) Determine target page / dimensions
    const idx = Math.min(doc.getPageCount(), page) - 1;
    const pg = doc.getPage(idx);
    const { width: pw } = pg.getSize();

    // 3) Embed font (handwritten TTF if provided)
    let font;
    if (ttf) {
      const ttfBytes = Buffer.from(await ttf.arrayBuffer());
      font = await doc.embedFont(ttfBytes, { subset: true });
    } else {
      font = await doc.embedStandardFont(StandardFonts.Helvetica);
    }

    // 4) Size the appearance to fit desired width %
    const targetWidth = (widthPct / 100) * pw;
    const size = fitTextToWidth(font, text, targetWidth);
    const textWidth = font.widthOfTextAtSize(text, size);
    const textHeight = font.heightAtSize(size);

    // 5) Draw visual appearance (ink)
    pg.drawText(text, { x, y, size, font, color: rgb(0, 0, 0) });

    // Signature widget rectangle around the appearance (a bit padded)
    const rect = {
      x,
      y: y - 2,
      w: Math.ceil(textWidth) + 6,
      h: Math.ceil(textHeight) + 8,
    };

    // 6) Save (classic xref, no object streams) BEFORE placeholder/sign
    let unsigned = Buffer.from(await doc.save({ useObjectStreams: false }));

    // 7) Add ByteRange/Contents placeholder & widget where we drew the signature
    unsigned = plainAddPlaceholder({
      pdfBuffer: unsigned,
      reason: "Digitally signed",
      location: "BitGremlin",
      signatureLength: 8192, // increase if your chain is chunky
      pageNumber: page, // 1-based
      rect: [rect.x, rect.y, rect.x + rect.w, rect.y + rect.h],
    });

    // 8) PKCS#7 sign using node-signpdf
    const P12 = Buffer.from(await p12.arrayBuffer());
    const SignPdfCls: SignerCtor = (((_SignPdf as any).default || _SignPdf) as SignerCtor);
    const signer = new SignPdfCls();
    const signed = signer.sign(unsigned, P12, { passphrase: pass });

    return new Response(new Blob([signed], { type: "application/pdf" }), {
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

/* ------------- helpers ------------- */

function fitTextToWidth(font: any, text: string, targetWidth: number) {
  let size = 48;
  while (size > 6 && font.widthOfTextAtSize(text, size) > targetWidth) size -= 1;
  return size;
}
function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}
function txt(status: number, msg: string) {
  return new Response(msg, { status, headers: { "Content-Type": "text/plain" } });
}
