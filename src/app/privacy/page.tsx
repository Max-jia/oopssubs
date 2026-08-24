import Link from "next/link";

export default function PrivacyPage() {
  return (
    <main className="min-h-screen max-w-md mx-auto px-6 py-12">
      <Link href="/" className="text-sm text-[var(--text-secondary)] hover:text-[var(--text)] mb-8 inline-block">← Home</Link>
      <h1 className="text-2xl font-bold mb-8">Privacy</h1>

      <div className="space-y-6 text-sm text-[var(--text-secondary)] leading-relaxed">
        <section>
          <h2 className="text-base font-semibold text-[var(--text)] mb-2">We don&apos;t have a server.</h2>
          <p>This app runs entirely in your browser. Your subscription list, your Gmail token, everything — it lives in your device&apos;s localStorage. We literally cannot see your data because we never send it anywhere except where you tell us to (Google, for Gmail access, and DeepSeek, for AI extraction).</p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-[var(--text)] mb-2">What we access</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Gmail read-only.</strong> We request permission to read your emails to find subscription receipts. We cannot send, delete, or modify emails.</li>
            <li><strong>Email bodies, for AI extraction.</strong> When scanning, we send snippets of subscription-related emails to DeepSeek&apos;s API to extract service names and amounts. We strip sender addresses and subject lines before sending. Only the email body text is sent.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold text-[var(--text)] mb-2">What we don&apos;t do</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>We don&apos;t store your emails, your subscription data, or your identity on any server</li>
            <li>We don&apos;t use cookies or tracking scripts (no Google Analytics, no Facebook pixel, nothing)</li>
            <li>We don&apos;t sell, share, or monetize your data in any way</li>
            <li>We don&apos;t have your credit card, bank login, or payment information</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold text-[var(--text)] mb-2">You can revoke access anytime</h2>
          <p>Remove Gmail access at <a href="https://myaccount.google.com/permissions" className="underline" target="_blank" rel="noopener noreferrer">myaccount.google.com/permissions</a>. Clear your subscription data by clearing your browser&apos;s site data for this domain.</p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-[var(--text)] mb-2">Third-party services</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Google Gmail API</strong> — to read your emails (you authorize this)</li>
            <li><strong>DeepSeek API</strong> — to extract subscription info from email text</li>
          </ul>
          <p className="mt-2">Both services process data per their own privacy policies.</p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-[var(--text)] mb-2">Contact</h2>
          <p>This is a one-person project. If you have questions about privacy, email jiayongchun001@gmail.com.</p>
        </section>
      </div>
    </main>
  );
}
