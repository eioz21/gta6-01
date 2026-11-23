// One fixed step of the living city: the player, the traffic, the police,
// the combat, the missions and the clock. Both the live game and the
// screenshot stager drive the world through stepWorld().
import { PLAYER, WEAPONS, MINUTES_PER_SECOND, clamp } from './config.js';
import { City, PLACES } from './world.js';
import { makePlayer, makePed, movePlayerOnFoot, updatePed, maintainPopulation, nearestCar, scarePedsNear } from './entities.js';
import { makeCar, makeTrafficCar, driveCar, collideCars, updateTrafficCar } from './vehicles.js';
import { addHeat, decayHeat, updatePolice, hurtPlayer } from './police.js';
import { playerShoot, playerPunch, reloadPistol, updateBullets, updateParticles, explodeCar, fireBullet, damagePed } from './combat.js';
import { missionObjective, taxiObjective, updateMissions, updateTaxi, toggleTaxi, updateDialogue, currentDialogue } from './missions.js';

export function stepWorld(state, input, dt) {
  const p = state.player;
  state.time += dt;
  state.clockHours = (state.clockHours + dt * MINUTES_PER_SECOND / 60) % 24;
  p.punchCooldown = Math.max(0, p.punchCooldown - dt);
  p.shootCooldown = Math.max(0, p.shootCooldown - dt);
  p.hurtFlash = Math.max(0, p.hurtFlash - dt * 2.5);
  p.bustedTimer = Math.max(0, p.bustedTimer - dt * 0.5);

  // --- Player ------------------------------------------------------------
  if (p.inCar) {
    const car = p.inCar;
    const throttle = input.is('up') ? 1 : input.is('down') ? -1 : 0;
    const steer = input.is('left') ? -1 : input.is('right') ? 1 : 0;
    driveCar(car, { throttle, steer, brake: input.is('brake') }, dt, state.city);
    p.x = car.x; p.y = car.y; p.angle = car.angle;
    p.distanceDriven += Math.hypot(car.vx, car.vy) * dt;
    // Running over pedestrians.
    for (const ped of state.peds) {
      if (ped.state === 'down') continue;
      const d = Math.hypot(ped.x - car.x, ped.y - car.y);
      if (d < 30 && Math.hypot(car.vx, car.vy) > 120) {
        damagePed(state, ped, 100, car.x, car.y);
      }
    }
    if (car.health <= 0) {
      explodeCar(state, car);
      exitCar(state);
      hurtPlayer(state, 20);
    }
    if (input.justPressed('enter')) exitCar(state);
    if (input.justPressed('taxi')) toggleTaxi(state);
    if (input.justPressed('horn')) state.audio.horn();
  } else {
    movePlayerOnFoot(p, input, dt, state.city);
    // Aim at the mouse.
    const cam = state.camera;
    const wx = (input.mouseX - state.view.width / 2) / cam.zoom + cam.x;
    const wy = (input.mouseY - state.view.height / 2) / cam.zoom + cam.y;
    if (Math.hypot(wx - p.x, wy - p.y) > 24) p.angle = Math.atan2(wy - p.y, wx - p.x);
    // Enter a car.
    if (input.justPressed('enter')) {
      const car = nearestCar(state, p.x, p.y, 62);
      if (car) enterCar(state, car);
    }
    // Combat.
    if (input.mousePressed || input.justPressed('melee')) {
      if (p.weapon === 'pistol') playerShoot(state, p.angle);
      else playerPunch(state, p.angle);
    }
    if (input.justPressed('reload')) reloadPistol(state);
    if (input.justPressed('weapon1')) { p.weapon = 'fists'; state.audio.uiClick(); }
    if (input.justPressed('weapon2')) {
      if (p.mag > 0 || p.ammo > 0) { p.weapon = 'pistol'; state.audio.uiClick(); }
      else state.toast('No pistol yet — finish the first mission.', 'info');
    }
    // Pickups.
    for (const pk of state.pickups) {
      if (pk.taken) continue;
      if (Math.hypot(pk.x - p.x, pk.y - p.y) < 26) {
        pk.taken = true;
        if (pk.kind === 'health') { p.hp = Math.min(p.maxHp, p.hp + 40); state.toast('+40 HP', 'good'); }
        if (pk.kind === 'ammo') { p.ammo += 24; state.toast('+24 pistol ammo', 'good'); }
        if (pk.kind === 'cash') { p.cash += pk.amount; p.cashEarned += pk.amount; state.toast(`+$${pk.amount}`, 'good'); }
        state.audio.pickup();
      }
    }
    // Traffic can hit the player on foot.
    for (const car of state.cars) {
      if (car.isPlayerCar || car.removed) continue;
      const d = Math.hypot(car.x - p.x, car.y - p.y);
      const speed = Math.hypot(car.vx, car.vy);
      if (d < 26 && speed > 60) {
        hurtPlayer(state, 12);
        p.x += (p.x - car.x) / (d || 1) * 30;
        p.y += (p.y - car.y) / (d || 1) * 30;
      }
    }
  }

  // --- Traffic + pedestrians ----------------------------------------------
  for (const car of state.cars) {
    if (car.removed || car.isPlayerCar || car.isPolice) continue;
    if (car.ai) updateTrafficCar(car, dt, state);
  }
  for (let i = 0; i < state.cars.length; i += 1) {
    for (let j = i + 1; j < state.cars.length; j += 1) {
      const a = state.cars[i]; const b = state.cars[j];
      if (a.removed || b.removed) continue;
      collideCars(a, b);
    }
  }
  for (const car of state.cars) {
    if (car.removed) continue;
    if (car.health <= 0 && !car.isPlayerCar) explodeCar(state, car);
  }
  state.cars = state.cars.filter((c) => !c.removed);
  for (const ped of state.peds) updatePed(ped, dt, state);

  // --- Police ---------------------------------------------------------------
  decayHeat(state, dt);
  updatePolice(state, dt);
  // Foot officers shoot when the player is wanted and on foot.
  if (p.wanted >= 1 && !p.inCar) {
    for (const cop of state.cops) {
      cop.shootTimer = (cop.shootTimer || state.rng.range(0.5, 1.5)) - dt;
      const d = Math.hypot(cop.x - p.x, cop.y - p.y);
      if (cop.shootTimer <= 0 && d < 420) {
        cop.shootTimer = state.rng.range(1.1, 2.0);
        const angle = Math.atan2(p.y - cop.y, p.x - cop.x) + (state.rng.next() - 0.5) * 0.25;
        fireBullet(state, cop.x + Math.cos(angle) * 18, cop.y + Math.sin(angle) * 18, angle, 'cop', 9);
        state.audio.shoot();
      }
    }
  }

  // --- Combat ----------------------------------------------------------------
  updateBullets(state, dt);
  updateParticles(state, dt);

  // --- Missions, taxi, dialogue ----------------------------------------------
  updateMissions(state, dt);
  updateTaxi(state, dt);
  updateDialogue(state, dt, input);
  state.currentDialogue = currentDialogue(state);
  const taxiObj = taxiObjective(state);
  state.objective = taxiObj || missionObjective(state);

  // --- Population + audio ------------------------------------------------------
  maintainPopulation(state, dt);
  const sirenOn = state.player.wanted > 0 && state.cars.some((c) => c.isPolice);
  state.audio.setSiren(sirenOn);
  const car = p.inCar;
  state.audio.setEngine(car ? Math.abs(Math.hypot(car.vx, car.vy)) / car.def.topSpeed : 0, !!car);
  state.audio.update(dt, true);

  // --- Autosave ------------------------------------------------------------------
  state.saveTimer -= dt;
  if (state.saveTimer <= 0) {
    state.saveTimer = 12;
    state.saveGame(false);
  }
}

