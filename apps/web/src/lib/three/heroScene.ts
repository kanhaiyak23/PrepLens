import * as THREE from "three";
import { gsap } from "gsap";
import type { FontStacks } from "./fonts";

export type HeroScene = {
  setPointer: (x: number, y: number) => void;
  setScroll: (p: number) => void;
  render: () => void;
  resize: () => void;
  intro: () => void;
  dispose: () => void;
};

/**
 * The hero's atmosphere: an aperture and four round-frames drifting in depth.
 * Transparent canvas, so the page's own gradient shows through and the type stays crisp DOM.
 */
export function createHeroScene(canvas: HTMLCanvasElement, host: HTMLElement, _fonts: FontStacks, light: boolean): HeroScene {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !light, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, light ? 1.25 : 1.75));
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x050e16, 14, 34);
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 80);
  camera.position.set(0, 0, 15);

  const disposables: { dispose: () => void }[] = [renderer];

  // aperture rig
  const rig = new THREE.Group();
  scene.add(rig);
  const ring = new THREE.Group();
  rig.add(ring);
  [2.1, 3.3, 4.6].forEach((rad, k) => {
    const geo = new THREE.TorusGeometry(rad, k === 0 ? 0.05 : 0.026, 8, 140);
    const mat = new THREE.MeshBasicMaterial({ color: k === 0 ? 0xf2b01e : 0x8fb2c8, transparent: true, opacity: k === 0 ? 0.95 : 0.5 });
    const m = new THREE.Mesh(geo, mat);
    ring.add(m);
    disposables.push(geo, mat);
  });
  const bladeGroup = new THREE.Group();
  ring.add(bladeGroup);
  for (let b = 0; b < 6; b++) {
    const geo = new THREE.PlaneGeometry(0.06, 2.2);
    const mat = new THREE.MeshBasicMaterial({ color: 0xf2b01e, transparent: true, opacity: 0.75 });
    const blade = new THREE.Mesh(geo, mat);
    const a = (b * Math.PI) / 3;
    blade.position.set(Math.cos(a) * 3.0, Math.sin(a) * 3.0, 0);
    blade.rotation.z = a + Math.PI / 2;
    bladeGroup.add(blade);
    disposables.push(geo, mat);
  }
  rig.rotation.set(-0.38, -0.55, 0);

  const intro = { k: 0 };

  // dust
  const N = light ? 40 : 90;
  const pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 30;
    pos[i * 3 + 1] = (Math.random() - 0.5) * 16;
    pos[i * 3 + 2] = -12 + Math.random() * 22;
  }
  const dGeo = new THREE.BufferGeometry();
  dGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const dMat = new THREE.PointsMaterial({ color: 0x8fb2c8, size: 0.05, transparent: true, opacity: 0.6 });
  const dust = new THREE.Points(dGeo, dMat);
  scene.add(dust);
  disposables.push(dGeo, dMat);

  let mx = 0;
  let my = 0;
  let smx = 0;
  let smy = 0;
  let scroll = 0;
  const t0 = performance.now();

  function layoutRig() {
    const w = host.clientWidth;
    const h = host.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // keep the rig on the right on wide screens, centred behind the type on narrow ones
    const wide = w > 960;
    rig.position.set(wide ? 5.4 : 0, wide ? 0.5 : -1.2, -1);
    rig.scale.setScalar(wide ? 0.92 : 0.7);
    camera.updateProjectionMatrix();
  }

  function render() {
    const t = (performance.now() - t0) / 1000;
    smx += (mx - smx) * 0.05;
    smy += (my - smy) * 0.05;
    ring.rotation.z = t * 0.12 + scroll * 2.4;
    bladeGroup.rotation.z = -t * 0.08 - scroll * 1.2;
    rig.rotation.y = -0.55 + smx * 0.35 + intro.k * 0.8;
    rig.rotation.x = -0.38 - smy * 0.25;
    dust.rotation.y = t * 0.02 + scroll * 0.3;
    camera.position.z = 15 - scroll * 3;
    renderer.render(scene, camera);
  }

  layoutRig();

  return {
    setPointer: (x, y) => {
      mx = x;
      my = y;
    },
    setScroll: (p) => {
      scroll = p;
    },
    render,
    resize: layoutRig,
    intro: () => {
      const target = rig.scale.x;
      gsap.fromTo(rig.scale, { x: target * 0.55, y: target * 0.55, z: target * 0.55 }, { x: target, y: target, z: target, duration: 2.2, ease: "expo.out" });
      intro.k = 1;
      gsap.to(intro, { k: 0, duration: 2.2, delay: 0.25, ease: "expo.out" });
    },
    dispose: () => {
      scene.clear();
      disposables.forEach((d) => d.dispose());
    },
  };
}
