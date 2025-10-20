import Navbar from "@/components/Navbar";
import ToolGrid from "@/components/ToolGrid";
import Footer from "@/components/Footer";
import Link from "next/link";

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
{/* below hero */}




        <ToolGrid />

        {/* affiliate/house ad above footer */}
        <div className="mt-16 flex justify-center px-4">
          <div className="hidden md:block">

          </div>
          <div className="md:hidden">

          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
