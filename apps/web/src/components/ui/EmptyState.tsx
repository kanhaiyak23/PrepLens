import { Icon } from "./Icon";

/** Design source: Stitch "Experiences Archive", the "StateEmptyExperiences" component (lilac tile icon, headline, one action). */
export function EmptyState({ icon = "psychology_alt", title, children, action }: { icon?: string; title: string; children?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="bg-surface-container-low rounded-2xl p-10 sm:p-14 text-center flex flex-col items-center max-w-3xl mx-auto">
      <div className="w-16 h-16 rounded-2xl bg-secondary-fixed text-on-secondary-fixed flex items-center justify-center mb-4"><Icon name={icon} className="!text-3xl" /></div>
      <h2 className="text-xl font-bold text-on-surface mb-2">{title}</h2>
      {children && <p className="text-sm text-on-surface-variant max-w-md mb-6 leading-relaxed">{children}</p>}
      {action}
    </div>
  );
}
