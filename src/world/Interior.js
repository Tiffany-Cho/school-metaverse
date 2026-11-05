import * as THREE from 'three';
import { v, mat, box, canvasTexture, signMaterial, signPlane, glowFrame, hotspot, tagAction, enableShadows, FONT } from './parts.js';
import { createSky, createTrack, createFieldLines, createTrees } from './Environment.js';
import { todayMenu, makeFood, makeTray } from './Meal.js';

// 건물 1층 내부 (천장을 걷어낸 단면 모형). 입구로 들어서면 좌우로 긴 메인 복도가 펼쳐짐
//   복도 왼쪽: 교실 1·2 / 복도 오른쪽: 교무실 1·2 / 왼쪽 끝: 급식실 / 오른쪽 끝: 체육관(층고 높음)
// 답답하지 않도록 바깥벽은 통유리창, 방 사이·복도 쪽 벽은 허리 높이 위로 유리이고 넓게 트여 있음.
// 복도 남쪽 창 너머로 운동장, 방 북쪽 창 너머로 뒤뜰 숲이 보임
const H = 3.6;
const T = 0.3;
const ROOM_DOOR = 6; // 복도 ↔ 방 개구부 폭
const SIDE_DOOR = { z: [-6.8, -3.6] }; // 교실 1↔2, 교무실 1↔2 사이 개구부
const PLAYGROUND = { x: 0, z: 34 };

const ROOMS = [
  { id: 'classroom1', button: 'classroom', label: '교실 1', kind: 'classroom', x: [-32, -16] },
  { id: 'classroom2', button: 'classroom', label: '교실 2', kind: 'classroom', x: [-16, -2] },
  { id: 'office1', button: 'office', label: '교무실 1', kind: 'office', x: [2, 16] },
  { id: 'office2', button: 'office', label: '교무실 2', kind: 'office', x: [16, 32] },
];
const ROOM_Z = [-15, -3];
const CAFE = { x: [-52, -32], z: [-15, 9], h: 4.5 };
const HALL = { x: [32, 56], z: [-17, 11], h: 8 };
const EXITS = { left: -26, mid: 0, right: 26 };

const KIND_COLOR = { classroom: '#c96f4f', office: '#2f4a6d' };
const DOOR_COLOR = { classroom: '#c9935f', office: '#7f93a8' };

const cxOf = (r) => (r.x[0] + r.x[1]) / 2;

