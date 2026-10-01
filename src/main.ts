import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import raw from "../data/timeline.toml?raw";
import { helixPosition, matchDay, monthGroups, nearestIndex, nodeSize, RADIUS, stepIndex } from "./layout";
import { parseTimeline } from "./timeline";
import "./style.css";

const { title, days } = parseTimeline(raw);
const N = days.length;
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const speed = reduce ? 0.15 : 1;
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
document.title = title;
$("title").textContent = title;
$("title").dataset.text = title;

// --- scene ---
const renderer = new THREE.WebGLRenderer({ canvas: $("scene"), antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x02010a, 0.012);
const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
camera.position.set(0, 0, 75);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.autoRotate = !reduce;
controls.autoRotateSpeed = 0.6;

function resize() {
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
}
addEventListener("resize", resize);
resize();

// --- stars ---
const starPos = new Float32Array(4000 * 3).map(() => (Math.random() - 0.5) * 400);
const starGeo = new THREE.BufferGeometry().setAttribute("position", new THREE.BufferAttribute(starPos, 3));
const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ size: 0.6, color: 0xffffff, transparent: true, opacity: 0.8 }));
scene.add(stars);

// --- golden helix ---
const curve = new THREE.CatmullRomCurve3(
  Array.from({ length: 400 }, (_, i) => new THREE.Vector3().copy(helixPosition(i, 400) as THREE.Vector3)),
);
const helix = new THREE.Mesh(
  new THREE.TubeGeometry(curve, 800, 0.08, 6),
  new THREE.MeshBasicMaterial({ color: 0xffc83a, transparent: true, opacity: 0.7 }),
);
scene.add(helix);

// --- center LEGEND + aura ---
function glowTexture(stops: [number, string][]) {
  const c = Object.assign(document.createElement("canvas"), { width: 128, height: 128 });
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  for (const [o, col] of stops) grad.addColorStop(o, col);
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}
const hero$1 = Object.assign(document.createElement("canvas"), { width: 512, height: 256 });
const uc = hero$1.getContext("2d")!;
uc.font = "900 180px Impact, sans-serif";
uc.textAlign = "center";
uc.textBaseline = "middle";
uc.fillStyle = "#fff";
uc.fillText("LEGEND", 256, 135);
const hero$1 = new THREE.CanvasTexture(hero$1);
const hero = new THREE.Group();
// ponytail: stacked planes fake extrusion; TextGeometry needs a font asset not shipped with three
for (let k = 0; k < 14; k++) {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(10, 5),
    new THREE.MeshBasicMaterial({
      map: hero$1, transparent: true, side: THREE.DoubleSide, depthWrite: false,
      color: new THREE.Color().setHSL(0.1 - k * 0.006, 1, k === 13 ? 0.7 : 0.35),
    }),
  );
  m.position.z = (k - 13) * 0.06 + 0.4;
  hero.add(m);
}
scene.add(hero);
const aura = new THREE.Sprite(new THREE.SpriteMaterial({
  map: glowTexture([[0, "rgba(255,220,80,0.9)"], [0.4, "rgba(255,60,160,0.35)"], [1, "rgba(0,0,0,0)"]]),
  blending: THREE.AdditiveBlending, depthWrite: false,
}));
aura.scale.setScalar(22);
scene.add(aura);
const rings = [0xff3c8a, 0x3cc8ff, 0xffd84a].map((c, i) => {
  const r = new THREE.Mesh(new THREE.TorusGeometry(6 + i * 1.2, 0.05, 8, 96), new THREE.MeshBasicMaterial({ color: c }));
  scene.add(r);
  return r;
});