export function enterCar(state, car) {
  const p = state.player;
  // A driven car has a driver: pull them out (a crime, and the heat shows it).
  if (car.driver && typeof car.driver === 'object') {
    const driver = car.driver;
    driver.x = car.x + Math.cos(car.angle + Math.PI / 2) * 30;
    driver.y = car.y + Math.sin(car.angle + Math.PI / 2) * 30;
    driver.state = 'flee';
    driver.fleeX = car.x;
    driver.fleeY = car.y;
    car.driver = null;
    addHeat(state, 26, 'stealCar');
    state.lastCrimeAt = state.time;
    p.carsStolen += 1;
    state.toast(`You jacked the ${car.def.name}!`, 'bad');
  } else if (!car.isPlayerCar) {
    addHeat(state, 8, 'stealCar');
    state.lastCrimeAt = state.time;
    p.carsStolen += 1;
  }
  car.driver = 'player';
  car.isPlayerCar = true;
  p.inCar = car;
  p.x = car.x; p.y = car.y;
  state.audio.carEnter();
}

export function exitCar(state) {
  const p = state.player;
  const car = p.inCar;
  if (!car) return;
  car.driver = null;
  car.isPlayerCar = false;
  p.inCar = null;
  p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 30;
  p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 30;
  if (state.city.collideCircle(p.x, p.y, 13)) {
    p.x = car.x - Math.cos(car.angle + Math.PI / 2) * 30;
    p.y = car.y - Math.sin(car.angle + Math.PI / 2) * 30;
  }
  // The taxi shift ends when you leave the cab on foot.
  if (state.mission.taxi.active && car.type !== 'taxi') {
    state.mission.taxi.active = false;
    state.mission.taxi.phase = 'none';
  }
  state.audio.carEnter();
}

