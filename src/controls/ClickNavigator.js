import * as THREE from 'three';
import gsap from 'gsap';
import { findAction } from '../world/parts.js';

// 산책하듯 차분한 보행 속도 (m/s)
const SPEED = 3;
// 이만큼 이상 끌면 화면 돌리기로 보고 이동하지 않음. 손가락은 마우스보다 흔들리므로 더 넉넉하게
const DRAG_THRESHOLD = { mouse: 6, touch: 14, pen: 10 };

// 현재 공간(운동장 / 건물 내부)의 바닥을 클릭하면 아바타가 걸어가고,
// 문·표지판처럼 action이 달린 물체를 클릭하면 onInteract로 알림
export class ClickNavigator {
  constructor({ camera, dom, avatar }) {
    this.camera = camera;
    this.avatar = avatar;
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.enabled = true;
    this.tween = null;
    this.world = null;
    this.listeners = new Set();
    this.interactListeners = new Set();

    this.marker = this.#createMarker();

    let down = null;
    dom.addEventListener('pointerdown', (e) => (down = { x: e.clientX, y: e.clientY }));
    dom.addEventListener('pointerup', (e) => {
      if (!down || !this.enabled || !this.world) return;
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
      down = null;
      if (moved > (DRAG_THRESHOLD[e.pointerType] ?? 6)) return;
      const hit = this.#pick(e, dom);
      if (hit?.action) this.interactListeners.forEach((fn) => fn(hit.action));
      else if (hit) this.moveTo(hit.point);
    });
  }

  // world: { scene, ground, pickables, zones: [{ id, x: [min, max], z: [min, max] }],
  //          links?: [{ a, b, axis: 'x' | 'z', at, span: [min, max] }] }  ← 구역 a·b를 잇는 개구부
  setWorld(world) {
    this.stop();
    this.world = world;
    world.scene.add(this.marker);
    gsap.killTweensOf([this.marker.scale, this.marker.material]);
    this.marker.material.opacity = 0;
  }

  onMove(fn) {
    this.listeners.add(fn);
  }

  onInteract(fn) {
    this.interactListeners.add(fn);
  }

  stop() {
    this.tween?.kill();
    this.tween = null;
    this.avatar.walking = false;
  }

  #pick(e, dom) {
    const rect = dom.getBoundingClientRect();
    this.pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    for (const h of this.raycaster.intersectObjects(this.world.pickables, true)) {
      if (h.object.userData.noPick) continue;
      const action = findAction(h.object);
      if (action) return { action };
      break;
    }
    const [hit] = this.raycaster.intersectObject(this.world.ground, false);
    return hit ? { point: hit.point.clone() } : null;
  }

  #zoneOf(p) {
    let best = null;
    let bestD = Infinity;
    for (const zone of this.world.zones) {
      const dx = Math.max(zone.x[0] - p.x, 0, p.x - zone.x[1]);
      const dz = Math.max(zone.z[0] - p.z, 0, p.z - zone.z[1]);
      const d = dx * dx + dz * dz;
      if (d < bestD) [best, bestD] = [zone, d];
    }
    return best;
  }

  clamp(p) {
    // 벽이나 건물을 클릭해도 가장 가까운 걸을 수 있는 자리까지만 감
    const zone = this.#zoneOf(p);
    p.set(THREE.MathUtils.clamp(p.x, zone.x[0], zone.x[1]), 0, THREE.MathUtils.clamp(p.z, zone.z[0], zone.z[1]));
    return zone;
  }

  moveTo(point) {
    const dest = point.clone();
    const toZone = this.clamp(dest);
    const pos = this.avatar.position;
    const fromZone = this.#zoneOf(pos);

    const path = fromZone === toZone ? [] : this.#through(fromZone, toZone, pos, dest);
    path.push(dest);
    if (path.length === 1 && pos.distanceTo(dest) < 0.05) return Promise.resolve();

    this.stop();
    this.avatar.walking = true;
    this.#showMarker(dest);
    this.listeners.forEach((fn) => fn(dest));

    return new Promise((resolve) => {
      const tl = gsap.timeline({
        onComplete: () => {
          this.avatar.walking = false;
          gsap.to(this.marker.material, { opacity: 0, duration: 0.3, onComplete: () => gsap.killTweensOf(this.marker.scale) });
          resolve();
        },
        onInterrupt: resolve,
      });
      let prev = pos.clone();
      for (const p of path) {
        const d = prev.distanceTo(p);
        if (d < 0.01) continue;
        tl.to(pos, {
          x: p.x,
          z: p.z,
          duration: Math.max(d / SPEED, 0.35),
          ease: path.length === 1 ? 'sine.inOut' : 'none',
          onStart: () => this.avatar.faceTo(p, 0.45),
        });
        prev = p;
      }
      this.tween = tl;
    });
  }

  // 구역 사이를 최소 개구부 수로 잇는 경로를 찾아, 각 개구부를 지나는 두 지점(앞·뒤)을 돌려줌.
  // 개구부 폭 안에서는 출발점과 목적지 사이 직선에 가까운 자리를 골라 자연스럽게 가로지름
  #through(from, to, pos, dest) {
    const links = this.world.links ?? [];
    const prev = new Map([[from.id, null]]);
    const queue = [from.id];
    while (queue.length && !prev.has(to.id)) {
      const id = queue.shift();
      for (const l of links) {
        const next = l.a === id ? l.b : l.b === id ? l.a : null;
        if (next && !prev.has(next)) {
          prev.set(next, { id, link: l });
          queue.push(next);
        }
      }
    }
    if (!prev.has(to.id)) return [];

    const hops = [];
    for (let id = to.id; prev.get(id); id = prev.get(id).id) hops.unshift({ ...prev.get(id), to: id });

    const points = [];
    let cur = pos.clone();
    for (const { id, link } of hops) {
      const zone = this.world.zones.find((z) => z.id === id);
      const across = link.axis;
      const along = across === 'x' ? 'z' : 'x';
      const side = Math.sign((zone[across][0] + zone[across][1]) / 2 - link.at);
      const t = THREE.MathUtils.clamp((cur[along] + dest[along]) / 2, link.span[0], link.span[1]);
      const before = new THREE.Vector3();
      before[along] = t;
      before[across] = link.at + side * 0.8;
      const after = before.clone();
      after[across] = link.at - side * 0.8;
      points.push(before, after);
      cur = after;
    }
    return points;
  }

  #createMarker() {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.35, 0.5, 32),
      new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false }),
    );
    ring.rotation.x = -Math.PI / 2;
    return ring;
  }

  #showMarker(p) {
    this.marker.position.set(p.x, 0.05, p.z);
    gsap.killTweensOf([this.marker.scale, this.marker.material]);
    this.marker.scale.setScalar(0.4);
    this.marker.material.opacity = 0.9;
    gsap.to(this.marker.scale, { x: 1.4, y: 1.4, z: 1.4, duration: 0.8, repeat: -1, ease: 'power1.out' });
  }
}
