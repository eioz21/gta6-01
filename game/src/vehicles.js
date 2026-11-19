// vehicles.js — cars: parked, traffic and police. Traffic follows the road
// grid in lanes; the player drives with arcade physics (accelerate, steer,
// handbrake) and collides with buildings, other cars and pedestrians.

import { WORLD, CAR_MODELS } from './config.js';
import { makeRng } from './rng.js';
import { isSolid, nearestRoadPoint, onRoad } from './world.js';

let nextCarId = 1;

export function makeCar(model, x, y, angle, opts = {}) {
  const def = CAR_MODELS[model];
  const color = opts.color || def.colors[Math.floor(Math.random() * def.colors.length)];
  return {
    id: nextCarId,
    model,
    name: def.name,
    x,
    y,
    angle,
    speed: 0,
    top: def.top,
    accel: def.accel,
    grip: def.grip,
    len: def.len,
    wid: def.wid,
    color,
    parked: !!opts.parked,
    traffic: !!opts.traffic,
    police: !!opts.police,
    targetSpeed: opts.targetSpeed || 0,
    lane: opts.lane || 0, // -1 or 1: which side of the road it drives on
    dir: opts.dir || 0, // 0 = along x, 1 = along y
    turnAt: 0,
    dead: false,
    smoke: 0,
    brakeLight: false,
  };
}

/** Scatter parked cars and start traffic moving on the roads. */
export function populateCars(city, rng, count) {
  const cars = [];
  const lines = city.lines;
  for (let i = 0; i < count; i += 1) {
    const parked = rng.chance(0.45);
    const line = rng.pick(lines);
    const along = rng.range(300, WORLD.size - 300);
    const models = ['sedan', 'sedan', 'sedan', 'taxi', 'sports', 'van', 'muscle', 'truck'];
    const model = rng.pick(models);
    if (parked) {
      // Parked along a road edge, just off the asphalt.
      const horizontal = rng.chance(0.5);
      const side = rng.chance(0.5) ? 1 : -1;
      const x = horizontal ? along : line + side * (WORLD.roadWidth / 2 + 16);
      const y = horizontal ? line + side * (WORLD.roadWidth / 2 + 16) : along;
      const angle = horizontal ? (side > 0 ? 0 : Math.PI) : (side > 0 ? Math.PI / 2 : -Math.PI / 2);
      const car = makeCar(model, x, y, angle, { parked: true });
      if (!isSolid(city, x, y, 20)) cars.push(car);
    } else {
      const horizontal = rng.chance(0.5);
      const lane = rng.chance(0.5) ? -1 : 1;
      const x = horizontal ? along : line + lane * 30;
      const y = horizontal ? line + lane * 30 : along;
      const angle = horizontal ? (lane > 0 ? 0 : Math.PI) : (lane > 0 ? Math.PI / 2 : -Math.PI / 2);
      const car = makeCar(model, x, y, angle, {
        traffic: true,
        lane,
        dir: horizontal ? 0 : 1,
        targetSpeed: rng.range(120, 200),
      });
      cars.push(car);
    }
  }
  return cars;
}

/** Circle-vs-oriented-rectangle test, used for car-vs-car and car-vs-person. */
export function circleHitsCar(px, py, r, car) {
  const cos = Math.cos(-car.angle);
  const sin = Math.sin(-car.angle);
  const dx = px - car.x;
  const dy = py - car.y;
  const lx = dx * cos - dy * sin;
  const ly = dx * sin + dy * cos;
  return Math.abs(lx) < car.len / 2 + r && Math.abs(ly) < car.wid / 2 + r;
}

export function carsOverlap(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dist = Math.hypot(dx, dy);
  return dist < (a.len + b.len) / 2 - 6;
}

