import { NextRequest } from "next/server";
import sharp from "sharp";

export const runtime = "nodejs";
export const maxDuration = 60;

type Fit = "cover" | "contain" | "inside" | "outside" | "fill";
type OutFormat = "auto" | "png" | "jpg" | "webp";

export async function POST(req: NextRequest) {
  try {
    if (!(req.headers.get("content-type") || "").includes("multipart/form-data")) {
      return text(400, "Expected multipart/form-data");
    }

    const form = await req.formData();
    const blob = form.get("file") as File | null;
    if (!blob || typeof (blob as any).arrayBuffer !== "function") {
      return text(400, "Missing file");
    }

    // controls
    const width = toInt(form.get("width"));
    const height = toInt(form.get("height"));
    const fit = (String(form.get("fit") || "inside") as Fit);
    const format = (String(form.get("format") || "auto") as OutFormat);
    const quality = clamp(toInt(form.get("quality")) ?? 85, 0, 100);
    const strip = String(form.get("strip") || "true") === "true";

    const input = Buffer.from(await blob.arrayBuffer());
    let img = sharp(input, { failOn: "none" });

    // resize if provided
    if (width || height) {
      img = img.resize({
        width: width || undefined,
        height: height || undefined,
        fit
      });
    }

    // strip metadata? - FIXED: removed 'iptc' which doesn't exist
if (strip) img = img.withMetadata();

    // encode
    let outExt = pickExt(format, (blob as any).type);
    if (outExt === "jpg") {
      img = img.jpeg({ quality, mozjpeg: true });
    } else if (outExt === "png") {
      // quality slider maps to compression level (0-9)
      const level = Math.round((quality / 100) * 9);
      img = img.png({ compressionLevel: level, palette: true });
    } else if (outExt === "webp") {
      img = img.webp({ quality });
    } else {
      // keep original by default; try to infer container
      const meta = await sharp(input).metadata();
      if (meta.format === "png") img = img.png();
      else if (meta.format === "webp") img = img.webp({ quality });
      else img = img.jpeg({ quality });
      outExt = meta.format === "png" ? "png" : meta.format === "webp" ? "webp" : "jpg";
    }

    const outBuf = await img.toBuffer();
    const mime = extToMime(outExt);

    return new Response(new Blob([outBuf], { type: mime }), {
      headers: {
        "Cache-Control": "no-store",
        "Content-Disposition": `attachment; filename="output.${outExt}"`
      }
    });

  } catch (e: any) {
    return text(500, `Image processing failed: ${e?.message || e}`);
  }
}

/* helpers */

function toInt(v: FormDataEntryValue | null): number | undefined {
  if (!v) return undefined;
  const n = parseInt(String(v), 10);
  return Number.isFinite(n) ? n : undefined;
}
function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}
function pickExt(fmt: OutFormat, mime?: string): "png"|"jpg"|"webp" {
  if (fmt === "png" || fmt === "jpg" || fmt === "webp") return fmt;
  if (mime?.includes("png")) return "png";
  if (mime?.includes("webp")) return "webp";
  if (mime?.includes("jpeg") || mime?.includes("jpg")) return "jpg";
  return "jpg";
}
function extToMime(ext: string) {
  switch (ext) {
    case "png": return "image/png";
    case "webp": return "image/webp";
    default: return "image/jpeg";
  }
}
function text(status: number, msg: string) {
  return new Response(msg, { status, headers: { "Content-Type": "text/plain" } });
}
