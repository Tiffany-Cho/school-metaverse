import * as THREE from 'three';
import gsap from 'gsap';
import { canvasTexture } from '../world/parts.js';
import { PARTS, normalizeOutfit } from './Wardrobe.js';

const TORSO_Y = 1.17;
const TORSO_LEN = 0.36;
const NECK_Y = TORSO_Y + TORSO_LEN / 2; // 몸통 위쪽 반구의 중심
// 안쪽 → 바깥쪽으로 갈수록 커지는 반지름. 겉옷이 항상 제일 바깥에 보이게 함
const R = { inner: 0.34, mid: 0.356, outer: 0.374 };

const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.75, ...extra });

function mesh(geo, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  return m;
}

// 몸통 앞면의 z (높이 y에서 반지름 r인 캡슐 표면)
function frontZ(r, y) {
  const dy = Math.max(0, y - NECK_Y);
  return Math.sqrt(Math.max(r * r - dy * dy, 0.0001));
}

function vShape(w, h) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, 0);
  s.lineTo(w / 2, 0);
  s.lineTo(0, -h);
  s.closePath();
  return new THREE.ShapeGeometry(s);
}

function plaidTexture() {
  const tex = canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#6f6a70';
    ctx.fillRect(0, 0, w, h);
    for (const o of [0, 128]) {
      ctx.fillStyle = 'rgba(52,48,58,0.5)';
      ctx.fillRect(o + 20, 0, 42, h);
      ctx.fillRect(0, o + 20, w, 42);
      ctx.fillStyle = '#c8673e';
      ctx.fillRect(o + 92, 0, 5, h);
      ctx.fillRect(0, o + 92, w, 5);
      ctx.fillStyle = '#a8343a';
      ctx.fillRect(o + 74, 0, 2, h);
      ctx.fillRect(0, o + 74, w, 2);
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.fillRect(o + 8, 0, 2, h);
      ctx.fillRect(0, o + 8, w, 2);
    }
  });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 1.4);
  return tex;
}

function tieTexture(base) {
  return canvasTexture(64, 256, (ctx, w, h) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, w, h);
    ctx.save();
    ctx.rotate(-0.6);
    for (let y = -200; y < 400; y += 38) {
      ctx.fillStyle = '#9aa0ad';
      ctx.fillRect(-200, y, 600, 6);
      ctx.fillStyle = '#2b2f45';
      ctx.fillRect(-200, y + 10, 600, 2);
    }
    ctx.restore();
  });
}