/** One traffic car's step: follow its lane, turn at intersections, slow for cars ahead. */
export function updateTrafficCar(city, car, cars, dt) {
  if (car.parked || car.police) return;
  const aheadX = car.x + Math.cos(car.angle) * (car.len / 2 + 26);
  const aheadY = car.y + Math.sin(car.angle) * (car.len / 2 + 26);
  let blocked = false;
  for (const other of cars) {
    if (other === car || other.dead) continue;
    if (Math.hypot(other.x - aheadX, other.y - aheadY) < 34) { blocked = true; break; }
  }
  const want = blocked ? 0 : car.targetSpeed;
  car.speed += Math.sign(want - car.speed) * Math.min(Math.abs(want - car.speed), 160 * dt);
  if (Math.abs(car.speed) < 1) return;
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  if (isSolid(city, nx, ny, 18)) {
    // Hit a wall: turn around at the next intersection instead of pushing through.
    car.angle += Math.PI;
    car.x += Math.cos(car.angle) * 4;
    car.y += Math.sin(car.angle) * 4;
    return;
  }
  car.x = nx;
  car.y = ny;
  // At an intersection, sometimes turn onto the crossing road.
  const nearX = Math.abs(car.x - nearestRoadPoint(city, car.x, car.y).x) < 8;
  const nearY = Math.abs(car.y - nearestRoadPoint(city, car.x, car.y).y) < 8;
  if (nearX && nearY && Math.random() < dt * 0.35) {
    const horizontal = car.dir === 0;
    const turn = Math.random() < 0.5 ? 1 : -1;
    car.dir = horizontal ? 1 : 0;
    car.angle = horizontal
      ? (turn > 0 ? Math.PI / 2 : -Math.PI / 2)
      : (turn > 0 ? Math.PI : 0);
    car.lane = turn;
  }
}

/** Drive the player's car with arcade physics. Returns a hit report for the caller. */
export function drivePlayerCar(city, car, input, cars, peds, dt, onHitPed, onCrash) {
  const forward = input.down('KeyW') || input.down('ArrowUp');
  const back = input.down('KeyS') || input.down('ArrowDown');
  const left = input.down('KeyA') || input.down('ArrowLeft');
  const right = input.down('KeyD') || input.down('ArrowRight');
  const handbrake = input.down('Space');

  if (forward) car.speed += car.accel * dt;
  if (back) car.speed -= car.accel * 0.7 * dt;
  if (!forward && !back) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 140 * dt);
  if (handbrake) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 420 * dt);
  car.speed = Math.max(-car.top * 0.45, Math.min(car.top, car.speed));

  const steer = (left ? -1 : 0) + (right ? 1 : 0);
  const grip = handbrake ? car.grip * 0.55 : car.grip;
  if (steer !== 0 && Math.abs(car.speed) > 12) {
    car.angle += steer * grip * (car.speed / car.top) * dt * (car.speed < 0 ? -1 : 1);
  }

  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  const speedBefore = Math.abs(car.speed);

  if (isSolid(city, nx, ny, car.len / 2 - 6)) {
    if (speedBefore > 200 && onCrash) onCrash(speedBefore);
    car.speed *= -0.25;
    car.smoke = Math.max(car.smoke, speedBefore > 260 ? 0.8 : 0.3);
  } else {
    car.x = nx;
    car.y = ny;
  }
  car.x = Math.max(20, Math.min(WORLD.size - 20, car.x));
  car.y = Math.max(20, Math.min(WORLD.size - 20, car.y));

  // Bump into other cars.
  for (const other of cars) {
    if (other === car || other.dead) continue;
    if (carsOverlap(car, other)) {
      const dx = car.x - other.x;
      const dy = car.y - other.y;
      const d = Math.hypot(dx, dy) || 1;
      const push = ((car.len + other.len) / 2 - 6 - d) / 2;
      car.x += (dx / d) * push;
      car.y += (dy / d) * push;
      if (!other.parked && !other.police) {
        other.x -= (dx / d) * push;
        other.y -= (dy / d) * push;
        other.speed = car.speed * 0.4;
      }
      if (speedBefore > 240 && onCrash) onCrash(speedBefore);
      car.speed *= 0.55;
    }
  }

  // Running over pedestrians is a crime, and it slows the car.
  for (const ped of peds) {
    if (ped.dead) continue;
    if (circleHitsCar(ped.x, ped.y, 10, car) && Math.abs(car.speed) > 40) {
      ped.dead = true;
      ped.hitByCar = true;
      car.speed *= 0.7;
      if (onHitPed) onHitPed(ped);
    }
  }
  car.brakeLight = back || handbrake;
  return { offRoad: !onRoad(city, car.x, car.y) };
}

/** The closest car to a point, within `maxDist`. */
export function nearestCar(cars, x, y, maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const car of cars) {
    if (car.dead) continue;
    const d = Math.hypot(car.x - x, car.y - y);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}

export function spawnPoliceCar(city, x, y, rng) {
  const road = nearestRoadPoint(city, x, y);
  const car = makeCar('police', road.x + rng.range(-80, 80), road.y + rng.range(-80, 80), 0, { police: true });
  car.targetSpeed = 380;
  return car;
}
