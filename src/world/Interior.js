import * as THREE from 'three';
import { v, mat, box, canvasTexture, signMaterial, signPlane, glowFrame, hotspot, tagAction, enableShadows, FONT } from './parts.js';

// 건물 1층 내부 (천장을 걷어낸 단면 모형). 입구로 들어서면 좌우로 긴 메인 복도가 펼쳐짐
//   복도 왼쪽: 교실 1·2 / 복도 오른쪽: 교무실 1·2 / 왼쪽 끝: 급식실 / 오른쪽 끝: 강당(층고 높음)
const H = 3.6;
const T = 0.3;
const BG = '#e9e3d9';

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
  scene.background = new THREE.Color(BG);
  scene.add(new THREE.HemisphereLight('#ffffff', '#b8a98f', 1.5));
  const sun = new THREE.DirectionalLight('#fff1dc', 1.6);
  sun.position.set(20, 45, 30);
  sun.target.position.set(2, 0, -3);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.02;
  Object.assign(sun.shadow.camera, { left: -62, right: 62, top: 62, bottom: -62, near: 1, far: 160 });
  scene.add(sun, sun.target);

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), new THREE.MeshStandardMaterial({ color: BG, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  ground.name = 'ground';
  scene.add(ground);

  const root = new THREE.Group();
  scene.add(root);

  buildFloors(root);
  buildWalls(root);
  buildCorridor(root);
  for (const r of ROOMS) (r.kind === 'classroom' ? buildClassroom : buildOffice)(root, r);
  buildCafeteria(root);
  buildAuditorium(root);
  buildStairs(root);
  enableShadows(root);

  const views = {
    corridor: { label: '메인 복도', button: 'corridor', stand: v(0, 0, 0), camera: v(0, 22, 30), target: v(0, 0, -4) },
    cafeteria: { label: '급식실', button: 'cafeteria', stand: v(-35, 0, 0), camera: v(-29, 13, 10), target: v(-43, 0.5, -3) },
    auditorium: { label: '강당', button: 'auditorium', stand: v(35.5, 0, 0), camera: v(34, 14, 12), target: v(46, 1.5, -3) },
  };
  for (const r of ROOMS) {
    const cx = cxOf(r);
    views[r.id] = { label: r.label, button: r.button, stand: v(cx, 0, -5.2), camera: v(cx, 8.5, -0.5), target: v(cx, 0.8, -10.5) };
  }

  // 걸을 수 있는 구역. 방 사이를 오갈 때는 문(outer: 복도 쪽, inner: 방 쪽)을 거쳐 감
  const zones = [
    { id: 'corridor', x: [-31.5, 31.5], z: [-2.3, 2.3], door: null },
    ...ROOMS.map((r) => ({
      id: r.id,
      x: [r.x[0] + 0.6, r.x[1] - 0.6],
      z: [ROOM_Z[0] + 0.6, ROOM_Z[1] - 0.6],
      door: { outer: v(cxOf(r), 0, -1.6), inner: v(cxOf(r), 0, -4.6) },
    })),
    { id: 'cafeteria', x: [CAFE.x[0] + 0.6, CAFE.x[1] - 0.6], z: [-12, CAFE.z[1] - 0.6], door: { outer: v(-30.6, 0, 0), inner: v(-33.8, 0, 0) } },
    { id: 'auditorium', x: [HALL.x[0] + 0.6, 48.6], z: [HALL.z[0] + 0.6, HALL.z[1] - 0.6], door: { outer: v(30.6, 0, 0), inner: v(34, 0, 0) } },
  ];

  return {
    scene,
    ground,
    root,
    zones,
    views,
    spawn: (spot) => v(EXITS[spot] ?? 0, 0, 1.4),
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
const GLASS = mat('#bcd8ea', { transparent: true, opacity: 0.28, roughness: 0.1, metalness: 0.2, depthWrite: false });

// a→b 직선 벽. gaps: { c: 시작점에서의 거리, w: 폭, h: 문 높이 }
function wall(parent, [x1, z1], [x2, z2], { h, gaps = [], glass = false }) {
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
      at(mid, e - s, 1, 0.5, T, WALL);
      const pane = at(mid, e - s, h - 1.15, 1 + (h - 1.15) / 2, 0.06, GLASS);
      pane.userData.noShadow = pane.userData.noPick = true;
    } else {
      at(mid, e - s, h, h / 2, T, WALL);
    }
  }
  for (const g of sorted) if (g.h < h) at(g.c, g.w, h - g.h, g.h + (h - g.h) / 2, T, WALL);
  if (glass) at(len / 2, len, 0.15, h - 0.075, T + 0.05, TRIM);
}

function buildWalls(root) {
  // 복도 남쪽: 유리창 + 출입구 3곳
  wall(root, [-32, 3], [32, 3], { h: H, glass: true, gaps: Object.values(EXITS).map((x) => ({ c: x + 32, w: 3, h: 2.8 })) });
  // 복도 북쪽: 교실·교무실 문 + 계단 입구
  wall(root, [-32, -3], [32, -3], { h: H, gaps: [...ROOMS.map((r) => ({ c: cxOf(r) + 32, w: 2.4, h: 2.6 })), { c: 32, w: 4, h: H }] });
  wall(root, [-32, -15], [32, -15], { h: H });
  for (const x of [-16, -2, 2, 16]) wall(root, [x, -15], [x, -3], { h: H });

  const { h: ch } = CAFE;
  wall(root, [-32, -15], [-32, 9], { h: ch, gaps: [{ c: 15, w: 3.6, h: 3 }] });
  wall(root, [-52, -15], [-32, -15], { h: ch });
  wall(root, [-52, -15], [-52, 9], { h: ch });
  wall(root, [-52, 9], [-32, 9], { h: ch, glass: true });

  const { h: hh } = HALL;
  wall(root, [32, -17], [32, 11], { h: hh, gaps: [{ c: 17, w: 3.6, h: 3 }] });
  wall(root, [32, -17], [56, -17], { h: hh });
  wall(root, [56, -17], [56, 11], { h: hh });
  wall(root, [32, 11], [56, 11], { h: hh, glass: true });
}

function buildCorridor(root) {
  // 방 문: 빛나는 테두리 + 문패 + 열려 있는 미닫이문 + 클릭 영역
  for (const r of ROOMS) {
    const cx = cxOf(r);
    const action = { type: 'room', id: r.id };
    const frame = glowFrame(2.4, 2.6);
    frame.position.set(cx, 0, -2.8);
    const plate = tagAction(signPlane(r.label, 2.2, 0.5, { bg: KIND_COLOR[r.kind] }), action);
    plate.position.set(cx, 3.08, -2.84);
    const hit = hotspot(2.8, 3.6, 1.2, action);
    hit.position.set(cx, 1.8, -3);
    root.add(frame, plate, hit, box(1.25, 2.5, 0.06, DOOR_COLOR[r.kind], cx + 1.25, 1.27, -3.25));
  }

  // 복도 양 끝: 급식실(왼쪽) · 강당(오른쪽)
  for (const [side, id, label] of [[-1, 'cafeteria', '급식실'], [1, 'auditorium', '강당']]) {
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
    const hanging = tagAction(signPlane(side < 0 ? '← 급식실' : '강당 →', 3.4, 0.7, { bg: '#2d2a26' }), action);
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

  // 사물함
  const doorXs = ROOMS.map(cxOf);
  const spots = [];
  for (let x = -31.2; x <= 31.2; x += 0.95) if (Math.abs(x) > 2.6 && doorXs.every((d) => Math.abs(x - d) > 1.9)) spots.push(x);
  const lockers = new THREE.InstancedMesh(new THREE.BoxGeometry(0.9, 1.8, 0.45), mat('#ffffff', { roughness: 0.6 }), spots.length);
  const palette = ['#9ec1d9', '#f2c4a0', '#b9d6a8', '#d7c3e6'].map((c) => new THREE.Color(c));
  const m = new THREE.Matrix4();
  spots.forEach((x, i) => {
    lockers.setMatrixAt(i, m.makeTranslation(x, 0.9, -2.6));
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

function buildClassroom(root, r) {
  const cx = cxOf(r);
  const board = new THREE.Mesh(new THREE.PlaneGeometry(6, 1.8), signMaterial(boardTexture(r.label, '오늘도 즐겁게 배워요'), 0.4));
  board.position.set(cx, 1.9, -14.71);
  board.userData.noShadow = true;
  root.add(box(6.4, 2.2, 0.1, '#8b6a45', cx, 1.9, -14.82), board, box(2.2, 0.9, 0.9, '#a0714a', cx - 4.5, 0.45, -12.8));

  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 4; col++) {
      const x = cx - 4.5 + col * 3;
      const z = -10.6 + row * 2.4;
      root.add(
        box(1.2, 0.08, 0.7, DESK, x, 0.78, z),
        box(1, 0.7, 0.55, STEEL, x, 0.37, z),
        box(0.55, 0.45, 0.55, CHAIR, x, 0.23, z + 0.75),
        box(0.55, 0.5, 0.06, CHAIR, x, 0.7, z + 1.03),
      );
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
  for (let i = 0; i < 5; i++) root.add(box(1.1, 1.9, 0.5, '#b9c0c8', cx - 4.4 + i * 2.2, 0.95, -14.55));
  const schedule = signPlane(`${r.label} · 이번 주 일정`, 5, 0.7, { bg: '#ffffff', fg: '#2f4a6d' });
  schedule.position.set(cx, 2.75, -14.83);
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.25, 0.5, 12), mat('#b5694a'));
  pot.position.set(cx + 5.6, 0.25, -4.4);
  const leaves = new THREE.Mesh(new THREE.IcosahedronGeometry(0.6, 0), mat('#7fae5b', { flatShading: true }));
  leaves.position.set(cx + 5.6, 1, -4.4);
  root.add(schedule, pot, leaves);
}

function buildCafeteria(root) {
  const steel = mat('#c9ced3', { metalness: 0.5, roughness: 0.4 });
  root.add(box(14, 1, 1.4, steel, -42, 0.5, -13.4));
  ['#e8b04f', '#c96f4f', '#7fae5b', '#f2e2c4', '#e8b04f', '#9ec1d9'].forEach((c, i) => root.add(box(1.6, 0.12, 0.9, c, -47.5 + i * 2.2, 1.06, -13.4)));
  const sign = signPlane('급식실', 6, 1.1, { bg: '#c96f4f', spaced: true });
  sign.position.set(-42, 3.3, -14.83);
  root.add(sign);

  const top = mat('#f3efe6');
  const leg = mat('#8d939b');
  const bench = mat('#e8a35a');
  for (const x of [-46.5, -37.5]) {
    for (const z of [-8.5, -4, 0.5, 5]) {
      root.add(box(7, 0.1, 1.3, top, x, 0.78, z), box(6, 0.7, 0.3, leg, x, 0.38, z));
      for (const s of [-1, 1]) root.add(box(7, 0.08, 0.4, bench, x, 0.48, z + s), box(6, 0.42, 0.1, leg, x, 0.22, z + s));
    }
  }
}

function buildAuditorium(root) {
  const wood = mat('#a8774a');
  root.add(
    box(7, 1.2, 22, wood, 52.5, 0.6, -3),
    box(1.2, 0.6, 6, wood, 48.4, 0.3, -3),
    box(0.3, 6.6, 24, '#a3283a', 55.7, 4.5, -3),
    box(0.4, 0.8, 26, '#7d1d2c', 55.5, 7.6, -3),
  );
  const banner = signPlane('영파여자고등학교 강당', 12, 1.3, { bg: '#1f2f45' });
  banner.position.set(55.35, 6.4, -3);
  banner.rotation.y = -Math.PI / 2;
  root.add(banner);

  // 높은 창
  for (let x = 35; x <= 53; x += 4.5) {
    const w = box(3, 1.8, 0.05, GLASS, x, 6, -16.82);
    w.userData.noShadow = w.userData.noPick = true;
    root.add(w);
  }

  // 무대를 바라보는 객석
  const seats = [];
  for (let x = 36; x <= 46; x += 1.5) for (let z = -14; z <= 8; z += 1.1) if (Math.abs(z + 3) > 1.2) seats.push([x, z]);
  const chairMat = mat('#3d5a80');
  const seat = new THREE.InstancedMesh(new THREE.BoxGeometry(0.55, 0.45, 0.55), chairMat, seats.length);
  const back = new THREE.InstancedMesh(new THREE.BoxGeometry(0.08, 0.55, 0.55), chairMat, seats.length);
  const m = new THREE.Matrix4();
  seats.forEach(([x, z], i) => {
    seat.setMatrixAt(i, m.makeTranslation(x, 0.23, z));
    back.setMatrixAt(i, m.makeTranslation(x - 0.27, 0.72, z));
  });
  root.add(seat, back);
}

function buildStairs(root) {
  const stair = mat('#cfc6b8');
  for (let i = 0; i < 10; i++) root.add(box(3.6, 0.36 * (i + 1), 1.1, stair, 0, 0.18 * (i + 1), -4 - i * 1.1));
  const sign = signPlane('중앙 계단', 2, 0.45, { bg: '#6b6f76' });
  sign.position.set(0, 3.2, -2.84);
  root.add(sign);
}
