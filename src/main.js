import './style.css';
import { Stage } from './core/Stage.js';
import { createEnvironment } from './world/Environment.js';
import { createSchool, animateSchool, POI } from './world/School.js';
import { Avatar } from './avatar/Avatar.js';
import { ClickNavigator } from './controls/ClickNavigator.js';
import { CameraDirector } from './controls/CameraDirector.js';
import { Overlay } from './ui/Overlay.js';

const canvas = document.querySelector('#scene');
const stage = new Stage(canvas);
const { scene, camera, controls } = stage;

const { ground } = createEnvironment(scene);
const school = createSchool(scene);
const avatar = new Avatar(scene);
const director = new CameraDirector({ camera, controls, avatar });
const navigator = new ClickNavigator({ camera, dom: canvas, ground, avatar, scene });

const ui = new Overlay(document.querySelector('#ui'), {
  wave() {
    avatar.wave();
    ui.say('안녕하세요! 👋');
  },
  async blackboard() {
    ui.setActive('blackboard');
    ui.say('칠판 앞으로 이동합니다');
    const walk = navigator.moveTo(POI.blackboard.stand);
    director.focus(POI.blackboard);
    await walk;
    avatar.faceTo(POI.blackboard.target);
  },
  tour() {
    ui.setActive('tour');
    ui.setLocked(true);
    navigator.enabled = false;
    ui.say('교실을 둘러봅니다', 6);
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
    navigator.enabled = true;
    ui.setLocked(false);
    ui.setActive(null);
    director.follow();
  },
});

navigator.onMove(() => {
  if (director.mode === 'focus') {
    ui.setActive(null);
    director.follow();
  }
});

stage.onUpdate((dt, t) => {
  avatar.update(dt);
  director.update(dt);
  animateSchool(school, t, dt, avatar.position);
});
stage.start();
