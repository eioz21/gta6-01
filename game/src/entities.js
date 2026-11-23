// The people of Solmar Bay: the player, pedestrians with routines, and the
// pickups they drop. Also the population managers that keep traffic and
// pedestrians flowing around the player.
import { PLAYER, PED_COLORS, clamp, dist2 } from './config.js';
import { makeCar, makeTrafficCar } from './vehicles.js';

let nextPedId = 1;

export function makePlayer(x, y) {
  return {
    x, y, angle: -Math.PI / 2,
    vx: 0, vy: 0,
    hp: PLAYER.maxHp, maxHp: PLAYER.maxHp,
    cash: 150,
    weapon: 'fists',
    ammo: 0, // pistol reserve ammo
    mag: 0, // pistol magazine
    inCar: null,
    punchCooldown: 0,
    shootCooldown: 0,
    hurtFlash: 0,
    wanted: 0,
    heat: 0,
    bustedTimer: 0,
    // stats
    carsStolen: 0,
    missionsDone: 0,
    cashEarned: 0,
    pedsDown: 0,
    distanceDriven: 0,
  };
}

export function makePed(x, y, rng) {
  return {
    id: nextPedId,
    x, y,
    angle: rng.next() * Math.PI * 2,
    speed: rng.range(28, 52),
    color: rng.pick(PED_COLORS),
    skin: rng.pick(['#e8b98a', '#c98a5a', '#8a5a3b', '#f0c8a0']),
    state: 'walk', // walk | idle | flee | down
    target: null,
    wait: rng.range(0, 4),
    hp: 30,
    fleeX: 0, fleeY: 0,
    walkPhase: rng.next() * Math.PI * 2,
  };
}

export function makePickup(x, y, kind, amount) {
  return { x, y, kind, amount, bob: Math.random() * Math.PI * 2, taken: false };
}

export function movePlayerOnFoot(player, input, dt, city) {
  let mx = 0; let my = 0;
  if (input.is('up')) my -= 1;
  if (input.is('down')) my += 1;
  if (input.is('left')) mx -= 1;
  if (input.is('right')) mx += 1;
  const running = input.is('run');
  const speed = running ? PLAYER.runSpeed : PLAYER.walkSpeed;
  const len = Math.hypot(mx, my);
  if (len > 0) {
    mx /= len; my /= len;
    const nx = player.x + mx * speed * dt;
    const ny = player.y + my * speed * dt;
    // Axis-separated collision so the player slides along walls.
    if (!city.collideCircle(nx, player.y, PLAYER.radius)) player.x = nx;
    if (!city.collideCircle(player.x, ny, PLAYER.radius)) player.y = ny;
    player.angle = Math.atan2(my, mx);
    player.moving = true;
    player.running = running;
  } else {
    player.moving = false;
    player.running = false;
  }
  player.x = clamp(player.x, 20, 3180);
  player.y = clamp(player.y, 20, 3180);
}

export function updatePed(ped, dt, state) {
  if (ped.state === 'down') return;
  const rng = state.rng;
  if (ped.state === 'flee') {
    // Run away from the threat point.
    const dx = ped.x - ped.fleeX; const dy = ped.y - ped.fleeY;
    const d = Math.hypot(dx, dy) || 1;
    const speed = 150;
    const nx = ped.x + (dx / d) * speed * dt;
    const ny = ped.y + (dy / d) * speed * dt;
    if (!state.city.collideCircle(nx, ped.y, 10)) ped.x = nx;
    if (!state.city.collideCircle(ped.x, ny, 10)) ped.y = ny;
    ped.angle = Math.atan2(dy, dx);
    ped.walkPhase += dt * 14;
    if (Math.hypot(ped.x - ped.fleeX, ped.y - ped.fleeY) > 420) ped.state = 'walk';
    return;
  }
  if (ped.state === 'idle') {
    ped.wait -= dt;
    if (ped.wait <= 0) { ped.state = 'walk'; ped.target = null; }
    return;
  }
  // Walk: head for the target sidewalk point, pick a new one on arrival.
  if (!ped.target) {
    ped.target = state.city.randomSidewalkPoint(rng);
  }
  const dx = ped.target.x - ped.x; const dy = ped.target.y - ped.y;
  const d = Math.hypot(dx, dy);
  if (d < 12) {
    if (rng.chance(0.25)) { ped.state = 'idle'; ped.wait = rng.range(2, 7); }
    ped.target = null;
    return;
  }
  const nx = ped.x + (dx / d) * ped.speed * dt;
  const ny = ped.y + (dy / d) * ped.speed * dt;
  if (!state.city.collideCircle(nx, ped.y, 10)) ped.x = nx;
  if (!state.city.collideCircle(ped.x, ny, 10)) ped.y = ny;
  ped.angle = Math.atan2(dy, dx);
  ped.walkPhase += dt * 8;
}