export function createInterior() {
  const scene = new THREE.Scene();
  createSky(scene, { fog: [90, 300] });
  scene.add(new THREE.HemisphereLight('#d6ebff', '#b8a98f', 1.15));
  // 운동장 쪽(남서)에서 낮게 드는 햇살: 유리는 그림자를 만들지 않아 창살·창턱 그림자만 바닥에 떨어짐
  const sun = new THREE.DirectionalLight('#ffe6c4', 2.3);
  sun.position.set(-26, 30, 46);
  sun.target.position.set(2, 0, -4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.02;
  Object.assign(sun.shadow.camera, { left: -75, right: 75, top: 75, bottom: -75, near: 1, far: 200 });
  scene.add(sun, sun.target);

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(800, 800), new THREE.MeshStandardMaterial({ color: '#93b46c', roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  ground.name = 'ground';
  scene.add(ground);
  buildOutdoors(scene);

  const root = new THREE.Group();
  scene.add(root);

  buildFloors(root);
  const fadeFront = fader(buildWalls(root));
  buildCorridor(root);
  // 앉을 수 있는 자리: { id, kind, pos(앉는 자리), face(바라볼 곳), drop(몸을 내릴 높이) }
  const seats = [];
  for (const r of ROOMS) (r.kind === 'classroom' ? buildClassroom : buildOffice)(root, r, seats);
  const menu = todayMenu();
  const stations = buildCafeteria(root, seats, menu);
  buildGym(root);
  buildStairs(root);
  enableShadows(root);

  // 산사 뷰처럼 아바타 뒤 낮은 곳에서 방 안과 창밖을 함께 담는 시점
  const views = {
    corridor: { label: '메인 복도', button: 'corridor', stand: v(0, 0, 0), camera: v(-9, 5.5, 13), target: v(4, 1.2, -8) },
    cafeteria: { label: '급식실', button: 'cafeteria', stand: v(-42, 0, -10.6), camera: v(-38.5, 4.4, 1.5), target: v(-42.5, 1.9, -12.5) },
    gym: { label: '체육관', button: 'gym', stand: v(38.5, 0, 2.5), camera: v(37.5, 4.8, 10.2), target: v(41.5, 1.2, -4.5) },
  };
  for (const r of ROOMS) {
    const cx = cxOf(r);
    views[r.id] = { label: r.label, button: r.button, stand: v(cx, 0, -5.2), camera: v(cx + 5, 4.3, -3.9), target: v(cx - 3, 1.2, -12.5) };
  }

  // 걸을 수 있는 구역과, 구역 사이를 잇는 개구부(wall: 개구부가 있는 벽의 축과 좌표, span: 지나갈 수 있는 폭)
  const zones = [
    { id: 'corridor', x: [-31.5, 31.5], z: [-2.3, 2.3] },
    ...ROOMS.map((r) => ({ id: r.id, x: [r.x[0] + 0.6, r.x[1] - 0.6], z: [ROOM_Z[0] + 0.6, ROOM_Z[1] - 0.6] })),
    { id: 'cafeteria', x: [CAFE.x[0] + 0.6, CAFE.x[1] - 0.6], z: [-12, CAFE.z[1] - 0.6] },
    { id: 'gym', x: GYM.x, z: GYM.z },
  ];
  const half = ROOM_DOOR / 2 - 0.5;
  const links = [
    ...ROOMS.map((r) => ({ a: r.id, b: 'corridor', axis: 'z', at: ROOM_Z[1], span: [cxOf(r) - half, cxOf(r) + half] })),
    { a: 'classroom1', b: 'classroom2', axis: 'x', at: -16, span: [SIDE_DOOR.z[0] + 0.4, SIDE_DOOR.z[1] - 0.4] },
    { a: 'office1', b: 'office2', axis: 'x', at: 16, span: [SIDE_DOOR.z[0] + 0.4, SIDE_DOOR.z[1] - 0.4] },
    { a: 'cafeteria', b: 'corridor', axis: 'x', at: -32, span: [-2, 2] },
    { a: 'gym', b: 'corridor', axis: 'x', at: 32, span: [-2, 2] },
  ];

  return {
    scene,
    ground,
    root,
    zones,
    links,
    views,
    seats,
    menu,
    stations,
    gymTrack: GYM_TRACK,
    inGym: (p) => p.x > GYM.x[0] - 0.2,
    spawn: (spot) => v(EXITS[spot] ?? 0, 0, 1.4),
    // 매 프레임: 카메라가 운동장 쪽 벽 바깥(뒤)으로 물러나면 그 벽을 서서히 투명하게
    update(camera) {
      fadeFront(1 - 0.85 * THREE.MathUtils.smoothstep(camera.position.z, 3.5, 6.5));
    },
  };
}

function flat(w, d, color, x, z, y = 0.02) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat(color, { roughness: 0.9 }));
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, y, z);
  m.userData.noShadow = true;
  m.receiveShadow = true;
  return m;
}

// 창밖 풍경: 남쪽 운동장 · 사방의 나무 · 북쪽 뒤뜰 너머 낮은 언덕
function buildOutdoors(scene) {
  scene.add(
    flat(126, 48, '#d6cfc2', 2, -3, 0.005), // 건물 둘레 포장 마당
    flat(80, 44, '#d9b98c', PLAYGROUND.x, PLAYGROUND.z, 0.01), // 운동장 흙바닥
    createTrack(PLAYGROUND),
    createFieldLines(PLAYGROUND),
  );

  const spots = [];
  for (let x = -66; x <= 70; x += 5.5) spots.push([x, -25 - (Math.abs(x) % 3)], [x + 2.5, -32 - (Math.abs(x) % 4)]);
  for (let z = -20; z <= 54; z += 6) spots.push([-66, z], [72, z]);
  for (let x = -58; x <= 64; x += 7) spots.push([x, 60]);
  for (const x of [-56, -48, 54, 62]) spots.push([x, 14], [x, 26]);
  scene.add(createTrees(spots));

  const hill = mat('#7fa35c', { flatShading: true });
  for (const [x, z, r] of [[-90, -120, 60], [10, -150, 80], [110, -115, 55], [-150, 40, 60], [160, 60, 70]]) {
    const h = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), hill);
    h.scale.y = 0.35;
    h.position.set(x, -r * 0.08, z);
    scene.add(h);
  }
}

