// 앉기 관련 터치 UI
//  - 의자 위에 뜨는 [앉기] 말풍선 버튼 (3D 위치를 따라 움직임)
//  - 앉아 있는 동안 화면 아래에 뜨는 공간별 액션 버튼 + [일어나기]
export const SEAT_ACTIONS = {
  classroom: [
    { id: 'study', icon: '📖', label: '공부 중' },
    { id: 'nap', icon: '💤', label: '낮잠' },
    { id: 'hungry', icon: '🍚', label: '배고파' },
  ],
  cafeteria: [
    { id: 'eat', icon: '🍱', label: '급식 먹는 중' },
    { id: 'drink', icon: '💧', label: '물 마시기' },
  ],
  gym: [
    { id: 'stretch', icon: '🤸', label: '체조하기' },
    { id: 'badminton', icon: '🏸', label: '배드민턴' },
    { id: 'run', icon: '🏃', label: '달리기' },
  ],
};

const PLACE = { classroom: '교실 자리에 앉았어요', cafeteria: '급식실 자리에 앉았어요', gym: '체육관에서 몸을 움직여 봐요' };

export class SeatPanel {
  constructor(root, { onSit, onAction, onStand }) {
    this.root = root;

    const pop = (this.pop = document.createElement('button'));
    pop.className = 'sitpop';
    pop.hidden = true;
    pop.innerHTML = '<span aria-hidden="true">🪑</span>앉기';
    pop.addEventListener('click', () => onSit());

    const bar = (this.bar = document.createElement('nav'));
    bar.className = 'seatbar';
    bar.hidden = true;
    bar.setAttribute('aria-label', '앉아서 할 수 있는 행동');
    bar.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.action === 'stand') onStand();
      else onAction(b.dataset.action);
    });

    root.append(pop, bar);
  }

  // x, y: 화면 좌표(px). null이면 숨김
  showSit(x, y) {
    if (x == null) {
      this.pop.hidden = true;
      return;
    }
    this.pop.hidden = false;
    this.pop.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
  }

  // mode 'seated': 앉아 있는 동안 하단 바를 대신함(일어나기 포함) / 'activity': 하단 바 위에 따로 뜸
  openBar(kind, { mode = 'seated' } = {}) {
    const actions = SEAT_ACTIONS[kind] ?? [];
    this.kind = kind;
    this.bar.innerHTML = `
      <span class="seatbar__place">${PLACE[kind] ?? ''}</span>
      <div class="seatbar__actions">
        ${actions.map((a) => `<button data-action="${a.id}"><span aria-hidden="true">${a.icon}</span>${a.label}</button>`).join('')}
        ${mode === 'seated' ? '<button data-action="stand" class="seatbar__stand"><span aria-hidden="true">🚶</span>일어나기</button>' : ''}
      </div>`;
    this.bar.hidden = false;
    this.root.classList.toggle('is-seated', mode === 'seated');
    this.root.classList.toggle('is-activity', mode === 'activity');
  }

  closeBar() {
    this.kind = null;
    this.bar.hidden = true;
    this.root.classList.remove('is-seated', 'is-activity');
  }

  setActive(id) {
    this.bar.querySelectorAll('[data-action]').forEach((b) => b.classList.toggle('is-active', b.dataset.action === id));
  }
}
