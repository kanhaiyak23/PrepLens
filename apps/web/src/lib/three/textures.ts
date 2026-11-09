import * as THREE from "three";
import type { FontStacks } from "./fonts";

export type RoundSpec = { n: string; name: string; q: string };

function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lh: number) {
  const words = text.split(" ");
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, y);
      line = w;
      y += lh;
    } else line = test;
  }
  if (line) ctx.fillText(line, x, y);
}

function panelPath(ctx: CanvasRenderingContext2D, W: number, H: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(r, 0);
  ctx.arcTo(W, 0, W, H, r);
  ctx.arcTo(W, H, 0, H, r);
  ctx.arcTo(0, H, 0, 0, r);
  ctx.arcTo(0, 0, W, 0, r);
  ctx.closePath();
}

/** One interview round drawn as a film frame. `compact` omits the question text (hero scene). */
export function frameTexture(r: RoundSpec, fonts: FontStacks, compact = false): THREE.CanvasTexture {
  const W = 1200;
  const H = 720;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const x = c.getContext("2d")!;

  x.fillStyle = "rgba(11, 25, 37, 0.96)";
  panelPath(x, W, H, 24);
  x.fill();
  x.lineWidth = 4;
  x.strokeStyle = "rgba(169, 185, 198, 0.4)";
  x.stroke();

  x.fillStyle = "#F2B01E";
  x.fillRect(64, 64, 72, 8);

  x.textBaseline = "alphabetic";
  x.fillStyle = "#E8EEF3";
  x.font = `800 250px ${fonts.display}`;
  x.fillText(r.n, 58, 330);

  x.font = `500 26px ${fonts.mono}`;
  x.fillStyle = "#A9B9C6";
  if ("letterSpacing" in x) (x as unknown as { letterSpacing: string }).letterSpacing = "4px";
  x.fillText(`ROUND ${r.n} / 04`, 66, 130);
  x.textAlign = "right";
  x.fillText("SAMPLE", W - 64, 108);
  x.textAlign = "left";
  if ("letterSpacing" in x) (x as unknown as { letterSpacing: string }).letterSpacing = "0px";

  x.fillStyle = "#E8EEF3";
  x.font = `700 ${compact ? 78 : 62}px ${fonts.display}`;
  x.fillText(r.name, 66, compact ? 520 : 440);

  if (!compact) {
    x.fillStyle = "#A9B9C6";
    x.font = `400 38px ${fonts.body}`;
    wrapText(x, r.q, 66, 510, W - 140, 52);
  }

  x.strokeStyle = "rgba(169, 185, 198, 0.35)";
  x.lineWidth = 2;
  for (let i = 0; i < 48; i++) {
    x.beginPath();
    x.moveTo(66 + i * 22, H - 44);
    x.lineTo(66 + i * 22, H - (i % 4 === 0 ? 70 : 58));
    x.stroke();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}