function buildFloors(root) {
  root.add(flat(64, 6, '#ddd5c7', 0, 0), flat(64, 0.25, '#c7bba8', 0, 0, 0.025));
  const floorColor = { classroom: '#c49a6c', office: '#b9c3cc' };
  for (const r of ROOMS) root.add(flat(r.x[1] - r.x[0], 12, floorColor[r.kind], cxOf(r), -9));
  root.add(
    flat(4, 12, '#cfc6b8', 0, -9),
    flat(20, 24, '#efe9dd', -42, -3),
    flat(24, 28, '#c4935f', 44, -3),
  );
}

const WALL = mat('#f3eee6');
const TRIM = mat('#c9bfae');
const GLASS = mat('#cfe6f2', { transparent: true, opacity: 0.22, roughness: 0.05, metalness: 0.1, depthWrite: false });
const MULLION = mat('#8a8f96', { roughness: 0.5 });

// a→b 직선 벽. gaps: { c: 시작점에서의 거리, w: 폭, h: 문 높이 }
// glass: 창턱(sill) 높이까지만 벽이고 그 위는 유리. 통유리 느낌이 나도록 창살을 일정 간격으로 세움
function wall(parent, [x1, z1], [x2, z2], { h, gaps = [], glass = false, sill = 1 }) {
  const len = Math.hypot(x2 - x1, z2 - z1);
  const dx = (x2 - x1) / len;
  const dz = (z2 - z1) / len;
  const ry = Math.atan2(-(z2 - z1), x2 - x1);
  const at = (d, w, hh, y, depth, material) => {
    const b = box(w, hh, depth, material, x1 + dx * d, y, z1 + dz * d);
    b.rotation.y = ry;
    parent.add(b);
    return b;
  };

  const sorted = [...gaps].sort((a, b) => a.c - b.c);
  const segs = [];
  let cur = 0;
  for (const g of sorted) {
    segs.push([cur, g.c - g.w / 2]);
    cur = g.c + g.w / 2;
  }
  segs.push([cur, len]);

  for (const [s, e] of segs) {
    if (e - s < 0.01) continue;
    const mid = (s + e) / 2;
    if (glass) {
      const top = h - 0.15;
      at(mid, e - s, sill, sill / 2, T, WALL);
      const pane = at(mid, e - s, top - sill, sill + (top - sill) / 2, 0.06, GLASS);
      pane.userData.noShadow = pane.userData.noPick = true;
      const n = Math.max(1, Math.round((e - s) / 2.4));
      for (let i = 0; i <= n; i++) {
        const post = at(s + ((e - s) * i) / n, 0.1, top - sill, sill + (top - sill) / 2, 0.12, MULLION);
        post.userData.noPick = true;
      }
      at(mid, e - s, 0.08, sill + 0.04, T + 0.08, TRIM).userData.noPick = true;
    } else {
      at(mid, e - s, h, h / 2, T, WALL);
    }
  }
  for (const g of sorted) if (g.h < h) at(g.c, g.w, h - g.h, g.h + (h - g.h) / 2, T, WALL);
  if (glass) at(len / 2, len, 0.15, h - 0.075, T + 0.05, TRIM);
}

