import { NextRequest } from "next/server";
import pdf from "pdf-parse";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    if (!(req.headers.get("content-type") || "").includes("multipart/form-data")) {
      return text(400, "Expected multipart/form-data");
    }
    const form = await req.formData();
    const file = form.get("file") as File | null;
    if (!file) return text(400, "Missing file");

    const buf = Buffer.from(await file.arrayBuffer());
    const data = await pdf(buf);
    const out = data.text || "";

    return new Response(new Blob([out], { type: "text/plain;charset=utf-8" }), {
      headers: {
        "Cache-Control": "no-store",
        "Content-Disposition": 'attachment; filename="extracted.txt"'
      }
    });
  } catch (e: any) {
    return text(500, `Text extraction failed: ${e?.message || e}`);
  }
}

function text(status: number, msg: string) {
  return new Response(msg, { status, headers: { "Content-Type": "text/plain" } });
}
