import Link from "next/link";
import { cancelGuides } from "@/data/cancel-guides";

export default function AllCancelGuides() {
  return (
    <main className="min-h-screen max-w-md mx-auto px-6 py-12 animate-fade-in">
      <Link href="/" className="nav-link inline-flex items-center gap-1 mb-8">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
        Back
      </Link>
      <h1 className="text-[28px] font-extrabold tracking-[-0.02em] mb-2">Cancel guides</h1>
      <p className="text-[15px] text-[#86868b] mb-8">Step-by-step for 20 services. No fluff.</p>
      <div className="card overflow-hidden p-0">
        {cancelGuides.map((g, i) => (
          <Link
            key={g.slug}
            href={`/cancel/${g.slug}`}
            className={`flex items-center justify-between px-5 py-3.5 hover:bg-[#f5f5f7] transition-colors duration-150 ${
              i !== cancelGuides.length - 1 ? 'border-b border-[#e5e5ea]' : ''
            }`}
          >
            <span className="text-[15px] font-medium">{g.name}</span>
            <span className={g.difficulty === 'easy' ? 'badge-easy' : g.difficulty === 'medium' ? 'badge-medium' : 'badge-hard'}>
              {g.difficulty}
            </span>
          </Link>
        ))}
      </div>
    </main>
  );
}
