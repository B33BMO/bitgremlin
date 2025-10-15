import { NextRequest } from "next/server";

// ⛔️ remove: `import pdf from "pdf-parse";`
// ✅ force CJS to avoid Next/ESM/pdfjs bundling weirdness
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfParse: (buf: Buffer) => Promise<{ text: string }> = require("pdf-parse");

export const runtime = "nodejs";
export const maxDuration = 60;
// (optional) ensure it's compiled for the server, not edge
export const preferredRegion = "auto";

export async function POST(req: NextRequest) {
  try {
    if (!(req.headers.get("content-type") || "").includes("multipart/form-data")) {
      return txt(400, "Expected multipart/form-data");
    }
    const form = await req.formData();
    const file = form.get("file") as File | null;
    if (!file) return txt(400, "Missing file");

    const buf = Buffer.from(await file.arrayBuffer());

    // Run pdf-parse (CJS) → no pdfjs ESM drama
    const { text } = await pdfParse(buf);

    return new Response(new Blob([text || ""], { type: "text/plain;charset=utf-8" }), {
      headers: {
        "Cache-Control": "no-store",
        "Content-Disposition": 'attachment; filename="extracted.txt"'
      }
    });
  } catch (e: any) {
    return txt(500, `Text extraction failed: ${e?.message || e}`);
  }
}

function txt(status: number, msg: string) {
  return new Response(msg, { status, headers: { "Content-Type": "text/plain" } });
}
