import ContactForm from "./ContactForm";

export const metadata = {
  title: "Contact – BitGremlin",
  description: "Get in touch with BitGremlin.",
};

export default function ContactPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-semibold">Contact</h1>
      <p className="mt-3 text-white/70">
        Questions, feedback, or partnership ideas? Shoot a message.
      </p>
      <ContactForm />
    </main>
  );
}
