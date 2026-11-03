import * as THREE from 'three';

const CLASS_Z = -20;

export const POI = {
  blackboard: {
    stand: new THREE.Vector3(0, 0, CLASS_Z - 3),
    camera: new THREE.Vector3(0, 3, CLASS_Z + 4.5),
    target: new THREE.Vector3(0, 2.6, CLASS_Z - 5),
  },
  tour: [
    { camera: new THREE.Vector3(14, 9, CLASS_Z + 14), target: new THREE.Vector3(0, 1, CLASS_Z) },
    { camera: new THREE.Vector3(7.5, 2.2, CLASS_Z + 4), target: new THREE.Vector3(-2, 1.2, CLASS_Z - 2) },
    { camera: new THREE.Vector3(-6, 2.5, CLASS_Z - 4), target: new THREE.Vector3(2, 1, CLASS_Z + 3) },
    { camera: new THREE.Vector3(0, 3, CLASS_Z + 6), target: new THREE.Vector3(0, 2.4, CLASS_Z - 5) },
    { camera: new THREE.Vector3(0, 16, CLASS_Z + 26), target: new THREE.Vector3(0, 4, CLASS_Z - 10) },
  ],
};

export function createSchool(scene) {
  const group = new THREE.Group();
  group.add(createMainBuilding(), createClassroom(), createFlag());
  group.traverse((o) => {
    if (o.isMesh) o.castShadow = o.receiveShadow = true;
  });
  scene.add(group);
  return group;
}

const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...extra });

function createMainBuilding() {
  const g = new THREE.Group();
  g.position.set(0, 0, -38);

  const body = new THREE.Mesh(new THREE.BoxGeometry(48, 12, 8), mat('#f4ead8'));
  body.position.y = 6;
  const roof = new THREE.Mesh(new THREE.BoxGeometry(49, 0.6, 9), mat('#7a8fa6'));
  roof.position.y = 12.3;
  const tower = new THREE.Mesh(new THREE.BoxGeometry(8, 16, 8.4), mat('#efe1c9'));
  tower.position.y = 8;
  const towerRoof = new THREE.Mesh(new THREE.ConeGeometry(6, 3.5, 4), mat('#5f7590'));
  towerRoof.position.y = 17.75;
  towerRoof.rotation.y = Math.PI / 4;

  const clock = new THREE.Mesh(new THREE.CircleGeometry(1.6, 32), mat('#ffffff', { emissive: '#fff4d6', emissiveIntensity: 0.3 }));
  clock.position.set(0, 13, 4.25);
  const hand = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.2, 0.05), mat('#333333'));
  hand.position.set(0, 13.4, 4.3);

  const winGeo = new THREE.PlaneGeometry(2.2, 2.4);
  const cols = [-21, -17, -13, -9, 9, 13, 17, 21];
  const rows = [3, 7.5];
  const windows = new THREE.InstancedMesh(winGeo, mat('#9fc8e8', { roughness: 0.2, metalness: 0.3, emissive: '#2a4a66', emissiveIntensity: 0.15 }), cols.length * rows.length);
  const m = new THREE.Matrix4();
  let i = 0;
  for (const y of rows) for (const x of cols) windows.setMatrixAt(i++, m.makeTranslation(x, y, 4.01));

  const door = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 4), mat('#6d4c3d'));
  door.position.set(0, 2, 4.22);

  g.add(body, roof, tower, towerRoof, clock, hand, windows, door);
  return g;
}