// --- day nodes (instanced) ---
const sphere = new THREE.SphereGeometry(1, 16, 12);
const nodes = new THREE.InstancedMesh(sphere, new THREE.MeshBasicMaterial(), N);
const halo = new THREE.InstancedMesh(sphere, new THREE.MeshBasicMaterial({
  transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false,
}), N);
scene.add(nodes, halo);
const pos = days.map((_, i) => new THREE.Vector3().copy(helixPosition(i, N) as THREE.Vector3));
const baseColor = days.map((d) => new THREE.Color().setHSL(0.13 - Math.min(d.events.length - 1, 6) * 0.04, 1, 0.6));
const dim = new THREE.Color(0x222233);
let matches = days.map(() => true);
function paint() {
  days.forEach((_, i) => {
    const c = matches[i] ? baseColor[i] : dim;
    nodes.setColorAt(i, c);
    halo.setColorAt(i, c);
  });
  nodes.instanceColor!.needsUpdate = halo.instanceColor!.needsUpdate = true;
}
paint();

// --- state & UI ---
let hover = -1;
let sel = -1;
let fly: { from: THREE.Vector3; to: THREE.Vector3; fromT: THREE.Vector3; toT: THREE.Vector3; t: number } | null = null;
const tooltip = $("tooltip");
const panel = $("panel");

function select(i: number) {
  sel = i;
  const p = pos[i];
  const out = new THREE.Vector3(p.x, 0, p.z).normalize().multiplyScalar(RADIUS + 12);
  fly = { from: camera.position.clone(), to: new THREE.Vector3(out.x, p.y + 4, out.z),
    fromT: controls.target.clone(), toT: p.clone(), t: reduce ? 1 : 0 };
  controls.autoRotate = false;
  burst(p);
  $("panel-date").textContent = days[i].date;
  $("panel-events").replaceChildren(...days[i].events.map((e) => Object.assign(document.createElement("li"), { textContent: e })));
  panel.hidden = false;
}
$("close").onclick = () => { panel.hidden = true; sel = -1; };

for (const g of monthGroups(days)) {
  const b = Object.assign(document.createElement("button"), { textContent: g.month.replace("-", "/") });
  b.onclick = () => select(g.startIndex);
  $("months").append(b);
}

($("search") as HTMLInputElement).oninput = (e) => {
  const q = (e.target as HTMLInputElement).value;
  matches = days.map((d) => matchDay(d, q));
  paint();
};

let timer = 0;
addEventListener("keydown", (e) => {
  if (e.target instanceof HTMLInputElement || !N) return;
  if (e.key === "ArrowRight" || e.key === "ArrowLeft") select(stepIndex(sel, e.key === "ArrowRight" ? 1 : -1, N));
  else if (e.key === " ") {
    e.preventDefault();
    if (timer) { clearInterval(timer); timer = 0; }
    else { select(stepIndex(sel, 1, N)); timer = window.setInterval(() => select(stepIndex(sel, 1, N)), 2000); }
    $("play").hidden = !timer;
  }
});

const proj = new THREE.Vector3();
// pick the on-screen node nearest the pointer (generous radius so small orbs and taps still hit)
function pick(e: PointerEvent) {
  const pts = pos.map((p) => {
    proj.copy(p).project(camera);
    return proj.z > 1 ? null : { x: (proj.x + 1) / 2 * innerWidth, y: (1 - proj.y) / 2 * innerHeight };
  });
  return nearestIndex(pts, e.clientX, e.clientY, e.pointerType === "touch" ? 32 : 20);
}
let downAt = { x: 0, y: 0 };
renderer.domElement.addEventListener("pointermove", (e) => {
  if (e.pointerType === "touch") return;
  hover = pick(e);
  renderer.domElement.style.cursor = hover >= 0 ? "pointer" : "";
  tooltip.hidden = hover < 0;
  if (hover >= 0) {
    tooltip.innerHTML = "";
    tooltip.append(Object.assign(document.createElement("b"), { textContent: days[hover].date }), days[hover].events[0] ?? "");
    tooltip.style.left = `${Math.min(e.clientX + 14, innerWidth - 290)}px`;
    tooltip.style.top = `${e.clientY + 14}px`;
  }
});
renderer.domElement.addEventListener("pointerdown", (e) => { downAt = { x: e.clientX, y: e.clientY }; });
renderer.domElement.addEventListener("pointerup", (e) => {
  if (Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) >= 6) return; // drag, not a click
  const i = pick(e);
  if (i >= 0) { tooltip.hidden = true; select(i); }
});

