import { NextRequest } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    // honeypot
    if ((form.get("website") as string)?.trim()) {
      await new Promise((r) => setTimeout(r, 800));
      return new Response("ok", { status: 200, headers: nocache });
    }

    const name = (form.get("name") as string || "").trim().slice(0, 200);
    const email = (form.get("email") as string || "").trim().slice(0, 200);
    const subject = (form.get("subject") as string || "").trim().slice(0, 200);
    const message = (form.get("message") as string || "").trim().slice(0, 5000);

    if (!name || !email || !subject || !message) {
      return new Response("Missing required fields", { status: 400, headers: nocache });
    }

    const payload = `From: ${name} <${email}>\nSubject: ${subject}\n\n${message}`;

    const hasSMTP =
      !!process.env.SMTP_HOST &&
      !!process.env.SMTP_USER &&
      !!process.env.SMTP_PASS &&
      !!process.env.CONTACT_TO;

    if (hasSMTP) {
      const nodemailer = await import("nodemailer");
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: !!process.env.SMTP_SECURE, // set "true" if you use 465
        auth: {
          user: process.env.SMTP_USER!,
          pass: process.env.SMTP_PASS!,
        },
      });

      await transporter.sendMail({
        from: process.env.CONTACT_FROM || process.env.SMTP_USER!,
        to: process.env.CONTACT_TO!,
        replyTo: email,
        subject: `[BitGremlin] ${subject}`,
        text: payload,
      });
    } else {
      console.log("[contact] (no SMTP configured)\n", payload);
    }

    return new Response("ok", { status: 200, headers: nocache });
  } catch (e: any) {
    return new Response(e?.message || "Server error", { status: 500, headers: nocache });
  }
}

const nocache = {
  "Cache-Control": "no-store",
};
