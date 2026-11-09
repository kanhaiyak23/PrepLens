export type FontStacks = { display: string; body: string; mono: string };

/** Resolve the next/font CSS variables so canvas textures use the same faces as the page. */
export function readFonts(): FontStacks {
  const cs = getComputedStyle(document.documentElement);
  const pick = (v: string, fallback: string) => cs.getPropertyValue(v).trim() || fallback;
  return {
    display: pick("--font-display", "Helvetica Neue, Arial, sans-serif"),
    body: pick("--font-body", "Helvetica Neue, Arial, sans-serif"),
    mono: pick("--font-mono", "Menlo, monospace"),
  };
}

export async function fontsReady(timeoutMs = 1800): Promise<void> {
  if (!document.fonts || !document.fonts.ready) return;
  await Promise.race([document.fonts.ready, new Promise<void>((r) => setTimeout(r, timeoutMs))]);
}
