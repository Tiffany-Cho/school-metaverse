import * as THREE from 'three';
import gsap from 'gsap';

const RUN_SPEED = 4.2;

// 체육관 활동: 체육관 안에 있으면 아래에 [체조하기][배드민턴][달리기] 버튼이 뜨고,
// 누르면 그 자리에서 동작(달리기는 바닥 트랙을 따라 계속 돎). 바닥을 누르거나 같은 버튼을 다시 누르면 멈춤
export class GymActivity {
  constructor({ avatar, navigator, panel, track, ui }) {
    this.avatar = avatar;
    this.navigator = navigator;
    this.panel = panel;
    this.ui = ui;
    this.active = null;
    this.open = false;
    this.ownMove = false;
    this.pathU = 0;
    this.path = trackCurve(track);
    this.length = this.path.getLength();
    this._p = new THREE.Vector3();
    this._t = new THREE.Vector3();

    // 셔틀콕: 라켓 앞에서 포물선을 그리며 오감
    this.shuttle = new THREE.Group();
    const cork = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), new THREE.MeshStandardMaterial({ color: '#f7f7f5' }));
    const skirt = new THREE.Mesh(
      new THREE.ConeGeometry(0.07, 0.12, 12, 1, true),
      new THREE.MeshStandardMaterial({ color: '#ffffff', transparent: true, opacity: 0.85, side: THREE.DoubleSide }),
    );
    skirt.position.y = 0.08;
    this.shuttle.add(cork, skirt);
    this.shuttle.visible = false;
    avatar.root.add(this.shuttle);

    // 바닥을 눌러 다른 곳으로 걸어가면 활동을 멈춤 (걷기 동작은 그대로 둠)
    navigator.onMove(() => {
      if (!this.ownMove) this.stop({ walking: true });
    });
  }

  // 매 프레임: 체육관 안이면 활동 버튼을 띄우고, 달리는 중이면 트랙을 따라 이동
  update(dt, inGym) {
    if (inGym !== this.open) {
      this.open = inGym;
      if (inGym) this.panel.openBar('gym', { mode: 'activity' });
      else {
        this.stop();
        this.panel.closeBar();
      }
    }
    if (this.active !== 'run' || !this.lapping) return;
    this.pathU = (this.pathU + (RUN_SPEED * dt) / this.length) % 1;
    this.path.getPointAt(this.pathU, this._p);
    this.path.getTangentAt(this.pathU, this._t);
    this.avatar.position.set(this._p.x, 0, this._p.z);
    this.avatar.root.rotation.y = Math.atan2(this._t.x, this._t.z);
  }

  toggle(id) {
    if (this.active === id) this.stop();
    else this.start(id);
  }

  async start(id) {
    this.stop();
    this.active = id;
    this.panel.setActive(id);
    this.avatar.act(id);
    if (id === 'badminton') this.#rally();
    if (id === 'run') {
      // 가장 가까운 트랙 지점까지 걸어간 뒤 돌기 시작
      this.pathU = this.#nearestU();
      this.ownMove = true;
      const walk = this.navigator.moveTo(this.path.getPointAt(this.pathU).setY(0));
      this.ownMove = false;
      await walk;
      if (this.active !== 'run') return;
      this.avatar.act('run');
      this.avatar.running = true;
      this.avatar.walking = true;
      this.lapping = true;
    }
    this.ui.toast({ icon: { stretch: '🤸', badminton: '🏸', run: '🏃' }[id], text: TOASTS[id], mine: true, hold: 1.8 });
  }

  stop({ walking = false } = {}) {
    if (!this.active) return;
    this.active = null;
    this.lapping = false;
    this.avatar.running = false;
    if (!walking) this.avatar.walking = false;
    this.avatar.act('stand');
    this.panel.setActive(null);
    gsap.killTweensOf(this.shuttle.position);
    this.shuttle.visible = false;
  }

  #rally() {
    const s = this.shuttle;
    s.visible = true;
    s.position.set(0.25, 2.4, 0.5);
    gsap.timeline({ repeat: -1 })
      .to(s.position, { z: 5, duration: 0.9, ease: 'none' })
      .to(s.position, { y: 3.6, duration: 0.45, ease: 'power1.out' }, 0)
      .to(s.position, { y: 1.6, duration: 0.45, ease: 'power1.in' }, 0.45)
      .to(s.position, { z: 0.5, duration: 0.9, ease: 'none' })
      .to(s.position, { y: 3.4, duration: 0.45, ease: 'power1.out' }, 0.9)
      .to(s.position, { y: 2.4, duration: 0.45, ease: 'power1.in' }, 1.35);
  }

  #nearestU() {
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < 100; i++) {
      const d = this.path.getPointAt(i / 100, this._p).distanceToSquared(this.avatar.position.clone().setY(0));
      if (d < bestD) [best, bestD] = [i / 100, d];
    }
    return best;
  }
}

const TOASTS = {
  stretch: '하나 둘, 셋 넷! 가볍게 몸을 풀어요',
  badminton: '배드민턴 랠리 시작!',
  run: '트랙을 따라 가볍게 달려요',
};

// 둥근 사각형 트랙을 따라가는 닫힌 곡선
function trackCurve({ cx, cz, w, d, r }) {
  const shape = new THREE.Shape();
  const x0 = -w / 2;
  const z0 = -d / 2;
  shape.moveTo(x0 + r, z0);
  shape.lineTo(-x0 - r, z0);
  shape.quadraticCurveTo(-x0, z0, -x0, z0 + r);
  shape.lineTo(-x0, -z0 - r);
  shape.quadraticCurveTo(-x0, -z0, -x0 - r, -z0);
  shape.lineTo(x0 + r, -z0);
  shape.quadraticCurveTo(x0, -z0, x0, -z0 - r);
  shape.lineTo(x0, z0 + r);
  shape.quadraticCurveTo(x0, z0, x0 + r, z0);
  const points = shape.getSpacedPoints(120).slice(0, -1).map((p) => new THREE.Vector3(cx + p.x, 0, cz + p.y));
  return new THREE.CatmullRomCurve3(points, true);
}
