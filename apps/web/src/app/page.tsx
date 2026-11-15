import { AppHeader } from "@/components/app/AppHeader";
import { AppFooter } from "@/components/app/AppFooter";
import { ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";

/**
 * Design source: Stitch "PrepLens - Home".
 * Kept: the audience banner, the hero (headline, sentence, two CTAs), the three step cards, the NST-only note.
 * Dropped because there is no real data behind them (the project rule is no fake numbers): the "2024-2025" badge text,
 * "Tech, Product, Analytics & SDE" and "Updated for recent campus cycles".
 */
const STEPS = [
  { n: "01", icon: "search", title: "Read", body: "Search by company or topic to see the exact questions asked in each round." },
  { n: "02", icon: "edit", title: "Share", body: "Write down your rounds, questions and tips after your own interview." },
  { n: "03", icon: "fact_check", title: "Admin review", body: "An admin checks every post before it goes public. You can withdraw yours any time." },
];

export default function Home() {
  return (
    <>
      <AppHeader />
      <main className="w-full pt-16 bg-surface-container-lowest">
        <section className="bg-surface-container-low py-3.5 px-4">
          <p className="max-w-4xl mx-auto flex items-center justify-center gap-2.5 text-center text-xs sm:text-sm text-on-surface-variant">
            <Icon name="school" className="text-secondary !text-lg shrink-0" />
            <span>Built for students of <b className="font-medium text-on-surface">Newton School of Technology (NST)</b>. Sign in with your <code className="font-mono text-xs bg-surface-variant px-1.5 py-0.5 rounded-lg">@nst.rishihood.edu.in</code> account.</span>
          </p>
        </section>

        <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-20 sm:pt-28 sm:pb-24">
          <p className="inline-flex items-center gap-2 mb-8 bg-surface-container px-3 py-1 rounded-full text-xs font-medium text-secondary">
            <span className="w-1.5 h-1.5 rounded-[50%] bg-primary" /> Placement archive
          </p>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight leading-[1.12] mb-6 max-w-3xl">Know what each interview round asks.</h1>
          <p className="text-base sm:text-lg text-on-surface-variant leading-relaxed mb-10 max-w-2xl">
            Real questions, round breakdowns and advice, shared by NST seniors to help you prepare for campus and off-campus placements.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 sm:w-auto">
            <ButtonLink href="/archive" className="!px-6 !py-3.5">Read experiences <Icon name="arrow_forward" className="!text-base" /></ButtonLink>
            <ButtonLink href="/submit" variant="secondary" className="!px-6 !py-3.5">Share yours <Icon name="edit_note" className="!text-base text-secondary" /></ButtonLink>
          </div>
          <p className="mt-12 flex items-center gap-2 text-xs text-on-surface-variant"><Icon name="verified_user" className="text-secondary !text-base" /> Every post is reviewed by an admin before it is public.</p>
        </section>

        <section className="pb-24">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-3 gap-6">
            {STEPS.map((s) => (
              <div key={s.n} className="bg-surface-container-low p-7 rounded-lg shadow-sm">
                <div className="flex items-center justify-between mb-8"><span className="text-xs font-mono tracking-widest text-secondary font-medium">{s.n}</span><Icon name={s.icon} className="text-secondary" /></div>
                <h2 className="text-lg font-semibold mb-2 tracking-tight">{s.title}</h2>
                <p className="text-sm text-on-surface-variant leading-relaxed">{s.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-surface-container-low py-12 px-4 sm:px-6">
          <div className="max-w-4xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div className="flex items-start gap-4">
              <Icon name="lock" className="text-primary !text-2xl mt-0.5" />
              <div>
                <h3 className="text-sm font-semibold">NST accounts only</h3>
                <p className="text-xs text-on-surface-variant mt-0.5">Posts are tied to verified campus accounts to keep the archive genuine. Reading never needs an account.</p>
              </div>
            </div>
            <a href="/submit" className="text-xs font-semibold text-primary hover:text-on-primary-fixed-variant whitespace-nowrap">Share your interview →</a>
          </div>
        </section>
      </main>
      <AppFooter />
    </>
  );
}
