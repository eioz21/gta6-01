// entities.js — the people of Solmar Bay: pedestrians going about their day,
// and the SBPD foot cops who chase the player when the heat is on.

import { WORLD } from './config.js';
import { makeRng } from './rng.js';
import { isSolid, moveWithCollision, nearestRoadPoint } from './world.js';

const PED_COLORS = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#ecf0f1', '#e67e22', '#1abc9c', '#fd79a8', '#6c5ce7'];
const PED_SHIRTS = ['#c0392b', '#2471a3', '#229954', '#b9770e', '#7d3c98', '#d5dbdb', '#ca6f1e', '#117a65', '#d63384', '#5b4bc4'];

export function makePed(x, y, rng) {
  return {
    x,
    y,
    angle: rng.range(0, Math.PI * 2),
    speed: rng.range(28, 62),
    radius: 12,
    color: rng.pick(PED_COLORS),
    shirt: rng.pick(PED_SHIRTS),
    state: 'walk', // walk | flee | dead
    target: null,
    wait: rng.range(0, 3),
    dead: false,
    hitByCar: false,
    panic: 0,
  };
}

/** Scatter pedestrians on the sidewalks around the player. */
export function populatePeds(city, rng, count, around) {
  const peds = [];
  for (let i = 0; i < count; i += 1) {
    const x = around.x + rng.range(-900, 900);
    const y = around.y + rng.range(-900, 900);
    if (x < 40 || y < 40 || x > WORLD.size - 40 || y > WORLD.size - 40) continue;
    if (isSolid(city, x, y, 14)) continue;
    peds.push(makePed(x, y, rng));
  }
  return peds;
}

/** Pick a new strolling destination on a nearby sidewalk. */
function newTarget(ped, city, rng) {
  const road = nearestRoadPoint(city, ped.x, ped.y);
  const along = rng.range(-260, 260);
  const horizontal = rng.chance(0.5);
  const off = (WORLD.roadWidth / 2 + 14) * (rng.chance(0.5) ? 1 : -1);
  return horizontal
    ? { x: road.x + along, y: road.y + off }
    : { x: road.x + off, y: road.y + along };
}

export function updatePed(city, ped, dt, rng, danger) {
  if (ped.dead) return;
  if (ped.panic > 0) ped.panic -= dt;
  if (danger && Math.hypot(danger.x - ped.x, danger.y - ped.y) < 260) {
    ped.state = 'flee';
    ped.panic = 2.5;
  } else if (ped.panic <= 0 && ped.state === 'flee') {
    ped.state = 'walk';
  }
  const speed = ped.state === 'flee' ? ped.speed * 2.6 : ped.speed;
  if (ped.wait > 0) {
    ped.wait -= dt;
    return;
  }
  if (!ped.target || Math.hypot(ped.target.x - ped.x, ped.target.y - ped.y) < 18) {
    if (ped.state === 'flee' && danger) {
      const away = Math.atan2(ped.y - danger.y, ped.x - danger.x);
      ped.target = { x: ped.x + Math.cos(away) * 300, y: ped.y + Math.sin(away) * 300 };
    } else {
      ped.target = newTarget(ped, city, rng);
    }
    if (Math.random() < 0.25) ped.wait = rng.range(0.5, 2.5);
  }
  const dx = ped.target.x - ped.x;
  const dy = ped.target.y - ped.y;
  const d = Math.hypot(dx, dy) || 1;
  ped.angle = Math.atan2(dy, dx);
  moveWithCollision(city, ped, (dx / d) * speed * dt, (dy / d) * speed * dt);
}

// ---------------------------------------------------------------- foot cops

export function makeCop(x, y) {
  return {
    x,
    y,
    angle: 0,
    speed: 150,
    radius: 13,
    hp: 60,
    state: 'chase',
    shootCooldown: 0,
    dead: false,
    color: '#1b2631',
    shirt: '#2c3e50',
  };
}

/** A foot cop chases the player and shoots when close enough. */
export function updateCop(city, cop, player, dt, fireBullet) {
  if (cop.dead) return;
  const dx = player.x - cop.x;
  const dy = player.y - cop.y;
  const d = Math.hypot(dx, dy) || 1;
  cop.angle = Math.atan2(dy, dx);
  const speed = d > 320 ? cop.speed * 1.25 : cop.speed;
  moveWithCollision(city, cop, (dx / d) * speed * dt, (dy / d) * speed * dt);
  cop.shootCooldown -= dt;
  if (d < 420 && cop.shootCooldown <= 0 && !player.dead) {
    cop.shootCooldown = 1.1 + Math.random() * 0.7;
    const aim = Math.atan2(dy, dx) + (Math.random() - 0.5) * 0.22;
    fireBullet(cop.x, cop.y, aim, 520, 8, 'cop', cop);
  }
}