function buildWalls(root) {
  // 복도 남쪽(운동장 쪽): 낮은 창턱의 통유리 + 출입구 3곳. 카메라가 이 벽 바깥에 있으면 흐리게 지움
  const front = new THREE.Group();
  root.add(front);
  wall(front, [-32, 3], [32, 3], { h: H, glass: true, sill: 0.45, gaps: Object.values(EXITS).map((x) => ({ c: x + 32, w: 3, h: 2.8 })) });
  // 복도 북쪽: 허리 위로 유리라 복도에서 방 안과 그 너머 창밖까지 보임. 방 입구는 넓게 트임
  wall(root, [-32, -3], [32, -3], { h: H, glass: true, sill: 0.9, gaps: [...ROOMS.map((r) => ({ c: cxOf(r) + 32, w: ROOM_DOOR, h: 2.9 })), { c: 32, w: 4, h: H }] });
  // 방 북쪽 바깥벽: 바닥 가까이까지 내려오는 통유리창
  wall(root, [-32, -15], [32, -15], { h: H, glass: true, sill: 0.6 });
  // 방 사이 벽: 유리 칸막이. 교실 1↔2, 교무실 1↔2는 서로 바로 오갈 수 있게 개구부를 냄
  const side = { c: (SIDE_DOOR.z[0] + SIDE_DOOR.z[1]) / 2 + 15, w: SIDE_DOOR.z[1] - SIDE_DOOR.z[0], h: 2.9 };
  for (const x of [-16, 16]) wall(root, [x, -15], [x, -3], { h: H, glass: true, sill: 0.9, gaps: [side] });
  for (const x of [-2, 2]) wall(root, [x, -15], [x, -3], { h: H, glass: true, sill: 0.9 });

  const { h: ch } = CAFE;
  wall(root, [-32, -15], [-32, 9], { h: ch, gaps: [{ c: 15, w: 5.4, h: 3.2 }] });
  wall(root, [-52, -15], [-32, -15], { h: ch });
  wall(root, [-52, -15], [-52, 9], { h: ch, glass: true, sill: 0.6 });
  wall(root, [-52, 9], [-32, 9], { h: ch, glass: true, sill: 0.6 });

  const { h: hh } = HALL;
  wall(root, [32, -17], [32, 11], { h: hh, gaps: [{ c: 17, w: 5.4, h: 3.4 }] });
  wall(root, [32, -17], [56, -17], { h: hh, glass: true, sill: 1.2 });
  wall(root, [56, -17], [56, 11], { h: hh });
  wall(root, [32, 11], [56, 11], { h: hh, glass: true, sill: 0.6 });
  return front;
}

// 카메라와 아바타 사이를 가리는 벽을 투명하게 만드는 페이더
function fader(group) {
  const mats = new Map();
  group.traverse((o) => {
    if (!o.isMesh) return;
    if (!mats.has(o.material)) {
      const m = o.material.clone();
      m.transparent = true;
      mats.set(o.material, { m, base: m.opacity });
    }
    o.material = mats.get(o.material).m;
  });
  let current = 1;
  return (visible) => {
    if (Math.abs(visible - current) < 0.01) return;
    current = visible;
    for (const { m, base } of mats.values()) m.opacity = base * visible;
  };
}

function buildCorridor(root) {
  // 방 입구: 넓게 트인 개구부 + 빛나는 테두리 + 문패. 클릭 영역은 문틀 윗부분이라 개구부 너머 바닥은 그대로 걸어서 들어갈 수 있음
  for (const r of ROOMS) {
    const cx = cxOf(r);
    const action = { type: 'room', id: r.id };
    const frame = glowFrame(ROOM_DOOR, 2.9);
    frame.position.set(cx, 0, -2.8);
    const plate = tagAction(signPlane(r.label, 2.2, 0.5, { bg: KIND_COLOR[r.kind] }), action);
    plate.position.set(cx, 3.25, -2.84);
    const hit = hotspot(ROOM_DOOR + 0.4, 0.9, 0.8, action);
    hit.position.set(cx, 3.25, -3);
    // 활짝 열어 벽 쪽으로 밀어 둔 미닫이문 (유리 칸막이 안쪽)
    const doorPanel = box(1.4, 2.6, 0.06, DOOR_COLOR[r.kind], cx + ROOM_DOOR / 2 + 0.75, 1.32, -3.25);
    root.add(frame, plate, hit, doorPanel);
  }

  // 복도 양 끝: 급식실(왼쪽) · 체육관(오른쪽)
  for (const [side, id, label] of [[-1, 'cafeteria', '급식실'], [1, 'gym', '체육관']]) {
    const action = { type: 'room', id };
    const x = side * 32;
    const frame = glowFrame(3.6, 3);
    frame.position.set(x - side * 0.2, 0, 0);
    frame.rotation.y = -side * (Math.PI / 2);
    const plate = tagAction(signPlane(label, 2.4, 0.6, { bg: side < 0 ? '#c96f4f' : '#1f2f45' }), action);
    plate.position.set(x - side * 0.17, 3.6, 0);
    plate.rotation.y = -side * (Math.PI / 2);
    const hit = hotspot(1.2, 3.6, 4, action);
    hit.position.set(x, 1.8, 0);
    // 복도에 매달린 방향 안내판
    const hanging = tagAction(signPlane(side < 0 ? '← 급식실' : '체육관 →', 3.4, 0.7, { bg: '#2d2a26' }), action);
    hanging.position.set(side * 28.5, 3.05, 0);
    root.add(frame, plate, hit, hanging, box(0.04, 0.2, 0.04, '#6b6f76', side * 28.5 - 1.4, 3.5, 0), box(0.04, 0.2, 0.04, '#6b6f76', side * 28.5 + 1.4, 3.5, 0));
  }

  // 출입구 3곳 → 운동장으로 나가기
  for (const x of Object.values(EXITS)) {
    const action = { type: 'exit' };
    const frame = glowFrame(3, 2.8);
    frame.position.set(x, 0, 2.8);
    frame.rotation.y = Math.PI;
    const doormat = tagAction(signPlane('출구 · 운동장으로', 2.8, 0.8, { bg: '#3f8f5a' }), action);
    doormat.rotation.x = -Math.PI / 2;
    doormat.position.set(x, 0.04, 2.1);
    const hit = hotspot(3.2, 3, 1.4, action);
    hit.position.set(x, 1.5, 2.6);
    root.add(frame, doormat, hit);
  }

  // 사물함: 창턱보다 낮게 둬서 유리 너머 시야를 가리지 않음
  const doorXs = ROOMS.map(cxOf);
  const clear = ROOM_DOOR / 2 + 2;
  const spots = [];
  for (let x = -31.2; x <= 31.2; x += 0.95) if (Math.abs(x) > 2.6 && doorXs.every((d) => Math.abs(x - d) > clear)) spots.push(x);
  const lockers = new THREE.InstancedMesh(new THREE.BoxGeometry(0.9, 0.85, 0.45), mat('#ffffff', { roughness: 0.6 }), spots.length);
  const palette = ['#9ec1d9', '#f2c4a0', '#b9d6a8', '#d7c3e6'].map((c) => new THREE.Color(c));
  const m = new THREE.Matrix4();
  spots.forEach((x, i) => {
    lockers.setMatrixAt(i, m.makeTranslation(x, 0.43, -2.6));
    lockers.setColorAt(i, palette[Math.floor(i / 6) % palette.length]);
  });
  root.add(lockers);
}

