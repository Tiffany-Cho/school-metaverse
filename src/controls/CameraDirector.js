import * as THREE from 'three';
import gsap from 'gsap';

const FOLLOW_OFFSET = new THREE.Vector3(0, 10, 17);
const FOLLOW_HEIGHT = 1.2;

export class CameraDirector {
  constructor({ camera, controls, avatar }) {
    this.camera = camera;
    this.controls = controls;
    this.avatar = avatar;
    this.mode = 'follow';
    this.timeline = null;
    this._delta = new THREE.Vector3();
    this._focus = new THREE.Vector3();

    controls.target.copy(avatar.position).setY(FOLLOW_HEIGHT);
    camera.position.copy(controls.target).add(FOLLOW_OFFSET);
  }

  update(dt) {
    if (this.mode !== 'follow') return;
    this._focus.copy(this.avatar.position).setY(FOLLOW_HEIGHT);
    this._delta.subVectors(this._focus, this.controls.target).multiplyScalar(1 - Math.exp(-6 * dt));
    this.controls.target.add(this._delta);
    this.camera.position.add(this._delta);
  }

  #tweenTo(tl, { camera, target }, duration, at) {
    tl.to(this.camera.position, { x: camera.x, y: camera.y, z: camera.z, duration, ease: 'power2.inOut' }, at);
    tl.to(this.controls.target, { x: target.x, y: target.y, z: target.z, duration, ease: 'power2.inOut' }, '<');
  }

  #begin(mode) {
    this.timeline?.kill();
    this.mode = mode;
    this.controls.enabled = false;
    this.timeline = gsap.timeline();
    return this.timeline;
  }

  focus(shot, duration = 1.6) {
    const tl = this.#begin('focus');
    this.#tweenTo(tl, shot, duration);
    tl.add(() => (this.controls.enabled = true));
    return tl;
  }

  tour(shots, { hold = 0.6, duration = 2.2, onDone } = {}) {
    const tl = this.#begin('tour');
    shots.forEach((shot, i) => this.#tweenTo(tl, shot, i === 0 ? 1.6 : duration, i === 0 ? undefined : `+=${hold}`));
    tl.add(() => {
      this.controls.enabled = true;
      onDone?.();
    });
    return tl;
  }

  follow(duration = 1.4) {
    const tl = this.#begin('return');
    const target = this.avatar.position.clone().setY(FOLLOW_HEIGHT);
    this.#tweenTo(tl, { camera: target.clone().add(FOLLOW_OFFSET), target }, duration);
    tl.add(() => {
      this.mode = 'follow';
      this.controls.enabled = true;
    });
    return tl;
  }

  get isFollowing() {
    return this.mode === 'follow';
  }
}
