import gsap from 'gsap';

const QUICK = [
  { id: 'overview', label: '운동장 전체보기', icon: '🏟️' },
  { id: 'corridor', label: '메인 복도', icon: '🚶' },
  { id: 'classroom', label: '교실', icon: '📚' },
  { id: 'office', label: '교무실', icon: '🗂️' },
  { id: 'cafeteria', label: '급식실', icon: '🍱' },
  { id: 'auditorium', label: '강당', icon: '🎤' },
];

const ACTIONS = [
  { id: 'wave', label: '인사하기', icon: '👋' },
  { id: 'wardrobe', label: '교복 갈아입기', icon: '👕' },
  { id: 'gate', label: '정문 보기', icon: '🚪' },
  { id: 'tour', label: '학교 둘러보기', icon: '🏫' },
  { id: 'home', label: '내 시점', icon: '🧭' },
];

const button = (a, cls) => `<button class="${cls}" data-action="${a.id}"><span>${a.icon}</span>${a.label}</button>`;

export class Overlay {
  constructor(root, handlers) {
    this.root = root;
    root.innerHTML = `
      <div class="fade"></div>
      <header class="brand">
        <p class="brand__eyebrow">ONLINE CAMPUS</p>
        <h1 class="brand__title">영파여자고등학교</h1>
        <p class="brand__desc"></p>
      </header>
      <nav class="quick" aria-label="학교 퀵버튼">
        <p class="quick__title">QUICK MOVE</p>
        ${QUICK.map((a) => button(a, 'quick__btn')).join('')}
      </nav>
      <p class="caption" aria-live="polite"></p>
      <nav class="dock">
        ${ACTIONS.map((a) => button(a, 'dock__btn')).join('')}
      </nav>
    `;
    this.fadeEl = root.querySelector('.fade');
    this.desc = root.querySelector('.brand__desc');
    this.caption = root.querySelector('.caption');
    this.buttons = [...root.querySelectorAll('[data-action]')];
    this.buttons.forEach((btn) =>
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        handlers[btn.dataset.action]?.();
      }),
    );

    gsap.from(root.querySelector('.brand'), { y: -20, opacity: 0, duration: 1, ease: 'power2.out', delay: 0.3 });
    gsap.from(root.querySelectorAll('.quick__btn'), { x: 20, opacity: 0, duration: 0.5, stagger: 0.05, ease: 'power2.out', delay: 0.4, clearProps: 'transform' });
    gsap.from(root.querySelectorAll('.dock__btn'), { y: 30, opacity: 0, duration: 0.6, stagger: 0.08, ease: 'back.out(1.6)', delay: 0.5, clearProps: 'transform' });
  }

  setActive(id) {
    this.buttons.forEach((b) => b.classList.toggle('is-active', b.dataset.action === id));
  }

  setLocked(locked, keep = ['home']) {
    this.buttons.forEach((b) => (b.disabled = locked && !keep.includes(b.dataset.action)));
  }

  setDressing(on) {
    this.root.classList.toggle('is-dressing', on);
  }

  setPlace(text) {
    this.desc.textContent = text;
  }

  // 장면 전환용 화면 가림막
  fade(to, duration = 0.45) {
    return gsap.to(this.fadeEl, { opacity: to, duration, ease: 'power1.inOut' }).then();
  }

  say(text, hold = 2.4) {
    gsap.killTweensOf(this.caption);
    this.caption.textContent = text;
    gsap.timeline()
      .fromTo(this.caption, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out' })
      .to(this.caption, { opacity: 0, y: -6, duration: 0.5, delay: hold });
  }
}
