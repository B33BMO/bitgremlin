"use client";
import { useEffect, useRef, useState } from "react";

type CommonProps = {
  id: string;
  className?: string;
  maxViewsPerDay?: number;
  width?: number;   // used for fixed-size reserve box
  height?: number;  // used for fixed-size reserve box
};

type AdSenseProps = CommonProps & {
  render: "adsense";
  adSlot: string;                 // <-- your numeric slot id, e.g. "1234567890"
  adClient?: string;              // defaults to your site client id
  format?: "responsive" | "fixed";
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

// Put your default client id here (or pass via prop)
const DEFAULT_CLIENT = "ca-pub-XXXXXXXXXXXXXXX";

export default function AdSlot(props: AdSlotProps) {
  // If it's an image banner, just render it and return
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

  // AdSense mode below
  const {
    id,
    adSlot,
    adClient = DEFAULT_CLIENT,
    className,
    width = 728,
    height = 90,
    format = "fixed",
    nonPersonalized,
    maxViewsPerDay = 8,
  } = props;

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const insRef = useRef<HTMLDivElement | null>(null);
  const [ready, setReady] = useState(false);
  const [capped, setCapped] = useState(false);

  // frequency cap
  useEffect(() => {
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
  }, [id, maxViewsPerDay]);

  // lazy render when visible
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

  // push adsense when visible
  useEffect(() => {
    if (!ready || capped || !insRef.current) return;

    if (typeof nonPersonalized === "boolean") {
      (window as any).adsbygoogle = (window as any).adsbygoogle || [];
      (window as any).adsbygoogle.requestNonPersonalizedAds = nonPersonalized ? 1 : 0;
    }

    try {
      // @ts-ignore
      (window.adsbygoogle = window.adsbygoogle || []).push({});
      // count a view
      const raw = localStorage.getItem(viewsKey(id));
      const cur = raw ? JSON.parse(raw) : { count: 0, ts: Date.now() };
      const updated =
        Date.now() - cur.ts > DAY ? { count: 1, ts: Date.now() } : { count: cur.count + 1, ts: cur.ts };
      localStorage.setItem(viewsKey(id), JSON.stringify(updated));
    } catch {
      // ignore
    }
  }, [ready, capped, id, nonPersonalized]);

  const reserveStyle =
    format === "responsive"
      ? undefined
      : { width, height }; // fixed box to avoid CLS

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
          data-ad-slot={adSlot}
          {...(format === "responsive" ? { "data-ad-format": "auto", "data-full-width-responsive": "true" } : {})}
        />
      )}
    </div>
  );
}
