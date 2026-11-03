import * as THREE from 'three';
import { v, mat, box, canvasTexture, signMaterial, signPlane, glowFrame, hotspot, enableShadows } from './parts.js';

const FLOOR_H = 3.6;
const FLOORS = 5;
const HEIGHT = FLOOR_H * FLOORS;
const DEPTH = 12;

// 정문에서 바라본 배치: 왼쪽에 앞뒤로 긴 동암관(ㅣ), 안쪽에 좌우로 긴 영파관(ㅡ) → ┌ 모양.
// 두 동은 6m 떨어져 있고 2~3층 높이의 구름다리로 이어짐
export const LAYOUT = {
  yeongpa: { x: 9, z: -42, length: 58 }, // x -20 ~ 38
  dongam: { x: -32, z: -18, length: 44 }, // z -40 ~ 4
  bridge: { x1: -26, x2: -20, z: -38 },
  gate: { x: 6, z: 24 },
  board: { x: 20, z: -30 },
};

export const POI = {
  start: v(6, 0, -1),
  overview: { camera: v(50, 58, 62), target: v(2, 0, -14) },
  gate: {
    stand: v(6, 0, 20),
    camera: v(6, 7, 38),
    target: v(6, 4.5, 24),
  },
  tour: [
    { camera: v(50, 58, 62), target: v(2, 0, -14) },
    { camera: v(6, 7, 38), target: v(6, 4.5, 24) },
    { camera: v(13, 14, -12), target: v(9, 8, -40) },
    { camera: v(-2, 14, -4), target: v(-32, 8, -18) },
    { camera: v(-6, 12, -22), target: v(-23, 7, -38) },
    { camera: v(6, 95, 20), target: v(2, 0, -12) },
  ],
};

export function createSchool(scene) {
  const group = new THREE.Group();

  const yHalf = LAYOUT.yeongpa.length / 2;
  const yeongpa = createWing({
    name: '영파관',
    length: LAYOUT.yeongpa.length,
    color: '#f1ebe2',
    accent: '#2f4a6d',
    entrances: [
      { x: -yHalf + 4, spot: 'left' },
      { x: 0, spot: 'mid' },
      { x: yHalf - 4, spot: 'right' },
    ],
    signs: [{ x: 0 }],
  });
  yeongpa.position.set(LAYOUT.yeongpa.x, 0, LAYOUT.yeongpa.z);

  // 로컬 +z(정면)가 월드 +x(운동장 쪽)를 보도록 회전. 로컬 x → 월드 -z
  const dHalf = LAYOUT.dongam.length / 2;
  const bridgeLocalX = LAYOUT.dongam.z - LAYOUT.bridge.z;
  const dongam = createWing({
    name: '동암관',
    length: LAYOUT.dongam.length,
    color: '#e3dbcf',
    accent: '#56705f',
    entrances: [
      { x: -dHalf + 4, spot: 'left' },
      { x: 0, spot: 'mid' },
      { x: dHalf - 8, spot: 'right' },
    ],
    signs: [{ x: -6 }, { end: true }],
    // 구름다리가 붙는 2~3층 창은 비움
    skipWindow: (x, f) => (f === 1 || f === 2) && Math.abs(x - bridgeLocalX) < 2.6,
  });
  dongam.position.set(LAYOUT.dongam.x, 0, LAYOUT.dongam.z);
  dongam.rotation.y = Math.PI / 2;

  group.add(yeongpa, dongam, createBridge(), createGate(), createWalls(), createNoticeBoard(), createFlag(), createGoals());
  enableShadows(group);
  scene.add(group);

  // 출입구 6곳의 월드 좌표와 바깥쪽 방향
  group.updateMatrixWorld(true);
  group.userData.entrances = {};
  for (const wing of [yeongpa, dongam]) {
    for (const e of wing.userData.entrances) {
      const key = `${wing.name}:${e.spot}`;
      group.userData.entrances[key] = {
        key,
        building: wing.name,
        spot: e.spot,
        door: wing.localToWorld(e.door.clone()),
        normal: v(0, 0, 1).transformDirection(wing.matrixWorld),
      };
    }
  }
  return group;
}

