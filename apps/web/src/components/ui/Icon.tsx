/** Material Symbols glyph. Design source: every Stitch screen uses Material Symbols Outlined for icons. */
export function Icon({ name, className = "" }: { name: string; className?: string }) {
  return <span aria-hidden="true" className={`material-symbols-outlined ${className}`}>{name}</span>;
}
