export const metadata = {
  title: "Terms of Service – BitGremlin",
  description: "The rules for using BitGremlin tools and site.",
};

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-semibold">Terms of Service</h1>
      <p className="mt-3 text-white/60 text-sm">
        Last updated: {new Date().toISOString().slice(0, 10)}
      </p>

      <div className="mt-6 card rounded-xl p-6 space-y-5 text-white/75">
        <section>
          <h2 className="text-lg font-semibold">1. Acceptance</h2>
          <p>By accessing this site or using BitGremlin tools, you agree to these Terms.</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold">2. Use of the Service</h2>
          <p>
            Don’t abuse, disrupt, reverse engineer, or use the tools for illegal activity. You’re
            responsible for compliance with your local laws.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold">3. Accounts & Content</h2>
          <p>
            If accounts are offered, keep credentials secure. You retain ownership of your content;
            you grant BitGremlin a limited license to process it for the feature you requested.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold">4. Warranties & Liability</h2>
          <p>
            Services are provided “as is” without warranties. To the fullest extent permitted by law,
            BitGremlin is not liable for indirect or consequential damages.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold">5. Changes</h2>
          <p>We may update these Terms. Continued use means you accept the new Terms.</p>
        </section>
        <p className="text-xs text-white/50">
          This is not legal advice. For production/commercial use, have counsel review.
        </p>
      </div>
    </main>
  );
}
