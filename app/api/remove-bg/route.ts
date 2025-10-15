import { NextRequest } from "next/server";
/// <reference lib="dom" />
// env:
// BG_BACKEND=local | replicate
// REMBG_URL=http://127.0.0.1:7000   # only if BG_BACKEND=local
// REPLICATE_API_TOKEN=xxxx          # only if BG_BACKEND=replicate
// REPLICATE_MODEL=cjwbw/rembg       # optional, defaults below

export const runtime = "nodejs"; // we need Node APIs (not edge)
export const maxDuration = 60;   // give it a minute for cold start/models

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") || "";
    if (!contentType.includes("multipart/form-data")) {
      return new Response("Expected multipart/form-data", { status: 400 });
    }
    const form = await req.formData();
    const file = form.get("image");
    // validate that it's a file-like object
    if (!file || typeof (file as any).arrayBuffer !== "function") {
    return new Response("Invalid or missing 'image' file field", { status: 400 });
    }

    const backend = process.env.BG_BACKEND || "local";
    if (backend === "replicate") {
      const out = await runReplicate(file);
      // Replicate returns a URL or Blob; here we fetch the result URL and stream it back
      return out;
    } else {
      const out = await runLocalRembg(file);
      return out;
    }
  } catch (e: any) {
    return new Response(`Background removal failed: ${e?.message || e}`, { status: 500 });
  }
}

async function runLocalRembg(file: File): Promise<Response> {
  const url = (process.env.REMBG_URL || "http://127.0.0.1:7000").replace(/\/$/, "");
  // rembg server expects multipart field named "image"
  const fd = new FormData();
  fd.append("image", file, file.name || "image.png");

  const r = await fetch(`${url}/remove`, { method: "POST", body: fd });
  if (!r.ok) {
    const t = await r.text().catch(() => "");
    throw new Error(`rembg server error ${r.status}: ${t}`);
  }

  const buf = await r.arrayBuffer();
  return new Response(Buffer.from(buf), {
    headers: {
      "content-type": "image/png",
      "cache-control": "no-store",
      "x-bg-backend": "local-rembg"
    }
  });
}

async function runReplicate(file: File): Promise<Response> {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) throw new Error("REPLICATE_API_TOKEN not set");

  const model = process.env.REPLICATE_MODEL || "cjwbw/rembg";
  // Upload the file to Replicate’s files API
  const uploadRes = await fetch("https://api.replicate.com/v1/files", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: (() => {
      const fd = new FormData();
      fd.append("file", file, file.name || "image.png");
      return fd;
    })()
  });

  if (!uploadRes.ok) {
    const t = await uploadRes.text().catch(() => "");
    throw new Error(`Replicate upload failed ${uploadRes.status}: ${t}`);
  }
  const uploadJson = await uploadRes.json() as { id: string; url: string };

  // Create prediction
  const predRes = await fetch("https://api.replicate.com/v1/predictions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      input: { image: uploadJson.url }
    })
  });

  if (!predRes.ok) {
    const t = await predRes.text().catch(() => "");
    throw new Error(`Replicate prediction failed ${predRes.status}: ${t}`);
  }
  let pred = await predRes.json() as any;

  // Poll until completed
  let tries = 0;
  while (pred.status === "starting" || pred.status === "processing") {
    await new Promise(r => setTimeout(r, 1200));
    const poll = await fetch(`https://api.replicate.com/v1/predictions/${pred.id}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    pred = await poll.json();
    tries++;
    if (tries > 50) throw new Error("Replicate timeout");
  }

  if (pred.status !== "succeeded") {
    throw new Error(`Replicate failed: ${pred.status} ${pred.error || ""}`);
  }

  // Output is typically a URL to a PNG
  const outUrl: string = Array.isArray(pred.output) ? pred.output[0] : pred.output;
  const get = await fetch(outUrl);
  if (!get.ok) throw new Error(`Fetch output failed ${get.status}`);
  const buf = await get.arrayBuffer();

  return new Response(Buffer.from(buf), {
    headers: {
      "content-type": "image/png",
      "cache-control": "no-store",
      "x-bg-backend": "replicate"
    }
  });
}
