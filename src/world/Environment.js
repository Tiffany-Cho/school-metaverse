import * as THREE from 'three';

export const GROUND_SIZE = 120;
export const WALK_LIMIT = 40;

export function createEnvironment(scene) {
  const skyTop = new THREE.Color('#7fb4e6');
  const skyBottom = new THREE.Color('#fbe3c8');

  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(220, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: { top: { value: skyTop }, bottom: { value: skyBottom } },
      vertexShader: `varying float h; void main(){ h = normalize(position).y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `uniform vec3 top; uniform vec3 bottom; varying float h; void main(){ gl_FragColor = vec4(mix(bottom, top, smoothstep(-0.05, 0.45, h)), 1.0); }`,
    }),
  );
  scene.add(sky);
  scene.fog = new THREE.Fog(skyBottom, 60, 160);

  scene.add(new THREE.HemisphereLight('#cfe6ff', '#8a7a5a', 1.1));

  const sun = new THREE.DirectionalLight('#ffe2b8', 2.4);
  sun.position.set(-30, 40, 20);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.02;
  Object.assign(sun.shadow.camera, { left: -50, right: 50, top: 50, bottom: -50, near: 1, far: 120 });
  scene.add(sun);

  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(GROUND_SIZE, 64),
    new THREE.MeshStandardMaterial({ color: '#d9b98c', roughness: 1 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  ground.name = 'ground';
  scene.add(ground);

  const grass = new THREE.Mesh(
    new THREE.RingGeometry(WALK_LIMIT + 4, GROUND_SIZE, 64),
    new THREE.MeshStandardMaterial({ color: '#8fb36a', roughness: 1 }),
  );
  grass.rotation.x = -Math.PI / 2;
  grass.position.y = 0.01;
  grass.receiveShadow = true;
  scene.add(grass);

  scene.add(createTrack());

  const grid = new THREE.GridHelper(WALK_LIMIT * 2, 40, '#ffffff', '#ffffff');
  grid.material.transparent = true;
  grid.material.opacity = 0.08;
  grid.position.y = 0.02;
  scene.add(grid);

  scene.add(createTrees());

  return { ground, sun };
}

function createTrack() {
  const shape = new THREE.Shape();
  const inner = new THREE.Path();
  roundedRect(shape, 34, 20, 10);
  roundedRect(inner, 28, 14, 7);
  shape.holes.push(inner);

  const track = new THREE.Mesh(
    new THREE.ShapeGeometry(shape, 24),
    new THREE.MeshStandardMaterial({ color: '#c96f4f', roughness: 0.95 }),
  );
  track.rotation.x = -Math.PI / 2;
  track.position.set(0, 0.015, 8);
  track.receiveShadow = true;
  return track;
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

function createTrees() {
  const COUNT = 46;
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

  for (let i = 0; i < COUNT; i++) {
    const a = (i / COUNT) * Math.PI * 2 + Math.random() * 0.1;
    const r = WALK_LIMIT + 6 + Math.random() * 10;
    const k = 0.8 + Math.random() * 0.6;
    p.set(Math.cos(a) * r, k, Math.sin(a) * r);
    m.compose(p, q, s.set(k, k, k));
    trunks.setMatrixAt(i, m);
    p.y = 2.4 * k;
    m.compose(p, q, s.set(k, k * 1.1, k));
    leaves.setMatrixAt(i, m);
    leaves.setColorAt(i, palette[i % palette.length]);
  }

  const group = new THREE.Group();
  group.add(trunks, leaves);
  return group;
}