const glassMat = (intensity = 0.15) =>
  mat('#8fb4cf', { roughness: 0.15, metalness: 0.35, emissive: '#2a4a66', emissiveIntensity: intensity });

function createWing({ name, length, color, accent, entrances, signs, skipWindow = () => false }) {
  const g = new THREE.Group();
  const half = length / 2;
  const hd = DEPTH / 2;

  g.add(
    box(length, HEIGHT, DEPTH, color, 0, HEIGHT / 2, 0),
    box(length + 0.3, 0.6, DEPTH + 0.3, '#9c958a', 0, 0.3, 0),
    box(length + 0.4, 1.4, DEPTH + 0.4, '#d6cfc3', 0, HEIGHT + 0.7, 0),
    box(length + 0.6, 0.15, DEPTH + 0.6, '#6f6a63', 0, HEIGHT + 1.47, 0),
  );

  // 층간 구분 띠
  const bandMat = mat('#bdb6aa');
  for (let f = 1; f < FLOORS; f++) g.add(box(length + 0.5, 0.3, DEPTH + 0.5, bandMat, 0, f * FLOOR_H, 0));

  // 옥상 설비
  const roofMat = mat('#a9a39a');
  g.add(box(4, 1.6, 3, roofMat, -half * 0.55, HEIGHT + 1.6, -1.5), box(3, 1.2, 2.4, roofMat, half * 0.45, HEIGHT + 1.4, 1));

  // 출입구 3곳: 양 끝 2개 + 가운데 1개(유리 커튼월 강조)
  g.userData.entrances = [];
  for (const { x, spot } of entrances) {
    const action = { type: 'enter', key: `${name}:${spot}` };
    const doorZ = spot === 'mid' ? hd + 0.6 : hd + 0.15;
    if (spot === 'mid') {
      g.add(
        box(5, HEIGHT - 0.6, 0.5, glassMat(0.3), x, (HEIGHT - 0.6) / 2 + 0.6, hd + 0.25),
        box(0.45, HEIGHT + 1.4, 0.9, accent, x - 2.7, (HEIGHT + 1.4) / 2, hd + 0.45),
        box(0.45, HEIGHT + 1.4, 0.9, accent, x + 2.7, (HEIGHT + 1.4) / 2, hd + 0.45),
        box(7, 0.35, 3, accent, x, 3.62, hd + 1.5),
      );
    } else {
      g.add(box(4.8, 0.3, 2.4, accent, x, 3.62, hd + 1.2));
    }
    const frame = glowFrame(3.4, 2.9);
    frame.position.set(x, 0.55, doorZ + 0.05);
    const hit = hotspot(5, 4.2, 3.4, action);
    hit.position.set(x, 2.1, hd + 1.2);
    g.add(box(3.2, 2.8, 0.2, '#3b4554', x, 2, doorZ), frame, box(5, 0.15, 2.6, '#b5ada0', x, 0.08, hd + 1.3), hit);
    g.userData.entrances.push({ spot, door: v(x, 0, doorZ) });
  }
  const mid = entrances.find((e) => e.spot === 'mid').x;
  const ends = entrances.filter((e) => e.spot !== 'mid').map((e) => e.x);

  // 창문 (앞·뒤 입면)
  const slots = [];
  for (let x = -half + 2.6; x <= half - 2.6; x += 3.2) {
    for (let f = 0; f < FLOORS; f++) {
      const y = f * FLOOR_H + 1.95;
      const blocked =
        Math.abs(x - mid) < 4.4 || (f === 0 && ends.some((e) => Math.abs(x - e) < 2.8)) || skipWindow(x, f);
      if (!blocked) slots.push([x, y, hd + 0.02, 0]);
      slots.push([x, y, -hd - 0.02, Math.PI]);
    }
  }
  const windows = new THREE.InstancedMesh(new THREE.PlaneGeometry(2.3, 1.8), glassMat(), slots.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = v(0, 1, 0);
  const one = v(1, 1, 1);
  slots.forEach(([x, y, z, ry], i) => windows.setMatrixAt(i, m.compose(v(x, y, z), q.setFromAxisAngle(up, ry), one)));
  windows.userData.noShadow = true;
  g.add(windows);

  // 건물 이름 간판 (옥상 난간)
  for (const s of signs) {
    const sign = signPlane(name, 8, 1.2, { bg: accent, spaced: true });
    if (s.end) {
      sign.position.set(-half - 0.22, HEIGHT + 0.7, 0);
      sign.rotation.y = -Math.PI / 2;
    } else {
      sign.position.set(s.x, HEIGHT + 0.7, hd + 0.22);
    }
    g.add(sign);
  }

  g.name = name;
  return g;
}

// 동암관 정면과 영파관 서쪽 끝을 잇는 2~3층 구름다리
function createBridge() {
  const { x1, x2, z } = LAYOUT.bridge;
  const len = x2 - x1;
  const g = new THREE.Group();
  g.position.set((x1 + x2) / 2, 0, z);
  const frameMat = mat('#2f4a6d');
  const glass = mat('#a9cbe2', { roughness: 0.1, metalness: 0.3, transparent: true, opacity: 0.55, emissive: '#2a4a66', emissiveIntensity: 0.2 });
  g.add(
    box(len, 7.2, 3.4, glass, 0, FLOOR_H * 2, 0),
    box(len + 0.2, 0.45, 3.8, '#d6cfc3', 0, FLOOR_H, 0),
    box(len + 0.2, 0.3, 3.7, '#bdb6aa', 0, FLOOR_H * 2, 0),
    box(len + 0.2, 0.5, 4, frameMat, 0, FLOOR_H * 3, 0),
  );
  for (const dx of [-len / 2 + 1, 0, len / 2 - 1]) {
    for (const dz of [-1.75, 1.75]) g.add(box(0.18, 7.2, 0.18, frameMat, dx, FLOOR_H * 2, dz));
  }
  // 다리 아래 받침 기둥
  for (const dz of [-1.4, 1.4]) g.add(box(0.5, FLOOR_H - 0.2, 0.5, '#9c958a', 0, (FLOOR_H - 0.2) / 2, dz));
  return g;
}

function createGate() {
  const g = new THREE.Group();
  g.position.set(LAYOUT.gate.x, 0, LAYOUT.gate.z);
  const stone = mat('#8f8a83');
  g.add(
    box(1.4, 6.2, 1.4, stone, -6.5, 3.1, 0),
    box(1.4, 6.2, 1.4, stone, 6.5, 3.1, 0),
    box(14.6, 1.9, 1.0, '#2f4a6d', 0, 6.6, 0),
    box(15, 0.2, 1.3, '#1f2f45', 0, 7.65, 0),
  );
  for (const side of [1, -1]) {
    const sign = signPlane('영파여자고등학교', 13.6, 1.6, { px: 1536, spaced: true });
    sign.position.set(0, 6.6, side * 0.51);
    if (side < 0) sign.rotation.y = Math.PI;
    g.add(sign);
  }
  return g;
}

// 학교 둘레 담장 + 철제 난간 (정문 자리는 비움)
function createWalls() {
  const g = new THREE.Group();
  const gx = LAYOUT.gate.x;
  const gz = LAYOUT.gate.z;
  const runs = [
    [-46, gz, gx - 7.2, gz],
    [gx + 7.2, gz, 46, gz],
    [46, gz, 46, -56],
    [46, -56, -46, -56],
    [-46, -56, -46, gz],
  ];
  const wallMat = mat('#c4bcae');
  const capMat = mat('#9c958a');
  const barPos = [];
  for (const [x1, z1, x2, z2] of runs) {
    const len = Math.hypot(x2 - x1, z2 - z1);
    const ry = Math.atan2(-(z2 - z1), x2 - x1);
    const cx = (x1 + x2) / 2;
    const cz = (z1 + z2) / 2;
    for (const [mesh, y] of [
      [box(len, 1, 0.4, wallMat), 0.5],
      [box(len + 0.2, 0.12, 0.6, capMat), 1.06],
      [box(len, 0.08, 0.08, '#4b5563'), 2.3],
    ]) {
      mesh.position.set(cx, y, cz);
      mesh.rotation.y = ry;
      g.add(mesh);
    }
    for (let d = 0.4; d < len; d += 0.8) barPos.push([x1 + ((x2 - x1) * d) / len, z1 + ((z2 - z1) * d) / len]);
  }
  const bars = new THREE.InstancedMesh(new THREE.BoxGeometry(0.06, 1.2, 0.06), mat('#4b5563'), barPos.length);
  const m = new THREE.Matrix4();
  barPos.forEach(([x, z], i) => bars.setMatrixAt(i, m.makeTranslation(x, 1.7, z)));
  g.add(bars);
  return g;
}

function createNoticeBoard() {
  const g = new THREE.Group();
  g.position.set(LAYOUT.board.x, 0, LAYOUT.board.z);
  const post = new THREE.CylinderGeometry(0.1, 0.1, 4.2, 8);
  const postMat = mat('#6b6f76', { metalness: 0.4 });
  for (const x of [-3.1, 3.1]) {
    const p = new THREE.Mesh(post, postMat);
    p.position.set(x, 2.1, -0.1);
    g.add(p);
  }
  g.add(box(6.4, 3.2, 0.2, '#8b6a45', 0, 2.6, -0.1));

  const tex = canvasTexture(1024, 480, (ctx, w) => {
    ctx.fillStyle = '#2f5d4a';
    ctx.fillRect(0, 0, w, 480);
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.font = 'bold 66px "Gowun Dodum", sans-serif';
    ctx.fillText('영파여고에 오신 것을 환영합니다', w / 2, 160);
    ctx.font = '42px "Gowun Dodum", sans-serif';
    ctx.fillStyle = 'rgba(255,236,170,0.9)';
    ctx.fillText('빛나는 출입구를 누르면 건물 안으로 들어가요', w / 2, 270);
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = '34px "Gowun Dodum", sans-serif';
    ctx.fillText(new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' }), w / 2, 370);
  });
  const board = new THREE.Mesh(new THREE.PlaneGeometry(6, 2.8), signMaterial(tex, 0.45));
  board.position.set(0, 2.6, 0.01);
  board.userData.noShadow = true;
  g.add(board);
  return g;
}

function createFlag() {
  const g = new THREE.Group();
  g.position.set(-19, 0, -25);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 11, 8), mat('#d0d0d0', { metalness: 0.6 }));
  pole.position.y = 5.5;
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.5, 12, 4), mat('#ffffff', { side: THREE.DoubleSide }));
  flag.position.set(1.25, 10, 0);
  flag.name = 'flag';
  g.add(pole, flag);
  return g;
}

function createGoals() {
  const g = new THREE.Group();
  const white = mat('#f5f5f5');
  const net = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.25, side: THREE.DoubleSide, depthWrite: false });
  for (const side of [-1, 1]) {
    const goal = new THREE.Group();
    goal.position.set(8 + side * 17.5, 0, -10);
    goal.rotation.y = side > 0 ? 0 : Math.PI;
    goal.add(
      box(0.12, 2.2, 0.12, white, 0, 1.1, -3),
      box(0.12, 2.2, 0.12, white, 0, 1.1, 3),
      box(0.12, 0.12, 6.1, white, 0, 2.2, 0),
    );
    const back = new THREE.Mesh(new THREE.PlaneGeometry(6, 2.2), net);
    back.position.set(1.2, 1.1, 0);
    back.rotation.y = Math.PI / 2;
    back.userData.noShadow = true;
    goal.add(back);
    g.add(goal);
  }
  return g;
}

export function animateSchool(group, t) {
  const flag = (group.userData.flag ??= group.getObjectByName('flag'));
  const pos = flag.geometry.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) + 1.2;
    pos.setZ(i, Math.sin(x * 2 - t * 4) * 0.12 * x);
  }
  pos.needsUpdate = true;
}
