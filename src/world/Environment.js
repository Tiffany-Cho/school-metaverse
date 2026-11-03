import * as THREE from 'three';

// 아바타가 걸을 수 있는 교내 마당 (건물 정면 앞 ~ 정문 안쪽)
export const WALK_ZONE = { x: [-24, 40.5], z: [-34, 21], door: null };

const PLAYGROUND = { x: 8, z: -10 };

export function createEnvironment(scene) {
  const skyTop = new THREE.Color('#7fb4e6');
  const skyBottom = new THREE.Color('#fbe3c8');

  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(400, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: { top: { value: skyTop }, bottom: { value: skyBottom } },
      vertexShader: `varying float h; void main(){ h = normalize(position).y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `uniform vec3 top; uniform vec3 bottom; varying float h; void main(){ gl_FragColor = vec4(mix(bottom, top, smoothstep(-0.05, 0.45, h)), 1.0); }`,
    }),
  );
  scene.add(sky);
  scene.fog = new THREE.Fog(skyBottom, 130, 340);

  scene.add(new THREE.HemisphereLight('#cfe6ff', '#8a7a5a', 1.1));

  // 정면(+z)과 운동장 쪽(+x) 입면이 밝게 보이도록 앞-오른쪽 위에서 비춤
  const sun = new THREE.DirectionalLight('#ffe2b8', 2.4);
  sun.target.position.set(0, 0, -15);
  sun.position.set(40, 60, 30);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.02;
  Object.assign(sun.shadow.camera, { left: -70, right: 70, top: 70, bottom: -70, near: 1, far: 220 });
  scene.add(sun, sun.target);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(800, 800),
    new THREE.MeshStandardMaterial({ color: '#93b46c', roughness: 1 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  ground.name = 'ground';
  scene.add(ground);

  scene.add(
    flat(92, 80, '#d6cfc2', 0, -16, 0.01), // 교내 포장 마당
    flat(62, 54, '#d9b98c', PLAYGROUND.x, PLAYGROUND.z + 2, 0.02), // 운동장 흙바닥
    flat(140, 1.8, '#cfc8bb', 0, 25.3, 0.01), // 보도
    flat(140, 8, '#55585d', 0, 30.2, 0.01), // 학교 앞 도로
    flat(14, 6, '#cfc8bb', 6, 27, 0.015), // 정문 진입로
  );
  scene.add(createTrack(), createFieldLines(), createRoadLines(), createTrees());

  return { ground, sun };
}

function flat(w, d, color, x, z, y) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({ color, roughness: 1 }));
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, y, z);
  m.receiveShadow = true;
  return m;
}

function createTrack() {
  const shape = new THREE.Shape();
  const inner = new THREE.Path();
  roundedRect(shape, 24, 14, 12);
  roundedRect(inner, 20, 10, 8);
  shape.holes.push(inner);

  const track = new THREE.Mesh(
    new THREE.ShapeGeometry(shape, 24),
    new THREE.MeshStandardMaterial({ color: '#c96f4f', roughness: 0.95 }),
  );
  track.rotation.x = -Math.PI / 2;
  track.position.set(PLAYGROUND.x, 0.03, PLAYGROUND.z);
  track.receiveShadow = true;
  return track;
}

function createFieldLines() {
  const lineMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.7, depthWrite: false });
  const g = new THREE.Group();
  const mid = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 18), lineMat);
  const circle = new THREE.Mesh(new THREE.RingGeometry(2.9, 3.05, 48), lineMat);
  for (const m of [mid, circle]) {
    m.rotation.x = -Math.PI / 2;
    g.add(m);
  }
  g.position.set(PLAYGROUND.x, 0.035, PLAYGROUND.z);
  return g;
}

function createRoadLines() {
  const COUNT = 24;
  const dashes = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(2.4, 0.18).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: '#f2d27a' }),
    COUNT,
  );
  const m = new THREE.Matrix4();
  for (let i = 0; i < COUNT; i++) dashes.setMatrixAt(i, m.makeTranslation(-69 + i * 6, 0.02, 30.2));
  return dashes;
}

function roundedRect(path, hw, hh, r) {
  path.moveTo(-hw + r, -hh);
  path.lineTo(hw - r, -hh);
  path.quadraticCurveTo(hw, -hh, hw, -hh + r);
  path.lineTo(hw, hh - r);
  path.quadraticCurveTo(hw, hh, hw - r, hh);
  path.lineTo(-hw + r, hh);
  path.quadraticCurveTo(-hw, hh, -hw, hh - r);
  path.lineTo(-hw, -hh + r);
  path.quadraticCurveTo(-hw, -hh, -hw + r, -hh);
}

// 담장을 따라 심은 나무 (정문 앞은 비움)
function treeSpots() {
  const spots = [];
  for (let x = -40; x <= 42; x += 6) if (Math.abs(x - 6) > 9) spots.push([x, 22.4]);
  for (let z = -50; z <= 16; z += 6) spots.push([43.4, z]);
  for (let x = -42; x <= 42; x += 7) spots.push([x, -52.6]);
  for (let z = -50; z <= 18; z += 7) spots.push([-42.4, z]);
  for (let x = -66; x <= 72; x += 9) if (Math.abs(x - 6) > 10) spots.push([x, 36.5]);
  return spots;
}

function createTrees() {
  const spots = treeSpots();
  const COUNT = spots.length;
  const trunkGeo = new THREE.CylinderGeometry(0.25, 0.35, 2, 6);
  const leafGeo = new THREE.IcosahedronGeometry(1.8, 0);
  const trunks = new THREE.InstancedMesh(trunkGeo, new THREE.MeshStandardMaterial({ color: '#6b4a32' }), COUNT);
  const leaves = new THREE.InstancedMesh(leafGeo, new THREE.MeshStandardMaterial({ color: '#ffffff', flatShading: true }), COUNT);
  trunks.castShadow = leaves.castShadow = true;

  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const p = new THREE.Vector3();
  const palette = ['#f2a7b5', '#f7c6cf', '#7fae5b', '#9cc46f', '#e8b04f'].map((c) => new THREE.Color(c));

  spots.forEach(([x, z], i) => {
    const k = 0.8 + Math.random() * 0.5;
    p.set(x, k, z);
    m.compose(p, q, s.set(k, k, k));
    trunks.setMatrixAt(i, m);
    p.y = 2.4 * k;
    m.compose(p, q, s.set(k, k * 1.1, k));
    leaves.setMatrixAt(i, m);
    leaves.setColorAt(i, palette[i % palette.length]);
  });

  const group = new THREE.Group();
  group.add(trunks, leaves);
  return group;
}
