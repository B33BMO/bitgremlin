"use client";
import { useEffect, useRef, useState } from "react";

type AdSlotProps = {
  id: string;                              // unique per placement
  adClient?: string;                       // fallback if needed
  adSlot: string;                          // your AdSense slot id (numbers)
  format?: "responsive" | "fixed";
  width?: number;                          // used when format="fixed"
  height?: number;                         // used when format="fixed"
  className?: string;
  nonPersonalized?: boolean;               // optional override
  maxViewsPerDay?: number;
};

const DAY = 24 * 60 * 60 * 1000;
const viewsKey = (id: string) => `adviews:${id}`;

export default function AdSlot({
  id,
  adClient = "ca-pub-9455100130460173",
  adSlot,
  format = "responsive",
  width = 728,
  height = 90,
  className = "",
  nonPersonalized,
  maxViewsPerDay = 8,
}: AdSlotProps) {
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

  // observe visibility
  useEffect(() => {
    if (!wrapRef.current || capped) return;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        setReady(true);
        io.disconnect();
      }
    }, { rootMargin: "200px" });
    io.observe(wrapRef.current);
    return () => io.disconnect();
  }, [capped]);

  // push ad when visible
  useEffect(() => {
    if (!ready || capped || !insRef.current) return;

    // set NPA at runtime if requested
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
      const updated = Date.now() - cur.ts > DAY ? { count: 1, ts: Date.now() } : { count: cur.count + 1, ts: cur.ts };
      localStorage.setItem(viewsKey(id), JSON.stringify(updated));
    } catch {
      // swallow; AdSense might not be ready yet
    }
  }, [ready, capped, id, nonPersonalized]);

  // size reservation (avoid CLS)
  const styleFixed = format === "fixed" ? { width, height } : undefined;

  return (
    <div
      ref={wrapRef}
      className={`ad-frame rounded-md border border-[var(--border)] bg-[color:var(--card)]/80 ${className}`}
      style={styleFixed}
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
          // responsive unit:
          {...(format === "responsive" ? { "data-ad-format": "auto", "data-full-width-responsive": "true" } : {})}
        />
      )}
    </div>
  );
}
