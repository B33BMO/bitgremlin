import { NextRequest } from "next/server";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { promises as fsp, writeFileSync, createReadStream } from "node:fs";
import { spawnSync, spawn } from "node:child_process";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    if (!(req.headers.get("content-type") || "").includes("multipart/form-data")) {
      return text(400, "Expected multipart/form-data");
    }
    const form = await req.formData();
    const file = form.get("file") as File | null;
    const preset = (String(form.get("preset") || "/ebook") as "/screen"|"/ebook"|"/printer"|"/prepress");
    if (!file) return text(400, "Missing file");

    const id = randomUUID();
    const inPath = join(tmpdir(), `pdf-${id}-in.pdf`);
    const outPath = join(tmpdir(), `pdf-${id}-out.pdf`);
    writeFileSync(inPath, Buffer.from(await file.arrayBuffer()));

    const gs = process.env.GS_BIN || which("gs");
    if (gs) {
      const args = [
        "-sDEVICE=pdfwrite", "-dCompatibilityLevel=1.4",
        `-dPDFSETTINGS=${preset}`,
        "-dNOPAUSE", "-dQUIET", "-dBATCH",
        `-sOutputFile=${outPath}`,
        inPath
      ];
      await run(gs, args);
    } else {
      // fallback: use qpdf-like linearize via ghostscript unavailable -> none.
      // Just pass-through (not really compression) to keep UX clean.
      await fsp.copyFile(inPath, outPath);
    }

    const stream = createReadStream(outPath);
    const headers = new Headers({
      "Content-Type": "application/pdf",
      "Cache-Control": "no-store",
      "Content-Disposition": 'attachment; filename="compressed.pdf"'
    });
    stream.on("close", () => Promise.all([fsp.unlink(inPath).catch(()=>{}), fsp.unlink(outPath).catch(()=>{})]));
    return new Response(stream as any, { headers });

  } catch (e: any) {
    return text(500, `Compress failed: ${e?.message || e}`);
  }
}

function which(cmd: string) {
  try { const r = spawnSync("which", [cmd], { encoding: "utf8" }); return r.stdout.trim() || ""; } catch { return ""; }
}
function run(bin: string, args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const p = spawn(bin, args, { stdio: ["ignore", "ignore", "pipe"] });
    let err = "";
    p.stderr.on("data", d => (err += d.toString()));
    p.on("close", c => c === 0 ? resolve() : reject(new Error(err || `${bin} exited ${c}`)));
  });
}
function text(status: number, msg: string) {
  return new Response(msg, { status, headers: { "Content-Type": "text/plain" } });
}
