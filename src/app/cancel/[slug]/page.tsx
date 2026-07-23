import { getGuide, cancelGuides } from "@/data/cancel-guides";
import Link from "next/link";
import { notFound } from "next/navigation";

export function generateStaticParams() {
  return cancelGuides.map((g) => ({ slug: g.slug }));
}

export default function CancelGuidePage({ params }: { params: { slug: string } }) {
  const guide = getGuide(params.slug);
  if (!guide) notFound();

  const difficultyLabel = {
    easy: { text: 'Takes about 2 minutes', className: 'badge-easy' },
    medium: { text: 'Takes about 5 minutes', className: 'badge-medium' },
    hard: { text: 'Brace yourself', className: 'badge-hard' },
  }[guide.difficulty];

  return (
    <main className="min-h-screen max-w-md mx-auto px-6 py-12 animate-fade-in">
      <Link href="/cancel" className="nav-link inline-flex items-center gap-1 mb-6">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
        All guides
      </Link>

      <span className={`${difficultyLabel.className} mb-3`}>{difficultyLabel.text}</span>

      <h1 className="text-[28px] font-extrabold tracking-[-0.02em] mb-6 leading-[1.15]">
        How to cancel<br />{guide.name}
      </h1>

      {guide.warning && (
        <div className="bg-[#ffebee] rounded-2xl p-4 mb-6 text-[14px] text-[#c62828] leading-relaxed">
          {guide.warning}
        </div>
      )}

      <div className="card mb-6">
        <ol className="space-y-0">
          {guide.steps.map((step, i) => (
            <li key={i} className={`flex gap-4 ${i !== 0 ? 'pt-4' : ''} ${i !== guide.steps.length - 1 ? 'pb-4 border-b border-[#e5e5ea]' : ''}`}>
              <span className="flex-shrink-0 w-7 h-7 rounded-full bg-[#1d1d1f] text-white text-[13px] flex items-center justify-center font-semibold mt-0.5">
                {i + 1}
              </span>
              <span className="text-[15px] text-[#1d1d1f] leading-relaxed pt-0.5">{step}</span>
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

      <div className="card text-center py-8 mt-6">
        <h3 className="text-[17px] font-semibold mb-1">One at a time?</h3>
        <p className="text-[14px] text-[#86868b] mb-5">Scan all your subscriptions at once.</p>
        <Link href="/app" className="btn-primary text-[15px]">
          Connect Gmail to find everything
        </Link>
      </div>
    </main>
  );
}
