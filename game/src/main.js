// main.js — Solmar Bay's game loop and glue. It owns the game state, reads
// input, updates the player, the city, the police and the missions, and draws
// the world plus the HUD. Every other module does one job; this one runs them.

import { WORLD, VIEW, PLAYER, WEAPONS, ECONOMY } from './config.js';
import { makeRng } from './rng.js';
import { buildCity, isSolid, moveWithCollision, nearestRoadPoint } from './world.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { makeCar, populateCars, updateTrafficCar, drivePlayerCar, nearestCar } from './vehicles.js';
import { populatePeds, updatePed } from './entities.js';
import { fireWeapon, fireBulletInto, updateBullets, updateParticles, spawnParticles, makePickup, updatePickups } from './combat.js';
import { createPolice, addWanted, clearWanted, crimeSeenBy, updatePolice, updatePoliceCar } from './police.js';
import {
  createMissionState, currentMission, currentStep, startMission, updateMission,
  completeMission, updateFare, pushSubtitle, pushBanner, updateGangMember,
} from './missions.js';
import { renderWorld } from './render.js';
import { drawHud, drawTitle, drawHowTo, drawPaused, drawGameOver } from './hud.js';
import { hasSave, saveGame, loadSave, clearSave } from './save.js';
import { stageShot } from './shots.js';

