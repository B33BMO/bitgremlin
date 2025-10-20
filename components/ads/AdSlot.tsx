"use client";
import { useEffect, useRef, useState } from "react";

type AdSlotProps = {
  id: string;                 // unique per placement (e.g., "hero-below-1")
  width?: number;             // px
  height?: number;            // px (reserve to avoid CLS)
  className?: string;         // extra styling
  render?: "adsense" | "image" | "house";  // what to render
  imageHref?: string;         // for "image" render
  imageSrc?: string;          // for "image" render
  imageAlt?: string;          // for "image" render
  nonPersonalized?: boolean;  // 0 or 1 for AdSense NPA
  maxViewsPerDay?: number;    // frequency cap
};

const DAY = 24 * 60 * 60 * 1000;

function viewsKey(id: string) { return `adviews:${id}`; }
function cleanOld(ts: number) { return Date.now() - ts > DAY; }

export default function AdSlot({
  id,
  width = 728,
  height = 90,
  className = "",
  render = "adsense",
  imageHref,
  imageSrc,
  imageAlt = "Sponsored",
  nonPersonalized = true,
  maxViewsPerDay = 8,
}: AdSlotProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);
  const [allowed, setAllowed] = useState(false);
  const [capped, setCapped] = useState(false);

  // consent check
  useEffect(() => {
    const consent = localStorage.getItem("bg_consent"); // "granted" | "npa" | "denied" | null
    setAllowed(consent === "granted" || consent === "npa"); // NPA still allowed to show (non-personalized)
  }, []);

  // frequency capping per slot / per day
  useEffect(() => {
    const raw = localStorage.getItem(viewsKey(id));
    if (raw) {
      const { count, ts } = JSON.parse(raw);
      if (cleanOld(ts)) {
        localStorage.setItem(viewsKey(id), JSON.stringify({ count: 0, ts: Date.now() }));
      } else if (count >= maxViewsPerDay) {
        setCapped(true);
      }
    } else {
      localStorage.setItem(viewsKey(id), JSON.stringify({ count: 0, ts: Date.now() }));
    }
  }, [id, maxViewsPerDay]);

  // lazy reveal
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) setVisible(true);
    }, { rootMargin: "150px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // bump views when actually visible
  useEffect(() => {
    if (!(visible && allowed && !capped)) return;
    const raw = localStorage.getItem(viewsKey(id));
    const cur = raw ? JSON.parse(raw) : { count: 0, ts: Date.now() };
    if (cleanOld(cur.ts)) {
      localStorage.setItem(viewsKey(id), JSON.stringify({ count: 1, ts: Date.now() }));
    } else {
      localStorage.setItem(viewsKey(id), JSON.stringify({ count: cur.count + 1, ts: cur.ts }));
    }
  }, [visible, allowed, capped, id]);

  const WrapperStyles: React.CSSProperties = { width, height };

  return (
    <div
      ref={ref}
      className={`ad-frame rounded-md border border-[var(--border)] bg-[color:var(--card)]/80 ${className}`}
      style={WrapperStyles}
      aria-label="Sponsored"
      role="region"
    >
      {/* skeleton / reserved area */}
      {!visible || !allowed || capped ? (
        <div className="flex h-full w-full items-center justify-center text-xs text-white/40">
          {/* keep it calm; empty or a tasteful “sponsored” note */}
          <span className="sr-only">Ad placeholder</span>
        </div>
      ) : (
        <AdRenderer
          render={render}
          nonPersonalized={nonPersonalized}
          imageHref={imageHref}
          imageSrc={imageSrc}
          imageAlt={imageAlt}
        />
      )}
    </div>
  );
}

function AdRenderer({
  render,
  nonPersonalized,
  imageHref,
  imageSrc,
  imageAlt
}: {
  render: "adsense" | "image" | "house";
  nonPersonalized: boolean;
  imageHref?: string;
  imageSrc?: string;
  imageAlt?: string;
}) {
  // Ads load within reserved frame. Swap strategy here without changing layout.
  if (render === "image" && imageHref && imageSrc) {
    return (
      <a href={imageHref} target="_blank" rel="noopener noreferrer" className="block h-full w-full">
        <img src={imageSrc} alt={imageAlt} className="h-full w-full object-cover" />
      </a>
    );
  }

  if (render === "house") {
    return (
      <div className="flex h-full w-full flex-col items-start justify-center p-3">
        <div className="text-[10px] uppercase tracking-widest text-[var(--accent)]/80">Sponsored</div>
        <div className="mt-1 text-sm font-semibold">BitGremlin Pro</div>
        <div className="text-xs text-white/60">No ads. Bigger files. Queue priority.</div>
        <a
          href="/pro"
          className="mt-3 inline-flex items-center gap-2 rounded-md border border-[var(--accent)] px-3 py-1 text-xs text-black"
          style={{ background: "var(--accent)" }}
        >
          Upgrade
        </a>
      </div>
    );
  }

  // Default: AdSense unit
  // You’ll need to include the AdSense script in <layout> conditionally (see below).
  // Example responsive unit. Replace data-ad-client / data-ad-slot with your IDs.
  return (
    <ins
      className="adsbygoogle block h-full w-full"
      style={{ display: "block" }}
      data-ad-client="ca-pub-9455100130460173"
      data-ad-slot="1234567890"
      data-ad-format="auto"
      data-full-width-responsive="true"
      data-adsbygoogle-status={nonPersonalized ? "npa" : "pa"}
    />
  );
}
