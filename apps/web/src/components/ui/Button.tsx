import Link from "next/link";
import type { ButtonHTMLAttributes, ComponentProps } from "react";

/**
 * Open/Closed: a new look is a new entry in VARIANT, not an edit to the component.
 * Design source: Stitch "PrepLens - Home" (primary + secondary CTAs), "Admin Moderation" (danger-soft reject), "Profile" (quiet sign out).
 */
const VARIANT = {
  primary: "bg-primary text-on-primary hover:bg-primary-container shadow-[0_6px_16px_-6px_rgb(200_7_47/0.55)]",
  secondary: "bg-surface-container-lowest text-on-surface border border-outline-variant hover:border-primary/40 hover:text-primary",
  quiet: "text-on-surface-variant hover:bg-surface-container hover:text-on-surface",
  danger: "bg-error-container text-on-error-container hover:bg-error hover:text-on-error",
} as const;
const SIZE = { md: "px-6 py-2.5 text-sm", sm: "px-4 py-1.5 text-sm" } as const;

type Look = { variant?: keyof typeof VARIANT; size?: keyof typeof SIZE };
export const buttonClass = ({ variant = "primary", size = "md" }: Look = {}) =>
  `inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${VARIANT[variant]} ${SIZE[size]}`;

export function Button({ variant, size, className = "", ...rest }: Look & ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button {...rest} className={`${buttonClass({ variant, size })} ${className}`} />;
}
export function ButtonLink({ variant, size, className = "", ...rest }: Look & ComponentProps<typeof Link>) {
  return <Link {...rest} className={`${buttonClass({ variant, size })} ${className}`} />;
}