const DESK = mat('#d9a86c');
const STEEL = mat('#7a8a99');
const CHAIR = mat('#4f7f9e');

function boardTexture(title, sub) {
  return canvasTexture(1024, 360, (ctx, w, h) => {
    ctx.fillStyle = '#2f5d4a';
    ctx.fillRect(0, 0, w, h);
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.font = `bold 92px ${FONT}`;
    ctx.fillText(title, w / 2, 150);
    ctx.font = `48px ${FONT}`;
    ctx.fillStyle = 'rgba(255,236,170,0.9)';
    ctx.fillText(sub, w / 2, 250);
  });
}

// 칠판은 서쪽 벽에 두고 책상은 칠판을 바라봄: 북쪽 통유리창이 학생들 오른편으로 길게 트임
function buildClassroom(root, r, seats) {
  const x0 = r.x[0];
  const bz = -10.4;
  const board = new THREE.Mesh(new THREE.PlaneGeometry(5, 1.7), signMaterial(boardTexture(r.label, '오늘도 즐겁게 배워요'), 0.4));
  board.rotation.y = Math.PI / 2;
  board.position.set(x0 + 0.33, 1.95, bz);
  board.userData.noShadow = true;
  root.add(box(0.12, 2.6, 5.6, '#e9e3d9', x0 + 0.2, 1.75, bz), box(0.1, 2.1, 5.4, '#8b6a45', x0 + 0.27, 1.95, bz), board);
  root.add(box(0.9, 0.9, 2.2, '#a0714a', x0 + 1.8, 0.45, bz));

  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      const x = x0 + 4.3 + row * 2.5;
      const z = -13 + col * 2.4;
      // 의자를 누르면 [앉기] 버튼이 뜸
      const id = `${r.id}-${row}-${col}`;
      const chair = tagAction(new THREE.Group(), { type: 'seat', id });
      chair.add(box(0.55, 0.45, 0.55, CHAIR, x + 0.75, 0.23, z), box(0.06, 0.5, 0.55, CHAIR, x + 1.03, 0.7, z));
      // 책상 밑은 비워 둬서 앉았을 때 다리가 들어감
      root.add(
        box(0.7, 0.08, 1.2, DESK, x, 0.78, z),
        box(0.5, 0.1, 1, STEEL, x, 0.69, z),
        box(0.05, 0.66, 0.05, STEEL, x - 0.25, 0.33, z - 0.52),
        box(0.05, 0.66, 0.05, STEEL, x - 0.25, 0.33, z + 0.52),
        chair,
      );
      seats.push({ id, kind: 'classroom', room: r.id, pos: v(x + 0.68, 0, z), face: v(x - 1, 0, z), drop: 0.12, chair });
    }
  }
}

