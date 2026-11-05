// '등교중 ㅠㅠ ..' 첫 화면. 마크업과 기본 스타일은 index.html에 있어서 스크립트가 받아지기 전부터 보임
const MIN_SHOW = 1800; // 너무 빨리 사라지면 깜빡이는 것처럼 보여서 최소한 이만큼은 보여 줌
const FADE = 900;

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export class Loader {
  constructor(el) {
    this.el = el;
    this.bar = el?.querySelector('.loader__bar i');
    this.status = el?.querySelector('.loader__status');
    this.track = el?.querySelector('.loader__bar');
  }

  set(progress, status) {
    if (!this.el) return;
    this.bar.style.width = `${Math.round(progress * 100)}%`;
    this.track.setAttribute('aria-valuenow', String(Math.round(progress * 100)));
    if (status && this.status) this.status.textContent = status;
  }

  async finish() {
    if (!this.el) return;
    this.set(1);
    await wait(Math.max(MIN_SHOW - performance.now(), 0) + 450);
    this.el.classList.add('is-done');
    await wait(FADE);
    this.el.remove();
  }
}