export function scarePedsNear(state, x, y, radius) {
  for (const ped of state.peds) {
    if (ped.state === 'down') continue;
    if (dist2(ped.x, ped.y, x, y) < radius * radius) {
      ped.state = 'flee';
      ped.fleeX = x; ped.fleeY = y;
    }
  }
}

// --- Population -----------------------------------------------------------
// Keep a lively ring of traffic and pedestrians around the player, recycling
// anything that wanders too far away.
const TRAFFIC_TYPES = ['sedan', 'sedan', 'sedan', 'coupe', 'taxi', 'van', 'muscle', 'truck', 'sport'];
const MAX_TRAFFIC = 14;
const MAX_PEDS = 26;
const MAX_PARKED = 10;

export function maintainPopulation(state, dt) {
  const p = state.player;
  const rng = state.rng;
  // Traffic cars on roads near the player.
  let traffic = 0;
  for (const car of state.cars) if (car.ai) traffic += 1;
  if (traffic < MAX_TRAFFIC) {
    const spot = state.city.randomRoadPoint(rng);
    const d = Math.hypot(spot.x - p.x, spot.y - p.y);
    if (d > 350 && d < 1100) {
      const car = makeTrafficCar(rng.pick(TRAFFIC_TYPES), spot.x, spot.y, rng);
      state.cars.push(car);
    }
  }
  // Parked cars along roads.
  let parked = 0;
  for (const car of state.cars) if (!car.ai && !car.isPlayerCar && !car.isPolice) parked += 1;
  if (parked < MAX_PARKED && rng.chance(0.02)) {
    const spot = state.city.randomRoadPoint(rng);
    const d = Math.hypot(spot.x - p.x, spot.y - p.y);
    if (d > 300 && d < 900) {
      const type = rng.pick(['sedan', 'coupe', 'muscle', 'van', 'sport']);
      const car = makeCar(type, spot.x + rng.range(-14, 14), spot.y + rng.range(-14, 14), Math.floor(rng.next() * 4) * Math.PI / 2, rng);
      state.cars.push(car);
    }
  }
  // Pedestrians on sidewalks near the player.
  if (state.peds.length < MAX_PEDS && rng.chance(0.1)) {
    const spot = state.city.randomSidewalkPoint(rng);
    const d = Math.hypot(spot.x - p.x, spot.y - p.y);
    if (d > 200 && d < 900) state.peds.push(makePed(spot.x, spot.y, rng));
  }
  // Recycle anything far away.
  for (const car of state.cars) {
    if (car.isPlayerCar || car.isPolice) continue;
    const d = Math.hypot(car.x - p.x, car.y - p.y);
    if (d > 1500) car.removed = true;
  }
  for (const ped of state.peds) {
    const d = Math.hypot(ped.x - p.x, ped.y - p.y);
    if (d > 1400) ped.removed = true;
  }
  state.cars = state.cars.filter((c) => !c.removed);
  state.peds = state.peds.filter((c) => !c.removed);
}

export function nearestCar(state, x, y, maxDist) {
  let best = null; let bestD = maxDist * maxDist;
  for (const car of state.cars) {
    if (car.removed || car.isPolice) continue;
    const d = dist2(car.x, car.y, x, y);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}