function buildOffice(root, r) {
  const cx = cxOf(r);
  const deskMat = mat('#e4dfd6');
  const monitor = mat('#2b2f36');
  const chair = mat('#3d5a80');
  for (const dx of [-3.4, 3.4]) {
    for (const sx of [-0.75, 0.75]) {
      for (const side of [-1, 1]) {
        const x = cx + dx + sx;
        const z = -9 + side * 0.45;
        root.add(
          box(1.45, 0.76, 0.85, deskMat, x, 0.38, z),
          box(0.6, 0.4, 0.05, monitor, x, 1.0, -9 + side * 0.2),
          box(0.55, 0.5, 0.55, chair, x, 0.25, -9 + side * 1.35),
        );
      }
    }
  }
  // 창 아래 낮은 서류장, 일정표는 복도 쪽 문 위 벽 안쪽
  for (let i = 0; i < 5; i++) root.add(box(1.1, 0.55, 0.5, '#b9c0c8', cx - 4.4 + i * 2.2, 0.28, -14.55));
  const schedule = signPlane(`${r.label} · 이번 주 일정`, 4.4, 0.6, { bg: '#ffffff', fg: '#2f4a6d' });
  schedule.rotation.y = Math.PI;
  schedule.position.set(cx, 3.25, -3.17);
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.25, 0.5, 12), mat('#b5694a'));
  pot.position.set(cx + 5.6, 0.25, -4.4);
  const leaves = new THREE.Mesh(new THREE.IcosahedronGeometry(0.6, 0), mat('#7fae5b', { flatShading: true }));
  leaves.position.set(cx + 5.6, 1, -4.4);
  root.add(schedule, pot, leaves);
}

function menuBoardTexture(menu) {
  return canvasTexture(1400, 500, (ctx, w, h) => {
    ctx.fillStyle = '#fffaf2';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#2f5d4a';
    ctx.fillRect(0, 0, w, 96);
    ctx.fillStyle = '#ffffff';
    ctx.textBaseline = 'middle';
    ctx.font = `bold 52px ${FONT}`;
    ctx.fillText('🍽️ 오늘의 급식', 40, 50);
    ctx.textAlign = 'right';
    ctx.font = `44px ${FONT}`;
    ctx.fillText(menu.date, w - 40, 50);

    ctx.textAlign = 'left';
    menu.items.forEach((item, i) => {
      const col = i < 4 ? 0 : 1;
      const row = i < 4 ? i : i - 4;
      const x = 50 + col * 690;
      const y = 150 + row * 76;
      ctx.font = `40px ${FONT}`;
      ctx.fillStyle = '#c96f4f';
      ctx.fillText(`${item.icon} ${item.label}`, x, y);
      ctx.font = `bold 46px ${FONT}`;
      ctx.fillStyle = '#2d2a26';
      ctx.fillText(item.dish, x + 300, y);
    });
    ctx.font = `30px ${FONT}`;
    ctx.fillStyle = 'rgba(45,42,38,0.55)';
    ctx.fillText(menu.note, 740, 150 + 3 * 76);
  });
}

