// Combat: fists, the pistol, bullets, and the particles that sell the hits.
// Bullets are simple ray-stepped projectiles; melee is a short arc in front
// of the player.
import { WEAPONS, PLAYER, dist2 } from './config.js';
import { addHeat, hurtPlayer } from './police.js';

export function fireBullet(state, x, y, angle, from, damage) {
  const w = WEAPONS.pistol;
  state.bullets.push({
    x, y,
    vx: Math.cos(angle) * w.bulletSpeed,
    vy: Math.sin(angle) * w.bulletSpeed,
    life: w.range / w.bulletSpeed,
    damage,
    from, // 'player' | 'cop'
  });
  state.particles.push({ x, y, kind: 'muzzle', life: 0.06, max: 0.06 });
}

export function playerShoot(state, angle) {
  const p = state.player;
  if (p.shootCooldown > 0 || p.mag <= 0) {
    if (p.mag <= 0 && p.ammo > 0) reloadPistol(state);
    return false;
  }
  p.shootCooldown = WEAPONS.pistol.cooldown;
  p.mag -= 1;
  const spread = (state.rng.next() - 0.5) * WEAPONS.pistol.spread * 2;
  const sx = p.x + Math.cos(angle) * 20;
  const sy = p.y + Math.sin(angle) * 20;
  fireBullet(state, sx, sy, angle + spread, 'player', WEAPONS.pistol.damage);
  state.audio.shoot();
  addHeat(state, 2, 'shoot');
  state.lastCrimeAt = state.time;
  return true;
}

export function reloadPistol(state) {
  const p = state.player;
  if (p.ammo <= 0 || p.mag >= WEAPONS.pistol.magSize) return;
  const need = WEAPONS.pistol.magSize - p.mag;
  const take = Math.min(need, p.ammo);
  p.mag += take;
  p.ammo -= take;
  state.audio.reload();
  state.toast(`Reloaded — ${p.mag} in the mag`, 'info');
}

export function playerPunch(state, angle) {
  const p = state.player;
  if (p.punchCooldown > 0) return false;
  p.punchCooldown = PLAYER.punchCooldown;
  state.audio.punch();
  let hitAnything = false;
  const px = p.x + Math.cos(angle) * 22;
  const py = p.y + Math.sin(angle) * 22;
  // Peds.
  for (const ped of state.peds) {
    if (ped.state === 'down') continue;
    const d = Math.hypot(ped.x - p.x, ped.y - p.y);
    if (d < PLAYER.punchRange + 12) {
      const a = Math.atan2(ped.y - p.y, ped.x - p.x);
      let diff = a - angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      if (Math.abs(diff) < PLAYER.punchArc) {
        damagePed(state, ped, PLAYER.punchDamage, px, py);
        hitAnything = true;
      }
    }
  }
  // Cops.
  for (const cop of state.cops) {
    const d = Math.hypot(cop.x - p.x, cop.y - p.y);
    if (d < PLAYER.punchRange + 12) {
      cop.hp -= PLAYER.punchDamage;
      state.particles.push({ x: cop.x, y: cop.y, kind: 'hit', life: 0.25, max: 0.25 });
      if (cop.hp <= 0) {
        state.cops.splice(state.cops.indexOf(cop), 1);
        addHeat(state, 30, 'killCop');
        state.lastCrimeAt = state.time;
        state.toast('You dropped an officer! The heat is on.', 'bad');
      }
      hitAnything = true;
    }
  }
  // Cars: a punch dents the nearest car.
  if (!hitAnything) {
    for (const car of state.cars) {
      if (Math.hypot(car.x - p.x, car.y - p.y) < 44) {
        car.health -= 4;
        state.particles.push({ x: px, y: py, kind: 'hit', life: 0.2, max: 0.2 });
        break;
      }
    }
  }
  return hitAnything;
}

