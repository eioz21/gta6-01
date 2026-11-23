// Cars: arcade driving physics, stealing, and the traffic AI that drives the
// city's flow along the road grid.
import { CAR_TYPES, clamp, angleDiff, angleLerp, dist2 } from './config.js';
import { makeRng } from './rng.js';

let nextCarId = 1;

export function makeCar(type, x, y, angle, rng) {
  const def = CAR_TYPES[type] || CAR_TYPES.sedan;
  const color = def.colors[Math.floor((rng ? rng.next() : Math.random()) * def.colors.length)];
  return {
    id: nextCarId,
    type, def, color,
    x, y, angle,
    speed: 0,
    // velocity decomposed along the car's heading (arcade model)
    vx: 0, vy: 0,
    health: 100,
    driver: null, // a pedestrian object, or 'player', or null (parked)
    isPolice: type === 'police',
    isPlayerCar: false,
    smoke: 0,
    honkTimer: 0,
    // traffic AI state
    ai: null,
    // taxi state
    taxiFare: null,
    removed: false,
  };
}

// One physics step for a car driven by `ctrl`:
// { throttle: -1..1, steer: -1..1, brake: bool }.
export function driveCar(car, ctrl, dt, city) {
  const def = car.def;
  const forwardX = Math.cos(car.angle);
  const forwardY = Math.sin(car.angle);
  // Speed along the heading.
  let forwardSpeed = car.vx * forwardX + car.vy * forwardY;
  const top = ctrl.throttle > 0 ? def.topSpeed : def.reverseSpeed;
  if (ctrl.throttle !== 0) {
    forwardSpeed += ctrl.throttle * def.accel * dt;
    forwardSpeed = clamp(forwardSpeed, -def.reverseSpeed, def.topSpeed);
  } else {
    // Rolling resistance.
    forwardSpeed -= forwardSpeed * 1.6 * dt;
    if (Math.abs(forwardSpeed) < 4) forwardSpeed = 0;
  }
  if (ctrl.brake) forwardSpeed -= forwardSpeed * 4.5 * dt;
  // Steering: stronger at speed, none when stopped.
  const steerAuthority = clamp(Math.abs(forwardSpeed) / 120, 0, 1);
  const steer = ctrl.steer * def.turn * steerAuthority * (forwardSpeed < 0 ? -1 : 1);
  car.angle += steer * dt;
  // Recompute heading after steering.
  const fx = Math.cos(car.angle);
  const fy = Math.sin(car.angle);
  // Lateral velocity decays with grip (drift feel).
  const rightX = -fy; const rightY = fx;
  let lateral = car.vx * rightX + car.vy * rightY;
  lateral -= lateral * Math.min(1, def.grip * dt);
  car.vx = fx * forwardSpeed + rightX * lateral;
  car.vy = fy * forwardSpeed + rightY * lateral;
  car.x += car.vx * dt;
  car.y += car.vy * dt;
  // Buildings stop the car with a thud. Damage has a short cooldown so
  // grinding along a wall does not melt the car in a second.
  const hit = city.collideCar(car.x, car.y, def.length * 0.42);
  if (hit) {
    // Step back out along the velocity and kill speed.
    car.x -= car.vx * dt;
    car.y -= car.vy * dt;
    const impact = Math.abs(forwardSpeed);
    car.hitCooldown = Math.max(0, (car.hitCooldown || 0) - dt);
    if (impact > 120 && car.hitCooldown <= 0) {
      car.health -= Math.min(8, impact * 0.012);
      car.smoke = Math.min(1, car.smoke + impact * 0.001);
      car.hitCooldown = 0.6;
    }
    car.vx *= -0.25; car.vy *= -0.25;
  } else {
    car.hitCooldown = Math.max(0, (car.hitCooldown || 0) - dt);
  }
  // World bounds and water: bounce back.
  if (car.x < 40 || car.y < 40 || car.x > 3160 || car.y > 3160) {
    car.x = clamp(car.x, 40, 3160);
    car.y = clamp(car.y, 40, 3160);
    car.vx *= -0.3; car.vy *= -0.3;
  }
  return car;
}

// Simple circle-vs-circle push for two cars.
export function collideCars(a, b) {
  const ra = a.def.length * 0.42;
  const rb = b.def.length * 0.42;
  const d2 = dist2(a.x, a.y, b.x, b.y);
  const min = ra + rb;
  if (d2 >= min * min || d2 === 0) return false;
  const d = Math.sqrt(d2);
  const nx = (b.x - a.x) / d; const ny = (b.y - a.y) / d;
  const push = (min - d) / 2;
  a.x -= nx * push; a.y -= ny * push;
  b.x += nx * push; b.y += ny * push;
  const rel = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
  if (rel > 40) {
    const dmg = rel * 0.02;
    a.health -= dmg; b.health -= dmg;
    a.vx -= nx * rel * 0.4; a.vy -= ny * rel * 0.4;
    b.vx += nx * rel * 0.4; b.vy += ny * rel * 0.4;
  }
  return true;
}

