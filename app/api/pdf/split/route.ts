// app/api/pdf/split/route.ts
import type { NextRequest } from "next/server";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { promises as fsp, writeFileSync, createReadStream } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import { PDFDocument } from "pdf-lib";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    if (!(req.headers.get("content-type") || "").includes("multipart/form-data")) {
      return text(400, "Expected multipart/form-data");
    }

    const form = await req.formData();
    const file = form.get("file") as File | null;
    const ranges = String(form.get("ranges") || "").trim();
    const password = String(form.get("password") || "");
    const ignore = String(form.get("ignore") || "false") === "true";

    if (!file) return text(400, "Missing file");
    if (!ranges) return text(400, "Missing ranges");

    // temp setup
    const id = randomUUID();
    const tmp = join(tmpdir(), `split-${id}`);
    await fsp.mkdir(tmp, { recursive: true });
    const srcPath = join(tmp, "src.pdf");

    // write the upload to disk (Uint8Array is fine for fs)
    const uploadBytes = new Uint8Array(await file.arrayBuffer());
    writeFileSync(srcPath, uploadBytes);

    // Try qpdf first (fast & robust)
    const qpdf = which("qpdf");
    if (qpdf) {
      const outPath = join(tmp, "extract.pdf");
      const args = [
        ...(password ? ["--password=" + password] : []),
        srcPath,
        outPath,
        "--pages",
        ".",
        ranges,
        "--",
      ];
      await run(qpdf, args);
      return sendAndCleanup(outPath, tmp);
    }

    // Fallback: pdf-lib
    const src = await loadPdf(uploadBytes, { password, ignore });
    const out = await PDFDocument.create();

    const wanted = parseRanges(ranges, src.getPageCount());
    const pages = await out.copyPages(src, wanted);
    pages.forEach((p) => out.addPage(p));

    // pdf-lib returns Uint8Array; hand Response a Uint8Array (BodyInit-friendly)
    const bytes = await out.save(); // Uint8Array
    // Cleanup temp dir (no outPath in this branch)
    fsp.rm(tmp, { recursive: true, force: true }).catch(() => {});

    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Cache-Control": "no-store",
        "Content-Disposition": 'attachment; filename="extracted.pdf"',
      },
    });
  } catch (e: any) {
    return text(500, `Split failed: ${e?.message || e}`);
  }
}

/* ----------------- Helpers ------------------ */

function parseRanges(r: string, max: number) {
  const out: number[] = [];
  for (const part of r.split(",").map((s) => s.trim()).filter(Boolean)) {
    if (part.includes("-")) {
      const [a, b] = part.split("-").map((n) => parseInt(n, 10));
      const start = Math.max(1, Math.min(a, b));
      const end = Math.min(max, Math.max(a, b));
      for (let i = start; i <= end; i++) out.push(i - 1);
    } else {
      const n = parseInt(part, 10);
      if (Number.isFinite(n) && n >= 1 && n <= max) out.push(n - 1);
    }
  }
  return [...new Set(out)];
}

async function loadPdf(
  buf: Uint8Array,
  opts: { password: string; ignore: boolean }
): Promise<PDFDocument> {
  // pdf-lib (this build) does not support password decryption.
  if (opts.password) {
    throw new Error(
      "Encrypted PDF provided, but pdf-lib fallback cannot open passwords. Install qpdf (apt-get install qpdf / brew install qpdf) or remove the password."
    );
  }

  try {
    // Best effort: load normally
    return await PDFDocument.load(buf);
  } catch (e1) {
    // If the file is encrypted and user asked to ignore, pdf-lib still can't open it.
    if (opts.ignore) {
      throw new Error(
        "PDF appears encrypted. The 'ignore' option is not supported by pdf-lib for decryption. Install qpdf to process encrypted files."
      );
    }
    throw e1;
  }
}


function which(cmd: string): string | null {
  try {
    const out = spawnSync("which", [cmd], { encoding: "utf8" });
    return out.stdout.trim() || null;
  } catch {
    return null;
  }
}

function run(bin: string, args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const p = spawn(bin, args, { stdio: ["ignore", "ignore", "pipe"] });
    let err = "";
    p.stderr.on("data", (d) => (err += d.toString()));
    p.on("close", (c) => (c === 0 ? resolve() : reject(new Error(err || `${bin} exited ${c}`))));
  });
}

async function sendAndCleanup(path: string, tmp: string) {
  const stream = createReadStream(path);
  const headers = new Headers({
    "Content-Type": "application/pdf",
    "Cache-Control": "no-store",
    "Content-Disposition": 'attachment; filename="extracted.pdf"',
  });
  stream.on("close", () =>
    fsp.rm(tmp, { recursive: true, force: true }).catch(() => {})
  );
  // Node Readable works as BodyInit in Next's Node runtime
  return new Response(stream as any, { headers });
}

function text(status: number, msg: string) {
  return new Response(msg, { status, headers: { "Content-Type": "text/plain" } });
}