export function damagePed(state, ped, damage, hx, hy) {
  ped.hp -= damage;
  state.particles.push({ x: ped.x, y: ped.y, kind: 'hit', life: 0.3, max: 0.3 });
  if (ped.hp <= 0) {
    ped.state = 'down';
    ped.hp = 0;
    state.player.pedsDown += 1;
    addHeat(state, 20, 'killPed');
    state.lastCrimeAt = state.time;
    // The victim drops some cash.
    const drop = state.rng.int(15, 60);
    state.pickups.push({ x: ped.x, y: ped.y, kind: 'cash', amount: drop, bob: 0, taken: false });
    state.audio.thud();
  } else {
    ped.state = 'flee';
    ped.fleeX = state.player.x;
    ped.fleeY = state.player.y;
    addHeat(state, 6, 'punchPed');
    state.lastCrimeAt = state.time;
  }
}

export function updateBullets(state, dt) {
  const p = state.player;
  for (const b of state.bullets) {
    b.life -= dt;
    const steps = 3;
    let hit = false;
    for (let s = 0; s < steps && !hit; s += 1) {
      b.x += (b.vx * dt) / steps;
      b.y += (b.vy * dt) / steps;
      // Buildings eat bullets.
      if (state.city.buildingAt(b.x, b.y)) {
        state.particles.push({ x: b.x, y: b.y, kind: 'spark', life: 0.2, max: 0.2 });
        hit = true;
        break;
      }
      if (b.from === 'player') {
        for (const ped of state.peds) {
          if (ped.state === 'down') continue;
          if (dist2(b.x, b.y, ped.x, ped.y) < 16 * 16) {
            damagePed(state, ped, b.damage, b.x, b.y);
            hit = true;
            break;
          }
        }
        if (!hit) {
          for (const cop of state.cops) {
            if (dist2(b.x, b.y, cop.x, cop.y) < 16 * 16) {
              cop.hp -= b.damage;
              state.particles.push({ x: cop.x, y: cop.y, kind: 'hit', life: 0.25, max: 0.25 });
              if (cop.hp <= 0) {
                state.cops.splice(state.cops.indexOf(cop), 1);
                addHeat(state, 30, 'killCop');
                state.lastCrimeAt = state.time;
              }
              hit = true;
              break;
            }
          }
        }
        if (!hit) {
          for (const car of state.cars) {
            if (car.isPlayerCar) continue;
            if (Math.abs(b.x - car.x) < car.def.length / 2 + 6 && Math.abs(b.y - car.y) < car.def.width / 2 + 6) {
              // Rough rotated-box test: use the car's circle instead.
              if (dist2(b.x, b.y, car.x, car.y) < (car.def.length * 0.45) ** 2) {
                car.health -= b.damage;
                state.particles.push({ x: b.x, y: b.y, kind: 'spark', life: 0.2, max: 0.2 });
                if (car.health <= 0) explodeCar(state, car);
                hit = true;
                break;
              }
            }
          }
        }
      } else if (b.from === 'cop') {
        if (!p.inCar && dist2(b.x, b.y, p.x, p.y) < 15 * 15) {
          hurtPlayer(state, b.damage);
          hit = true;
        } else if (p.inCar && dist2(b.x, b.y, p.inCar.x, p.inCar.y) < 26 * 26) {
          p.inCar.health -= b.damage * 0.4;
          hit = true;
        }
      }
    }
    if (hit) b.life = 0;
  }
  state.bullets = state.bullets.filter((b) => b.life > 0);
}

export function explodeCar(state, car) {
  car.removed = true;
  state.particles.push({ x: car.x, y: car.y, kind: 'explosion', life: 0.8, max: 0.8 });
  state.audio.explosion();
  // Blast hurts nearby peds and the player.
  for (const ped of state.peds) {
    if (ped.state !== 'down' && dist2(ped.x, ped.y, car.x, car.y) < 130 * 130) {
      damagePed(state, ped, 100, car.x, car.y);
    }
  }
  const p = state.player;
  if (!p.inCar && dist2(p.x, p.y, car.x, car.y) < 130 * 130) {
    hurtPlayer(state, 30);
  }
  if (car.driver && car.driver !== 'player' && typeof car.driver === 'object') {
    car.driver.state = 'down';
  }
}

export function updateParticles(state, dt) {
  for (const pt of state.particles) pt.life -= dt;
  state.particles = state.particles.filter((pt) => pt.life > 0);
}
