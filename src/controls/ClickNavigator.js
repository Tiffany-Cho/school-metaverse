import * as THREE from 'three';
import gsap from 'gsap';
import { WALK_LIMIT } from '../world/Environment.js';

const SPEED = 6;
const MIN_Z = -25;
const DRAG_THRESHOLD = 6;

export class ClickNavigator {
  constructor({ camera, dom, ground, avatar, scene }) {
    this.camera = camera;
    this.ground = ground;
    this.avatar = avatar;
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.enabled = true;
    this.tween = null;
    this.listeners = new Set();

    this.marker = this.#createMarker();
    scene.add(this.marker);

    let down = null;
    dom.addEventListener('pointerdown', (e) => (down = { x: e.clientX, y: e.clientY }));
    dom.addEventListener('pointerup', (e) => {
      if (!down || !this.enabled) return;
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
      down = null;
      if (moved > DRAG_THRESHOLD) return;
      const hit = this.#pick(e, dom);
      if (hit) this.moveTo(hit);
    });
  }

  onMove(fn) {
    this.listeners.add(fn);
  }

  #pick(e, dom) {
    const rect = dom.getBoundingClientRect();
    this.pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const [hit] = this.raycaster.intersectObject(this.ground, false);
    return hit ? hit.point.clone() : null;
  }

  clamp(p) {
    p.y = 0;
    const r = Math.hypot(p.x, p.z);
    if (r > WALK_LIMIT) p.multiplyScalar(WALK_LIMIT / r);
    p.z = Math.max(p.z, MIN_Z);
    return p;
  }

  moveTo(point) {
    const dest = this.clamp(point.clone());
    const pos = this.avatar.position;
    const dist = pos.distanceTo(dest);
    if (dist < 0.05) return Promise.resolve();

    this.tween?.kill();
    this.avatar.faceTo(dest);
    this.avatar.walking = true;
    this.#showMarker(dest);
    this.listeners.forEach((fn) => fn(dest));

    return new Promise((resolve) => {
      this.tween = gsap.to(pos, {
        x: dest.x,
        z: dest.z,
        duration: Math.max(dist / SPEED, 0.25),
        ease: 'power1.inOut',
        onComplete: () => {
          this.avatar.walking = false;
          gsap.to(this.marker.material, { opacity: 0, duration: 0.3, onComplete: () => gsap.killTweensOf(this.marker.scale) });
          resolve();
        },
        onInterrupt: resolve,
      });
    });
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
