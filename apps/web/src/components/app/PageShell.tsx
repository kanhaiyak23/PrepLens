import { AppHeader } from "./AppHeader";
import { AppFooter } from "./AppFooter";

/**
 * Single Responsibility: the frame every page shares (header, content width, footer) and the page heading block.
 * Pages supply only their content. Design source: the heading block on Stitch "My Posts", "Profile", "Share Your Interview":
 * a small lilac eyebrow with a dot, a large semibold title, one line of description.
 */
export function PageShell({ eyebrow, title, description, width = "max-w-5xl", actions, children }: {
  eyebrow?: string; title?: string; description?: string; width?: string; actions?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <>
      <AppHeader />
      <main id="top" className="w-full pt-16 bg-surface-container-lowest min-h-[70vh]">
        <div className={`${width} mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12`}>
          {title && (
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
              <div className="space-y-2">
                {eyebrow && <p className="inline-flex items-center gap-2 text-xs font-semibold tracking-wider uppercase text-primary"><span className="w-1.5 h-1.5 rounded-[50%] bg-primary" />{eyebrow}</p>}
                <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-on-surface">{title}</h1>
                {description && <p className="text-on-surface-variant max-w-2xl">{description}</p>}
              </div>
              {actions}
            </div>
          )}
          {children}
        </div>
      </main>
      <AppFooter />
    </>
  );
}