function createClassroom() {
  const g = new THREE.Group();
  g.position.set(0, 0, CLASS_Z);

  const floor = new THREE.Mesh(new THREE.BoxGeometry(16, 0.2, 12), mat('#b88a5a'));
  floor.position.y = 0.1;

  const back = new THREE.Mesh(new THREE.BoxGeometry(16, 4.6, 0.4), mat('#e9dcc3'));
  back.position.set(0, 2.3, -6);
  const sideGeo = new THREE.BoxGeometry(0.4, 1.2, 12);
  const left = new THREE.Mesh(sideGeo, mat('#e9dcc3'));
  left.position.set(-8, 0.6, 0);
  const right = left.clone();
  right.position.x = 8;

  const boardTex = createBoardTexture();
  const board = new THREE.Mesh(
    new THREE.PlaneGeometry(8, 3),
    new THREE.MeshStandardMaterial({ map: boardTex, emissiveMap: boardTex, emissive: '#ffffff', emissiveIntensity: 0.45, roughness: 0.9 }),
  );
  board.position.set(0, 2.6, -5.76);
  const frame = new THREE.Mesh(new THREE.BoxGeometry(8.4, 3.4, 0.1), mat('#8b6a45'));
  frame.position.set(0, 2.6, -5.79);
  frame.scale.z = 0.2;

  const teacherDesk = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1, 1), mat('#a0714a'));
  teacherDesk.position.set(-5.5, 0.7, -4);

  const deskGeo = new THREE.BoxGeometry(1.2, 0.08, 0.7);
  const legGeo = new THREE.BoxGeometry(1.1, 0.7, 0.6);
  const chairGeo = new THREE.BoxGeometry(0.6, 0.5, 0.6);
  const deskMat = mat('#d9a86c');
  const legMat = mat('#7a8a99');
  const chairMat = mat('#4f7f9e');
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 4; c++) {
      const x = -4.5 + c * 3;
      const z = -1 + r * 2.4;
      const top = new THREE.Mesh(deskGeo, deskMat);
      top.position.set(x, 0.95, z);
      const leg = new THREE.Mesh(legGeo, legMat);
      leg.position.set(x, 0.55, z);
      leg.scale.set(0.9, 1, 0.9);
      const chair = new THREE.Mesh(chairGeo, chairMat);
      chair.position.set(x, 0.45, z + 0.8);
      g.add(top, leg, chair);
    }
  }

  const pillarGeo = new THREE.CylinderGeometry(0.2, 0.2, 5, 8);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(17, 0.3, 13), mat('#7a8fa6', { transparent: true }));
  roof.position.y = 5.1;
  roof.name = 'classRoof';
  for (const [x, z] of [[-8, 6], [8, 6]]) {
    const p = new THREE.Mesh(pillarGeo, mat('#e9dcc3'));
    p.position.set(x, 2.6, z);
    g.add(p);
  }

  g.add(floor, back, left, right, frame, board, teacherDesk, roof);
  return g;
}

function createBoardTexture() {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 384;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#2f5d4a';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.font = 'bold 64px "Gowun Dodum", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('우리 학교에 오신 것을 환영합니다', 512, 130);
  ctx.font = '40px "Gowun Dodum", sans-serif';
  ctx.fillStyle = 'rgba(255,236,170,0.9)';
  ctx.fillText('오늘의 공지 · 함께 걷고, 함께 배우기', 512, 220);
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = '32px "Gowun Dodum", sans-serif';
  ctx.fillText(new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' }), 512, 300);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function createFlag() {
  const g = new THREE.Group();
  g.position.set(14, 0, -28);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 9, 8), mat('#d0d0d0', { metalness: 0.6 }));
  pole.position.y = 4.5;
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.5, 12, 4), mat('#ffffff', { side: THREE.DoubleSide }));
  flag.position.set(1.25, 8, 0);
  flag.name = 'flag';
  g.add(pole, flag);
  return g;
}

export function animateSchool(group, t, dt, avatarPos) {
  const roof = (group.userData.roof ??= group.getObjectByName('classRoof'));
  const inside = Math.abs(avatarPos.x) < 8.5 && Math.abs(avatarPos.z - CLASS_Z) < 7;
  roof.material.opacity = THREE.MathUtils.damp(roof.material.opacity, inside ? 0.15 : 1, 6, dt);
  roof.castShadow = roof.material.opacity > 0.9;

  const flag = (group.userData.flag ??= group.getObjectByName('flag'));
  const pos = flag.geometry.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) + 1.2;
    pos.setZ(i, Math.sin(x * 2 - t * 4) * 0.12 * x);
  }
  pos.needsUpdate = true;
}
