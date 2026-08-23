import { getGuide, cancelGuides } from "@/data/cancel-guides";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

export function generateStaticParams() {
  return cancelGuides.map((g) => ({ slug: g.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const guide = getGuide(params.slug);
  if (!guide) return {};
  return {
    title: `How to Cancel ${guide.name} in ${guide.steps.length} Steps (2026)`,
    description: `Step-by-step guide to cancel your ${guide.name} subscription. ${guide.difficulty === 'hard' ? 'Includes phone numbers and mail-in options.' : 'Takes just a few minutes.'} ${guide.warning ? guide.warning.slice(0, 120) : ''}`,
    openGraph: {
      title: `How to Cancel ${guide.name} — ${guide.difficulty === 'easy' ? 'Takes 2 Minutes' : guide.difficulty === 'medium' ? 'Takes 5 Minutes' : 'We\'ll Walk You Through It'}`,
      description: `${guide.steps.length} easy-to-follow steps. Updated July 2026.`,
    },
  };
}

export default function CancelGuidePage({ params }: { params: { slug: string } }) {
  const guide = getGuide(params.slug);
  if (!guide) notFound();

  const difficultyLabel = {
    easy: { text: 'Takes about 2 minutes', className: 'badge-easy' },
    medium: { text: 'Takes about 5 minutes', className: 'badge-medium' },
    hard: { text: 'Brace yourself', className: 'badge-hard' },
  }[guide.difficulty];

  // Google HowTo structured data for rich results
  const howToSchema = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    "name": `How to cancel ${guide.name}`,
    "description": `Step-by-step guide to cancel your ${guide.name} subscription or membership. ${guide.difficulty === 'hard' ? 'May require phone call or in-person visit.' : 'Takes just a few minutes.'}`,
    "totalTime": guide.difficulty === 'easy' ? 'PT2M' : guide.difficulty === 'medium' ? 'PT5M' : 'PT15M',
    "step": guide.steps.map((step, i) => ({
      "@type": "HowToStep",
      "position": i + 1,
      "text": step,
    })),
  };

  return (
    <main className="min-h-screen max-w-md mx-auto px-6 py-12 animate-fade-in">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(howToSchema) }}
      />
      <Link href="/cancel" className="nav-link inline-flex items-center gap-1 mb-6">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
        All guides
      </Link>

      <span className={`${difficultyLabel.className} mb-3`}>{difficultyLabel.text}</span>

      <h1 className="text-[28px] font-extrabold tracking-[-0.02em] mb-6 leading-[1.15]">
        How to cancel<br />{guide.name}
      </h1>

      {guide.warning && (
        <div className="bg-[var(--red-dim)] rounded-2xl p-4 mb-6 text-[14px] text-[var(--red)] leading-relaxed">
          {guide.warning}
        </div>
      )}

      <div className="card mb-6">
        <ol className="space-y-0">
          {guide.steps.map((step, i) => (
            <li key={i} className={`flex gap-4 ${i !== 0 ? 'pt-4' : ''} ${i !== guide.steps.length - 1 ? 'pb-4 border-b border-[var(--divider)]' : ''}`}>
              <span className="flex-shrink-0 w-7 h-7 rounded-full bg-[var(--text)] text-[var(--bg)] text-[13px] flex items-center justify-center font-semibold mt-0.5">
                {i + 1}
              </span>
              <span className="text-[15px] text-[var(--text)] leading-relaxed pt-0.5">{step}</span>
            </li>
          ))}
        </ol>
      </div>

      {guide.directLink && (
        <a href={guide.directLink} target="_blank" rel="noopener noreferrer" className="btn-primary w-full mb-4">
          Open cancel page
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" /></svg>
        </a>
      )}

      {/* Pre-filled email template for hard-to-cancel services */}
      {guide.cancelEmail && (
        <a
          href={`mailto:${guide.cancelEmail.to}?subject=${encodeURIComponent(guide.cancelEmail.subject)}&body=${encodeURIComponent(guide.cancelEmail.body)}`}
          className="btn-secondary w-full mb-4"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" /></svg>
          Send cancel email
        </a>
      )}

      {/* Data citation */}
      {guide.citation && (
        <div className="bg-[var(--bg-elevated)] rounded-2xl p-4 mb-4 text-[13px] text-[var(--text-secondary)] leading-relaxed">
          {guide.citation}
        </div>
      )}

      {/* FAQ */}
      <div className="card mb-4">
        <h3 className="text-[15px] font-semibold mb-3">FAQ</h3>
        <div className="space-y-3 text-[14px]">
          <div>
            <p className="font-medium text-[var(--text)]">Will I lose my data if I cancel?</p>
            <p className="text-[var(--text-secondary)]">Most services keep your data for a period after cancellation. {guide.name} is no exception — you typically retain access until the end of your billing cycle.</p>
          </div>
          <div>
            <p className="font-medium text-[var(--text)]">Can I get a refund?</p>
            <p className="text-[var(--text-secondary)]">Most subscription services do not offer prorated refunds. Cancel right before your renewal date to maximize value.</p>
          </div>
          <div>
            <p className="font-medium text-[var(--text)]">What if the cancel button is missing?</p>
            <p className="text-[var(--text-secondary)]">
              {guide.difficulty === 'hard'
                ? `${guide.name} is known for making cancellation difficult. If you can\'t find the option, try a different device or browser, or use the phone number listed above.`
                : 'Try a different device or browser. Some services hide cancel options on mobile. Switch to desktop view.'}
            </p>
          </div>
        </div>
      </div>

      {/* Freshness signal */}
      <p className="text-center text-[12px] text-[var(--text-tertiary)] mb-4">
        Last updated: July 24, 2026 · Cancel guides verified by OopsSubs
      </p>

      <div className="card text-center py-8 mt-6">
        <h3 className="text-[17px] font-semibold mb-1">One at a time?</h3>
        <p className="text-[14px] text-[var(--text-secondary)] mb-5">Scan all your subscriptions at once.</p>
        <Link href="/app" className="btn-primary text-[15px]">
          Connect Gmail to find everything
        </Link>
      </div>
    </main>
  );
}
