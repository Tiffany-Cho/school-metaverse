import gsap from 'gsap';
import { PARTS, PRESETS, SLOT_LABELS, normalizeOutfit, matchPreset, presetSwatches } from '../avatar/Wardrobe.js';

const ROW_SLOTS = ['hair', 'glasses'];

// 교복 선택 팝업: 프리셋 카드 + 파츠별 화살표 조합. 바뀔 때마다 onChange로 아바타에 바로 입힘
export class WardrobePanel {
  constructor(root, { onChange, onConfirm }) {
    this.onChange = onChange;
    this.onConfirm = onConfirm;
    this.outfit = normalizeOutfit();
    this.start = 'outside';
    this.isOpen = false;

    const el = (this.el = document.createElement('aside'));
    el.className = 'wardrobe';
    el.hidden = true;
    el.setAttribute('aria-label', '교복 선택');
    el.innerHTML = `
      <header class="wardrobe__head">
        <p class="wardrobe__eyebrow">AVATAR CUSTOMIZER</p>
        <h2 class="wardrobe__title">교복 선택</h2>
        <p class="wardrobe__sub">교복을 고르면 아바타가 바로 갈아입어요. 화면을 끌면 뒷모습도 볼 수 있어요.</p>
      </header>
      <div class="wardrobe__nav">
        <button class="wardrobe__step" data-step="-1" aria-label="이전 교복">‹</button>
        <span class="wardrobe__count"></span>
        <button class="wardrobe__step" data-step="1" aria-label="다음 교복">›</button>
      </div>
      <div class="wardrobe__presets">
        ${PRESETS.map(
          (p) => `
          <button class="preset" data-id="${p.id}">
            <span class="preset__swatches"></span>
            <strong>${p.name}</strong>
            <small>${p.desc}</small>
          </button>`,
        ).join('')}
      </div>
      <div class="wardrobe__accent">
        <span class="wardrobe__label">포인트 색상 <small>넥타이 · 체육복 라인</small></span>
        <div class="accents">
          ${Object.entries(PARTS.accent)
            .map(([id, a]) => `<button class="accent" data-accent="${id}" style="--c:${a.color}"><i></i>${a.label}</button>`)
            .join('')}
        </div>
      </div>
      <h3 class="wardrobe__label">헤어 · 안경</h3>
      <div class="wardrobe__rows">
        ${ROW_SLOTS.map(
          (slot) => `
          <div class="wrow" data-slot="${slot}">
            <span class="wrow__label">${SLOT_LABELS[slot]}</span>
            <button class="wrow__arrow" data-dir="-1" aria-label="${SLOT_LABELS[slot]} 이전">‹</button>
            <output class="wrow__value"></output>
            <button class="wrow__arrow" data-dir="1" aria-label="${SLOT_LABELS[slot]} 다음">›</button>
          </div>`,
        ).join('')}
      </div>
      <div class="wardrobe__start">
        <span class="wardrobe__label">시작 위치</span>
        <div class="seg">
          <button data-start="outside">운동장</button>
          <button data-start="corridor">메인 복도</button>
        </div>
      </div>
      <button class="wardrobe__go"></button>
    `;
    root.append(el);

    this.cards = [...el.querySelectorAll('.preset')];
    this.rows = Object.fromEntries([...el.querySelectorAll('.wrow')].map((r) => [r.dataset.slot, r]));
    this.count = el.querySelector('.wardrobe__count');
    this.startBox = el.querySelector('.wardrobe__start');
    this.startButtons = [...el.querySelectorAll('[data-start]')];
    this.goButton = el.querySelector('.wardrobe__go');
    this.accents = [...el.querySelectorAll('.accent')];

    el.addEventListener('click', (e) => {
      const card = e.target.closest('.preset');
      const arrow = e.target.closest('.wrow__arrow');
      const step = e.target.closest('.wardrobe__step');
      const start = e.target.closest('[data-start]');
      const accent = e.target.closest('.accent');
      if (card) this.#applyPreset(PRESETS.find((p) => p.id === card.dataset.id));
      else if (accent) this.#set({ ...this.outfit, accent: accent.dataset.accent });
      else if (arrow) this.#cycle(arrow.closest('.wrow').dataset.slot, Number(arrow.dataset.dir));
      else if (step) this.#stepPreset(Number(step.dataset.step));
      else if (start) {
        this.start = start.dataset.start;
        this.#render();
      } else if (e.target.closest('.wardrobe__go')) this.#confirm();
    });
  }

  open(outfit, { first = false } = {}) {
    this.outfit = normalizeOutfit(outfit);
    this.first = first;
    this.isOpen = true;
    this.el.hidden = false;
    this.#render();
    gsap.fromTo(this.el, { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out' });
  }

  close() {
    this.isOpen = false;
    return gsap.to(this.el, { opacity: 0, y: 24, duration: 0.35, ease: 'power2.in', onComplete: () => (this.el.hidden = true) }).then();
  }

  #set(outfit) {
    this.outfit = normalizeOutfit(outfit);
    this.#render();
    this.onChange(this.outfit);
  }

  #applyPreset(preset) {
    this.#set({ ...this.outfit, ...preset.outfit });
  }

  #stepPreset(dir) {
    const cur = PRESETS.findIndex((p) => p.id === matchPreset(this.outfit));
    const next = cur < 0 ? (dir > 0 ? 0 : PRESETS.length - 1) : (cur + dir + PRESETS.length) % PRESETS.length;
    this.#applyPreset(PRESETS[next]);
    this.cards[next].scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
  }

  #cycle(slot, dir) {
    const keys = Object.keys(PARTS[slot]);
    const i = keys.indexOf(this.outfit[slot]);
    this.#set({ ...this.outfit, [slot]: keys[(i + dir + keys.length) % keys.length] });
  }

  #confirm() {
    if (!this.isOpen) return;
    this.onConfirm({ outfit: this.outfit, start: this.first ? this.start : null });
  }

  #render() {
    const presetId = matchPreset(this.outfit);
    const index = PRESETS.findIndex((p) => p.id === presetId);
    this.cards.forEach((c, i) => {
      c.classList.toggle('is-active', c.dataset.id === presetId);
      c.querySelector('.preset__swatches').innerHTML = presetSwatches(PRESETS[i].outfit, this.outfit.accent)
        .map((color) => `<i style="background:${color}"></i>`)
        .join('');
    });
    this.accents.forEach((b) => b.classList.toggle('is-on', b.dataset.accent === this.outfit.accent));
    this.count.textContent = index < 0 ? '직접 조합' : `${index + 1} / ${PRESETS.length} · ${PRESETS[index].name}`;

    const tieLocked = !PARTS.inner[this.outfit.inner].tie;
    for (const [slot, row] of Object.entries(this.rows)) {
      row.querySelector('.wrow__value').textContent = PARTS[slot][this.outfit[slot]].label;
      const locked = slot === 'neck' && tieLocked;
      row.classList.toggle('is-locked', locked);
      row.querySelectorAll('button').forEach((b) => (b.disabled = locked));
    }

    this.startBox.hidden = !this.first;
    this.startButtons.forEach((b) => b.classList.toggle('is-on', b.dataset.start === this.start));
    this.goButton.textContent = this.first ? '이 교복으로 시작하기' : '이 교복으로 갈아입기';
  }
}
