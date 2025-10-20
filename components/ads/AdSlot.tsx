"use client";
import { useEffect, useRef, useState } from "react";
import { AD_SLOTS } from "./slots";

type CommonProps = {
  id: string;
  className?: string;
  maxViewsPerDay?: number;
  width?: number;   // for fixed-size reservations
  height?: number;  // for fixed-size reservations
};

type AdSenseProps = CommonProps & {
  render: "adsense";
  /** Optional: if omitted, resolved from AD_SLOTS[id] or a fallback rule/env */
  adSlot?: string;
  /** Defaults to your site client id below */
  adClient?: string;
  /** "fixed" reserves width/height; "responsive" uses data-ad-format */
  format?: "responsive" | "fixed";
  /** Force NPA at runtime (if you’re not wiring a consent store yet) */
  nonPersonalized?: boolean;
};

type ImageProps = CommonProps & {
  render: "image";
  imageHref: string;
  imageSrc: string;
  imageAlt?: string;
};

export type AdSlotProps = AdSenseProps | ImageProps;

const DAY = 24 * 60 * 60 * 1000;
const viewsKey = (id: string) => `adviews:${id}`;

// ✔️ put your default client id here (or pass adClient prop)
const DEFAULT_CLIENT = "ca-pub-XXXXXXXXXXXXXXX";

export default function AdSlot(props: AdSlotProps) {
  // ───────────── House / Affiliate banner ─────────────
  if (props.render === "image") {
    const { id, imageHref, imageSrc, imageAlt, className, width = 728, height = 90 } = props;
    return (
      <a
        id={id}
        href={imageHref}
        target="_blank"
        rel="noopener sponsored"
        className={`ad-frame inline-block rounded-md border border-[var(--border)] bg-[color:var(--card)]/80 ${className || ""}`}
        style={{ width, height }}
        aria-label="Sponsored"
      >
        <img
          src={imageSrc}
          alt={imageAlt || "Sponsored"}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", borderRadius: "0.5rem" }}
        />
      </a>
    );
  }

  // ───────────── Google AdSense slot ─────────────
  const {
    id,
    adClient = DEFAULT_CLIENT,
    className,
    width = 728,
    height = 90,
    format = "fixed",
    nonPersonalized,
    maxViewsPerDay = 8,
  } = props;

  // resolve the actual slot id
  const resolvedSlot =
    props.adSlot ??
    AD_SLOTS[id] ??
    (id.startsWith("grid-mid-") ? AD_SLOTS["grid-mid"] : undefined) ??
    process.env.NEXT_PUBLIC_ADSENSE_DEFAULT_SLOT;

  if (!resolvedSlot) {
    console.warn(`[AdSlot] Missing adSlot mapping for placement id="${id}". Render skipped.`);
    return null; // or render a house fallback
  }

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const insRef = useRef<HTMLDivElement | null>(null);
  const [ready, setReady] = useState(false);
  const [capped, setCapped] = useState(false);

  // frequency cap (per-placement, per-day)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(viewsKey(id));
      if (raw) {
        const { count, ts } = JSON.parse(raw);
        if (Date.now() - ts > DAY) {
          localStorage.setItem(viewsKey(id), JSON.stringify({ count: 0, ts: Date.now() }));
        } else if (count >= maxViewsPerDay) {
          setCapped(true);
        }
      } else {
        localStorage.setItem(viewsKey(id), JSON.stringify({ count: 0, ts: Date.now() }));
      }
    } catch {/* ignore quota issues */}
  }, [id, maxViewsPerDay]);

  // lazy when visible
  useEffect(() => {
    if (!wrapRef.current || capped) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setReady(true);
          io.disconnect();
        }
      },
      { rootMargin: "200px" }
    );
    io.observe(wrapRef.current);
    return () => io.disconnect();
  }, [capped]);

  // push to adsbygoogle when visible
  useEffect(() => {
    if (!ready || capped || !insRef.current) return;

    if (typeof nonPersonalized === "boolean") {
      (window as any).adsbygoogle = (window as any).adsbygoogle || [];
      (window as any).adsbygoogle.requestNonPersonalizedAds = nonPersonalized ? 1 : 0;
    }

    try {
      // @ts-ignore
      (window.adsbygoogle = window.adsbygoogle || []).push({});
      const raw = localStorage.getItem(viewsKey(id));
      const cur = raw ? JSON.parse(raw) : { count: 0, ts: Date.now() };
      const updated =
        Date.now() - cur.ts > DAY ? { count: 1, ts: Date.now() } : { count: cur.count + 1, ts: cur.ts };
      localStorage.setItem(viewsKey(id), JSON.stringify(updated));
    } catch {
      // swallow script timing issues
    }
  }, [ready, capped, id, nonPersonalized]);

  const reserveStyle = format === "responsive" ? undefined : { width, height };

  return (
    <div
      ref={wrapRef}
      className={`ad-frame rounded-md border border-[var(--border)] bg-[color:var(--card)]/80 ${className || ""}`}
      style={reserveStyle}
      aria-label="Sponsored"
      role="region"
    >
      {(!ready || capped) ? (
        <div className="h-full w-full" />
      ) : (
        <ins
          ref={insRef as any}
          className="adsbygoogle block"
          style={format === "responsive" ? { display: "block" } : { display: "inline-block", width, height }}
          data-ad-client={adClient}
          data-ad-slot={resolvedSlot}
          {...(format === "responsive" ? { "data-ad-format": "auto", "data-full-width-responsive": "true" } : {})}
        />
      )}
    </div>
  );
}
