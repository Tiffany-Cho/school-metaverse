import * as THREE from 'three';

const NEAR = 1.8; // 이만큼 가까이 멈추면 [앉기] 버튼이 저절로 뜸
const POP_HEIGHT = 1.35;

// 의자 앉기 흐름: 의자를 누르거나 근처에 멈춤 → [앉기] → 의자까지 걸어가 앉음 → 공간별 액션
// 앉은 채로 바닥을 누르면 일어나서 그쪽으로 걸어감 (ClickNavigator의 이동 알림으로 처리)
export class Seating {
  // hooks: { sat(seat), stood(seat), acted(id, seat) } — 급식 식판처럼 앉고 일어날 때 따라 움직일 것들
  constructor({ avatar, navigator, camera, panel, hooks = {} }) {
    this.hooks = hooks;
    this.avatar = avatar;
    this.navigator = navigator;
    this.camera = camera;
    this.panel = panel;
    this.seats = [];
    this.seated = null;
    this.candidate = null;
    this.picked = false; // 의자를 직접 눌러서 고른 경우
    this.pending = null;
    this.action = null;
    this.ownMove = false;
    this._v = new THREE.Vector3();

    navigator.onMove(() => {
      if (this.ownMove) return;
      this.pending = null;
      this.picked = false;
      this.candidate = null;
      this.release();
    });
  }

  // 공간이 바뀔 때 그 공간의 자리 목록으로 교체 (운동장은 빈 목록)
  setSeats(seats = []) {
    this.release();
    this.seats = seats;
    this.candidate = null;
    this.picked = false;
    this.pending = null;
  }

  pick(id) {
    const seat = this.seats.find((s) => s.id === id);
    if (!seat || seat === this.seated) return;
    this.candidate = seat;
    this.picked = true;
  }

  async sit() {
    const seat = this.candidate;
    if (!seat) return;
    const token = (this.pending = {});
    this.candidate = null;
    this.picked = false;

    this.ownMove = true;
    this.release();
    const walk = this.navigator.moveTo(seat.pos.clone());
    this.ownMove = false;
    await walk;

    // 걸어가는 도중 다른 곳을 눌렀으면 앉지 않음
    if (this.pending !== token || this.avatar.position.distanceTo(seat.pos) > 0.25) return;
    this.pending = null;
    this.avatar.position.copy(seat.pos);
    this.avatar.faceTo(seat.face, 0.5);
    this.avatar.sitDown(seat.drop);
    this.seated = seat;
    this.action = null;
    this.panel.openBar(seat.kind);
    this.hooks.sat?.(seat);
  }

  act(id) {
    if (!this.seated) return;
    this.action = this.action === id ? null : id;
    this.avatar.act(this.action ?? 'sit');
    this.panel.setActive(this.action);
    this.hooks.acted?.(this.action, this.seated);
  }

  release() {
    if (!this.seated) return;
    const seat = this.seated;
    this.seated = null;
    this.action = null;
    this.hooks.stood?.(seat);
    this.avatar.standUp();
    this.panel.closeBar();
  }

  // 매 프레임: [앉기] 버튼을 띄울 의자를 고르고 화면 위치를 맞춤
  update(enabled = true) {
    if (!enabled) {
      this.panel.showSit(null);
      return;
    }
    if (!this.picked) this.candidate = this.seated || this.pending || this.avatar.walking ? null : this.#nearest();
    const seat = this.candidate;
    if (!seat || seat === this.seated) {
      this.panel.showSit(null);
      return;
    }
    const p = this._v.copy(seat.pos).setY(POP_HEIGHT).project(this.camera);
    if (p.z > 1 || Math.abs(p.x) > 1.1 || Math.abs(p.y) > 1.1) {
      this.panel.showSit(null);
      return;
    }
    this.panel.showSit(((p.x + 1) / 2) * window.innerWidth, ((1 - p.y) / 2) * window.innerHeight);
  }

  #nearest() {
    let best = null;
    let bestD = NEAR;
    for (const s of this.seats) {
      const d = s.pos.distanceTo(this.avatar.position);
      if (d < bestD) [best, bestD] = [s, d];
    }
    return best;
  }
}
