import { NextRequest } from "next/server";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { promises as fsp, writeFileSync, createReadStream } from "node:fs";
import { spawn, spawnSync } from "node:child_process";

// Force Node runtime (not edge)
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    if (!(req.headers.get("content-type") || "").includes("multipart/form-data")) {
      return txt(400, "Expected multipart/form-data");
    }
    const form = await req.formData();
    const file = form.get("file") as File | null;
    if (!file) return txt(400, "Missing file");

    const buf = Buffer.from(await file.arrayBuffer());

    // 1) Prefer system pdftotext (Poppler)
    const pdftotext = process.env.PDFTOTEXT_BIN || which("pdftotext");
    if (pdftotext) {
      const id = randomUUID();
      const inPath = join(tmpdir(), `pdf-${id}.pdf`);
      writeFileSync(inPath, buf);

      const args = ["-enc", "UTF-8", "-layout", inPath, "-"]; // output to stdout
      const text = await runToString(pdftotext, args);

      // clean up
      fsp.unlink(inPath).catch(() => {});
      return new Response(new Blob([text], { type: "text/plain;charset=utf-8" }), {
        headers: {
          "Cache-Control": "no-store",
          "Content-Disposition": 'attachment; filename="extracted.txt"'
        }
      });
    }

    // 2) Fallback: pdf-parse (CJS). May still choke in some Next setups.
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const pdfParse: (b: Buffer) => Promise<{ text: string }> = require("pdf-parse");
      const { text } = await pdfParse(buf);
      return new Response(new Blob([text || ""], { type: "text/plain;charset=utf-8" }), {
        headers: {
          "Cache-Control": "no-store",
          "Content-Disposition": 'attachment; filename="extracted.txt"'
        }
      });
    } catch (e: any) {
      return txt(
        500,
        "Text extraction needs Poppler. Install it (e.g., `sudo apt install -y poppler-utils`) or set PDFTOTEXT_BIN to the absolute path."
      );
    }
  } catch (e: any) {
    return txt(500, `Text extraction failed: ${e?.message || e}`);
  }
}

/* ---------- helpers ---------- */
function which(cmd: string): string {
  try {
    const out = spawnSync("which", [cmd], { encoding: "utf8" });
    return out.stdout.trim();
  } catch {
    return "";
  }
}

function runToString(bin: string, args: string[]) {
  return new Promise<string>((resolve, reject) => {
    const p = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"] });
    let out = "", err = "";
    p.stdout.on("data", d => (out += d.toString()));
    p.stderr.on("data", d => (err += d.toString()));
    p.on("close", code => code === 0 ? resolve(out) : reject(new Error(err || `${bin} exited ${code}`)));
  });
}

function txt(status: number, msg: string) {
  return new Response(msg, { status, headers: { "Content-Type": "text/plain" } });
}
