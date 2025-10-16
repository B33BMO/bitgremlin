export const metadata = {
  title: "Privacy Policy – BitGremlin",
  description: "How BitGremlin handles your data and privacy.",
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-semibold">Privacy Policy</h1>
      <p className="mt-3 text-white/60 text-sm">
        Last updated: {new Date().toISOString().slice(0, 10)}
      </p>

      <div className="mt-6 card rounded-xl p-6 space-y-5 text-white/75">
        <section>
          <h2 className="text-lg font-semibold">What we collect</h2>
          <p>
            Minimal technical logs necessary to operate the site (e.g., error logs). If a tool uploads
            media for processing, the file is used only to produce the requested output and is deleted
            after processing.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold">Cookies & analytics</h2>
          <p>
            We avoid invasive tracking. If analytics are enabled, they are privacy-respecting and
            aggregate only.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold">Data retention</h2>
          <p>
            Transient processing files are short-lived. Support messages sent via the contact form are
            retained for as long as needed to respond.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold">Your rights</h2>
          <p>
            You can request deletion of contact messages or other data we control. Email us via the
            Contact page.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold">Third parties</h2>
          <p>
            If we use providers (e.g., email, CDN), they are bound by similar privacy commitments and
            only receive the minimum data necessary.
          </p>
        </section>
      </div>
    </main>
  );
}
