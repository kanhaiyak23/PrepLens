import { AppHeader } from "./AppHeader";
import { AppFooter } from "./AppFooter";

/**
 * Single Responsibility: the frame every page shares (header, page heading band, content width, footer).
 * Pages supply only their content. Design source: Rishihood brand (ADR-29): a cream band with a soft crimson glow,
 * a ruled crimson eyebrow, a Garamond title and one line of description.
 */
export function PageShell({ eyebrow, title, description, width = "max-w-5xl", actions, children }: {
  eyebrow?: string; title?: string; description?: string; width?: string; actions?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <>
      <AppHeader />
      <main id="top" className="w-full pt-16 min-h-[70vh]">
        {title && (
          <section className="relative overflow-hidden border-b border-outline-variant/70 bg-surface-container-low">
            <div aria-hidden="true" className="absolute -top-32 -right-24 w-[34rem] h-[34rem] rounded-full bg-[radial-gradient(closest-side,rgb(200_7_47/0.10),transparent)]" />
            <div aria-hidden="true" className="absolute -bottom-40 -left-24 w-[28rem] h-[28rem] rounded-full bg-[radial-gradient(closest-side,rgb(215_129_93/0.12),transparent)]" />
            <div className={`relative ${width} mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-10 sm:pt-16 sm:pb-12 flex flex-col sm:flex-row sm:items-end justify-between gap-6 animate-rise`}>
              <div className="space-y-3 min-w-0">
                {eyebrow && <p className="eyebrow-rule text-primary">{eyebrow}</p>}
                <h1 className="text-4xl sm:text-5xl text-on-surface leading-[1.05]">{title}</h1>
                {description && <p className="text-on-surface-variant max-w-2xl leading-relaxed">{description}</p>}
              </div>
              {actions}
            </div>
          </section>
        )}
        <div className={`${width} mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12`}>{children}</div>
      </main>
      <AppFooter />
    </>
  );
}
