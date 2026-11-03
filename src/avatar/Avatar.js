import * as THREE from 'three';
import gsap from 'gsap';

export class Avatar {
  constructor(scene, { color = '#4f86c6' } = {}) {
    this.root = new THREE.Group();
    this.body = new THREE.Group();
    this.root.add(this.body);

    const skin = new THREE.MeshStandardMaterial({ color: '#ffd9b8', roughness: 0.7 });
    const cloth = new THREE.MeshStandardMaterial({ color, roughness: 0.6 });
    const dark = new THREE.MeshStandardMaterial({ color: '#2b2b2b' });

    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 0.6, 6, 16), cloth);
    torso.position.y = 0.95;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.42, 24, 16), skin);
    head.position.y = 1.85;
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.44, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), dark);
    hair.position.y = 1.9;
    hair.rotation.x = -0.25;

    const eyeGeo = new THREE.SphereGeometry(0.05, 8, 8);
    const eyeL = new THREE.Mesh(eyeGeo, dark);
    eyeL.position.set(-0.14, 1.88, 0.38);
    const eyeR = eyeL.clone();
    eyeR.position.x = 0.14;

    this.armL = this.#createArm(cloth, skin, -0.5);
    this.armR = this.#createArm(cloth, skin, 0.5);

    const legGeo = new THREE.CapsuleGeometry(0.13, 0.35, 4, 8);
    this.legL = new THREE.Mesh(legGeo, dark);
    this.legL.position.set(-0.18, 0.3, 0);
    this.legR = this.legL.clone();
    this.legR.position.x = 0.18;

    this.body.add(torso, head, hair, eyeL, eyeR, this.armL, this.armR, this.legL, this.legR);

    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.6, 24),
      new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.18, depthWrite: false }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.03;
    this.root.add(shadow);

    this.root.traverse((o) => {
      if (o.isMesh && o !== shadow) o.castShadow = true;
    });

    this.walking = false;
    this.busy = false;
    this.walkPhase = 0;
    this.root.position.set(0, 0, 14);
    scene.add(this.root);
  }

  #createArm(cloth, skin, x) {
    const pivot = new THREE.Group();
    pivot.position.set(x, 1.3, 0);
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.45, 4, 8), cloth);
    arm.position.y = -0.3;
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 8), skin);
    hand.position.y = -0.62;
    pivot.add(arm, hand);
    return pivot;
  }

  get position() {
    return this.root.position;
  }

  faceTo(target, duration = 0.35) {
    const dx = target.x - this.root.position.x;
    const dz = target.z - this.root.position.z;
    if (dx * dx + dz * dz < 1e-4) return;
    const goal = Math.atan2(dx, dz);
    const cur = this.root.rotation.y;
    const delta = Math.atan2(Math.sin(goal - cur), Math.cos(goal - cur));
    gsap.to(this.root.rotation, { y: cur + delta, duration, ease: 'power2.out', overwrite: 'auto' });
  }

  wave() {
    if (this.busy) return;
    this.busy = true;
    const tl = gsap.timeline({ onComplete: () => (this.busy = false) });
    tl.to(this.armR.rotation, { z: 2.7, duration: 0.3, ease: 'back.out(2)' })
      .to(this.armR.rotation, { x: 0.35, duration: 0.18, yoyo: true, repeat: 5, ease: 'sine.inOut' })
      .to(this.body.position, { y: 0.15, duration: 0.18, yoyo: true, repeat: 1, ease: 'power1.out' }, 0.3)
      .to(this.armR.rotation, { z: 0, x: 0, duration: 0.35, ease: 'power2.inOut' });
    return tl;
  }

  update(dt) {
    const target = this.walking ? 1 : 0;
    this.walkAmount = THREE.MathUtils.damp(this.walkAmount ?? 0, target, 10, dt);
    this.walkPhase += dt * 10 * this.walkAmount;
    const s = Math.sin(this.walkPhase) * this.walkAmount;

    this.legL.rotation.x = s * 0.6;
    this.legR.rotation.x = -s * 0.6;
    this.armL.rotation.x = -s * 0.5;
    if (!this.busy) this.armR.rotation.x = s * 0.5;
    if (!this.busy) this.body.position.y = Math.abs(Math.sin(this.walkPhase)) * 0.08 * this.walkAmount;
  }
}