function crestTexture() {
  return canvasTexture(128, 128, (ctx) => {
    ctx.beginPath();
    ctx.arc(64, 58, 54, 0, Math.PI * 2);
    ctx.fillStyle = '#c9a14a';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(64, 58, 40, 0, Math.PI * 2);
    ctx.fillStyle = '#2f5d4a';
    ctx.fill();
    ctx.fillStyle = '#9fd17a';
    ctx.beginPath();
    ctx.ellipse(54, 56, 12, 6, -0.6, 0, Math.PI * 2);
    ctx.ellipse(74, 52, 12, 6, 0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(62, 56, 4, 22);
    ctx.fillStyle = '#a3283a';
    ctx.fillRect(18, 100, 92, 18);
  });
}

function lettersTexture(text) {
  return canvasTexture(256, 256, (ctx, w, h) => {
    ctx.font = 'bold 150px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 16;
    ctx.strokeStyle = '#ffffff';
    ctx.strokeText(text, w / 2, h / 2);
    ctx.lineWidth = 8;
    ctx.strokeStyle = '#1f3a2c';
    ctx.strokeText(text, w / 2, h / 2);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(text, w / 2, h / 2);
  });
}

export class Avatar {
  constructor(scene, outfit) {
    this.root = new THREE.Group();
    this.body = new THREE.Group();
    this.root.add(this.body);

    this.mats = {
      skin: std('#ffdcc0', { roughness: 0.65 }),
      dark: std('#2b2b2b'),
      white: std('#f7f7f5'),
      pink: std('#eba3bd'),
      metal: std('#c8ccd2', { metalness: 0.7, roughness: 0.3 }),
      hair: std('#6a3f27', { roughness: 0.55, side: THREE.DoubleSide }),
      inner: std('#ffffff'),
      collar: std('#ffffff'),
      mid: std('#333333'),
      outer: std('#333333'),
      outerSleeve: std('#333333'),
      rib: std('#1f3a2c'),
      panel0: std('#ffffff', { side: THREE.DoubleSide }),
      panel1: std('#ffffff', { side: THREE.DoubleSide }),
      piping: std('#ffffff'),
      pants: std('#38373d'),
      legwear: std('#3b2b25'),
      shoe: std('#4a2a1e', { roughness: 0.35 }),
      sole: std('#cfcfcf'),
    };

    this.#buildHead();
    this.#buildTorso();
    this.armL = this.#buildArm(-1);
    this.armR = this.#buildArm(1);
    this.#buildLower();

    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.6, 24),
      new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.18, depthWrite: false }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.03;
    this.root.add(shadow);

    this.root.traverse((o) => {
      if (o.isMesh && o !== shadow) o.castShadow = true;
    });

    this.walking = false;
    this.busy = false;
    this.walkPhase = 0;
    this.applyOutfit(outfit);
    scene.add(this.root);
  }

  #buildHead() {
    const M = this.mats;
    const head = mesh(new THREE.SphereGeometry(0.42, 32, 20), M.skin, 0, 1.85, 0);
    const eyeGeo = new THREE.SphereGeometry(0.05, 12, 10);
    const eyeL = mesh(eyeGeo, M.dark, -0.14, 1.86, 0.385);
    const eyeR = mesh(eyeGeo, M.dark, 0.14, 1.86, 0.385);
    eyeL.scale.y = eyeR.scale.y = 1.3;
    const blushMat = new THREE.MeshBasicMaterial({ color: '#f4a0a8', transparent: true, opacity: 0.45, depthWrite: false });
    const blushL = mesh(new THREE.CircleGeometry(0.055, 16), blushMat, -0.24, 1.76, 0.345);
    const blushR = blushL.clone();
    blushR.position.x = 0.24;
    blushL.rotation.y = -0.6;
    blushR.rotation.y = 0.6;
    blushL.userData.noShadow = blushR.userData.noShadow = true;
    const mouth = mesh(new THREE.TorusGeometry(0.045, 0.011, 6, 12, Math.PI), std('#c75b6b'), 0, 1.74, 0.405);
    mouth.rotation.z = Math.PI;
    this.body.add(head, eyeL, eyeR, blushL, blushR, mouth);

    const h = M.hair;
    const cap = mesh(new THREE.SphereGeometry(0.445, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.5), h, 0, 1.9, 0);
    cap.rotation.x = -0.28;
    // 뒤통수~옆머리를 감싸는 껍질 (얼굴 쪽은 비움)
    const shell = mesh(new THREE.SphereGeometry(0.465, 32, 16, Math.PI * 0.85, Math.PI * 1.3, 0, Math.PI * 0.62), h, 0, 1.84, 0);
    const back = mesh(new THREE.CapsuleGeometry(0.34, 0.55, 6, 16), h, 0, 1.42, -0.17);
    back.scale.set(1.25, 1, 0.62);
    const lockGeo = new THREE.CapsuleGeometry(0.085, 0.5, 4, 10);
    const lockL = mesh(lockGeo, h, -0.38, 1.5, 0.1);
    const lockR = mesh(lockGeo, h, 0.38, 1.5, 0.1);
    const bangs = mesh(new THREE.SphereGeometry(0.455, 32, 8, Math.PI * 0.18, Math.PI * 0.64, Math.PI * 0.06, Math.PI * 0.29), h, 0, 1.85, 0);
    const tailTop = mesh(new THREE.SphereGeometry(0.15, 16, 12), h, 0, 1.98, -0.42);
    const tail = mesh(new THREE.CapsuleGeometry(0.1, 0.5, 4, 10), h, 0, 1.62, -0.5);
    tail.rotation.x = 0.15;
    this.hairParts = { cap, shell, back, lockL, lockR, bangs, tailTop, tail };
    this.body.add(...Object.values(this.hairParts));

    const ring = new THREE.TorusGeometry(0.085, 0.012, 8, 28);
    this.glasses = new THREE.Group();
    this.glasses.add(mesh(ring, M.metal, -0.15, 1.86, 0.41), mesh(ring, M.metal, 0.15, 1.86, 0.41), mesh(new THREE.BoxGeometry(0.1, 0.015, 0.015), M.metal, 0, 1.88, 0.42));
    this.body.add(this.glasses);
  }

  #buildTorso() {
    const M = this.mats;
    const torso = (r) => new THREE.CapsuleGeometry(r, TORSO_LEN, 8, 24);
    this.layers = {
      inner: mesh(torso(R.inner), M.inner, 0, TORSO_Y, 0),
      mid: mesh(torso(R.mid), M.mid, 0, TORSO_Y, 0),
      outer: mesh(torso(R.outer), M.outer, 0, TORSO_Y, 0),
    };
    const band = (r) => new THREE.CylinderGeometry(r, r, 0.2, 28, 1, true);
    this.innerYoke = mesh(band(R.inner + 0.004), M.pink, 0, 1.3, 0);
    this.outerYoke = mesh(band(R.outer + 0.004), M.pink, 0, 1.3, 0);

    // 앞섶: 열린 자켓 / V넥 사이로 안쪽 옷이 보이는 삼각형
    this.panel0 = mesh(vShape(0.26, 0.5), M.panel0);
    this.panel1 = mesh(vShape(0.26, 0.5), M.panel1);
    const pipeGeo = new THREE.BoxGeometry(0.022, 1, 0.006);
    this.pipes = [mesh(pipeGeo, M.piping), mesh(pipeGeo, M.piping)];

    const wing = new THREE.BoxGeometry(0.15, 0.07, 0.03);
    this.collar = new THREE.Group();
    const wingL = mesh(wing, M.collar, -0.075, 0, 0);
    const wingR = mesh(wing, M.collar, 0.075, 0, 0);
    wingL.rotation.z = 0.45;
    wingR.rotation.z = -0.45;
    this.collar.add(wingL, wingR);
    this.collar.position.y = 1.47;

    // 포인트 색별 넥타이 무늬
    this.tieTextures = Object.fromEntries(Object.entries(PARTS.accent).map(([id, a]) => [id, tieTexture(a.tie)]));
    const tieMat = (this.tieMat = std('#ffffff', { map: this.tieTextures.pink }));
    const blade = new THREE.Shape();
    blade.moveTo(-0.032, 0);
    blade.lineTo(0.032, 0);
    blade.lineTo(0.052, -0.36);
    blade.lineTo(0, -0.42);
    blade.lineTo(-0.052, -0.36);
    blade.closePath();
    const bladeGeo = new THREE.ShapeGeometry(blade);
    bladeGeo.computeBoundingBox();
    // 텍스처가 넥타이 모양 전체에 펼쳐지도록 UV를 다시 계산
    const uv = bladeGeo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (bladeGeo.attributes.position.getX(i) + 0.052) / 0.104, 1 + bladeGeo.attributes.position.getY(i) / 0.42);
    this.tieKnot = mesh(new THREE.BoxGeometry(0.075, 0.07, 0.03), tieMat, 0, 1.43, 0);
    this.tieBlade = mesh(bladeGeo, tieMat, 0, 1.4, 0);

    const crestMat = new THREE.MeshStandardMaterial({ map: crestTexture(), transparent: true, alphaTest: 0.4, roughness: 0.7 });
    this.crest = mesh(new THREE.PlaneGeometry(0.12, 0.12), crestMat, 0.17, 1.27, 0);
    const lettersMat = new THREE.MeshStandardMaterial({ map: lettersTexture('YP'), transparent: true, alphaTest: 0.4, roughness: 0.7 });
    this.letters = mesh(new THREE.PlaneGeometry(0.17, 0.17), lettersMat, 0.16, 1.2, 0);

    const snapGeo = new THREE.CylinderGeometry(0.018, 0.018, 0.012, 12).rotateX(Math.PI / 2);
    this.snaps = new THREE.Group();
    for (const y of [0.9, 1.05, 1.2]) this.snaps.add(mesh(snapGeo, M.white, 0, y, 0));
    this.zip = mesh(new THREE.BoxGeometry(0.018, 0.62, 0.008), M.metal, 0, 1.1, 0);
    const pocketGeo = new THREE.BoxGeometry(0.14, 0.012, 0.006);
    this.pocket = new THREE.Group();
    this.pocket.add(mesh(pocketGeo, M.piping, 0.17, 0.98, 0), mesh(pocketGeo, M.piping, 0.17, 1.005, 0));

    const hood = mesh(new THREE.SphereGeometry(0.24, 16, 12), M.outer, 0, 1.5, -0.3);
    hood.scale.set(1.5, 0.75, 0.8);
    const stringGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.22, 6);
    this.hood = new THREE.Group();
    this.hood.add(hood, mesh(stringGeo, M.white, -0.06, 1.3, 0), mesh(stringGeo, M.white, 0.06, 1.3, 0));

    this.body.add(
      ...Object.values(this.layers),
      this.innerYoke,
      this.outerYoke,
      this.panel0,
      this.panel1,
      ...this.pipes,
      this.collar,
      this.tieKnot,
      this.tieBlade,
      this.crest,
      this.letters,
      this.snaps,
      this.zip,
      this.pocket,
      this.hood,
    );
  }

  #buildArm(side) {
    const M = this.mats;
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.4, 1.33, 0);
    const longSleeve = (r, len) => new THREE.CapsuleGeometry(r, len, 4, 12);
    const arm = {
      skin: mesh(longSleeve(0.078, 0.4), M.skin, 0, -0.27, 0),
      hand: mesh(new THREE.SphereGeometry(0.092, 14, 10), M.skin, 0, -0.57, 0),
      innerLong: mesh(longSleeve(0.09, 0.38), M.inner, 0, -0.24, 0),
      innerShort: mesh(new THREE.CylinderGeometry(0.098, 0.098, 0.2, 16), M.inner, 0, -0.07, 0),
      innerStripe: mesh(new THREE.BoxGeometry(0.02, 0.18, 0.03), M.pink, side * 0.098, -0.07, 0),
      mid: mesh(longSleeve(0.102, 0.37), M.mid, 0, -0.24, 0),
      outer: mesh(longSleeve(0.114, 0.36), M.outerSleeve, 0, -0.235, 0),
      cuff: mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.07, 16), M.rib, 0, -0.44, 0),
      cuffLine: mesh(new THREE.CylinderGeometry(0.122, 0.122, 0.018, 16), M.white, 0, -0.44, 0),
      outerStripe: mesh(new THREE.BoxGeometry(0.025, 0.36, 0.03), M.pink, side * 0.11, -0.22, 0),
    };
    pivot.add(...Object.values(arm));
    pivot.userData.parts = arm;
    this.body.add(pivot);
    return pivot;
  }

  #buildLower() {
    const M = this.mats;
    this.skirt = mesh(
      new THREE.CylinderGeometry(0.33, 0.52, 0.42, 28, 1, true),
      std('#ffffff', { map: plaidTexture(), flatShading: true, side: THREE.DoubleSide }),
      0,
      0.74,
      0,
    );
    this.hip = mesh(new THREE.CylinderGeometry(0.33, 0.35, 0.32, 24), M.pants, 0, 0.74, 0);
    this.body.add(this.skirt, this.hip);

    const makeLeg = (side) => {
      const g = new THREE.Group();
      g.position.set(side * 0.14, 0.6, 0);
      const parts = {
        skin: mesh(new THREE.CapsuleGeometry(0.085, 0.44, 4, 12), M.skin, 0, -0.3, 0),
        tights: mesh(new THREE.CapsuleGeometry(0.088, 0.44, 4, 12), M.legwear, 0, -0.3, 0),
        kneeSock: mesh(new THREE.CapsuleGeometry(0.091, 0.2, 4, 12), M.legwear, 0, -0.43, 0),
        whiteSock: mesh(new THREE.CylinderGeometry(0.092, 0.092, 0.12, 12), M.legwear, 0, -0.5, 0),
        pants: mesh(new THREE.CapsuleGeometry(0.112, 0.42, 4, 12), M.pants, 0, -0.28, 0),
        pantsStripe: mesh(new THREE.BoxGeometry(0.02, 0.5, 0.03), M.pink, side * 0.11, -0.3, 0),
        shoe: mesh(new THREE.BoxGeometry(0.17, 0.1, 0.28), M.shoe, 0, -0.56, 0.04),
        sole: mesh(new THREE.BoxGeometry(0.18, 0.04, 0.3), M.sole, 0, -0.6, 0.04),
      };
      g.add(...Object.values(parts));
      g.userData.parts = parts;
      this.body.add(g);
      return g;
    };
    this.legL = makeLeg(-1);
    this.legR = makeLeg(1);
  }

  // 교복 착장을 실시간으로 바꿈
  applyOutfit(raw) {
    const o = (this.outfit = normalizeOutfit(raw));
    const M = this.mats;
    const inner = PARTS.inner[o.inner];
    const mid = o.mid === 'none' ? null : PARTS.mid[o.mid];
    const outer = o.outer === 'none' ? null : PARTS.outer[o.outer];

    M.pink.color.set(PARTS.accent[o.accent].color);
    this.tieMat.map = this.tieTextures[o.accent];
    M.inner.color.set(inner.color);
    M.collar.color.set(inner.collar);
    if (mid) M.mid.color.set(mid.color);
    if (outer) {
      M.outer.color.set(outer.color);
      M.outerSleeve.color.set(outer.sleeveColor ?? outer.color);
      M.rib.color.set(outer.rib ?? outer.color);
      M.piping.color.set(outer.piping ?? '#f1ece2');
    }

    this.layers.mid.visible = !!mid;
    this.layers.outer.visible = !!outer;

    // 바깥 → 안쪽 순서로 쌓인 레이어
    const stack = [outer && { def: outer, r: R.outer }, mid && { def: mid, r: R.mid }, { def: inner, r: R.inner }].filter(Boolean);
    const top = stack[0];

    // 앞섶(V)으로 보이는 안쪽 레이어
    this.panel0.visible = this.panel1.visible = false;
    this.pipes.forEach((p) => (p.visible = false));
    let exposed = top;
    let tieZ = top.r + 0.006;
    const opening = top.def.opening ?? (top.def.collarV ? 'collar' : null);
    if (opening && stack[1]) {
      const [w, h] = { open: [0.26, 0.5], v: [0.24, 0.4], collar: [0.2, 0.2] }[opening];
      const z = top.r + 0.006;
      this.#placePanel(this.panel0, M.panel0, stack[1].def.color, w, h, z);
      if (top.def.piping || top.def.letters) this.#placePipes(w, h, z + 0.002);
      exposed = stack[1];
      tieZ = z + 0.004;
      if (opening === 'open' && stack[1].def.opening === 'v' && stack[2]) {
        this.#placePanel(this.panel1, M.panel1, stack[2].def.color, w * 0.6, h * 0.62, z + 0.003);
        exposed = stack[2];
        tieZ = z + 0.006;
      }
    }

    const tie = o.neck === 'tie' && exposed.def === inner;
    this.tieKnot.visible = tie;
    this.tieBlade.visible = tie && opening !== 'collar';
    this.tieKnot.position.z = tieZ + 0.01;
    this.tieBlade.position.z = tieZ + 0.002;

    this.collar.visible = !!inner.collar && o.outer !== 'track';
    this.collar.position.z = frontZ(top.r, 1.47) + 0.004;

    this.innerYoke.visible = !!inner.yoke && top.def === inner;
    this.outerYoke.visible = !!outer?.yoke;

    const front = top.r + 0.008;
    this.crest.visible = !!top.def.crest;
    this.crest.position.z = front;
    this.letters.visible = !!top.def.letters;
    this.letters.position.z = front;
    this.snaps.visible = !!top.def.letters;
    this.snaps.position.z = front;
    this.zip.visible = !!top.def.zip;
    this.zip.position.z = front;
    this.pocket.visible = !!top.def.piping;
    this.pocket.position.z = front - 0.004;
    this.hood.visible = !!outer?.hood;
    this.hood.children.slice(1).forEach((s) => (s.position.z = front));

    for (const arm of [this.armL, this.armR]) {
      const p = arm.userData.parts;
      p.innerLong.visible = inner.sleeves === 'long';
      p.innerShort.visible = inner.sleeves === 'short';
      p.mid.visible = !!mid && !mid.sleeveless;
      p.outer.visible = !!outer;
      p.cuff.visible = p.cuffLine.visible = !!outer?.rib;
      p.outerStripe.visible = !!outer?.stripe;
      p.innerStripe.visible = !!inner.stripe && !outer && !(mid && !mid.sleeveless);
    }

    // 하의 · 양말 · 신발
    const bottom = PARTS.bottom[o.bottom];
    const pants = o.bottom !== 'skirt';
    this.skirt.visible = !pants;
    this.hip.visible = pants;
    if (pants) M.pants.color.set(bottom.color);
    M.legwear.color.set(PARTS.legwear[o.legwear].color);
    M.shoe.color.set(PARTS.shoes[o.shoes].color);
    M.shoe.roughness = o.shoes === 'loafers' ? 0.3 : 0.8;
    for (const leg of [this.legL, this.legR]) {
      const p = leg.userData.parts;
      p.pants.visible = pants;
      p.pantsStripe.visible = !!bottom.stripe;
      p.tights.visible = o.legwear === 'tights';
      p.kneeSock.visible = o.legwear === 'kneeSocks';
      p.whiteSock.visible = o.legwear === 'whiteSocks';
      p.sole.visible = o.shoes === 'sneakers';
    }

    // 헤어 · 안경
    M.hair.color.set(PARTS.hairColor[o.hairColor].color);
    const show = {
      long: ['cap', 'shell', 'back', 'lockL', 'lockR'],
      bangs: ['cap', 'shell', 'back', 'lockL', 'lockR', 'bangs'],
      bob: ['cap', 'shell', 'bangs'],
      ponytail: ['cap', 'bangs', 'tailTop', 'tail'],
    }[o.hair];
    for (const [name, part] of Object.entries(this.hairParts)) part.visible = show.includes(name);
    this.glasses.visible = o.glasses === 'on';
  }

  #placePanel(panel, material, color, w, h, z) {
    material.color.set(color);
    panel.scale.set(w / 0.26, h / 0.5, 1);
    panel.position.set(0, 1.46, z);
    panel.visible = true;
  }

  #placePipes(w, h, z) {
    const len = Math.hypot(w / 2, h);
    const angle = Math.atan2(w / 2, h);
    this.pipes.forEach((p, i) => {
      const s = i === 0 ? -1 : 1;
      p.scale.y = len;
      p.position.set((s * w) / 4, 1.46 - h / 2, z);
      p.rotation.z = -s * angle;
      p.visible = true;
    });
  }

  get position() {
    return this.root.position;
  }

  faceTo(target, duration = 0.35) {
    const dx = target.x - this.root.position.x;
    const dz = target.z - this.root.position.z;
    if (dx * dx + dz * dz < 1e-4) return;
    const goal = Math.atan2(dx, dz);
    const cur = this.root.rotation.y;
    const delta = Math.atan2(Math.sin(goal - cur), Math.cos(goal - cur));
    gsap.to(this.root.rotation, { y: cur + delta, duration, ease: 'power2.out', overwrite: 'auto' });
  }

  wave() {
    if (this.busy) return;
    this.busy = true;
    const tl = gsap.timeline({ onComplete: () => (this.busy = false) });
    tl.to(this.armR.rotation, { z: 2.7, duration: 0.3, ease: 'back.out(2)' })
      .to(this.armR.rotation, { x: 0.35, duration: 0.18, yoyo: true, repeat: 5, ease: 'sine.inOut' })
      .to(this.body.position, { y: 0.15, duration: 0.18, yoyo: true, repeat: 1, ease: 'power1.out' }, 0.3)
      .to(this.armR.rotation, { z: 0, x: 0, duration: 0.35, ease: 'power2.inOut' });
    return tl;
  }

  update(dt) {
    const target = this.walking ? 1 : 0;
    this.walkAmount = THREE.MathUtils.damp(this.walkAmount ?? 0, target, 10, dt);
    this.walkPhase += dt * 10 * this.walkAmount;
    const s = Math.sin(this.walkPhase) * this.walkAmount;

    this.legL.rotation.x = s * 0.5;
    this.legR.rotation.x = -s * 0.5;
    this.armL.rotation.x = -s * 0.5;
    if (!this.busy) this.armR.rotation.x = s * 0.5;
    if (!this.busy) this.body.position.y = Math.abs(Math.sin(this.walkPhase)) * 0.08 * this.walkAmount;
  }
}
