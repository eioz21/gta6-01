// police.js — the wanted system and the SBPD's response. Crimes raise the
// heat; police cars and foot cops spawn at the map edge and chase; stay out of
// sight and the stars fall away. The police never cheat: they drive and shoot
// with the same rules as everything else.

import { WANTED } from './config.js';
import { makeCop, updateCop } from './entities.js';
import { spawnPoliceCar } from './vehicles.js';
import { isSolid } from './world.js';

export function createPolice() {
  return {
    stars: 0, // fractional; the HUD rounds up
    unseenTimer: 0,
    spawnTimer: 0,
    cops: [],
    cars: [],
  };
}

export function addWanted(police, amount) {
  const before = Math.ceil(police.stars);
  police.stars = Math.min(WANTED.maxStars, police.stars + amount);
  police.unseenTimer = 0;
  return Math.ceil(police.stars) > before;
}

export function clearWanted(police) {
  police.stars = 0;
  police.unseenTimer = 0;
  for (const cop of police.cops) cop.dead = true;
  for (const car of police.cars) car.dead = true;
}

/** A crime at (x, y): the police only see it when a cop, a police car or a
 *  witness pedestrian is close enough to notice. */
export function crimeSeenBy(police, peds, x, y) {
  for (const cop of police.cops) {
    if (!cop.dead && Math.hypot(cop.x - x, cop.y - y) < 520) return true;
  }
  for (const car of police.cars) {
    if (!car.dead && Math.hypot(car.x - x, car.y - y) < 520) return true;
  }
  for (const ped of peds) {
    if (!ped.dead && Math.hypot(ped.x - x, ped.y - y) < 300) return true;
  }
  return false;
}

function spawnPositionNear(player, rng, dist) {
  const angle = rng.range(0, Math.PI * 2);
  const x = Math.max(60, Math.min(3540, player.x + Math.cos(angle) * dist));
  const y = Math.max(60, Math.min(3540, player.y + Math.sin(angle) * dist));
  return { x, y };
}

export function updatePolice(city, police, player, peds, dt, rng, fireBullet) {
  const stars = Math.ceil(police.stars);
  const anyNear = police.cops.some((c) => !c.dead && Math.hypot(c.x - player.x, c.y - player.y) < 480)
    || police.cars.some((c) => !c.dead && Math.hypot(c.x - player.x, c.y - player.y) < 520);

  if (stars === 0) {
    police.unseenTimer = 0;
  } else if (!anyNear) {
    police.unseenTimer += dt;
    if (police.unseenTimer > WANTED.decayDelay) {
      police.stars = Math.max(0, police.stars - WANTED.decayRate * dt);
    }
  } else {
    police.unseenTimer = 0;
  }

  // Spawn reinforcements while the heat is on.
  police.spawnTimer -= dt;
  if (stars > 0 && police.spawnTimer <= 0) {
    police.spawnTimer = stars >= 3 ? 1.6 : 2.6;
    const wantCops = Math.min(WANTED.maxCops, stars * 2 + 1);
    const wantCars = Math.min(WANTED.maxPoliceCars, stars >= 2 ? stars - 1 : 0);
    const liveCops = police.cops.filter((c) => !c.dead).length;
    const liveCars = police.cars.filter((c) => !c.dead).length;
    if (liveCops < wantCops && stars >= WANTED.copFootAt) {
      const pos = spawnPositionNear(player, rng, 620);
      police.cops.push(makeCop(pos.x, pos.y));
    } else if (liveCars < wantCars && stars >= WANTED.copCarAt) {
      const pos = spawnPositionNear(player, rng, 700);
      police.cars.push(spawnPoliceCar(city, pos.x, pos.y, rng));
    }
  }

  for (const cop of police.cops) {
    if (!cop.dead) updateCop(city, cop, player, dt, fireBullet);
  }
}

/** A police car chases the player: steer toward them, ram on contact. */
export function updatePoliceCar(city, car, player, dt, onRam) {
  const dx = player.x - car.x;
  const dy = player.y - car.y;
  const dist = Math.hypot(dx, dy) || 1;
  const wantAngle = Math.atan2(dy, dx);
  let diff = wantAngle - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const turnRate = 2.4;
  car.angle += Math.max(-turnRate * dt, Math.min(turnRate * dt, diff));
  const wantSpeed = dist > 120 ? car.top : car.top * 0.55;
  car.speed += Math.sign(wantSpeed - car.speed) * Math.min(Math.abs(wantSpeed - car.speed), 320 * dt);
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  if (!isSolid(city, nx, ny, car.len / 2 - 6)) {
    car.x = nx;
    car.y = ny;
  } else {
    car.speed *= 0.4;
    car.angle += 0.35;
  }
  if (dist < (car.len + 40) / 2 + 10 && Math.abs(car.speed) > 120 && onRam) onRam(car);
}
