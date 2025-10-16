import Navbar from "@/components/Navbar";
import ToolGrid from "@/components/ToolGrid";
import Footer from "@/components/Footer";
import Link from "next/link";
import AdSlot from "@/components/ads/AdSlot";

export default function Page() {
  return (
    <>
      <Navbar />
      <main>
        {/* hero */}
        <section className="relative mx-auto max-w-7xl px-4 pt-16">
          <div className="max-w-2xl">
            <p className="text-xs tracking-widest text-[var(--accent)]/90">THE GREMLIN ATE YOUR WORKFLOW</p>
            <h1 className="mt-3 text-4xl font-semibold sm:text-5xl">
              The chaos engine for your files.
            </h1>
            <p className="mt-4 text-[15px] text-white/70">
              Convert, compress, trim, merge, rip, hash — fast, private, and free.
              BitGremlin chews your bits and spits out something better.
            </p>
          </div>

          {/* subtle cyan sweep */}
          <div
            className="pointer-events-none absolute -right-40 -top-24 h-[380px] w-[520px] rounded-full blur-3xl"
            style={{ background: "radial-gradient(closest-side, rgba(0,255,174,0.15), transparent 70%)" }}
          />
        </section>

        {/* ad: below hero (desktop size) */}
        <div className="mt-10 flex justify-center px-4">
          <div className="hidden md:block">
            <AdSlot id="hero-below-1" width={970} height={40} render="adsense" />
          </div>
          <div className="md:hidden">
            <AdSlot id="hero-below-mobile" width={320} height={40} render="adsense" />
          </div>
        </div>

        <ToolGrid />

        {/* affiliate/house ad above footer */}
        <div className="mt-16 flex justify-center px-4">
          <div className="hidden md:block">
            <AdSlot
              id="footer-top-affiliate"
              width={970}
              height={90}
              render="image"
              imageHref="https://your-affiliate-link"
              imageSrc="/ads/affiliate-banner-970x90.jpg"
              imageAlt="Partner"
            />
          </div>
          <div className="md:hidden">
            <AdSlot
              id="footer-top-affiliate-m"
              width={300}
              height={250}
              render="image"
              imageHref="https://your-affiliate-link"
              imageSrc="/ads/affiliate-300x250.jpg"
              imageAlt="Partner"
            />
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
