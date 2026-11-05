import { randomNickname } from './Nickname.js';

// 접속한 사람들 사이의 소식(지금은 인사)을 주고받는 통로.
// 화면(알림·아바타 동작)은 on()으로 듣기만 하고, 소식이 어디서 왔는지는 몰라도 됨:
//   - 내가 인사:        social.greet()                  → 'greet' { from: me }
//   - 다른 접속자 인사:  social.receive({ type: 'greet', from })  ← 나중에 웹소켓 등에서 받은 메시지를 그대로 넣으면 됨
//   - 가상의 반 친구:    simulateClassmates(social)       → receive()로 넣으므로 실제 접속자와 똑같이 처리됨
export class Social {
  constructor(me) {
    this.me = { id: 'me', ...me, isMe: true };
    this.listeners = new Map();
    // 내 소식을 서버로 보낼 곳. 멀티플레이어를 붙일 때 이 함수만 바꾸면 됨
    this.send = () => {};
  }

  on(type, fn) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(fn);
    return () => this.listeners.get(type).delete(fn);
  }

  #emit(event) {
    this.listeners.get(event.type)?.forEach((fn) => fn(event));
  }

  greet() {
    const event = { type: 'greet', from: this.me, at: Date.now() };
    this.send(event);
    this.#emit(event);
  }

  receive(event) {
    if (event.from?.id === this.me.id) return;
    this.#emit({ ...event, from: { ...event.from, isMe: false } });
  }

  rename(nickname) {
    this.me.nickname = nickname;
  }
}

// 아직 실제 접속자가 없으니, 가끔 가상의 반 친구가 인사를 건네게 함
export function simulateClassmates(social, { first = 25000, min = 45000, max = 90000, paused = () => false } = {}) {
  const friends = Array.from({ length: 6 }, (_, i) => ({ id: `friend-${i}`, nickname: randomNickname([social.me.nickname]) }));
  let timer;
  const next = (delay) => {
    timer = setTimeout(() => {
      if (!paused()) social.receive({ type: 'greet', from: friends[Math.floor(Math.random() * friends.length)], at: Date.now() });
      next(min + Math.random() * (max - min));
    }, delay);
  };
  next(first);
  return () => clearTimeout(timer);
}
