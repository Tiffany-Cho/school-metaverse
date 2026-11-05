import gsap from 'gsap';

const QUICK = [
  { id: 'overview', label: '운동장 전체보기', icon: '🏟️' },
  { id: 'corridor', label: '메인 복도', icon: '🚶' },
  { id: 'classroom', label: '교실', icon: '📚' },
  { id: 'office', label: '교무실', icon: '🗂️' },
  { id: 'cafeteria', label: '급식실', icon: '🍱' },
  { id: 'gym', label: '체육관', icon: '🏸' },
];

const ACTIONS = [
  { id: 'wave', label: '인사하기', icon: '👋' },
  { id: 'wardrobe', label: '교복 갈아입기', icon: '👕' },
];

const button = (a, cls) => `<button class="${cls}" data-action="${a.id}"><span aria-hidden="true">${a.icon}</span>${a.label}</button>`;

export class Overlay {
  constructor(root, handlers) {
    this.root = root;
    // 장소 이동 메뉴는 평소엔 접힌 버튼 하나, 누르면 아래로 펼쳐짐
    root.innerHTML = `
      <div class="fade"></div>
      <h1 class="sr-only">영파여자고등학교 온라인 캠퍼스</h1>
      <nav class="quick" aria-label="장소 이동">
        <button class="quick__toggle" aria-expanded="false" aria-controls="quick-menu">
          <span class="quick__icon" aria-hidden="true">🗺️</span><span class="quick__label">장소 이동</span>
        </button>
        <div class="quick__menu" id="quick-menu">
          ${QUICK.map((a) => button(a, 'quick__btn')).join('')}
        </div>
      </nav>
      <p class="caption" aria-live="polite"></p>
      <div class="toasts" aria-live="polite"></div>
      <div class="traychip" hidden aria-label="내 식판"></div>
      <nav class="dock">
        ${ACTIONS.map((a) => button(a, 'dock__btn')).join('')}
      </nav>
    `;
    this.fadeEl = root.querySelector('.fade');
    this.caption = root.querySelector('.caption');
    this.toasts = root.querySelector('.toasts');
    this.trayChip = root.querySelector('.traychip');
    this.quick = root.querySelector('.quick');
    this.toggle = root.querySelector('.quick__toggle');
    this.buttons = [...root.querySelectorAll('[data-action]')];
    this.buttons.forEach((btn) =>
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (btn.classList.contains('quick__btn')) this.setMenu(false);
        handlers[btn.dataset.action]?.();
      }),
    );
    this.toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      this.setMenu(!this.menuOpen);
    });
    // 메뉴 밖(3D 화면 등)을 누르면 접힘
    document.addEventListener('pointerdown', (e) => {
      if (this.menuOpen && !this.quick.contains(e.target)) this.setMenu(false);
    });
    this.menuOpen = false;
  }

  // 로딩 화면이 걷힌 뒤 UI가 차례로 나타남
  intro() {
    const root = this.root;
    gsap.from(this.toggle, { x: 20, opacity: 0, duration: 0.6, ease: 'power2.out', clearProps: 'all' });
    gsap.from(root.querySelectorAll('.dock__btn'), { y: 30, opacity: 0, duration: 0.6, stagger: 0.08, ease: 'back.out(1.6)', delay: 0.25, clearProps: 'all' });
  }

  setMenu(open) {
    this.menuOpen = open;
    this.quick.classList.toggle('is-open', open);
    this.toggle.setAttribute('aria-expanded', String(open));
  }

  setActive(id) {
    this.buttons.forEach((b) => b.classList.toggle('is-active', b.dataset.action === id));
  }

  setLocked(locked, keep = []) {
    this.buttons.forEach((b) => (b.disabled = locked && !keep.includes(b.dataset.action)));
  }

  setDressing(on) {
    this.root.classList.toggle('is-dressing', on);
    if (on) this.setMenu(false);
  }

  // 왼쪽 위 '내 식판': 받은 반찬은 진하게, 아직 안 받은 칸은 흐리게. items가 null이면 숨김
  setTray(items, courses) {
    this.trayChip.hidden = !items;
    if (!items) return;
    this.trayChip.innerHTML = `
      <span class="traychip__title">🍱 내 식판 <b>${items.length}/${courses.length}</b></span>
      <span class="traychip__slots">
        ${courses.map((c) => `<i class="${items.includes(c.id) ? 'is-on' : ''}" title="${c.label}">${c.icon}</i>`).join('')}
      </span>`;
  }

  // 아래쪽에 잠깐 떴다 사라지는 알림. 여러 개가 오면 위로 쌓이고 오래된 것부터 밀려남
  toast({ icon = '', text, mine = false, hold = 2.8 }) {
    const el = document.createElement('div');
    el.className = `toast${mine ? ' toast--mine' : ''}`;
    el.innerHTML = `<span class="toast__icon" aria-hidden="true">${icon}</span><span class="toast__text"></span>`;
    el.querySelector('.toast__text').textContent = text;
    this.toasts.prepend(el);
    while (this.toasts.children.length > 3) this.toasts.lastElementChild.remove();
    gsap.timeline({ onComplete: () => el.remove() })
      .fromTo(el, { opacity: 0, y: 16, scale: 0.94 }, { opacity: 1, y: 0, scale: 1, duration: 0.45, ease: 'back.out(1.8)' })
      .to(el, { opacity: 0, y: -8, duration: 0.5, ease: 'power1.in', delay: hold });
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
