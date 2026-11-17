import { Icon } from "./Icon";

/** Design source: Stitch "Experiences Archive", the "StateEmptyExperiences" component (lilac tile icon, headline, one action). */
export function EmptyState({ icon = "psychology_alt", title, children, action }: { icon?: string; title: string; children?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="bg-surface-container-lowest border border-dashed border-outline-variant rounded-3xl p-10 sm:p-14 text-center flex flex-col items-center max-w-3xl mx-auto">
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-fixed to-secondary-container text-primary flex items-center justify-center mb-4"><Icon name={icon} className="!text-3xl" /></div>
      <h2 className="font-display text-2xl font-semibold text-on-surface mb-2">{title}</h2>
      {children && <p className="text-sm text-on-surface-variant max-w-md mb-6 leading-relaxed">{children}</p>}
      {action}
    </div>
  );
}
