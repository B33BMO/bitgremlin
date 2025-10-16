// app/api/remove-bg/route.ts
import type { NextRequest } from "next/server";

export const runtime = "nodejs"; // needs Node for fetch/FormData/file handling
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") || "";
    if (!contentType.includes("multipart/form-data")) {
      return new Response("Expected multipart/form-data", { status: 400 });
    }

    const form = await req.formData();
    const fileEntry = form.get("image");

    // ✅ Proper type narrowing: ensure we actually have a File
    if (!(fileEntry instanceof File)) {
      return new Response("Invalid or missing 'image' file field", { status: 400 });
    }
    const file = fileEntry;

    const backend = process.env.BG_BACKEND || "local";
    if (backend === "replicate") {
      return await runReplicate(file);
    } else {
      return await runLocalRembg(file);
    }
  } catch (e: any) {
    return new Response(`Background removal failed: ${e?.message || e}`, { status: 500 });
  }
}

async function runLocalRembg(input: File): Promise<Response> {
  const base = (process.env.REMBG_URL || "http://127.0.0.1:7000").replace(/\/$/, "");

  // rembg server expects multipart field named "file"
  const fd = new FormData();
  fd.append("file", input, input.name || "image.png");

  // Try common endpoints
  const paths = ["/api/remove", "/remove"];
  let lastErr: string | null = null;

  for (const p of paths) {
    const r = await fetch(`${base}${p}`, { method: "POST", body: fd });
    if (r.ok) {
      const buf = await r.arrayBuffer();
      return new Response(new Uint8Array(buf), {
        headers: {
          "content-type": "image/png",
          "cache-control": "no-store",
          "x-bg-backend": `local-rembg${p}`,
        },
      });
    } else {
      const t = await r.text().catch(() => "");
      lastErr = `rembg server error ${r.status} on ${p}: ${t || "(no body)"}`;
      if (r.status !== 404) break; // bail early on non-404s
    }
  }

  throw new Error(lastErr || "rembg server unreachable");
}

async function runReplicate(file: File): Promise<Response> {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) throw new Error("REPLICATE_API_TOKEN not set");

  const model = process.env.REPLICATE_MODEL || "cjwbw/rembg";

  // Upload the file to Replicate’s files API
  const uploadFd = new FormData();
  uploadFd.append("file", file, file.name || "image.png");

  const uploadRes = await fetch("https://api.replicate.com/v1/files", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: uploadFd,
  });
  if (!uploadRes.ok) {
    const t = await uploadRes.text().catch(() => "");
    throw new Error(`Replicate upload failed ${uploadRes.status}: ${t}`);
  }
  const uploadJson = (await uploadRes.json()) as { id: string; url: string };

  // Create prediction
  const predRes = await fetch("https://api.replicate.com/v1/predictions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: { image: uploadJson.url },
    }),
  });
  if (!predRes.ok) {
    const t = await predRes.text().catch(() => "");
    throw new Error(`Replicate prediction failed ${predRes.status}: ${t}`);
  }
  let pred: any = await predRes.json();

  // Poll until done
  let tries = 0;
  while (pred.status === "starting" || pred.status === "processing") {
    await new Promise((r) => setTimeout(r, 1200));
    const poll = await fetch(`https://api.replicate.com/v1/predictions/${pred.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    pred = await poll.json();
    if (++tries > 50) throw new Error("Replicate timeout");
  }
  if (pred.status !== "succeeded") {
    throw new Error(`Replicate failed: ${pred.status} ${pred.error || ""}`);
  }

  // Output is typically a URL to a PNG
  const outUrl: string = Array.isArray(pred.output) ? pred.output[0] : pred.output;
  const get = await fetch(outUrl);
  if (!get.ok) throw new Error(`Fetch output failed ${get.status}`);
  const buf = await get.arrayBuffer();

  return new Response(new Uint8Array(buf), {
    headers: {
      "content-type": "image/png",
      "cache-control": "no-store",
      "x-bg-backend": "replicate",
    },
  });
}
