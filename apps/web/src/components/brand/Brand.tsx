import Image from "next/image";

/**
 * Brand marks (ADR-29). The PrepLens mark is a shield, echoing the Rishihood crest, holding a lens: "a closer look".
 * The university logos are the official files from rishihood.edu.in, served locally from /public/brand.
 */
export function PrepLensMark({ className = "w-8 h-8", tone = "brand" }: { className?: string; tone?: "brand" | "light" }) {
  const id = tone === "brand" ? "pl-g" : "pl-gl";
  return (
    <svg viewBox="0 0 32 36" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          {tone === "brand"
            ? <><stop offset="0" stopColor="#e2683c" /><stop offset="0.55" stopColor="#c8072f" /><stop offset="1" stopColor="#7a0a22" /></>
            : <><stop offset="0" stopColor="#ffffff" /><stop offset="1" stopColor="#f6dfe3" /></>}
        </linearGradient>
      </defs>
      <path d="M16 1.5 3 6v11.2c0 8.1 5.5 14.3 13 17.3 7.5-3 13-9.2 13-17.3V6L16 1.5Z" fill={`url(#${id})`} />
      <circle cx="14.6" cy="16.2" r="6" fill="none" stroke={tone === "brand" ? "#fff" : "#9e0626"} strokeWidth="2.4" />
      <path d="m19 20.6 4.4 4.4" stroke={tone === "brand" ? "#fff" : "#9e0626"} strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}

export function Wordmark({ light = false, className = "" }: { light?: boolean; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <PrepLensMark className="w-7 h-8 shrink-0" />
      <span className={`font-display text-[1.6rem] leading-none font-semibold tracking-tight ${light ? "text-white" : "text-on-surface"}`}>
        Prep<span className={light ? "text-[#ffb3c0]" : "text-primary"}>Lens</span>
      </span>
    </span>
  );
}

export function RishihoodLogo({ light = false, className = "h-8 w-auto" }: { light?: boolean; className?: string }) {
  return light
    ? <Image src="/brand/rishihood-logo-white.png" alt="Rishihood University" width={512} height={204} className={className} />
    : <Image src="/brand/rishihood-logo.png" alt="Rishihood University" width={512} height={188} className={className} />;
}

export function NstLogo({ className = "h-7 w-auto" }: { className?: string }) {
  return <Image src="/brand/nst-logo.png" alt="Newton School of Technology" width={260} height={84} className={className} />;
}