// 급식실: 벽의 오늘 메뉴판 + 밥부터 후식까지 차례로 받는 배식대 + 식탁(자리마다 식판)
function buildCafeteria(root, seats, menu) {
  const steel = mat('#c9ced3', { metalness: 0.5, roughness: 0.4 });
  const pan = mat('#e3e6ea', { metalness: 0.6, roughness: 0.3 });
  root.add(box(14, 1, 1.4, steel, -42, 0.5, -13.4), box(14.2, 0.06, 1.5, '#aeb4ba', -42, 1.02, -13.4));
  // 위생 가림막
  const guard = box(14, 0.04, 0.7, GLASS, -42, 1.6, -13.1);
  guard.userData.noShadow = guard.userData.noPick = true;
  root.add(guard);
  for (const x of [-48.8, -42, -35.2]) root.add(box(0.05, 0.6, 0.05, '#aeb4ba', x, 1.3, -12.85));

  const sign = signPlane('급식실', 6, 1.1, { bg: '#c96f4f', spaced: true });
  sign.position.set(-46.5, 3.3, -14.83);
  const board = new THREE.Mesh(new THREE.PlaneGeometry(7, 2.5), signMaterial(menuBoardTexture(menu), 0.35));
  board.position.set(-38, 3.05, -14.8);
  board.userData.noShadow = true;
  root.add(sign, box(7.3, 2.8, 0.08, '#8b6a45', -38, 3.05, -14.88), board);

  const stations = menu.items.map((item, i) => {
    const x = -48 + i * 2;
    const action = { type: 'serve', id: item.id };
    root.add(box(1.7, 0.1, 1, pan, x, 1.08, -13.45));
    // 통 안에 음식을 크게 담아 둠
    for (const dx of [-0.35, 0.35]) {
      const food = makeFood(item.id);
      food.scale.setScalar(5);
      food.position.set(x + dx, 1.12, -13.45);
      root.add(food);
    }
    const label = tagAction(signPlane(`${i + 1}. ${item.label}`, 1.8, 0.42, { bg: '#2f5d4a' }), action);
    label.position.set(x, 0.62, -12.68);
    const dish = tagAction(signPlane(item.dish, 1.7, 0.36, { bg: '#ffffff', fg: '#2d2a26' }), action);
    dish.position.set(x, 1.95, -13.9);
    const hit = hotspot(1.95, 1.8, 1.8, action);
    hit.position.set(x, 0.9, -13.1);
    root.add(label, dish, hit);
    return { ...item, stand: v(x, 0, -11.9), face: v(x, 0, -14) };
  });

  const top = mat('#f3efe6');
  const leg = mat('#8d939b');
  const bench = mat('#e8a35a');
  for (const x of [-46.5, -37.5]) {
    for (const z of [-8.5, -4, 0.5, 5]) {
      root.add(box(7, 0.1, 1.3, top, x, 0.78, z), box(6, 0.7, 0.3, leg, x, 0.38, z));
      for (const s of [-1, 1]) {
        root.add(box(7, 0.08, 0.4, bench, x, 0.48, z + s), box(6, 0.42, 0.1, leg, x, 0.22, z + s));
        // 긴 의자 위 네 자리마다 누를 수 있는 영역 + 식판
        for (const dx of [-2.4, -0.8, 0.8, 2.4]) {
          const id = `cafe-${x}-${z}-${s}-${dx}`;
          const spot = hotspot(1.2, 0.7, 0.9, { type: 'seat', id });
          spot.position.set(x + dx, 0.35, z + s * 1.05);
          // 식판의 밥·국 칸이 앉는 사람 쪽을 향하게 돌려 둠
          const tray = makeTray();
          tray.group.position.set(x + dx, 0.83, z + s * 0.36);
          tray.group.rotation.y = s > 0 ? Math.PI : 0;
          root.add(spot, tray.group);
          seats.push({ id, kind: 'cafeteria', room: 'cafeteria', pos: v(x + dx, 0, z + s * 1.02), face: v(x + dx, 0, z), drop: 0.06, chair: spot, tray });
        }
      }
    }
  }
  return stations;
}

// 체육관 바닥 선: 배드민턴 코트 + 가장자리를 도는 달리기 트랙 + 가운데 원
function courtTexture(w, h) {
  const px = 40; // 1m당 픽셀
  return canvasTexture(w * px, h * px, (ctx, cw, ch) => {
    ctx.clearRect(0, 0, cw, ch);
    const cx = cw / 2;
    const cy = ch / 2;
    // 트랙 (두 줄)
    ctx.strokeStyle = 'rgba(232, 120, 70, 0.85)';
    ctx.lineWidth = 6;
    for (const inset of [0.7, 2.1]) {
      const r = (GYM_TRACK.r - (inset - 1.4)) * px;
      ctx.beginPath();
      ctx.roundRect(inset * px, inset * px, cw - inset * 2 * px, ch - inset * 2 * px, r);
      ctx.stroke();
    }
    // 배드민턴 코트 6.1 × 13.4m (네트는 가운데 가로)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.lineWidth = 5;
    const bw = 6.1 * px;
    const bh = 13.4 * px;
    ctx.strokeRect(cx - bw / 2, cy - bh / 2, bw, bh);
    ctx.strokeRect(cx - bw / 2 + 0.46 * px, cy - bh / 2, bw - 0.92 * px, bh);
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(cx - bw / 2, cy + s * 1.98 * px);
      ctx.lineTo(cx + bw / 2, cy + s * 1.98 * px);
      ctx.moveTo(cx, cy + s * 1.98 * px);
      ctx.lineTo(cx, cy + s * bh / 2);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(47, 93, 74, 0.7)';
    ctx.beginPath();
    ctx.arc(cx, cy, 1.8 * px, 0, Math.PI * 2);
    ctx.stroke();
  });
}

