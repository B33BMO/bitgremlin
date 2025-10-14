import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export default function ToolPage({ params }: { params: { slug: string } }) {
  const title = params.slug
    .split("-")
    .map(s => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" ");

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-3xl px-4 pt-12">
        <h1 className="text-3xl font-semibold">{title}</h1>
        <p className="mt-2 text-white/70">
          This tool is coming online. The gremlin is chewing the cables as we speak.
        </p>

        <div className="mt-6 rounded-xl card p-5">
          <p className="text-sm text-white/70">
            Drop your UI here (upload zone, URL input, options, progress). Keep it lean and fast.
          </p>
        </div>
      </main>
      <Footer />
    </>
  );
}
