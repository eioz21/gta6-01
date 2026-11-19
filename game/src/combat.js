// combat.js — shooting, punching, bullets, explosions and pickups.
// Nothing here knows about the screen; it only moves numbers and reports hits.

import { WEAPONS } from './config.js';
import { isSolid } from './world.js';
import { circleHitsCar } from './vehicles.js';

export function makeBullet(x, y, angle, speed, damage, owner, range) {
  return {
    x, y, angle, speed, damage, owner, range,
    travelled: 0,
    dead: false,
  };
}

export function fireBulletInto(bullets, x, y, angle, speed, damage, owner, range = 600) {
  bullets.push(makeBullet(x, y, angle, speed, damage, owner, range));
}

/** Move bullets; test them against buildings, cars and people. Returns hit events. */
export function updateBullets(city, bullets, dt, targets) {
  const hits = [];
  for (const b of bullets) {
    if (b.dead) continue;
    const step = b.speed * dt;
    b.x += Math.cos(b.angle) * step;
    b.y += Math.sin(b.angle) * step;
    b.travelled += step;
    if (b.travelled > b.range || isSolid(city, b.x, b.y, 2)) {
      b.dead = true;
      hits.push({ kind: 'wall', x: b.x, y: b.y });
      continue;
    }
    for (const t of targets) {
      if (t.dead || t === b.ownerRef) continue;
      if (t.isCar) {
        if (circleHitsCar(b.x, b.y, 3, t)) {
          b.dead = true;
          t.hp = (t.hp ?? 100) - b.damage;
          hits.push({ kind: 'car', x: b.x, y: b.y, target: t, damage: b.damage });
          break;
        }
      } else if (Math.hypot(t.x - b.x, t.y - b.y) < (t.radius || 13) + 3) {
        b.dead = true;
        t.hp = (t.hp ?? 100) - b.damage;
        if (t.hp <= 0) t.dead = true;
        hits.push({ kind: 'person', x: b.x, y: b.y, target: t, damage: b.damage, killed: t.dead });
        break;
      }
    }
  }
  return hits;
}

/** A shotgun blast: several pellets fanned around the aim. */
export function fireShotgun(bullets, x, y, angle, weapon) {
  const pellets = weapon.pellets || 6;
  for (let i = 0; i < pellets; i += 1) {
    const spread = (Math.random() - 0.5) * 0.34;
    fireBulletInto(bullets, x, y, angle + spread, weapon.bulletSpeed * (0.9 + Math.random() * 0.2), weapon.damage, 'player', weapon.range);
  }
}

export function fireWeapon(bullets, x, y, angle, weaponKey) {
  const w = WEAPONS[weaponKey];
  if (!w || weaponKey === 'fists') return false;
  if (weaponKey === 'shotgun') fireShotgun(bullets, x, y, angle, w);
  else fireBulletInto(bullets, x, y, angle, w.bulletSpeed, w.damage, 'player', w.range);
  return true;
}

// ---------------------------------------------------------------- particles

export function spawnParticles(list, x, y, color, count, speed = 160, life = 0.5, size = 3) {
  for (let i = 0; i < count; i += 1) {
    const a = Math.random() * Math.PI * 2;
    const v = speed * (0.4 + Math.random() * 0.8);
    list.push({
      x, y,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v,
      life: life * (0.6 + Math.random() * 0.7),
      maxLife: life,
      size: size * (0.6 + Math.random() * 0.8),
      color,
      dead: false,
    });
  }
}

export function updateParticles(list, dt) {
  for (const p of list) {
    p.life -= dt;
    if (p.life <= 0) { p.dead = true; continue; }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.96;
    p.vy *= 0.96;
  }
}

// ---------------------------------------------------------------- pickups

export function makePickup(kind, x, y) {
  return { kind, x, y, radius: 16, dead: false, bob: Math.random() * Math.PI * 2 };
}

export function updatePickups(pickups, player, dt, onCollect) {
  for (const p of pickups) {
    if (p.dead) continue;
    p.bob += dt * 4;
    if (!player.dead && Math.hypot(p.x - player.x, p.y - player.y) < p.radius + 14) {
      p.dead = true;
      onCollect(p);
    }
  }
}
