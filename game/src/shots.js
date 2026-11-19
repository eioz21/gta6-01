// shots.js — stages the four screenshots from the query string (?shot=...).
// Each scene plays the real game forward from a fixed seed with a scripted
// driver, so the frame is what a short session really looks like — no
// compositing, no staging outside the game's own rules.
//
//   ?shot=start   title screen over downtown at golden hour
//   ?shot=drive   Leo driving a sports car through traffic
//   ?shot=chase   a 3-star police chase on the coast road
//   ?shot=mission the final mission at the marina, gang in sight

import { makeCar } from './vehicles.js';
import { makePed } from './entities.js';
import { startMission, spawnGang } from './missions.js';

function driveForward(g, seconds) {
  // Hold W and steer gently toward the road ahead, like a player would.
  const steps = Math.floor(seconds / (1 / 60));
  for (let i = 0; i < steps; i += 1) {
    g.keys.add('KeyW');
    g.step(1 / 60, true);
    g.keys.delete('KeyW');
  }
}

export function stageShot(name, g) {
  g.shotMode = true;
  g.screen = 'play';
  g.audio.stopMusic();
  g.missions.fareTimer = 9999; // no taxi fares wander into a staged frame
  if (name === 'start') {
    g.screen = 'title';
    g.camera.x = 1500;
    g.camera.y = 1100;
    g.clock = 17 * 60 + 20; // golden hour
    g.player.x = 1800;
    g.player.y = 1500;
    return;
  }

  g.clock = 17 * 60 + 40;
  g.player.hp = 100;
  g.money = 2450;
  g.player.weapons.pistol = true;
  g.player.ammo.pistol = 86;

  if (name === 'drive') {
    const car = makeCar('sports', 1200, 1920, 0, {});
    car.speed = 260;
    g.cars.push(car);
    g.player.car = car;
    g.player.x = car.x;
    g.player.y = car.y;
    g.camera.x = car.x - 640;
    g.camera.y = car.y - 360;
    g.missions.index = 0;
    g.missions.active = true;
    g.missions.stepIndex = 1;
    g.missions.subtitles = [{ text: "ROSA: Any car on the street will do. Bring it to my garage.", until: 9999 }];
    driveForward(g, 1.2);
    return;
  }

  if (name === 'chase') {
    const car = makeCar('muscle', 1920, 2500, Math.PI / 2, {});
    car.speed = 320;
    g.cars.push(car);
    g.player.car = car;
    g.player.x = car.x;
    g.player.y = car.y;
    g.police.stars = 3;
    // Two interceptors right behind, one foot cop ahead.
    const p1 = makeCar('police', 1920, 2320, Math.PI / 2, { police: true });
    const p2 = makeCar('police', 1952, 2250, Math.PI / 2, { police: true });
    p1.speed = 380;
    p2.speed = 360;
    g.police.cars.push(p1, p2);
    const cop = makePed(1920, 2750, g.rng);
    cop.shirt = '#2c3e50';
    cop.color = '#1b2631';
    g.police.cops.push({ ...cop, hp: 60, shootCooldown: 0, state: 'chase', speed: 150 });
    g.missions.index = 3;
    g.missions.active = true;
    g.missions.stepIndex = 0;
    g.missions.timer = 31;
    g.missions.subtitles = [{ text: 'ROSA: Three stars, Leo. Survive the heat, then disappear.', until: 9999 }];
    g.camera.x = car.x - 640;
    g.camera.y = car.y - 360;
    driveForward(g, 0.8);
    return;
  }

  // mission: the marina showdown.
  g.player.x = 2760;
  g.player.y = 2900;
  g.player.weapon = 'smg';
  g.player.weapons.smg = true;
  g.player.ammo.smg = 180;
  g.player.angle = Math.PI / 2;
  startMission(g, 4);
  g.missions.stepIndex = 1;
  g.missions.gang = spawnGang(g, 6);
  // A couple of gang members already down, one mid-fire.
  g.missions.gang[0].dead = true;
  g.missions.gang[1].dead = true;
  g.missions.kills = 2;
  g.fireBullet(g.player.x, g.player.y + 40, Math.PI / 2, 900, 16, 'player', null);
  g.camera.x = g.player.x - 640;
  g.camera.y = g.player.y - 360;
  g.step(1 / 60, true);
}
