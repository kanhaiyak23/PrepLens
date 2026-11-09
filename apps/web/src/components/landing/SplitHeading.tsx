import type { ElementType } from "react";

/**
 * Renders a headline as masked words so GSAP can lift them in.
 * Split in JSX (not by mutating the DOM) so React and the server HTML always agree.
 * Wrap a word in *asterisks* to underline-mark it.
 */
export function SplitHeading({
  text,
  as: Tag = "h2",
  className = "",
}: {
  text: string;
  as?: ElementType;
  className?: string;
}) {
  const plain = text.replace(/\*/g, "");
  const segments = text.split(/(\*[^*]+\*)/).filter(Boolean);
  let k = 0;
  const words = (s: string) =>
    s
      .split(/(\s+)/)
      .filter(Boolean)
      .map((p) =>
        /^\s+$/.test(p) ? (
          " "
        ) : (
          <span className="w" key={k++}>
            <span className="wi" data-split>
              {p}
            </span>
          </span>
        ),
      );

  return (
    <Tag className={className} aria-label={plain}>
      <span aria-hidden="true">
        {segments.map((seg, i) =>
          seg.startsWith("*") ? (
            <em className="em-mark" key={i}>
              {words(seg.slice(1, -1))}
            </em>
          ) : (
            <span key={i}>{words(seg)}</span>
          ),
        )}
      </span>
    </Tag>
  );
}
