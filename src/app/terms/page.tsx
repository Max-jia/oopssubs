import Link from "next/link";

export default function TermsPage() {
  return (
    <main className="min-h-screen max-w-md mx-auto px-6 py-12">
      <Link href="/" className="nav-link inline-flex items-center gap-1 mb-8">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
        Home
      </Link>
      <h1 className="text-[28px] font-extrabold tracking-[-0.02em] mb-2">Terms of Service</h1>
      <p className="text-[15px] text-[#86868b] mb-8">Last updated: July 24, 2026</p>

      <div className="space-y-6 text-[14px] text-[#1d1d1f] leading-relaxed">
        <section>
          <h2 className="text-[17px] font-semibold mb-2">1. What OopsSubs does</h2>
          <p>OopsSubs helps you find and manage paid subscriptions by scanning your Gmail inbox for subscription-related emails. You can also manually add subscriptions and receive renewal reminders.</p>
        </section>

        <section>
          <h2 className="text-[17px] font-semibold mb-2">2. Your data</h2>
          <p>OopsSubs runs entirely in your browser. We do not have a server or database. Your subscription list, Gmail authorization token, and all personal data are stored locally on your device using browser localStorage. We never see, access, or store your data.</p>
        </section>

        <section>
          <h2 className="text-[17px] font-semibold mb-2">3. Gmail access</h2>
          <p>When you connect Gmail, you grant OopsSubs read-only access to scan your inbox for subscription receipts. We request the minimum permission needed (gmail.readonly). We do not send, delete, or modify emails. You can revoke access at any time at myaccount.google.com/permissions.</p>
        </section>

        <section>
          <h2 className="text-[17px] font-semibold mb-2">4. AI processing</h2>
          <p>To extract subscription details from emails, we send anonymized email body text to DeepSeek's API. Sender addresses and subject lines are stripped before sending. The AI processes this text and returns structured data (service name, amount). No emails are stored by DeepSeek.</p>
        </section>

        <section>
          <h2 className="text-[17px] font-semibold mb-2">5. Calendar</h2>
          <p>If you choose to add a subscription renewal to your calendar, OopsSubs writes an event to your Google Calendar via the calendar.events scope. You control this — we never write calendar events without your explicit tap.</p>
        </section>

        <section>
          <h2 className="text-[17px] font-semibold mb-2">6. No guarantees</h2>
          <p>OopsSubs is provided "as is." While we work hard to provide accurate cancel guides and subscription detection, we cannot guarantee that every subscription will be detected or that every cancel guide will be up to date. Services change their cancellation processes — if you find an outdated guide, let us know.</p>
        </section>

        <section>
          <h2 className="text-[17px] font-semibold mb-2">7. Contact</h2>
          <p>OopsSubs is a solo project. Reach out at jiayongchun001@gmail.com.</p>
        </section>
      </div>
    </main>
  );
}
