export const metadata = {
  title: "About – BitGremlin",
  description: "What BitGremlin is about and how we build tools.",
};

export default function AboutPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-semibold">About BitGremlin</h1>
      <p className="mt-3 text-white/70">
        BitGremlin builds sharp, privacy-first utilities for creators, devs, and tinkerers:
        audio/video tools, file utilities, and security-minded helpers. The goal is
        simple: fast tools that respect your time and your data.
      </p>

      <div className="mt-6 card rounded-xl p-6">
        <h2 className="text-xl font-semibold">Principles</h2>
        <ul className="mt-3 space-y-2 text-white/75 list-disc pl-6">
          <li>Privacy first. You own your data.</li>
          <li>Speed and clarity over bloat.</li>
          <li>Transparent roadmaps and rapid iteration.</li>
        </ul>
      </div>

      <div className="mt-6 card rounded-xl p-6">
        <h2 className="text-xl font-semibold">Stack</h2>
        <p className="mt-2 text-white/70">
          Next.js + React + Tailwind, Node/ffmpeg for media ops, with optional local or self-hosted backends.
        </p>
      </div>
    </main>
  );
}
