import { COURSES } from '../world/Meal.js';

const EAT_TIME = 6000; // [급식 먹는 중]을 이만큼 하면 다 먹음

// 급식: 배식대에서 하나씩 받아 식판을 채우고 → 자리에 앉으면 식탁에 내려놓고 → 먹으면 빈 식판으로 반납
export class Lunch {
  constructor({ avatar, navigator, stations, ui, onFinished }) {
    this.avatar = avatar;
    this.navigator = navigator;
    this.stations = stations;
    this.ui = ui;
    this.onFinished = onFinished;
    this.items = null; // 들고 있는 식판의 음식 (null = 식판 없음)
    this.table = null; // 식판을 내려놓은 자리
    this.pending = null;
    this.eatTimer = null;
  }

  get done() {
    return this.items?.length === COURSES.length;
  }

  // 배식대 한 칸을 누르면 그 앞으로 걸어가 받음
  async serve(id) {
    const station = this.stations.find((s) => s.id === id);
    if (!station) return;
    if (this.items?.includes(id)) {
      this.ui.toast({ icon: station.icon, text: `${station.dish}은(는) 이미 받았어요` });
      return;
    }
    const token = (this.pending = {});
    await this.navigator.moveTo(station.stand.clone());
    if (this.pending !== token || this.avatar.position.distanceTo(station.stand) > 0.3) return;
    this.pending = null;
    this.avatar.faceTo(station.face, 0.4);

    const items = [...(this.items ?? []), id];
    this.items = COURSES.map((c) => c.id).filter((c) => items.includes(c));
    this.avatar.setTray(this.items);
    this.#render();
    if (this.done) this.ui.toast({ icon: '🍱', text: '식판 완성! 빈자리에 앉아 맛있게 먹어요', mine: true, hold: 3.4 });
    else this.ui.toast({ icon: station.icon, text: `${station.label} · ${station.dish}을(를) 받았어요`, mine: true, hold: 1.8 });
  }

  // 급식실 자리에 앉으면 들고 있던 식판을 식탁에 내려놓음
  sat(seat) {
    if (seat.kind !== 'cafeteria' || !this.items || !seat.tray) return;
    seat.tray.set(this.items);
    this.table = seat;
    this.avatar.setTray(null);
  }

  // 다 먹기 전에 일어나면 식판을 다시 들고 감
  stood() {
    this.#stopEating();
    if (!this.table) return;
    const seat = this.table;
    this.table = null;
    this.avatar.setTray(this.items);
    seat.tray.set([]);
  }

  action(id) {
    this.#stopEating();
    if (id !== 'eat' || !this.table) return;
    this.eatTimer = setTimeout(() => this.#finish(), EAT_TIME);
  }

  #finish() {
    this.eatTimer = null;
    if (!this.table) return;
    this.table.tray.set([]);
    this.table = null;
    this.items = null;
    this.#render();
    this.ui.toast({ icon: '🍽️', text: '잘 먹었습니다! 식판을 반납했어요', mine: true, hold: 3 });
    this.onFinished?.();
  }

  #stopEating() {
    clearTimeout(this.eatTimer);
    this.eatTimer = null;
  }

  // 건물을 나가면 식판은 두고 감
  reset() {
    this.#stopEating();
    this.table?.tray.set([]);
    this.table = null;
    this.items = null;
    this.pending = null;
    this.avatar.setTray(null);
    this.#render();
  }

  #render() {
    this.ui.setTray(this.items, COURSES);
  }
}