// Seed the world with a few parked cars, pedestrians and pickups around the
// player's starting spot, so the first minute already feels alive.
export function seedWorld(state) {
  const rng = state.rng;
  const p = state.player;
  // Parked cars near the start.
  for (let i = 0; i < 6; i += 1) {
    const spot = state.city.randomRoadPoint(rng);
    const car = makeCar(rng.pick(['sedan', 'coupe', 'muscle', 'van', 'sport', 'taxi']), spot.x, spot.y, Math.floor(rng.next() * 4) * Math.PI / 2, rng);
    state.cars.push(car);
  }
  // One taxi right by the start, for the side job.
  const taxi = makeCar('taxi', p.x + 120, p.y + 40, 0, rng);
  state.cars.push(taxi);
  // Traffic already rolling.
  for (let i = 0; i < 8; i += 1) {
    const spot = state.city.randomRoadPoint(rng);
    if (Math.hypot(spot.x - p.x, spot.y - p.y) < 400) continue;
    state.cars.push(makeTrafficCar(rng.pick(['sedan', 'coupe', 'taxi', 'van', 'muscle']), spot.x, spot.y, rng));
  }
  // Pedestrians on the sidewalks.
  for (let i = 0; i < 14; i += 1) {
    const spot = state.city.randomSidewalkPoint(rng);
    state.peds.push(makePed(spot.x, spot.y, rng));
  }
  // Pickups: health by the hospital, ammo by the PD, cash on the beach.
  state.pickups.push({ x: PLACES.hospital.x + 60, y: PLACES.hospital.y, kind: 'health', amount: 0, bob: 0, taken: false });
  state.pickups.push({ x: PLACES.policeHQ.x - 60, y: PLACES.policeHQ.y, kind: 'ammo', amount: 0, bob: 0, taken: false });
  state.pickups.push({ x: PLACES.beachPier.x, y: PLACES.beachPier.y - 60, kind: 'cash', amount: 120, bob: 1, taken: false });
  state.pickups.push({ x: PLACES.marasGarage.x - 60, y: PLACES.marasGarage.y, kind: 'health', amount: 0, bob: 2, taken: false });
}
