import { NextRequest } from "next/server";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { promises as fsp, writeFileSync, createReadStream } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import { PDFDocument } from "pdf-lib";

export const runtime = "nodejs";
export const maxDuration = 180;

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

    // write uploads to /tmp
    const id = randomUUID();
    const tmp = join(tmpdir(), `merge-${id}`);
    await fsp.mkdir(tmp, { recursive: true });
    const inputs: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const buf = Buffer.from(await f.arrayBuffer());
      const p = join(tmp, `${String(i).padStart(3, "0")}.pdf`);
      writeFileSync(p, buf);
      inputs.push(p);
    }

    // 1) Try pdfunite (Poppler)
    const pdfunite = process.env.PDFUNITE_BIN || which("pdfunite");
    if (pdfunite) {
      const outPath = join(tmp, "out.pdf");
      const args = [...inputs, outPath];
      await run(pdfunite, args);
      return sendAndCleanup(outPath, tmp);
    }

    // 2) Try Ghostscript
    const gs = process.env.GS_BIN || which("gs");
    if (gs) {
      const outPath = join(tmp, "out.pdf");
      const gsArgs = [
        "-dSAFER",
        "-dBATCH",
        "-dNOPAUSE",
        "-sDEVICE=pdfwrite",
        "-dCompatibilityLevel=1.6",
        "-dDetectDuplicateImages=true",
        "-dCompressFonts=true",
        "-sOutputFile=" + outPath,
        ...inputs
      ];
      await run(gs, gsArgs);
      return sendAndCleanup(outPath, tmp);
    }

    // 3) Fallback: pdf-lib (works for simple PDFs)
    const { bytes, warnings } = await mergeWithPdfLib(files, { password, ignore });
    
    // FIX: Use type assertion for Uint8Array compatibility
    const res = new Response(new Blob([bytes as BlobPart], { type: "application/pdf" }), {
      headers: {
        "Content-Type": "application/pdf",
        "Cache-Control": "no-store",
        "Content-Disposition": 'attachment; filename="merged.pdf"',
        ...(warnings.length ? { "X-Merge-Warnings": encodeURIComponent(warnings.join(" | ")) } : {})
      }
    });
    // cleanup tmp
    fsp.rm(tmp, { recursive: true, force: true }).catch(() => {});
    return res;

  } catch (e: any) {
    return text(500, `Merge failed: ${e?.message || e}`);
  }
}

/* ---------------- helpers ---------------- */

function which(cmd: string): string {
  try {
    const out = spawnSync("which", [cmd], { encoding: "utf8" });
    return out.stdout.trim();
  } catch {
    return "";
  }
}

function run(bin: string, args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const p = spawn(bin, args, { stdio: ["ignore", "ignore", "pipe"] });
    let err = "";
    p.stderr.on("data", d => (err += d.toString()));
    p.on("close", c => (c === 0 ? resolve() : reject(new Error(err || `${bin} exited ${c}`))));
  });
}

async function sendAndCleanup(outPath: string, tmpDir: string) {
  const stream = createReadStream(outPath);
  const headers = new Headers({
    "Content-Type": "application/pdf",
    "Cache-Control": "no-store",
    "Content-Disposition": 'attachment; filename="merged.pdf"'
  });
  stream.on("close", () => fsp.rm(tmpDir, { recursive: true, force: true }).catch(() => {}));
  return new Response(stream as any, { headers });
}

async function mergeWithPdfLib(
  files: File[],
  opts: { password: string; ignore: boolean }
): Promise<{ bytes: Uint8Array; warnings: string[] }> {
  const warnings: string[] = [];
  const out = await PDFDocument.create();

  for (const f of files) {
    const name = (f as any).name || "file.pdf";
    const bytes = new Uint8Array(await f.arrayBuffer());
    let doc: PDFDocument | null = null;

    try {
      doc = await PDFDocument.load(bytes);
    } catch (e1: any) {
      if (opts.password) {
        try {
          // FIX: Use type assertion for password option
          doc = await PDFDocument.load(bytes, { password: opts.password } as any);
        } catch (e2: any) {
          if (opts.ignore) {
            try {
              doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
            } catch (e3: any) {
              warnings.push(`${name}: ${e3?.message || e3}`);
            }
          } else {
            warnings.push(`${name}: ${e2?.message || e2}`);
          }
        }
      } else if (opts.ignore) {
        try {
          doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
        } catch (e3: any) {
          warnings.push(`${name}: ${e3?.message || e3}`);
        }
      } else {
        warnings.push(`${name}: ${e1?.message || e1}`);
      }
    }

    if (!doc) continue;
    try {
      const copied = await out.copyPages(doc, doc.getPageIndices());
      copied.forEach(p => out.addPage(p));
    } catch (e: any) {
      warnings.push(`${name}: copy failed: ${e?.message || e}`);
    }
  }

  if (out.getPageCount() === 0) {
    throw new Error(warnings.length ? `No pages merged. Issues: ${warnings.join(" | ")}` : "No pages merged.");
  }
  const bytes = await out.save();
  return { bytes, warnings };
}

function text(status: number, msg: string) {
  return new Response(msg, { status, headers: { "Content-Type": "text/plain" } });
}
