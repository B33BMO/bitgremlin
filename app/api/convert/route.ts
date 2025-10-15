import { NextRequest } from "next/server";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { join, extname } from "node:path";
import { promises as fsp, createReadStream, writeFileSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import mime from "mime-types";
import sharp from "sharp";

export const runtime = "nodejs";
export const maxDuration = 300;

const FFMPEG_PATH = process.env.FFMPEG_PATH || which("ffmpeg") || "";

type Kind = "image" | "audio" | "video";

export async function POST(req: NextRequest) {
  try {
    // limit: ~150MB (tune as needed)
    const len = Number(req.headers.get("content-length") || "0");
    if (len > 150 * 1024 * 1024) return bad(413, "File too large (max ~150MB)");

    if (!(req.headers.get("content-type") || "").includes("multipart/form-data")) {
      return bad(400, "Expected multipart/form-data");
    }

    const form = await req.formData();
    const blob = form.get("file") as File | null;
    const target = String(form.get("target") || "").toLowerCase();
    const kind = String(form.get("kind") || "").toLowerCase() as Kind;

    if (!blob || typeof (blob as any).arrayBuffer !== "function") return bad(400, "Missing file");
    if (!["image", "audio", "video"].includes(kind)) return bad(400, "Invalid kind");
    if (!target) return bad(400, "Missing target format");

    // Common: read into Buffer (images need it; for av we’ll write to tmp)
    const inputBuf = Buffer.from(await blob.arrayBuffer());
    const inputName = (blob as any).name || `upload${guessExt(blob.type) || ""}`;
    const id = randomUUID();

    if (kind === "image") {
      const out = await convertImage(inputBuf, target);
      if (!out) return bad(400, `Unsupported image target: ${target}`);
      return streamBuffer(out.buffer, out.mime, `${basename(inputName)}.${out.ext}`);
    }

    // audio/video require ffmpeg
    if (!FFMPEG_PATH) return bad(500, "FFmpeg not found. Set FFMPEG_PATH to absolute path.");

    // write input to tmp
    const inTmp = join(tmpdir(), `conv-${id}${extname(inputName) || ""}`);
    writeFileSync(inTmp, inputBuf);

    const outTmp = join(tmpdir(), `conv-${id}.${target}`);
    await convertAv(inTmp, outTmp, kind, target);

    const ctype = mime.lookup(target) || (kind === "audio" ? "audio/*" : "video/*");
    const stream = createReadStream(outTmp);
    const headers = new Headers({
      "Content-Type": String(ctype),
      "Cache-Control": "no-store",
      "Content-Disposition": `attachment; filename="${basename(inputName)}.${target}"`
    });

    stream.on("close", async () => {
      await fsp.unlink(inTmp).catch(() => {});
      await fsp.unlink(outTmp).catch(() => {});
    });

    return new Response(stream as any, { headers });

  } catch (e: any) {
    return bad(500, `Conversion failed: ${e?.message || e}`);
  }
}

/* ------------ helpers ------------- */

function basename(name: string) {
  return name.replace(/\.[^.]+$/, "");
}
function guessExt(m: string | null) {
  if (!m) return "";
  const e = mime.extension(m);
  return e ? `.${e}` : "";
}

async function convertImage(buf: Buffer, target: string) {
  const img = sharp(buf, { failOn: "none" });
  switch (target) {
    case "png": {
      const out = await img.png({ compressionLevel: 9 }).toBuffer();
      return { buffer: out, ext: "png", mime: "image/png" };
    }
    case "jpg":
    case "jpeg": {
      const out = await img.jpeg({ quality: 90 }).toBuffer();
      return { buffer: out, ext: "jpg", mime: "image/jpeg" };
    }
    case "webp": {
      const out = await img.webp({ quality: 90 }).toBuffer();
      return { buffer: out, ext: "webp", mime: "image/webp" };
    }
    default:
      return null;
  }
}

async function convertAv(inPath: string, outPath: string, kind: "audio"|"video", target: string) {
  // sane default codecs
  const args: string[] = ["-y", "-i", inPath];

  if (kind === "audio") {
    // mp3: libmp3lame, wav: pcm_s16le, flac: flac
    if (target === "mp3") args.push("-vn", "-acodec", "libmp3lame", "-q:a", "0");
    else if (target === "wav") args.push("-vn", "-acodec", "pcm_s16le");
    else if (target === "flac") args.push("-vn", "-acodec", "flac");
    else throw new Error(`Unsupported audio target: ${target}`);
  } else {
    // video targets
    if (target === "mp4") {
      args.push("-c:v", "libx264", "-preset", "veryfast", "-crf", "22", "-c:a", "aac", "-b:a", "192k");
    } else if (target === "webm") {
      args.push("-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "34", "-c:a", "libopus", "-b:a", "160k");
    } else {
      throw new Error(`Unsupported video target: ${target}`);
    }
  }

  args.push(outPath);

  await run(FFMPEG_PATH, args);
}

function run(bin: string, args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const p = spawn(bin, args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    p.stderr.on("data", (d) => (stderr += d.toString()));
    p.on("close", (code) => {
      if (code === 0) return resolve();
      reject(new Error(stderr || `${bin} exited with code ${code}`));
    });
  });
}

function which(cmd: string): string | "" {
  try {
    const out = spawnSync("which", [cmd], { encoding: "utf8" });
    const p = out.stdout.trim();
    return p || "";
  } catch {
    return "";
  }
}

function bad(status: number, message: string) {
  return new Response(message, { status, headers: { "Content-Type": "text/plain" } });
}
