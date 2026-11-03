// 영파여고 교복 이미지에서 뽑은 파츠 카탈로그.
// 레이어는 안쪽부터 inner(셔츠/폴로) → mid → outer(자켓/야구잠바/집업) 순서로 겹쳐 입음.
// opening: 'open'(앞이 열린 자켓) 이면 그 안쪽 레이어와 넥타이가 앞섶으로 보임.
// 넥타이·체육복 요크·줄무늬는 포인트 색(accent)을 따름.

const NAVY = '#1f2338';

export const PARTS = {
  accent: {
    pink: { label: '분홍', color: '#eba3bd', tie: '#d98a9c' },
    yellow: { label: '노랑', color: '#f2cf5b', tie: '#e0b440' },
    green: { label: '초록', color: '#86c595', tie: '#5ea672' },
  },
  outer: {
    none: { label: '없음' },
    blazer: { label: '블레이저', color: '#2f2f34', piping: '#f2f2f2', opening: 'open', crest: true },
    varsity: { label: '야구잠바', color: '#1f3a2c', sleeveColor: '#f1ece2', rib: '#1f3a2c', letters: 'YP', collarV: true },
    hoodie: { label: '후드집업', color: '#1d1d20', hood: true, zip: true, collarV: true },
    track: { label: '체육복 집업', color: NAVY, yoke: true, stripe: true, crest: true, zip: true },
  },
  mid: {
    none: { label: '없음' },
  },
  inner: {
    shirt: { label: '흰 셔츠', color: '#f6f5f2', collar: '#ffffff', sleeves: 'long', tie: true },
    gymPolo: { label: '체육복 폴로', color: NAVY, collar: NAVY, yoke: true, stripe: true, sleeves: 'short', crest: true },
  },
  neck: {
    tie: { label: '스트라이프 넥타이' },
    none: { label: '없음' },
  },
  bottom: {
    skirt: { label: '체크 주름 스커트' },
    gymPants: { label: '체육복 바지', color: NAVY, stripe: true },
  },
  // 양말·신발은 모든 교복에서 브라운 니삭스 + 로퍼로 고정
  legwear: {
    kneeSocks: { label: '브라운 니삭스', color: '#3b2b25' },
  },
  shoes: {
    loafers: { label: '로퍼', color: '#4a2a1e' },
  },
  hair: {
    long: { label: '긴 생머리' },
    bangs: { label: '앞머리 긴머리' },
    bob: { label: '단발' },
    ponytail: { label: '포니테일' },
  },
  hairColor: {
    brown: { label: '브라운', color: '#6a3f27' },
    black: { label: '흑발', color: '#1e1916' },
  },
  glasses: {
    off: { label: '안 씀' },
    on: { label: '동그란 안경' },
  },
};

export const SLOT_LABELS = {
  hair: '헤어',
  glasses: '안경',
};

export const UNIFORM_SLOTS = ['outer', 'inner', 'neck', 'bottom', 'legwear', 'shoes'];

export const PRESETS = [
  {
    id: 'winter',
    name: '동복 블레이저',
    desc: '블레이저 + 셔츠 + 넥타이 + 체크 스커트',
    outfit: { outer: 'blazer', inner: 'shirt', neck: 'tie', bottom: 'skirt', legwear: 'kneeSocks', shoes: 'loafers' },
  },
  {
    id: 'varsity',
    name: '야구잠바',
    desc: 'YP 야구잠바 + 셔츠 + 넥타이 + 체크 스커트',
    outfit: { outer: 'varsity', inner: 'shirt', neck: 'tie', bottom: 'skirt', legwear: 'kneeSocks', shoes: 'loafers' },
  },
  {
    id: 'hoodie',
    name: '후드집업',
    desc: '후드집업 + 셔츠 + 넥타이 + 체크 스커트',
    outfit: { outer: 'hoodie', inner: 'shirt', neck: 'tie', bottom: 'skirt', legwear: 'kneeSocks', shoes: 'loafers' },
  },
  {
    id: 'gym',
    name: '체육복',
    desc: '체육복 폴로 + 체육복 바지',
    outfit: { outer: 'none', inner: 'gymPolo', neck: 'none', bottom: 'gymPants', legwear: 'kneeSocks', shoes: 'loafers' },
  },
  {
    id: 'gymJacket',
    name: '체육복 집업',
    desc: '체육복 집업 + 폴로 + 체육복 바지',
    outfit: { outer: 'track', inner: 'gymPolo', neck: 'none', bottom: 'gymPants', legwear: 'kneeSocks', shoes: 'loafers' },
  },
];

export const DEFAULT_OUTFIT = { ...PRESETS[0].outfit, mid: 'none', accent: 'pink', hair: 'long', hairColor: 'brown', glasses: 'off' };

// 빠진 값은 기본값으로 채우고, 넥타이는 셔츠에만 맬 수 있게 맞춤
export function normalizeOutfit(outfit = {}) {
  const o = { ...DEFAULT_OUTFIT };
  for (const slot of Object.keys(PARTS)) if (PARTS[slot][outfit[slot]]) o[slot] = outfit[slot];
  if (!PARTS.inner[o.inner].tie) o.neck = 'none';
  return o;
}

export function matchPreset(outfit) {
  return PRESETS.find((p) => UNIFORM_SLOTS.every((s) => p.outfit[s] === outfit[s]))?.id ?? null;
}

// 카드에 보여줄 대표 색 (포인트 색 반영)
export function presetSwatches(outfit, accent = 'pink') {
  const a = PARTS.accent[accent];
  const colors = [];
  if (outfit.outer !== 'none') colors.push(PARTS.outer[outfit.outer].color);
  colors.push(PARTS.inner[outfit.inner].color);
  if (outfit.neck === 'tie') colors.push(a.tie);
  if (PARTS.inner[outfit.inner].yoke) colors.push(a.color);
  colors.push(outfit.bottom === 'skirt' ? '#6f6a70' : PARTS.bottom[outfit.bottom].color);
  return colors;
}

const STORAGE_KEY = 'ypgo.outfit';

export function loadOutfit() {
  try {
    return normalizeOutfit(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}'));
  } catch {
    return normalizeOutfit();
  }
}

export function saveOutfit(outfit) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(outfit));
  } catch {
    // 저장소를 쓸 수 없어도 이번 접속에는 그대로 적용됨
  }
}