// --- Traffic AI -----------------------------------------------------------
// A traffic car drives the grid: it heads for an intersection, then picks a
// new one (never a U-turn), keeping to the right-hand lane.
export function makeTrafficCar(type, x, y, rng) {
  const car = makeCar(type, x, y, 0, rng);
  const dir = Math.floor(rng.next() * 4); // 0 E, 1 S, 2 W, 3 N
  car.angle = dir * Math.PI / 2;
  car.ai = {
    dir,
    target: nextIntersection(x, y, dir, rng),
    speed: rng.range(120, 190),
    wait: 0,
  };
  return car;
}

function nearestLine(v) {
  const lines = [200, 600, 1000, 1400, 1800, 2200, 2600, 3000];
  let best = lines[0]; let bd = Infinity;
  for (const line of lines) { const d = Math.abs(v - line); if (d < bd) { bd = d; best = line; } }
  return best;
}

// Right-hand lane offset for a direction: 0 E, 1 S, 2 W, 3 N.
function laneOffset(dir) {
  if (dir === 0) return { x: 0, y: 15 };
  if (dir === 1) return { x: -15, y: 0 };
  if (dir === 2) return { x: 0, y: -15 };
  return { x: 15, y: 0 };
}

function nextIntersection(x, y, dir, rng) {
  const lines = [200, 600, 1000, 1400, 1800, 2200, 2600, 3000];
  const off = laneOffset(dir);
  if (dir === 0) {
    for (const line of lines) if (line > x + 10) return { x: line, y: nearestLine(y) + off.y };
  }
  if (dir === 2) {
    for (let i = lines.length - 1; i >= 0; i -= 1) if (lines[i] < x - 10) return { x: lines[i], y: nearestLine(y) + off.y };
  }
  if (dir === 1) {
    for (const line of lines) if (line > y + 10) return { x: nearestLine(x) + off.x, y: line };
  }
  if (dir === 3) {
    for (let i = lines.length - 1; i >= 0; i -= 1) if (lines[i] < y - 10) return { x: nearestLine(x) + off.x, y: lines[i] };
  }
  return { x, y };
}

export function updateTrafficCar(car, dt, state) {
  const ai = car.ai;
  if (!ai) return;
  // Slow down for a car directly ahead.
  let desired = ai.speed;
  const fx = Math.cos(car.angle); const fy = Math.sin(car.angle);
  for (const other of state.cars) {
    if (other === car || other.removed) continue;
    const dx = other.x - car.x; const dy = other.y - car.y;
    const ahead = dx * fx + dy * fy;
    const side = Math.abs(dx * -fy + dy * fx);
    if (ahead > 0 && ahead < 70 && side < 26) { desired = 0; break; }
  }
  // Steer toward the target intersection, on the right-hand lane.
  const dx = ai.target.x - car.x; const dy = ai.target.y - car.y;
  const wantAngle = Math.atan2(dy, dx);
  const diff = angleDiff(car.angle, wantAngle);
  const dist = Math.sqrt(dx * dx + dy * dy);
  const steer = clamp(diff * 2.2, -1, 1);
  const speedNow = Math.abs(car.vx * fx + car.vy * fy);
  let throttle = 0;
  if (dist < 26) {
    // Reached the intersection: pick a new direction (no U-turn).
    const options = [0, 1, 2, 3].filter((d) => d !== (ai.dir + 2) % 4);
    ai.dir = options[Math.floor(state.rng.next() * options.length)];
    ai.target = nextIntersection(car.x, car.y, ai.dir, state.rng);
    car.angle = ai.dir * Math.PI / 2;
  } else if (desired > 0 && speedNow < desired) {
    throttle = 1;
  }
  // Keep the car glued to its lane: pull the heading back to the grid axis.
  const axisAngle = Math.round(car.angle / (Math.PI / 2)) * (Math.PI / 2);
  car.angle = angleLerp(car.angle, axisAngle, Math.min(1, 1.2 * dt));
  driveCar(car, { throttle, steer: Math.abs(diff) > 0.05 ? steer : 0, brake: desired === 0 }, dt, state.city);
  // Cap traffic speed.
  const sp = Math.hypot(car.vx, car.vy);
  if (sp > ai.speed + 40) { car.vx *= (ai.speed + 40) / sp; car.vy *= (ai.speed + 40) / sp; }
}
