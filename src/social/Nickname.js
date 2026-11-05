// '나긋한 구름', '졸린 다람쥐'처럼 꾸밈말 + 이름 조합의 랜덤 닉네임
const ADJECTIVES = [
  '나긋한', '졸린', '행복한', '수줍은', '느긋한', '반짝이는', '포근한', '씩씩한', '말랑한', '상냥한',
  '꿈꾸는', '산뜻한', '다정한', '보송한', '조용한', '명랑한', '살랑이는', '따뜻한', '부지런한', '엉뚱한',
];
const NOUNS = [
  '구름', '다람쥐', '햇살', '고양이', '토끼', '벚꽃', '바람', '별빛', '도토리', '참새',
  '복숭아', '솜사탕', '단풍잎', '펭귄', '해바라기', '물방울', '아기곰', '민들레', '오리', '연필',
];

const pick = (list) => list[Math.floor(Math.random() * list.length)];

export function randomNickname(exclude = []) {
  for (let i = 0; i < 20; i++) {
    const name = `${pick(ADJECTIVES)} ${pick(NOUNS)}`;
    if (!exclude.includes(name)) return name;
  }
  return `${pick(ADJECTIVES)} ${pick(NOUNS)}`;
}

// 같은 브라우저로 다시 오면 같은 이름. 저장소를 못 쓰면 이번 접속에만 새 이름
const STORAGE_KEY = 'ypgo.nickname';

export function loadNickname() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return saved;
    const name = randomNickname();
    localStorage.setItem(STORAGE_KEY, name);
    return name;
  } catch {
    return randomNickname();
  }
}

export function saveNickname(name) {
  try {
    localStorage.setItem(STORAGE_KEY, name);
  } catch {
    // 저장 못 해도 이번 접속에는 그대로 씀
  }
}
