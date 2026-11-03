import './style.css';
import * as THREE from 'three';
import { Stage } from './core/Stage.js';
import { createEnvironment, WALK_ZONE } from './world/Environment.js';
import { createSchool, animateSchool, POI } from './world/School.js';
import { createInterior } from './world/Interior.js';
import { pulseGlow } from './world/parts.js';
import { Avatar } from './avatar/Avatar.js';
import { ClickNavigator } from './controls/ClickNavigator.js';
import { CameraDirector } from './controls/CameraDirector.js';
import { Overlay } from './ui/Overlay.js';
import { WardrobePanel } from './ui/WardrobePanel.js';
import { loadOutfit, saveOutfit } from './avatar/Wardrobe.js';

const canvas = document.querySelector('#scene');
const stage = new Stage(canvas);
const { camera, controls } = stage;

const { ground } = createEnvironment(stage.scene);
const school = createSchool(stage.scene);
const interior = createInterior();
const entrances = school.userData.entrances;

const avatar = new Avatar(stage.scene, loadOutfit());
avatar.position.copy(POI.start);
const director = new CameraDirector({ camera, controls, avatar });
const navigator = new ClickNavigator({ camera, dom: canvas, avatar });

const outside = {
  scene: stage.scene,
  ground,
  zones: [WALK_ZONE],
  pickables: [school],
  offset: new THREE.Vector3(0, 12, 22),
  hint: '운동장을 클릭해 걷고, 빛나는 출입구를 눌러 건물로 들어가 보세요',
};
const inside = {
  scene: interior.scene,
  ground: interior.ground,
  zones: interior.zones,
  pickables: [interior.root],
  offset: new THREE.Vector3(0, 11, 9),
  hint: '복도를 클릭해 걷고, 방 문이나 표지판을 눌러 들어가 보세요',
};
let world = null;
let lastEntrance = '영파관:mid';
let busy = false;

function useWorld(w) {
  world = w;
  stage.scene = w.scene;
  w.scene.add(avatar.root);
  navigator.setWorld(w);
  director.offset.copy(w.offset);
  ui.setPlace(w.hint);
}

// 화면 전환 중에는 클릭과 버튼을 잠금
async function transition(work) {
  if (busy) return false;
  busy = true;
  clearTimeout(introTimer);
  navigator.enabled = false;
  ui.setLocked(true, []);
  try {
    await work();
  } finally {
    busy = false;
    navigator.enabled = true;
    ui.setLocked(false);
  }
  return true;
}

// 출입구로 다가가 줌인 → 화면 가림 → 복도 안에서 다시 열림
function enterBuilding(key) {
  return transition(async () => {
    const e = entrances[key];
    ui.say(`${e.building}으로 들어갑니다`);
    if (world === outside) {
      navigator.moveTo(e.door.clone().addScaledVector(e.normal, 1.6));
      const shot = {
        camera: e.door.clone().addScaledVector(e.normal, 10).setY(5),
        target: e.door.clone().setY(2),
      };
      await director.focus(shot, 1.3).then();
    }
    await ui.fade(1);
    useWorld(inside);
    lastEntrance = key;
    const spawn = interior.spawn(e.spot);
    avatar.position.copy(spawn);
    avatar.root.rotation.y = Math.PI;
    director.jump({ camera: spawn.clone().add(new THREE.Vector3(0, 16, 22)), target: spawn.clone().setY(1) });
    ui.setActive(null);
    ui.say(`${e.building} 1층 메인 복도`);
    await ui.fade(0);
    director.follow(1.6);
  });
}

function exitBuilding() {
  return transition(async () => {
    ui.say('운동장으로 나갑니다');
    await ui.fade(1);
    useWorld(outside);
    const e = entrances[lastEntrance];
    avatar.position.copy(e.door).addScaledVector(e.normal, 2.4).setY(0);
    navigator.clamp(avatar.position);
    avatar.root.rotation.y = Math.atan2(e.normal.x, e.normal.z);
    const target = avatar.position.clone().setY(1.2);
    director.jump({ camera: target.clone().addScaledVector(e.normal, 6).add(outside.offset), target });
    ui.setActive(null);
    await ui.fade(0);
    director.follow(1.4);
  });
}

const ensureOutside = () => (world === inside ? exitBuilding() : Promise.resolve(true));
const ensureInside = () => (world === outside ? enterBuilding(lastEntrance) : Promise.resolve(true));

// 운동장의 정문처럼 걸어가서 바라보는 지점
async function visit(poi, id, message) {
  const walk = navigator.moveTo(poi.stand);
  ui.setActive(id);
  ui.say(message);
  director.focus(poi);
  await walk;
  avatar.faceTo(poi.target);
}

