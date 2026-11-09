import * as THREE from "three";
import { frameTexture, type RoundSpec } from "./textures";
import type { FontStacks } from "./fonts";

const Z_STEP = 10;
const CAM_START = 16;
const CAM_END = -24;

export type FlyScene = {
  setProgress: (p: number) => void;
  setPointer: (x: number, y: number) => void;
  render: () => void;
  resize: () => void;
  dispose: () => void;
};

type Frame = { g: THREE.Group; mat: THREE.MeshBasicMaterial; edges: THREE.LineSegments; z: number; baseY: number };

/**
 * Scroll-driven fly-through of the interview rounds.
 * Imperative Three.js on purpose: the camera is a pure function of scroll progress,
 * so React state is never in the render path (web3d-integration-patterns, pattern 1).
 */
export function createFlyScene(canvas: HTMLCanvasElement, host: HTMLElement, rounds: RoundSpec[], fonts: FontStacks): FlyScene {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.setClearColor(0x050e16, 1);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x050e16, 9, 38);
  const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 120);

  const disposables: { dispose: () => void }[] = [renderer];

  const frames: Frame[] = rounds.map((r, i) => {
    const g = new THREE.Group();
    const tex = frameTexture(r, fonts);
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide });
    const planeGeo = new THREE.PlaneGeometry(7.2, 4.32);
    const edgeSrc = new THREE.PlaneGeometry(7.3, 4.42);
    const edgeGeo = new THREE.EdgesGeometry(edgeSrc);
    const edgeMat = new THREE.LineBasicMaterial({ color: 0xf2b01e, transparent: true, opacity: 0 });
    const plane = new THREE.Mesh(planeGeo, mat);
    const edges = new THREE.LineSegments(edgeGeo, edgeMat);
    g.add(plane, edges);
    const side = i % 2 === 0 ? 1 : -1;
    g.position.set(4.4 + side * 1.0, side * 0.25, -i * Z_STEP);
    g.rotation.y = -side * 0.24;
    g.rotation.x = side * -0.03;
    scene.add(g);
    disposables.push(tex, mat, planeGeo, edgeSrc, edgeGeo, edgeMat);
    return { g, mat, edges, z: -i * Z_STEP, baseY: g.position.y };
  });

  // dust
  const N = 140;
  const pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 34;
    pos[i * 3 + 1] = (Math.random() - 0.5) * 18;
    pos[i * 3 + 2] = 18 - Math.random() * 78;
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const dustMat = new THREE.PointsMaterial({ color: 0x8fb2c8, size: 0.06, transparent: true, opacity: 0.7 });
  const dust = new THREE.Points(dustGeo, dustMat);
  scene.add(dust);
  disposables.push(dustGeo, dustMat);

  // the aperture at the end of the strip
  const ap = new THREE.Group();
  ap.position.set(4.4, 0, -46);
  [2.6, 4.4, 6.4].forEach((rad, k) => {
    const geo = new THREE.TorusGeometry(rad, 0.04, 8, 120);
    const mat = new THREE.MeshBasicMaterial({ color: k === 0 ? 0xf2b01e : 0x8fb2c8, transparent: true, opacity: k === 0 ? 0.95 : 0.55 });
    ap.add(new THREE.Mesh(geo, mat));
    disposables.push(geo, mat);
  });
  for (let b = 0; b < 6; b++) {
    const geo = new THREE.PlaneGeometry(0.05, 2.0);
    const mat = new THREE.MeshBasicMaterial({ color: 0xf2b01e, transparent: true, opacity: 0.7 });
    const blade = new THREE.Mesh(geo, mat);
    blade.position.set(Math.cos((b * Math.PI) / 3) * 3.5, Math.sin((b * Math.PI) / 3) * 3.5, 0);
    blade.rotation.z = (b * Math.PI) / 3 + Math.PI / 2;
    ap.add(blade);
    disposables.push(geo, mat);
  }
  scene.add(ap);

  let progress = 0;
  let mx = 0;
  let my = 0;
  let smx = 0;
  let smy = 0;

  function resize() {
    const w = host.clientWidth;
    const h = host.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function render() {
    const p = progress;
    const camZ = CAM_START + (CAM_END - CAM_START) * p;
    smx += (mx - smx) * 0.06;
    smy += (my - smy) * 0.06;
    camera.position.set(-2.2 + Math.sin(p * 5.2) * 0.7 + smx * 1.2, 0.1 + Math.cos(p * 4.1) * 0.35 - smy * 0.7, camZ);
    camera.lookAt(1.0 + smx * 0.6, 0, camZ - 12);
    camera.rotation.z = Math.sin(p * 6) * 0.025;

    for (const f of frames) {
      const d = camZ - f.z; // > 0 while the frame is ahead of the camera
      const ahead = Math.min(1, Math.max(0, (24 - d) / 8)); // only the current frame and the next are really visible
      const fade = Math.min(1, Math.max(0, (d - 0.4) / 1.6)) * ahead;
      const near = Math.exp(-Math.pow((d - 9) / 3.6, 2));
      f.mat.opacity = fade;
      (f.edges.material as THREE.LineBasicMaterial).opacity = fade * near * 0.95;
      f.g.position.y += (f.baseY + near * 0.15 - f.g.position.y) * 0.1;
    }
    ap.rotation.z = p * 3.2;
    ap.scale.setScalar(0.85 + p * 0.25);
    dust.rotation.y = p * 0.25;
    renderer.render(scene, camera);
  }

  resize();

  return {
    setProgress: (p) => {
      progress = p;
    },
    setPointer: (x, y) => {
      mx = x;
      my = y;
    },
    render,
    resize,
    dispose: () => {
      scene.clear();
      disposables.forEach((d) => d.dispose());
    },
  };
}

/** Index of the round whose caption should show: -1 is the intro. Thresholds follow the camera path. */
export const FLY_THRESHOLDS = [0.05, 0.3, 0.55, 0.8];
export function roundIndexAt(p: number): number {
  let idx = -1;
  for (let k = 0; k < FLY_THRESHOLDS.length; k++) if (p >= FLY_THRESHOLDS[k]) idx = k;
  return idx;
}