// --- particle bursts ---
const bursts: { pts: THREE.Points; vel: Float32Array; age: number }[] = [];
const sparkTex = glowTexture([[0, "rgba(255,255,255,1)"], [0.3, "rgba(255,200,80,0.8)"], [1, "rgba(0,0,0,0)"]]);
function burst(at: THREE.Vector3) {
  if (reduce) return;
  const n = 300;
  const p = new Float32Array(n * 3);
  const vel = new Float32Array(n * 3);
  for (let k = 0; k < n; k++) {
    p.set([at.x, at.y, at.z], k * 3);
    const v = new THREE.Vector3().randomDirection().multiplyScalar(4 + Math.random() * 10);
    vel.set([v.x, v.y, v.z], k * 3);
  }
  const pts = new THREE.Points(
    new THREE.BufferGeometry().setAttribute("position", new THREE.BufferAttribute(p, 3)),
    new THREE.PointsMaterial({ size: 0.7, map: sparkTex, color: new THREE.Color().setHSL(Math.random(), 1, 0.6),
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  scene.add(pts);
  bursts.push({ pts, vel, age: 0 });
}

// --- loop ---
const m4 = new THREE.Matrix4();
const q = new THREE.Quaternion();
const s = new THREE.Vector3();
const ease = (x: number) => 1 - (1 - x) ** 3;
const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime * speed;

  stars.rotation.y = t * 0.01;
  hero.rotation.y = t * 0.8;
  hero.position.y = Math.sin(t * 1.5) * 0.6;
  aura.material.rotation = t * 0.3;
  aura.scale.setScalar(20 + Math.sin(t * 3) * 2);
  rings.forEach((r, i) => r.rotation.set(t * (0.5 + i * 0.3), t * (0.7 - i * 0.2), 0));
  (helix.material as THREE.MeshBasicMaterial).color.setHSL(0.12 + Math.sin(t) * 0.02, 1, 0.55);

  for (let i = 0; i < N; i++) {
    const big = i === hover || i === sel ? 1.9 : 1;
    s.setScalar(nodeSize(days[i].events.length) * big * (1 + 0.15 * Math.sin(t * 3 + i * 0.7)));
    nodes.setMatrixAt(i, m4.compose(pos[i], q, s));
    halo.setMatrixAt(i, m4.compose(pos[i], q, s.multiplyScalar(1.6)));
  }
  nodes.instanceMatrix.needsUpdate = halo.instanceMatrix.needsUpdate = true;

  if (fly) {
    fly.t = Math.min(1, fly.t + dt / 1.2);
    const k = ease(fly.t);
    camera.position.lerpVectors(fly.from, fly.to, k);
    controls.target.lerpVectors(fly.fromT, fly.toT, k);
    if (fly.t === 1) fly = null;
  }

  for (let b = bursts.length - 1; b >= 0; b--) {
    const { pts, vel } = bursts[b];
    const arr = pts.geometry.attributes.position.array as Float32Array;
    for (let k = 0; k < arr.length; k++) arr[k] += vel[k] * dt;
    pts.geometry.attributes.position.needsUpdate = true;
    bursts[b].age += dt;
    (pts.material as THREE.PointsMaterial).opacity = 1 - bursts[b].age / 1.5;
    if (bursts[b].age > 1.5) {
      scene.remove(pts);
      pts.geometry.dispose();
      (pts.material as THREE.Material).dispose();
      bursts.splice(b, 1);
    }
  }

  controls.update();
  renderer.render(scene, camera);
});
