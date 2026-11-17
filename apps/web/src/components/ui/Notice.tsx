import { Icon } from "./Icon";

/** Inline message. Design source: Stitch "Sign in" (red access-restricted box), "Profile"/"My Posts" (lilac info strip), "Share Your Interview" (top banner). */
const KIND = {
  info: { box: "bg-surface-container-low text-on-surface border border-outline-variant/70", icon: "info", iconColor: "text-primary" },
  error: { box: "bg-error-container text-on-error-container", icon: "error", iconColor: "text-on-error-container" },
  success: { box: "bg-emerald-50 text-emerald-900", icon: "check_circle", iconColor: "text-emerald-700" },
} as const;

export function Notice({ kind = "info", title, children }: { kind?: keyof typeof KIND; title?: string; children: React.ReactNode }) {
  const k = KIND[kind];
  return (
    <div role={kind === "error" ? "alert" : "status"} className={`flex items-start gap-3 rounded-xl px-4 py-3 text-sm ${k.box}`}>
      <Icon name={k.icon} className={`mt-0.5 ${k.iconColor}`} />
      <div>{title && <p className="font-semibold">{title}</p>}<div>{children}</div></div>
    </div>
  );
}
