// The Solmar PD: the wanted system (heat -> stars) and the police who
// answer it — cruisers that chase and ram, and foot officers who try to
// arrest the player on foot.
import { WANTED_THRESHOLDS, HEAT, clamp, dist2, angleDiff } from './config.js';
import { makeCar, driveCar } from './vehicles.js';

export function starsFromHeat(heat) {
  let stars = 0;
  for (let i = 1; i < WANTED_THRESHOLDS.length; i += 1) {
    if (heat >= WANTED_THRESHOLDS[i]) stars = i;
  }
  return stars;
}

export function addHeat(state, amount, reason) {
  const before = state.player.wanted;
  state.player.heat = clamp(state.player.heat + amount, 0, 100);
  state.player.wanted = starsFromHeat(state.player.heat);
  if (state.player.wanted > before) {
    state.audio.sirenSting();
    state.toast(`Wanted level ${state.player.wanted} — Solmar PD is on you!`, 'bad');
  }
  return state.player.wanted;
}

export function decayHeat(state, dt) {
  const p = state.player;
  if (p.heat <= 0) return;
  // Heat cools only when the player has not committed a crime recently.
  if (state.time - state.lastCrimeAt > 4) {
    p.heat = Math.max(0, p.heat - HEAT.decayPerSecond * dt);
    const stars = starsFromHeat(p.heat);
    if (stars < p.wanted) {
      p.wanted = stars;
      if (stars === 0) state.toast('You lost the cops. Stay clean.', 'good');
    }
  }
}

function makeCopCar(state, x, y) {
  const car = makeCar('police', x, y, 0, state.rng);
  car.isPolice = true;
  car.ai = { police: true, target: null, stuck: 0 };
  return car;
}

function makeCop(state, x, y) {
  return {
    x, y, angle: 0,
    speed: 150,
    hp: 60,
    state: 'chase',
    punchCooldown: 0,
    isCop: true,
    color: '#1c2a44',
    walkPhase: 0,
  };
}

// How many police units the wanted level calls for.
function wantedUnits(stars, inCar) {
  if (stars === 0) return { cars: 0, cops: 0 };
  if (inCar) return { cars: Math.min(stars + 1, 5), cops: 0 };
  return { cars: stars >= 3 ? 2 : 0, cops: Math.min(stars + 1, 4) };
}

export function updatePolice(state, dt) {
  const p = state.player;
  const stars = p.wanted;
  const need = wantedUnits(stars, !!p.inCar);
  // Spawn cruisers at road points near (but not on top of) the player.
  let cars = 0;
  for (const car of state.cars) if (car.isPolice) cars += 1;
  if (cars < need.cars) {
    for (let tries = 0; tries < 8 && cars < need.cars; tries += 1) {
      const spot = state.city.randomRoadPoint(state.rng);
      const d = Math.hypot(spot.x - p.x, spot.y - p.y);
      if (d > 420 && d < 1000) {
        state.cars.push(makeCopCar(state, spot.x, spot.y));
        cars += 1;
      }
    }
  }
  // Spawn foot officers near the player.
  let cops = 0;
  for (const c of state.cops) cops += 1;
  if (cops < need.cops) {
    for (let tries = 0; tries < 8 && cops < need.cops; tries += 1) {
      const spot = state.city.randomSidewalkPoint(state.rng);
      const d = Math.hypot(spot.x - p.x, spot.y - p.y);
      if (d > 260 && d < 700) {
        state.cops.push(makeCop(state, spot.x, spot.y));
        cops += 1;
      }
    }
  }
  // Despawn police when the heat is gone.
  if (stars === 0) {
    for (const car of state.cars) if (car.isPolice) car.removed = true;
    state.cops = [];
  }
  // Cruiser AI: chase the player's car (or the player on foot), ram it.
  // Each cruiser aims at a slightly different point beside the target, so
  // they fan out instead of stacking on one spot.
  const target = p.inCar ? p.inCar : null;
  for (const car of state.cars) {
    if (!car.isPolice || car.removed) continue;
    const tx0 = target ? target.x : p.x;
    const ty0 = target ? target.y : p.y;
    const dx0 = tx0 - car.x; const dy0 = ty0 - car.y;
    const d0 = Math.hypot(dx0, dy0) || 1;
    const off = ((car.id % 3) - 1) * 55;
    const tx = tx0 + (-dy0 / d0) * off;
    const ty = ty0 + (dx0 / d0) * off;
    const dx = tx - car.x; const dy = ty - car.y;
    const d = Math.hypot(dx, dy);
    const wantAngle = Math.atan2(dy, dx);
    const diff = angleDiff(car.angle, wantAngle);
    const steer = clamp(diff * 2.4, -1, 1);
    const throttle = d > 60 ? 1 : 0.4;
    driveCar(car, { throttle, steer, brake: false }, dt, state.city);
    // Ramming the player's car damages it; ramming the player hurts them.
    // Ram damage lands as discrete hits with a cooldown, so three cruisers
    // leaning on the car cannot grind it to nothing in a second.
    car.ramCooldown = Math.max(0, (car.ramCooldown || 0) - dt);
    if (target) {
      const cd = Math.hypot(car.x - target.x, car.y - target.y);
      if (cd < 46 && car.ramCooldown <= 0) {
        target.health -= 7;
        car.health -= 2;
        car.ramCooldown = 1.0;
      }
    } else if (d < 30) {
      hurtPlayer(state, 26 * dt);
    }
    // A cruiser that flips onto a building or gets stuck backs off.
    if (Math.hypot(car.vx, car.vy) < 12) {
      car.ai.stuck += dt;
      if (car.ai.stuck > 3) {
        car.angle += Math.PI / 2;
        car.ai.stuck = 0;
      }
    } else {
      car.ai.stuck = 0;
    }
  }
  // Foot officers: run at the player; touch them long enough and it's a bust.
  for (const cop of state.cops) {
    const dx = p.x - cop.x; const dy = p.y - cop.y;
    const d = Math.hypot(dx, dy);
    if (p.inCar) {
      // Officers scatter from a speeding car.
      if (d < 90) {
        cop.x -= (dx / (d || 1)) * cop.speed * dt;
        cop.y -= (dy / (d || 1)) * cop.speed * dt;
      }
      continue;
    }
    if (d > 14) {
      cop.x += (dx / d) * cop.speed * dt;
      cop.y += (dy / d) * cop.speed * dt;
      cop.angle = Math.atan2(dy, dx);
      cop.walkPhase += dt * 10;
    }
    if (d < 26) {
      p.bustedTimer += dt;
      if (p.bustedTimer > 1.6) {
        state.events.push({ type: 'busted' });
      }
    } else {
      p.bustedTimer = Math.max(0, p.bustedTimer - dt * 2);
    }
  }
  // Clean up removed police cars.
  state.cars = state.cars.filter((c) => !c.removed || c.isPlayerCar);
}

export function hurtPlayer(state, amount) {
  const p = state.player;
  if (p.hp <= 0) return;
  p.hp = Math.max(0, p.hp - amount);
  p.hurtFlash = 1;
  state.audio.hurt();
  if (p.hp <= 0) state.events.push({ type: 'wasted' });
}