// 체육관: 의자를 모두 걷어 낸 넓은 마루 + 무대. 가운데 배드민턴 네트, 가장자리 트랙
const GYM = { x: [32.6, 48.6], z: [-16.4, 10.4] };
// 달리기 경로: 바닥 트랙 두 줄 사이(가장자리에서 1.4m 안쪽)를 도는 둥근 사각형
export const GYM_TRACK = { cx: (GYM.x[0] + GYM.x[1]) / 2, cz: (GYM.z[0] + GYM.z[1]) / 2, w: 13.2, d: 24, r: 4 };

function buildGym(root) {
  const wood = mat('#a8774a');
  root.add(
    box(7, 1.2, 22, wood, 52.5, 0.6, -3),
    box(1.2, 0.6, 6, wood, 48.4, 0.3, -3),
    box(0.3, 6.6, 24, '#2f5d4a', 55.7, 4.5, -3),
    box(0.4, 0.8, 26, '#244a3a', 55.5, 7.6, -3),
  );
  const banner = signPlane('영파여고 체육관', 10, 1.3, { bg: '#1f2f45' });
  banner.position.set(55.35, 6.4, -3);
  banner.rotation.y = -Math.PI / 2;
  root.add(banner);

  const w = GYM.x[1] - GYM.x[0];
  const d = GYM.z[1] - GYM.z[0];
  const lines = new THREE.Mesh(
    new THREE.PlaneGeometry(w, d),
    new THREE.MeshStandardMaterial({ map: courtTexture(w, d), transparent: true, roughness: 0.6, depthWrite: false }),
  );
  lines.rotation.x = -Math.PI / 2;
  lines.position.set(GYM_TRACK.cx, 0.03, GYM_TRACK.cz);
  lines.userData.noShadow = true;
  lines.receiveShadow = true;
  root.add(lines);

  // 배드민턴 네트
  const net = new THREE.Mesh(
    new THREE.PlaneGeometry(6.1, 0.76),
    new THREE.MeshStandardMaterial({ color: '#ffffff', transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false }),
  );
  net.position.set(GYM_TRACK.cx, 1.17, GYM_TRACK.cz);
  net.userData.noShadow = net.userData.noPick = true;
  root.add(net, box(6.1, 0.05, 0.03, '#ffffff', GYM_TRACK.cx, 1.55, GYM_TRACK.cz));
  for (const s of [-1, 1]) root.add(box(0.06, 1.55, 0.06, '#6b6f76', GYM_TRACK.cx + s * 3.1, 0.78, GYM_TRACK.cz));

  // 무대 옆 공 바구니와 매트
  root.add(box(1.2, 0.6, 0.8, '#7a8a99', 47.6, 0.3, -15.6), box(2.4, 0.3, 1.4, '#3d5a80', 34.4, 0.15, -15.6), box(2.4, 0.3, 1.4, '#c96f4f', 34.4, 0.45, -15.6));
  ['#e8b04f', '#c96f4f', '#ffffff', '#5f9e48'].forEach((c, i) => {
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 8), mat(c));
    ball.position.set(47.25 + (i % 2) * 0.4, 0.75, -15.8 + Math.floor(i / 2) * 0.35);
    root.add(ball);
  });
}

function buildStairs(root) {
  const stair = mat('#cfc6b8');
  for (let i = 0; i < 10; i++) root.add(box(3.6, 0.36 * (i + 1), 1.1, stair, 0, 0.18 * (i + 1), -4 - i * 1.1));
  const sign = signPlane('중앙 계단', 2, 0.45, { bg: '#6b6f76' });
  sign.position.set(0, 3.2, -2.84);
  root.add(sign);
}
