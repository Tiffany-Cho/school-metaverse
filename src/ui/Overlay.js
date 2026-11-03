import gsap from 'gsap';

const ACTIONS = [
  { id: 'wave', label: '인사하기', icon: '👋' },
  { id: 'blackboard', label: '칠판 보기', icon: '📋' },
  { id: 'tour', label: '교실 둘러보기', icon: '🏫' },
  { id: 'home', label: '내 시점', icon: '🧭' },
];

export class Overlay {
  constructor(root, handlers) {
    root.innerHTML = `
      <header class="brand">
        <p class="brand__eyebrow">ONLINE CAMPUS</p>
        <h1 class="brand__title">우리 학교</h1>
        <p class="brand__desc">바닥을 클릭해 운동장을 거닐어 보세요</p>
      </header>
      <p class="caption" aria-live="polite"></p>
      <nav class="dock">
        ${ACTIONS.map((a) => `<button class="dock__btn" data-action="${a.id}"><span>${a.icon}</span>${a.label}</button>`).join('')}
      </nav>
    `;
    this.caption = root.querySelector('.caption');
    this.buttons = [...root.querySelectorAll('.dock__btn')];
    this.buttons.forEach((btn) =>
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        handlers[btn.dataset.action]?.();
      }),
    );

    gsap.from(root.querySelector('.brand'), { y: -20, opacity: 0, duration: 1, ease: 'power2.out', delay: 0.3 });
    gsap.from(this.buttons, { y: 30, opacity: 0, duration: 0.6, stagger: 0.08, ease: 'back.out(1.6)', delay: 0.5, clearProps: 'transform' });
  }

  setActive(id) {
    this.buttons.forEach((b) => b.classList.toggle('is-active', b.dataset.action === id));
  }

  setLocked(locked) {
    this.buttons.forEach((b) => (b.disabled = locked && b.dataset.action !== 'home'));
  }

  say(text, hold = 2.4) {
    gsap.killTweensOf(this.caption);
    this.caption.textContent = text;
    gsap.timeline()
      .fromTo(this.caption, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out' })
      .to(this.caption, { opacity: 0, y: -6, duration: 0.5, delay: hold });
  }
}
