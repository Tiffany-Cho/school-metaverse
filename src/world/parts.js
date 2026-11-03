import * as THREE from 'three';

export const FONT = '"Gowun Dodum", sans-serif';

export const v = (x, y, z) => new THREE.Vector3(x, y, z);

export const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...extra });

export function box(w, h, d, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), typeof material === 'string' ? mat(material) : material);
  m.position.set(x, y, z);
  return m;
}

export function canvasTexture(width, height, draw) {
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  const ctx = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const paint = () => {
    ctx.clearRect(0, 0, width, height);
    draw(ctx, width, height);
    tex.needsUpdate = true;
  };
  paint();
  // 웹폰트가 늦게 로드되면 다시 그림
  document.fonts?.load(`64px ${FONT}`).then(paint, () => {});
  return tex;
}

export const signMaterial = (map, intensity = 0.35) =>
  new THREE.MeshStandardMaterial({ map, emissiveMap: map, emissive: '#ffffff', emissiveIntensity: intensity, roughness: 0.8 });

// 단색 바탕 + 가운데 글자 간판
export function signPlane(text, w, h, { bg = '#2f4a6d', fg = '#ffffff', px = 1024, spaced = false } = {}) {
  const ph = Math.round((px * h) / w);
  const tex = canvasTexture(px, ph, (ctx, cw, ch) => {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, cw, ch);
    ctx.fillStyle = fg;
    ctx.font = `bold ${Math.round(ch * 0.62)}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const label = spaced ? text.split('').join(' ') : text;
    const fit = Math.min(1, (cw * 0.9) / ctx.measureText(label).width);
    ctx.setTransform(fit, 0, 0, 1, cw / 2, ch / 2 + ch * 0.03);
    ctx.fillText(label, 0, 0);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), signMaterial(tex));
  mesh.userData.noShadow = true;
  return mesh;
}

// 클릭할 수 있는 문 테두리 — 은은하게 깜빡여 눈에 띄게 함
export const GLOW = mat('#ffd58a', { emissive: '#ffb347', emissiveIntensity: 0.5 });

export function pulseGlow(t) {
  GLOW.emissiveIntensity = 0.3 + 0.5 * (0.5 + 0.5 * Math.sin(t * 3));
}

// 문 둘레 빛나는 테두리 (로컬 +z 방향을 바라봄)
export function glowFrame(w, h) {
  const g = new THREE.Group();
  g.add(box(0.14, h, 0.25, GLOW, -w / 2, h / 2, 0), box(0.14, h, 0.25, GLOW, w / 2, h / 2, 0), box(w + 0.14, 0.14, 0.25, GLOW, 0, h, 0));
  return g;
}

// 보이지 않는 클릭 영역
const HOTSPOT = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false });

export function hotspot(w, h, d, action) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), HOTSPOT);
  m.userData.action = action;
  m.userData.noShadow = true;
  return m;
}

export function tagAction(object, action) {
  object.userData.action = action;
  return object;
}

export function findAction(object) {
  for (let o = object; o; o = o.parent) if (o.userData.action) return o.userData.action;
  return null;
}

export function enableShadows(root) {
  root.traverse((o) => {
    if (o.isMesh && !o.userData.noShadow) o.castShadow = o.receiveShadow = true;
  });
}
