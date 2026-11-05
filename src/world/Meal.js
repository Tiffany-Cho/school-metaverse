import * as THREE from 'three';
import { mat } from './parts.js';

// 급식 식단: 밥 · 국 · 고기 반찬 · 김치 · 야채 반찬 · 밑반찬 · 후식 (배식 순서대로)
export const COURSES = [
  { id: 'rice', label: '밥', icon: '🍚' },
  { id: 'soup', label: '국', icon: '🥣' },
  { id: 'meat', label: '고기 반찬', icon: '🍖' },
  { id: 'kimchi', label: '김치', icon: '🌶️' },
  { id: 'veggie', label: '야채 반찬', icon: '🥬' },
  { id: 'side', label: '밑반찬', icon: '🥚' },
  { id: 'dessert', label: '후식', icon: '🍮' },
];

// 월~금 식단 (주말에는 다음 월요일 식단을 미리 보여 줌)
const WEEK = [
  ['잡곡밥', '미역국', '제육볶음', '배추김치', '시금치나물', '계란말이', '요구르트'],
  ['흑미밥', '된장찌개', '닭갈비', '깍두기', '콩나물무침', '어묵볶음', '귤'],
  ['백미밥', '소고기무국', '돈가스', '배추김치', '오이무침', '감자조림', '딸기우유'],
  ['현미밥', '순두부찌개', '불고기', '총각김치', '브로콜리숙회', '멸치볶음', '바나나'],
  ['차조밥', '떡국', '탕수육', '배추김치', '숙주나물', '메추리알장조림', '아이스크림'],
];
const DAYS = ['일', '월', '화', '수', '목', '금', '토'];

export function todayMenu(date = new Date()) {
  const day = date.getDay();
  const weekend = day === 0 || day === 6;
  const dishes = WEEK[weekend ? 0 : day - 1];
  return {
    date: `${date.getMonth() + 1}월 ${date.getDate()}일 (${DAYS[day]})`,
    note: weekend ? '주말이라 다음 주 월요일 식단을 미리 보여 드려요' : '맛있게 먹고 힘내요!',
    items: COURSES.map((c, i) => ({ ...c, dish: dishes[i] })),
  };
}

// 음식 모양 (식판 한 칸 크기 기준. 배식대 통에는 크게 키워 씀)
const FOOD = {
  rice: mat('#f8f5ee', { roughness: 0.9 }),
  soupBowl: mat('#f2efe8', { roughness: 0.4 }),
  soup: mat('#c9773f', { roughness: 0.3 }),
  meat: mat('#8a4a2b', { roughness: 0.7 }),
  kimchi: mat('#d9502f', { roughness: 0.6 }),
  veggie: mat('#5f9e48', { roughness: 0.7 }),
  side: mat('#f2c94c', { roughness: 0.6 }),
  dessert: mat('#f4a3b4', { roughness: 0.5 }),
};

export function makeFood(id) {
  const g = new THREE.Group();
  const add = (geo, m, x = 0, y = 0, z = 0) => {
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.set(x, y, z);
    g.add(mesh);
    return mesh;
  };
  if (id === 'rice') {
    add(new THREE.SphereGeometry(0.07, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), FOOD.rice).scale.y = 0.7;
  } else if (id === 'soup') {
    add(new THREE.CylinderGeometry(0.075, 0.055, 0.06, 16), FOOD.soupBowl, 0, 0.03, 0);
    add(new THREE.CylinderGeometry(0.066, 0.066, 0.01, 16), FOOD.soup, 0, 0.055, 0);
  } else if (id === 'meat') {
    for (const [x, z] of [[-0.02, 0], [0.025, 0.015], [0.005, -0.02]]) add(new THREE.BoxGeometry(0.035, 0.022, 0.03), FOOD.meat, x, 0.012, z).rotation.y = x * 20;
  } else if (id === 'kimchi') {
    add(new THREE.ConeGeometry(0.04, 0.03, 7), FOOD.kimchi, 0, 0.015, 0);
  } else if (id === 'veggie') {
    add(new THREE.IcosahedronGeometry(0.032, 0), FOOD.veggie, 0, 0.018, 0).scale.y = 0.6;
  } else if (id === 'side') {
    for (const x of [-0.018, 0.018]) add(new THREE.CylinderGeometry(0.018, 0.018, 0.03, 10), FOOD.side, x, 0.015, 0).rotation.z = Math.PI / 2;
  } else if (id === 'dessert') {
    add(new THREE.SphereGeometry(0.028, 10, 8), FOOD.dessert, 0, 0.028, 0);
  }
  return g;
}

// 칸이 나뉜 식판. 가까운 쪽(-z)에 밥·국, 먼 쪽에 반찬 다섯 칸
const SLOTS = {
  rice: [-0.12, -0.075],
  soup: [0.12, -0.075],
  meat: [-0.2, 0.09],
  kimchi: [-0.1, 0.09],
  veggie: [0, 0.09],
  side: [0.1, 0.09],
  dessert: [0.2, 0.09],
};
const TRAY = mat('#9ec1d9', { roughness: 0.5 });
const TRAY_RIM = mat('#86aecb', { roughness: 0.5 });

export function makeTray() {
  const group = new THREE.Group();
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.025, 0.36), TRAY);
  base.position.y = 0.0125;
  const divider = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.03, 0.012), TRAY_RIM);
  divider.position.set(0, 0.02, 0.01);
  const foods = new THREE.Group();
  foods.position.y = 0.025;
  group.add(base, divider, foods);
  return {
    group,
    items: [],
    set(items = []) {
      this.items = [...items];
      foods.clear();
      for (const id of items) {
        const food = makeFood(id);
        const [x, z] = SLOTS[id];
        food.position.set(x, 0, z);
        foods.add(food);
      }
    },
  };
}