const SEED = 20261119;
const SAVE_EVERY = 20; // seconds between autosaves

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.rng = makeRng(SEED);
    this.city = buildCity(SEED);
    this.input = createInput(canvas);
    this.keys = this.input.keys;
    this.audio = createAudio();
    this.screen = 'title';
    this.shotMode = false;
    this.time = 0;
    this.clock = 17 * 60 + 10; // minutes since midnight; start at golden hour
    this.day = 1;
    this.playStartedAt = 0;
    this.hurtFlash = 0;
    this.saveTimer = SAVE_EVERY;
    this.hasSave = hasSave();
    this.titleHover = -1;
    this.pauseHover = -1;
    this.camera = { x: 1500, y: 1100 };
    this.worldHelpers = { moveWithCollision };
    this.combatHelpers = { spawnParticles };
    this.objectiveMarker = null;
    this.resetWorld();
    this.bindMenuClicks();
  }

  resetWorld() {
    const safe = this.city.places.safehouse;
    this.player = {
      x: safe.x, y: safe.y, angle: 0, radius: PLAYER.radius,
      hp: PLAYER.maxHp, dead: false, car: null,
      weapon: 'pistol', weapons: { fists: true, pistol: true },
      ammo: { pistol: 120, smg: 0, shotgun: 0 },
      punchCooldown: 0, shootCooldown: 0, speed: 0,
    };
    this.cars = populateCars(this.city, this.rng, 30);
    this.peds = populatePeds(this.city, this.rng, 42, safe);
    this.police = createPolice();
    this.bullets = [];
    this.particles = [];
    this.pickups = [
      makePickup('health', this.city.places.hospital.x, this.city.places.hospital.y),
      makePickup('ammo', this.city.places.garage.x, this.city.places.garage.y),
      makePickup('cash', 1800, 2340),
      makePickup('cash', 1080, 1080),
    ];
    this.missions = createMissionState();
    this.money = ECONOMY.startMoney;
    this.pickupTimer = 18;
  }

  // ---------------------------------------------------------- starting up

  newGame() {
    clearSave();
    this.resetWorld();
    this.screen = 'play';
    this.playStartedAt = this.time;
    this.audio.unlock();
    this.audio.startMusic();
    startMission(this, 0);
    saveGame(this);
    // The click that started the game must not leak into play as a shot.
    this.input.endFrame();
  }

  continueGame() {
    const data = loadSave();
    this.resetWorld();
    if (data) {
      this.money = data.money;
      this.player.x = data.player.x;
      this.player.y = data.player.y;
      this.player.hp = data.player.hp;
      this.player.weapons = data.weapons;
      this.player.ammo = data.ammo;
      this.clock = data.clock;
      this.day = data.day;
      this.missions.index = data.missionIndex;
      this.missions.done = data.missionDone;
    }
    this.screen = 'play';
    this.playStartedAt = this.time;
    this.audio.unlock();
    this.audio.startMusic();
    if (this.missions.index >= 0 && this.missions.index < 5) {
      startMission(this, this.missions.index);
    } else if (this.missions.done) {
      pushBanner(this, 'Welcome back, King of the Bay.', 4);
    }
    // The click that continued the game must not leak into play as a shot.
    this.input.endFrame();
  }

  quitToTitle() {
    saveGame(this);
    this.hasSave = hasSave();
    this.audio.stopMusic();
    this.audio.stopSiren();
    this.audio.stopEngine();
    clearWanted(this.police);
    this.screen = 'title';
  }

  // ---------------------------------------------------------- menus

  bindMenuClicks() {
    this.canvas.addEventListener('click', () => this.audio.unlock());
  }

  titleOptions() {
    return this.hasSave
      ? ['continue', 'new', 'howto']
      : ['new', 'howto'];
  }

  handleTitleClick() {
    const mx = this.input.mouse.x;
    const my = this.input.mouse.y;
    const options = this.titleOptions();
    let hover = -1;
    options.forEach((opt, i) => {
      const y = 440 + i * 44;
      if (mx > 320 && mx < VIEW.width - 320 && my > y - 28 && my < y + 10) hover = i;
    });
    this.titleHover = hover;
    if (this.input.mouse.clicked && hover >= 0) {
      const choice = options[hover];
      if (choice === 'continue') this.continueGame();
      else if (choice === 'new') this.newGame();
      else if (choice === 'howto') this.screen = 'howto';
    }
    if (this.input.wasPressed('Enter')) {
      if (this.hasSave) this.continueGame();
      else this.newGame();
    }
  }

  handlePauseClick() {
    const mx = this.input.mouse.x;
    const my = this.input.mouse.y;
    let hover = -1;
    for (let i = 0; i < 3; i += 1) {
      const y = 340 + i * 44;
      if (mx > 320 && mx < VIEW.width - 320 && my > y - 28 && my < y + 10) hover = i;
    }
    this.pauseHover = hover;
    if (this.input.mouse.clicked && hover >= 0) {
      if (hover === 0) this.screen = 'play';
      else if (hover === 1) this.restartMission();
      else if (hover === 2) this.quitToTitle();
      // The click that resumed must not leak into play as a shot.
      this.input.endFrame();
    }
    if (this.input.wasPressed('Escape')) this.screen = 'play';
  }

  restartMission() {
    const idx = this.missions.index >= 0 ? this.missions.index : 0;
    clearWanted(this.police);
    this.missions.gang = [];
    this.player.hp = PLAYER.maxHp;
    this.screen = 'play';
    startMission(this, idx);
  }

  // ---------------------------------------------------------- combat input

  fireBullet(x, y, angle, speed, damage, owner, ownerRef) {
    fireBulletInto(this.bullets, x, y, angle, speed, damage, owner, 620);
    const last = this.bullets[this.bullets.length - 1];
    last.ownerRef = ownerRef;
  }

  tryShoot(dt) {
    const p = this.player;
    p.shootCooldown -= dt;
    const w = WEAPONS[p.weapon];
    if (p.weapon === 'fists') return;
    const wantFire = w.auto ? this.input.mouse.down : this.input.mouse.clicked;
    if (!wantFire || p.shootCooldown > 0) return;
    if ((p.ammo[p.weapon] ?? 0) <= 0) {
      p.shootCooldown = 0.3;
      pushSubtitle(this, 'No ammo — find an ammo pickup (orange).', 2.5);
      return;
    }
    p.ammo[p.weapon] -= 1;
    p.shootCooldown = w.cooldown;
    const gx = p.x + Math.cos(p.angle) * 20;
    const gy = p.y + Math.sin(p.angle) * 20;
    const before = this.bullets.length;
    fireWeapon(this.bullets, gx, gy, p.angle, p.weapon);
    // The shooter's own bullets must never hit the shooter.
    for (let i = before; i < this.bullets.length; i += 1) this.bullets[i].ownerRef = p;
    if (!this.shotMode) this.audio.shoot(p.weapon);
    spawnParticles(this.particles, gx, gy, '#ffe98a', 3, 120, 0.15, 2);
    // Firing in public is a crime — if anyone sees it.
    if (crimeSeenBy(this.police, this.peds, p.x, p.y)) {
      if (addWanted(this.police, 1)) {
        pushSubtitle(this, 'A witness called the SBPD!', 3);
        if (!this.shotMode) this.audio.wantedUp();
      }
    }
  }

  tryPunch(dt) {
    const p = this.player;
    p.punchCooldown -= dt;
    if (!this.input.wasPressed('Space') || p.punchCooldown > 0 || p.car) return;
    p.punchCooldown = PLAYER.punchCooldown;
    if (!this.shotMode) this.audio.punch();
    const reach = PLAYER.punchRange;
    const tx = p.x + Math.cos(p.angle) * reach;
    const ty = p.y + Math.sin(p.angle) * reach;
    const victims = [...this.peds, ...this.police.cops, ...this.missions.gang];
    for (const v of victims) {
      if (v.dead) continue;
      if (Math.hypot(v.x - tx, v.y - ty) < 26) {
        v.hp = (v.hp ?? 60) - PLAYER.punchDamage;
        v.panic = 2;
        v.state = 'flee';
        spawnParticles(this.particles, v.x, v.y, '#ff6b6b', 6, 140, 0.4, 3);
        if (v.hp <= 0) {
          v.dead = true;
          this.onKill(v);
        } else if (crimeSeenBy(this.police, this.peds, p.x, p.y)) {
          addWanted(this.police, 0.5);
        }
        break;
      }
    }
  }

  onKill(victim) {
    if (victim.gang) return; // mission kills are the job, not a crime
    if (this.police.cops.includes(victim)) {
      addWanted(this.police, 1);
      pushSubtitle(this, 'You killed a cop. The whole SBPD is coming.', 4);
    } else if (crimeSeenBy(this.police, this.peds, victim.x, victim.y)) {
      addWanted(this.police, 1);
    }
    if (Math.random() < 0.5) {
      this.pickups.push(makePickup('cash', victim.x, victim.y));
    }
  }

  // ---------------------------------------------------------- cars

  tryEnterCar() {
    const p = this.player;
    if (!this.input.wasPressed('KeyE')) return;
    if (p.car) {
      // Get out beside the car.
      const car = p.car;
      car.speed = 0;
      car.parked = true;
      const side = Math.PI / 2;
      p.x = car.x + Math.cos(car.angle + side) * 34;
      p.y = car.y + Math.sin(car.angle + side) * 34;
      if (isSolid(this.city, p.x, p.y, p.radius)) {
        p.x = car.x + Math.cos(car.angle - side) * 34;
        p.y = car.y + Math.sin(car.angle - side) * 34;
      }
      p.car = null;
      if (!this.shotMode) this.audio.door();
      return;
    }
    const car = nearestCar(this.cars, p.x, p.y, 64);
    if (!car) return;
    const wasPolice = car.police;
    const seen = crimeSeenBy(this.police, this.peds, p.x, p.y);
    car.parked = false;
    car.traffic = false;
    p.car = car;
    p.x = car.x;
    p.y = car.y;
    if (!this.shotMode) this.audio.door();
    if (wasPolice) {
      addWanted(this.police, 2);
      pushSubtitle(this, 'You stole a police car!', 3);
    } else if (seen) {
      if (addWanted(this.police, 1)) pushSubtitle(this, 'Someone saw you steal that car!', 3);
    }
    // A police car the player stole stops being a police car.
    if (wasPolice) {
      car.police = false;
      this.police.cars = this.police.cars.filter((c) => c !== car);
    }
  }

  // ---------------------------------------------------------- the frame

  step(dt) {
    this.time += dt;
    this.clock += dt * 1.5; // 1.5 game-minutes a second: a day lasts ~16 minutes
    if (this.clock >= 24 * 60) {
      this.clock -= 24 * 60;
      this.day += 1;
    }
    if (this.hurtFlash > 0) this.hurtFlash -= dt * 2;

    if (this.screen === 'title') {
      this.updateAmbient(dt);
      this.updateCamera(dt, true);
      this.input.endFrame();
      return;
    }
    if (this.screen !== 'play') {
      this.input.endFrame();
      return;
    }

    const p = this.player;
    this.updatePlayer(dt);
    this.updateCamera(dt, false);

    // Traffic, pedestrians, police. (The player's car is driven by the
    // player, never by traffic: it would move twice a frame and turn alone.)
    for (const car of this.cars) {
      if (!car.dead && car !== p.car) updateTrafficCar(this.city, car, this.cars, dt);
    }
    for (const car of this.police.cars) {
      if (!car.dead) updatePoliceCar(this.city, car, p, dt, (rammer) => this.onRam(rammer));
    }
    updatePolice(this.city, this.police, p, this.peds, dt, this.rng, (x, y, a, s, d, o, ref) => this.fireBullet(x, y, a, s, d, o, ref));
    for (const ped of this.peds) {
      if (!ped.dead) updatePed(this.city, ped, dt, this.rng, p.car || (this.police.stars > 0 ? p : null));
    }
    for (const member of this.missions.gang) {
      if (!member.dead) updateGangMember(this, member, dt);
    }
    this.maintainCrowd(dt);

    // Bullets and their consequences.
    const carTargets = this.cars.filter((c) => !c.dead);
    for (const c of carTargets) c.isCar = true;
    const hits = updateBullets(this.city, this.bullets, dt, [...this.peds, ...this.police.cops, ...this.missions.gang, p, ...carTargets]);
    for (const hit of hits) {
      if (hit.kind === 'person' && hit.target === p) {
        this.damagePlayer(hit.damage, hit.x, hit.y);
      } else if (hit.kind === 'person' && hit.killed) {
        this.onKill(hit.target);
        spawnParticles(this.particles, hit.x, hit.y, '#c0392b', 12, 160, 0.6, 3);
      } else if (hit.kind === 'person') {
        spawnParticles(this.particles, hit.x, hit.y, '#c0392b', 5, 120, 0.4, 3);
      } else if (hit.kind === 'car') {
        spawnParticles(this.particles, hit.x, hit.y, '#f39c12', 6, 140, 0.4, 3);
      } else if (hit.kind === 'wall') {
        spawnParticles(this.particles, hit.x, hit.y, '#bbb', 3, 80, 0.3, 2);
      }
    }
    this.bullets = this.bullets.filter((b) => !b.dead);
    updateParticles(this.particles, dt);
    this.particles = this.particles.filter((pt) => !pt.dead);

    // Pickups.
    updatePickups(this.pickups, p, dt, (pk) => this.onPickup(pk));
    this.pickups = this.pickups.filter((pk) => !pk.dead);
    this.pickupTimer -= dt;
    if (this.pickupTimer <= 0) {
      this.pickupTimer = 22;
      const road = nearestRoadPoint(this.city, p.x + (Math.random() - 0.5) * 1200, p.y + (Math.random() - 0.5) * 1200);
      this.pickups.push(makePickup('cash', road.x, road.y));
    }

    // Missions and fares.
    const missionResult = updateMission(this, dt);
    if (missionResult === 'complete') completeMission(this);
    updateFare(this, dt);
    this.updateObjectiveMarker();

    // Siren and engine follow the action.
    if (!this.shotMode) {
      if (Math.ceil(this.police.stars) > 0) this.audio.startSiren();
      else this.audio.stopSiren();
      this.audio.setEngine(p.car ? Math.abs(p.car.speed) / p.car.top : 0);
    }

    // Autosave.
    this.saveTimer -= dt;
    if (this.saveTimer <= 0) {
      this.saveTimer = SAVE_EVERY;
      saveGame(this);
    }

    // Death.
    if (p.hp <= 0 && !p.dead) {
      p.dead = true;
      this.audio.stopSiren();
      this.audio.stopEngine();
      this.audio.missionFail();
      this.money = Math.floor(this.money / 2);
      this.screen = 'over';
    }

    this.input.endFrame();
  }

  updatePlayer(dt) {
    const p = this.player;
    const input = this.input;

    if (input.wasPressed('KeyM')) {
      const muted = this.audio.toggleMute();
      pushSubtitle(this, muted ? 'Sound off' : 'Sound on', 1.5);
    }
    if (input.wasPressed('Escape')) {
      this.screen = 'pause';
      return;
    }
    if (input.wasPressed('KeyQ')) {
      const owned = Object.keys(WEAPONS).filter((k) => p.weapons[k]);
      const idx = owned.indexOf(p.weapon);
      p.weapon = owned[(idx + 1) % owned.length];
      pushSubtitle(this, `${WEAPONS[p.weapon].name} ready`, 1.5);
    }

    if (p.car) {
      const car = p.car;
      drivePlayerCar(
        this.city, car, input, this.cars, this.peds, dt,
        (ped) => {
          // Ran someone over.
          spawnParticles(this.particles, ped.x, ped.y, '#c0392b', 10, 160, 0.6, 3);
          if (crimeSeenBy(this.police, this.peds, ped.x, ped.y)) addWanted(this.police, 1);
          else addWanted(this.police, 0.25);
        },
        (speed) => {
          if (!this.shotMode) this.audio.crash();
          this.damagePlayer(Math.min(18, speed / 40), p.x, p.y);
          spawnParticles(this.particles, car.x, car.y, '#888', 8, 140, 0.5, 3);
        },
      );
      p.x = car.x;
      p.y = car.y;
      p.angle = car.angle;
      car.smoke = Math.max(0, car.smoke - dt);
      this.tryEnterCar();
      return;
    }

    // On foot.
    const move = input.moveVector();
    const sprint = input.down('ShiftLeft') || input.down('ShiftRight');
    const speed = sprint ? PLAYER.runSpeed : PLAYER.walkSpeed;
    const dx = move.x * speed * dt;
    const dy = move.y * speed * dt;
    moveWithCollision(this.city, p, dx, dy);
    p.speed = Math.hypot(dx, dy) / Math.max(dt, 0.001);

    // Aim at the mouse.
    const wx = this.camera.x + input.mouse.x;
    const wy = this.camera.y + input.mouse.y;
    p.angle = Math.atan2(wy - p.y, wx - p.x);

    this.tryShoot(dt);
    this.tryPunch(dt);
    this.tryEnterCar();
  }

  onRam(rammer) {
    const p = this.player;
    if (p.car) {
      p.car.speed *= 0.4;
      this.damagePlayer(4, p.x, p.y);
    } else {
      this.damagePlayer(14, p.x, p.y);
      // Knocked flying a little.
      const away = Math.atan2(p.y - rammer.y, p.x - rammer.x);
      moveWithCollision(this.city, p, Math.cos(away) * 30, Math.sin(away) * 30);
    }
    if (!this.shotMode) this.audio.crash();
    spawnParticles(this.particles, p.x, p.y, '#888', 8, 140, 0.5, 3);
  }

  damagePlayer(amount, x, y) {
    const p = this.player;
    if (p.dead || this.screen !== 'play') return;
    p.hp -= amount;
    this.hurtFlash = 0.8;
    if (!this.shotMode) this.audio.hurt();
    spawnParticles(this.particles, x ?? p.x, y ?? p.y, '#e74c3c', 5, 120, 0.4, 3);
  }

  onPickup(pk) {
    const p = this.player;
    if (pk.kind === 'cash') {
      this.money += ECONOMY.pickupCash;
      pushSubtitle(this, `Found $${ECONOMY.pickupCash} on the street`, 2);
      if (!this.shotMode) this.audio.cash();
    } else if (pk.kind === 'health') {
      p.hp = Math.min(PLAYER.maxHp, p.hp + ECONOMY.healthPickup);
      pushSubtitle(this, `First aid +${ECONOMY.healthPickup} HP`, 2);
    } else if (pk.kind === 'ammo') {
      for (const key of ['pistol', 'smg', 'shotgun']) {
        if (p.weapons[key]) p.ammo[key] = (p.ammo[key] ?? 0) + ECONOMY.ammoPickup;
      }
      pushSubtitle(this, `Ammo restocked (+${ECONOMY.ammoPickup} each)`, 2);
    }
    if (!this.shotMode) this.audio.pickup();
    spawnParticles(this.particles, pk.x, pk.y, '#ffd34d', 10, 140, 0.5, 3);
  }

  maintainCrowd(dt) {
    this.crowdTimer = (this.crowdTimer ?? 0) - dt;
    if (this.crowdTimer > 0) return;
    this.crowdTimer = 2;
    const p = this.player;
    // Prune the far away, top up near the player.
    this.peds = this.peds.filter((ped) => !ped.dead || Math.hypot(ped.x - p.x, ped.y - p.y) < 700);
    this.peds = this.peds.filter((ped) => Math.hypot(ped.x - p.x, ped.y - p.y) < 1400);
    if (this.peds.length < 34) {
      const fresh = populatePeds(this.city, this.rng, 10, p);
      this.peds.push(...fresh);
    }
    this.cars = this.cars.filter((car) => car === p.car || Math.hypot(car.x - p.x, car.y - p.y) < 1600);
    if (this.cars.filter((c) => c.traffic).length < 16) {
      const fresh = populateCars(this.city, this.rng, 6);
      this.cars.push(...fresh);
    }
  }

  updateAmbient(dt) {
    // The title screen's living backdrop: traffic and pedestrians drift by.
    for (const car of this.cars) {
      if (!car.dead) updateTrafficCar(this.city, car, this.cars, dt);
    }
    for (const ped of this.peds) {
      if (!ped.dead) updatePed(this.city, ped, dt, this.rng, null);
    }
    this.camera.x = 1500 + Math.sin(this.time * 0.05) * 260;
    this.camera.y = 1100 + Math.cos(this.time * 0.04) * 160;
  }

  updateCamera(dt, title) {
    if (title) return;
    const p = this.player;
    let tx = p.x - VIEW.width / 2;
    let ty = p.y - VIEW.height / 2;
    if (p.car) {
      tx += Math.cos(p.angle) * Math.abs(p.car.speed) * 0.25;
      ty += Math.sin(p.angle) * Math.abs(p.car.speed) * 0.25;
    }
    const k = 1 - Math.pow(0.001, dt); // smooth follow
    this.camera.x += (tx - this.camera.x) * k;
    this.camera.y += (ty - this.camera.y) * k;
    this.camera.x = clamp(this.camera.x, 0, WORLD.size - VIEW.width);
    this.camera.y = clamp(this.camera.y, 0, WORLD.size - VIEW.height);
  }

  updateObjectiveMarker() {
    const step = currentStep(this.missions);
    const m = currentMission(this.missions);
    if (m && this.missions.active && step) {
      if (step.type === 'goto' || step.type === 'interact') {
        const place = this.city.places[step.place];
        this.objectiveMarker = { x: place.x, y: place.y };
        return;
      }
      if (step.type === 'kill') {
        const alive = this.missions.gang.find((x) => !x.dead);
        if (alive) {
          this.objectiveMarker = { x: alive.x, y: alive.y };
          return;
        }
      }
      if (step.type === 'car') {
        const car = nearestCar(this.cars, this.player.x, this.player.y, 900);
        if (car) {
          this.objectiveMarker = { x: car.x, y: car.y };
          return;
        }
      }
    }
    if (this.missions.fare) {
      const f = this.missions.fare;
      this.objectiveMarker = f.state === 'waiting' ? { x: f.ped.x, y: f.ped.y } : { x: f.dest.x, y: f.dest.y };
      return;
    }
    this.objectiveMarker = null;
  }

  // ---------------------------------------------------------- drawing

  render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, VIEW.width, VIEW.height);
    if (this.screen === 'howto') {
      renderWorld(ctx, this);
      drawHowTo(ctx);
      return;
    }
    renderWorld(ctx, this);
    if (this.screen === 'title') {
      drawTitle(ctx, this);
    } else if (this.screen === 'play') {
      drawHud(ctx, this);
    } else if (this.screen === 'pause') {
      drawHud(ctx, this);
      drawPaused(ctx, this);
    } else if (this.screen === 'over') {
      drawHud(ctx, this);
      drawGameOver(ctx, this);
    }
  }

  // ---------------------------------------------------------- the loop

  run() {
    let last = performance.now();
    const frame = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (this.screen === 'title') this.handleTitleClick();
      else if (this.screen === 'pause') this.handlePauseClick();
      else if (this.screen === 'howto') {
        if (this.input.wasPressed('Escape') || this.input.mouse.clicked) this.screen = 'title';
      } else if (this.screen === 'over') {
        if (this.input.mouse.clicked) {
          this.player.hp = PLAYER.maxHp;
          this.player.dead = false;
          const safe = this.city.places.safehouse;
          this.player.x = safe.x;
          this.player.y = safe.y;
          this.player.car = null;
          clearWanted(this.police);
          this.missions.gang = [];
          this.screen = 'play';
          if (this.missions.index >= 0) startMission(this, this.missions.index);
          // The click that respawned must not leak into play as a shot.
          this.input.endFrame();
        }
      }
      this.step(dt);
      this.render();
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }
}

// ---------------------------------------------------------- boot

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const canvas = document.getElementById('game');
const game = new Game(canvas);
window.__game = game; // debug handle: lets a play-tester read live state
if (shot) {
  stageShot(shot, game);
  // Render one frame immediately so a screenshot flag catches the scene,
  // then keep the loop running for the virtual-time budget.
  game.render();
} else {
  game.run();
}
