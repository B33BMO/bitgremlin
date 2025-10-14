import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ToolGrid from "@/components/ToolGrid";

export default function ToolsPage() {
  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 pt-10">
        <h1 className="text-3xl font-semibold">All Tools</h1>
        <p className="mt-2 text-white/70">Everything the gremlin can do, in one place.</p>
        <ToolGrid />
      </main>
      <Footer />
    </>
  );
}