// 건물 안 장소(복도/교실/교무실/급식실/강당)로 이동하며 방 안을 비추는 시점으로 줌인
async function visitRoom(id) {
  if (busy || !(await ensureInside())) return;
  const view = interior.views[id];
  await visit(view, view.button, id === 'corridor' ? '메인 복도로 이동합니다' : `${view.label} 안으로 들어갑니다`);
}

const ui = new Overlay(document.querySelector('#ui'), {
  wave() {
    avatar.wave();
    ui.say('안녕하세요! 👋');
  },
  wardrobe: () => openWardrobe(),
  async overview() {
    if (busy || !(await ensureOutside())) return;
    clearTimeout(introTimer);
    ui.setActive('overview');
    ui.say('영파관과 동암관을 한눈에 봅니다');
    director.focus(POI.overview, 2);
  },
  corridor: () => visitRoom('corridor'),
  classroom: () => visitRoom('classroom1'),
  office: () => visitRoom('office1'),
  cafeteria: () => visitRoom('cafeteria'),
  auditorium: () => visitRoom('auditorium'),
  async gate() {
    if (busy || !(await ensureOutside())) return;
    clearTimeout(introTimer);
    visit(POI.gate, 'gate', '정문으로 이동합니다');
  },
  async tour() {
    if (busy || !(await ensureOutside())) return;
    clearTimeout(introTimer);
    ui.setActive('tour');
    ui.setLocked(true);
    navigator.enabled = false;
    ui.say('영파관·동암관과 구름다리를 둘러봅니다', 10);
    director.tour(POI.tour, {
      onDone: () => {
        navigator.enabled = true;
        ui.setLocked(false);
        ui.setActive(null);
        director.follow();
      },
    });
  },
  home() {
    if (busy) return;
    clearTimeout(introTimer);
    navigator.enabled = true;
    ui.setLocked(false);
    ui.setActive(null);
    director.follow();
  },
});

// 교복 선택: 아바타를 정면에서 비추고, 팝업에서 고르는 대로 바로 갈아입힘
const wardrobe = new WardrobePanel(document.querySelector('#ui'), {
  onChange: (outfit) => avatar.applyOutfit(outfit),
  onConfirm: ({ outfit, start }) => closeWardrobe(outfit, start),
});

function dressingShot() {
  const p = avatar.position;
  // 넓은 화면은 오른쪽 팝업을 피해 아바타를 왼쪽에, 좁은 화면은 아래 팝업을 피해 위쪽에 둠
  const shift = window.innerWidth > 720 ? new THREE.Vector3(0.9, 1.0, 0) : new THREE.Vector3(0, -0.2, 0);
  const target = p.clone().add(shift);
  return { camera: target.clone().add(new THREE.Vector3(0, 1.8, 5.4)), target };
}

function openWardrobe({ first = false } = {}) {
  if (busy || wardrobe.isOpen) return;
  clearTimeout(introTimer);
  navigator.stop();
  navigator.enabled = false;
  ui.setDressing(true);
  ui.setActive(null);
  ui.setPlace('교복을 고른 뒤 아래 버튼을 눌러 주세요');
  avatar.faceTo(avatar.position.clone().add(new THREE.Vector3(0, 0, 1)), 0.6);
  director.focus(dressingShot(), first ? 2.4 : 1.4);
  wardrobe.open(avatar.outfit, { first });
}

async function closeWardrobe(outfit, start) {
  saveOutfit(outfit);
  await wardrobe.close();
  ui.setDressing(false);
  ui.setPlace(world.hint);
  navigator.enabled = true;
  avatar.wave();
  if (start === 'corridor') {
    enterBuilding('영파관:mid');
  } else if (start === 'outside') {
    // 첫 입장: 학교 전체(┌ 배치)를 보여 준 뒤 아바타 뒤로 내려옴
    ui.say('영파여자고등학교에 오신 것을 환영해요!', 3);
    director.focus(POI.overview, 2.2);
    introTimer = setTimeout(() => director.follow(3), 3200);
  } else {
    ui.say('교복을 갈아입었어요');
    director.follow();
  }
}

useWorld(outside);

// 접속 직후: 학교 전경에서 아바타 앞으로 날아와 교복 선택 팝업을 띄움
let introTimer = null;
director.jump(POI.overview);
openWardrobe({ first: true });

navigator.onInteract((action) => {
  if (busy) return;
  if (action.type === 'enter') enterBuilding(action.key);
  else if (action.type === 'room') visitRoom(action.id);
  else if (action.type === 'exit') exitBuilding();
});

navigator.onMove(() => {
  if (busy) return;
  if (director.mode === 'focus' || director.mode === 'intro') {
    clearTimeout(introTimer);
    ui.setActive(null);
    director.follow();
  }
});

stage.onUpdate((dt, t) => {
  avatar.update(dt);
  director.update(dt);
  animateSchool(school, t);
  pulseGlow(t);
});
stage.start();
