// Rendering: the camera, the city, the cars, the people, the day/night
// light. Everything is drawn with plain canvas shapes — the whole look of
// Solmar Bay is code, not assets.
import { WORLD, ROAD_LINES, ROAD_HALF, clamp, lerp } from './config.js';
import { districtAt } from './world.js';

export function makeCamera() {
  return { x: 1600, y: 1600, zoom: 1 };
}

// 0..1 darkness for an hour of day: night is dark, midday is bright.
export function darknessAt(hour) {
  // Dawn 6, dusk 19. Smooth ramp between.
  const day = (h) => {
    if (h < 5 || h > 20) return 1;
    if (h < 7) return 1 - (h - 5) / 2;
    if (h < 18) return 0;
    if (h < 20) return (h - 18) / 2;
    return 1;
  };
  return day(hour);
}

function skyTint(hour) {
  const d = darknessAt(hour);
  // Warm golden hour around 17-19, blue night, bright noon.
  if (hour >= 16.5 && hour <= 19) return { r: 255, g: 170, b: 110, a: 0.10 * (1 - d) + 0.05 };
  return { r: 20, g: 40, b: 90, a: 0 };
}

export function renderWorld(ctx, state, view) {
  const { city, player } = state;
  const cam = state.camera;
  const w = view.width; const h = view.height;
  // Camera follows the player (or their car), smoothed.
  const focusX = player.inCar ? player.inCar.x : player.x;
  const focusY = player.inCar ? player.inCar.y : player.y;
  cam.x = lerp(cam.x, focusX, 0.12);
  cam.y = lerp(cam.y, focusY, 0.12);
  const scale = cam.zoom;
  const ox = w / 2 - cam.x * scale;
  const oy = h / 2 - cam.y * scale;
  const hour = state.clockHours;
  const dark = darknessAt(hour);

  ctx.save();
  ctx.clearRect(0, 0, w, h);
  // Ground base: warm sand-grass of a coastal city.
  ctx.fillStyle = '#b8a86a';
  ctx.fillRect(0, 0, w, h);
  ctx.save();
  ctx.translate(ox, oy);
  ctx.scale(scale, scale);

  const vx0 = cam.x - w / 2 / scale - 80;
  const vy0 = cam.y - h / 2 / scale - 80;
  const vx1 = cam.x + w / 2 / scale + 80;
  const vy1 = cam.y + h / 2 / scale + 80;

  // Ground: city grass, sand strip, water on the west and south edges.
  ctx.fillStyle = '#8fae6b';
  ctx.fillRect(Math.max(0, vx0), Math.max(0, vy0), Math.min(WORLD, vx1) - Math.max(0, vx0), Math.min(WORLD, vy1) - Math.max(0, vy0));
  // Beach sand.
  ctx.fillStyle = '#e8d8a0';
  ctx.fillRect(Math.max(120, vx0), 2960, Math.min(3080, vx1) - Math.max(120, vx0), 160);
  // Water: harbour west, marina east, sea south.
  ctx.fillStyle = '#2f7fb8';
  if (vx0 < 120) ctx.fillRect(Math.max(0, vx0), Math.max(0, vy0), 120 - Math.max(0, vx0), Math.min(WORLD, vy1) - Math.max(0, vy0));
  if (vx1 > 3080) ctx.fillRect(3080, Math.max(0, vy0), Math.min(WORLD, vx1) - 3080, Math.min(WORLD, vy1) - Math.max(0, vy0));
  if (vy1 > 3120) ctx.fillRect(Math.max(0, vx0), 3120, Math.min(WORLD, vx1) - Math.max(0, vx0), Math.min(WORLD, vy1) - 3120);
  // Water shimmer lines.
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 2;
  for (let y = 60; y < WORLD; y += 90) {
    if (y < vy0 || y > vy1) continue;
    ctx.beginPath();
    ctx.moveTo(20, y);
    ctx.lineTo(100, y);
    ctx.stroke();
  }

  drawRoads(ctx, city, vx0, vy0, vx1, vy1);
  drawParks(ctx, city, vx0, vy0, vx1, vy1);
  drawBuildings(ctx, city, vx0, vy0, vx1, vy1, dark);
  drawPickups(ctx, state, vx0, vy0, vx1, vy1);
  drawMissionMarkers(ctx, state);
  drawCars(ctx, state, vx0, vy0, vx1, vy1, dark);
  drawPeds(ctx, state, vx0, vy0, vx1, vy1);
  drawCops(ctx, state);
  drawPlayer(ctx, state, dark);
  drawBullets(ctx, state);
  drawParticles(ctx, state);
  ctx.restore();

  // Night overlay + golden-hour tint (screen space).
  if (dark > 0.02) {
    const grad = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.25, w / 2, h / 2, Math.max(w, h) * 0.75);
    grad.addColorStop(0, `rgba(8,12,38,${(dark * 0.42).toFixed(3)})`);
    grad.addColorStop(1, `rgba(8,12,38,${(dark * 0.62).toFixed(3)})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  }
  const tint = skyTint(hour);
  if (tint.a > 0.01) {
    ctx.fillStyle = `rgba(${tint.r},${tint.g},${tint.b},${tint.a.toFixed(3)})`;
    ctx.fillRect(0, 0, w, h);
  }
  // Hurt flash.
  if (player.hurtFlash > 0) {
    ctx.fillStyle = `rgba(200,30,30,${(player.hurtFlash * 0.28).toFixed(3)})`;
    ctx.fillRect(0, 0, w, h);
  }
  ctx.restore();
}

function drawRoads(ctx, city, vx0, vy0, vx1, vy1) {
  // Asphalt.
  ctx.fillStyle = '#3d3d42';
  for (const line of ROAD_LINES) {
    if (line > vy0 - ROAD_HALF && line < vy1 + ROAD_HALF) ctx.fillRect(Math.max(0, vx0), line - ROAD_HALF, Math.min(WORLD, vx1) - Math.max(0, vx0), ROAD_HALF * 2);
    if (line > vx0 - ROAD_HALF && line < vx1 + ROAD_HALF) ctx.fillRect(line - ROAD_HALF, Math.max(0, vy0), ROAD_HALF * 2, Math.min(WORLD, vy1) - Math.max(0, vy0));
  }
  // Sidewalk edges.
  ctx.fillStyle = '#9a9a92';
  for (const line of ROAD_LINES) {
    if (line > vy0 - ROAD_HALF - 8 && line < vy1 + ROAD_HALF + 8) {
      ctx.fillRect(Math.max(0, vx0), line - ROAD_HALF - 8, Math.min(WORLD, vx1) - Math.max(0, vx0), 5);
      ctx.fillRect(Math.max(0, vx0), line + ROAD_HALF + 3, Math.min(WORLD, vx1) - Math.max(0, vx0), 5);
    }
    if (line > vx0 - ROAD_HALF - 8 && line < vx1 + ROAD_HALF + 8) {
      ctx.fillRect(line - ROAD_HALF - 8, Math.max(0, vy0), 5, Math.min(WORLD, vy1) - Math.max(0, vy0));
      ctx.fillRect(line + ROAD_HALF + 3, Math.max(0, vy0), 5, Math.min(WORLD, vy1) - Math.max(0, vy0));
    }
  }
  // Centre dashes.
  ctx.strokeStyle = '#d8c860';
  ctx.lineWidth = 3;
  ctx.setLineDash([22, 26]);
  for (const line of ROAD_LINES) {
    if (line > vy0 - 4 && line < vy1 + 4) {
      ctx.beginPath(); ctx.moveTo(Math.max(0, vx0), line); ctx.lineTo(Math.min(WORLD, vx1), line); ctx.stroke();
    }
    if (line > vx0 - 4 && line < vx1 + 4) {
      ctx.beginPath(); ctx.moveTo(line, Math.max(0, vy0)); ctx.lineTo(line, Math.min(WORLD, vy1)); ctx.stroke();
    }
  }
  ctx.setLineDash([]);
  // Crosswalks at intersections.
  ctx.fillStyle = 'rgba(240,240,230,0.85)';
  for (const lx of ROAD_LINES) {
    for (const ly of ROAD_LINES) {
      if (lx < vx0 - 60 || lx > vx1 + 60 || ly < vy0 - 60 || ly > vy1 + 60) continue;
      for (let i = -3; i <= 3; i += 1) {
        ctx.fillRect(lx + i * 9 - 3, ly - ROAD_HALF - 2, 5, 10);
        ctx.fillRect(lx + i * 9 - 3, ly + ROAD_HALF - 8, 5, 10);
      }
    }
  }
}

function drawParks(ctx, city, vx0, vy0, vx1, vy1) {
  for (const park of city.parks) {
    if (park.x > vx1 || park.x + park.w < vx0 || park.y > vy1 || park.y + park.h < vy0) continue;
    ctx.fillStyle = '#6fa055';
    ctx.fillRect(park.x, park.y, park.w, park.h);
    ctx.strokeStyle = '#5a8a48';
    ctx.lineWidth = 3;
    ctx.strokeRect(park.x, park.y, park.w, park.h);
  }
  for (const lot of city.parkingLots) {
    if (lot.x > vx1 || lot.x + lot.w < vx0 || lot.y > vy1 || lot.y + lot.h < vy0) continue;
    ctx.fillStyle = '#4a4a50';
    ctx.fillRect(lot.x, lot.y, lot.w, lot.h);
    ctx.strokeStyle = 'rgba(240,240,230,0.6)';
    ctx.lineWidth = 2;
    for (let x = lot.x + 20; x < lot.x + lot.w - 10; x += 34) {
      ctx.beginPath(); ctx.moveTo(x, lot.y + 8); ctx.lineTo(x, lot.y + 34); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x, lot.y + lot.h - 8); ctx.lineTo(x, lot.y + lot.h - 34); ctx.stroke();
    }
  }
  // Trees.
  for (const t of city.trees) {
    if (t.x < vx0 || t.x > vx1 || t.y < vy0 || t.y > vy1) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath(); ctx.arc(t.x + 4, t.y + 5, t.r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = t.palm ? '#3f8a4f' : '#4a8a3f';
    ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.beginPath(); ctx.arc(t.x - t.r * 0.3, t.y - t.r * 0.3, t.r * 0.5, 0, Math.PI * 2); ctx.fill();
  }
  // Street lamps (glow at night is drawn in drawBuildings via darkness).
  ctx.fillStyle = '#3a3a3a';
  for (const lamp of city.lamps) {
    if (lamp.x < vx0 || lamp.x > vx1 || lamp.y < vy0 || lamp.y > vy1) continue;
    ctx.fillRect(lamp.x - 2, lamp.y - 2, 4, 4);
  }
}

function drawBuildings(ctx, city, vx0, vy0, vx1, vy1, dark) {
  for (const b of city.buildings) {
    if (b.x > vx1 || b.x + b.w < vx0 || b.y > vy1 || b.y + b.h < vy0) continue;
    // Drop shadow: taller buildings throw a longer shadow.
    const sh = 6 + b.height * 4;
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.fillRect(b.x + sh, b.y + sh, b.w, b.h);
    // Walls.
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    // Roof inset.
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x + 6, b.y + 6, b.w - 12, b.h - 12);
    // Windows: deterministic from the building seed.
    const cols = Math.max(2, Math.floor(b.w / 26));
    const rows = Math.max(2, Math.floor(b.h / 26));
    const cw = b.w / cols; const rh = b.h / rows;
    for (let c = 0; c < cols; c += 1) {
      for (let r = 0; r < rows; r += 1) {
        const on = ((b.seed >> ((c * 3 + r * 7) % 29)) & 1) === 1;
        const lit = dark > 0.5 && on;
        ctx.fillStyle = lit ? '#ffd970' : (on ? '#7fb0d8' : '#5a6a7a');
        ctx.fillRect(b.x + c * cw + cw * 0.25, b.y + r * rh + rh * 0.25, cw * 0.5, rh * 0.5);
      }
    }
    // Downtown towers get a rooftop box.
    if (b.downtown && b.height >= 3) {
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(b.x + b.w * 0.3, b.y + b.h * 0.3, b.w * 0.4, b.h * 0.4);
      ctx.fillStyle = '#8a2a2a';
      ctx.fillRect(b.x + b.w * 0.46, b.y + b.h * 0.46, 8, 8);
    }
  }
}

function drawPickups(ctx, state, vx0, vy0, vx1, vy1) {
  for (const pk of state.pickups) {
    if (pk.taken || pk.x < vx0 || pk.x > vx1 || pk.y < vy0 || pk.y > vy1) continue;
    const bob = Math.sin(state.time * 3 + pk.bob) * 2;
    ctx.save();
    ctx.translate(pk.x, pk.y + bob);
    if (pk.kind === 'health') {
      ctx.fillStyle = '#e8e8e8';
      ctx.fillRect(-11, -11, 22, 22);
      ctx.fillStyle = '#d81e3c';
      ctx.fillRect(-3, -8, 6, 16);
      ctx.fillRect(-8, -3, 16, 6);
    } else if (pk.kind === 'ammo') {
      ctx.fillStyle = '#2a2a2a';
      ctx.fillRect(-11, -8, 22, 16);
      ctx.fillStyle = '#e8a020';
      ctx.fillRect(-8, -5, 4, 10);
      ctx.fillRect(-1, -5, 4, 10);
      ctx.fillRect(6, -5, 4, 10);
    } else {
      ctx.fillStyle = '#2fae5f';
      ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 13px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('$', 0, 1);
    }
    ctx.restore();
  }
}

function drawMissionMarkers(ctx, state) {
  const obj = state.objective;
  if (!obj || obj.self) return;
  const pulse = 1 + Math.sin(state.time * 4) * 0.12;
  ctx.save();
  ctx.translate(obj.x, obj.y);
  ctx.strokeStyle = obj.taxi ? '#f2b705' : '#ffd23f';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(0, 0, 34 * pulse, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = obj.taxi ? 'rgba(242,183,5,0.25)' : 'rgba(255,210,63,0.25)';
  ctx.beginPath();
  ctx.arc(0, 0, 34 * pulse, 0, Math.PI * 2);
  ctx.fill();
  // Beacon pillar.
  const grad = ctx.createLinearGradient(0, -260, 0, 0);
  grad.addColorStop(0, 'rgba(255,210,63,0)');
  grad.addColorStop(1, 'rgba(255,210,63,0.35)');
  ctx.fillStyle = grad;
  ctx.fillRect(-8, -260, 16, 260);
  // Diamond marker.
  ctx.fillStyle = '#ffd23f';
  ctx.beginPath();
  ctx.moveTo(0, -34); ctx.lineTo(12, -18); ctx.lineTo(0, -2); ctx.lineTo(-12, -18);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#1a1a1a';
  ctx.font = 'bold 13px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(obj.marker || '!', 0, -18);
  ctx.restore();
}

function drawCarShape(ctx, car, dark) {
  const def = car.def;
  const len = def.length; const wid = def.width;
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(-len / 2 + 3, -wid / 2 + 4, len, wid);
  // Body.
  ctx.fillStyle = car.color;
  roundRect(ctx, -len / 2, -wid / 2, len, wid, 7);
  ctx.fill();
  // Police livery.
  if (car.isPolice) {
    ctx.fillStyle = '#e8e8e8';
    ctx.fillRect(-len / 2 + 8, -wid / 2, len - 16, wid);
    ctx.fillStyle = '#1c2a44';
    ctx.fillRect(-len / 2 + 8, -wid / 2, 6, wid);
    ctx.fillStyle = '#d81e3c';
    ctx.fillRect(-4, -wid / 2 + 2, 8, 4);
    ctx.fillStyle = '#2456d8';
    ctx.fillRect(-4, wid / 2 - 6, 8, 4);
  }
  // Cabin + windows.
  ctx.fillStyle = 'rgba(30,40,55,0.9)';
  roundRect(ctx, -len * 0.22, -wid / 2 + 3, len * 0.4, wid - 6, 4);
  ctx.fill();
  ctx.fillStyle = 'rgba(160,200,230,0.85)';
  ctx.fillRect(-len * 0.14, -wid / 2 + 5, len * 0.1, wid - 10);
  // Wheels.
  ctx.fillStyle = '#141414';
  const wy = wid / 2 - 1;
  ctx.fillRect(-len / 2 + 4, -wy - 3, 9, 5);
  ctx.fillRect(len / 2 - 13, -wy - 3, 9, 5);
  ctx.fillRect(-len / 2 + 4, wy - 2, 9, 5);
  ctx.fillRect(len / 2 - 13, wy - 2, 9, 5);
  // Headlights at night.
  if (dark > 0.4) {
    ctx.fillStyle = 'rgba(255,240,180,0.9)';
    ctx.fillRect(len / 2 - 2, -wid / 2 + 3, 3, 4);
    ctx.fillRect(len / 2 - 2, wid / 2 - 7, 3, 4);
    const grad = ctx.createLinearGradient(len / 2, 0, len / 2 + 120, 0);
    grad.addColorStop(0, 'rgba(255,240,180,0.20)');
    grad.addColorStop(1, 'rgba(255,240,180,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(len / 2, -wid / 2 + 2);
    ctx.lineTo(len / 2 + 120, -34);
    ctx.lineTo(len / 2 + 120, 34);
    ctx.lineTo(len / 2, wid / 2 - 2);
    ctx.closePath();
    ctx.fill();
  }
  // Damage smoke.
  if (car.health < 55) {
    ctx.fillStyle = 'rgba(60,60,60,0.5)';
    ctx.beginPath();
    ctx.arc(-len / 2 + 6, 0, 6 + Math.sin(Date.now() / 90) * 2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawCars(ctx, state, vx0, vy0, vx1, vy1, dark) {
  for (const car of state.cars) {
    if (car.removed) continue;
    if (car.x < vx0 - 80 || car.x > vx1 + 80 || car.y < vy0 - 80 || car.y > vy1 + 80) continue;
    drawCarShape(ctx, car, dark);
  }
}

function drawPeds(ctx, state, vx0, vy0, vx1, vy1) {
  for (const ped of state.peds) {
    if (ped.removed) continue;
    if (ped.x < vx0 || ped.x > vx1 || ped.y < vy0 || ped.y > vy1) continue;
    ctx.save();
    ctx.translate(ped.x, ped.y);
    if (ped.state === 'down') {
      ctx.rotate(ped.angle);
      ctx.fillStyle = ped.color;
      ctx.fillRect(-12, -5, 24, 10);
      ctx.fillStyle = ped.skin;
      ctx.beginPath(); ctx.arc(13, 0, 6, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      continue;
    }
    const bob = Math.sin(ped.walkPhase) * 2;
    // Shadow.
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath(); ctx.ellipse(0, 4, 8, 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.rotate(ped.angle);
    // Body.
    ctx.fillStyle = ped.color;
    ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = ped.skin;
    ctx.beginPath(); ctx.arc(6, 0, 6, 0, Math.PI * 2); ctx.fill();
    // Facing tick.
    ctx.fillStyle = '#222';
    ctx.fillRect(10, -2 + bob * 0.3, 4, 4);
    ctx.restore();
  }
}

function drawCops(ctx, state) {
  for (const cop of state.cops) {
    ctx.save();
    ctx.translate(cop.x, cop.y);
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath(); ctx.ellipse(0, 4, 8, 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.rotate(cop.angle);
    ctx.fillStyle = '#1c2a44';
    ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e8b98a';
    ctx.beginPath(); ctx.arc(6, 0, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffd23f';
    ctx.fillRect(8, -2, 5, 4);
    ctx.restore();
  }
}

function drawPlayer(ctx, state, dark) {
  const p = state.player;
  if (p.inCar) return;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath(); ctx.ellipse(0, 5, 9, 4.5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.rotate(p.angle);
  // Kai: teal jacket, dark hair.
  ctx.fillStyle = '#0f7a6e';
  ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#e8b98a';
  ctx.beginPath(); ctx.arc(7, 0, 6.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#1d1d22';
  ctx.beginPath(); ctx.arc(4, 0, 6.5, Math.PI * 0.6, Math.PI * 1.5); ctx.fill();
  // Gun in hand when armed.
  if (p.weapon === 'pistol') {
    ctx.fillStyle = '#222';
    ctx.fillRect(10, -2, 10, 4);
  }
  // Aim line (short, subtle).
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(16, 0); ctx.lineTo(30, 0); ctx.stroke();
  ctx.restore();
  // Player ring so the eye finds Kai in a crowd.
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(p.x, p.y, 17, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
}

function drawBullets(ctx, state) {
  ctx.strokeStyle = '#ffe08a';
  ctx.lineWidth = 3;
  for (const b of state.bullets) {
    ctx.beginPath();
    ctx.moveTo(b.x - b.vx * 0.012, b.y - b.vy * 0.012);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
}

function drawParticles(ctx, state) {
  for (const pt of state.particles) {
    const t = pt.life / pt.max;
    if (pt.kind === 'muzzle') {
      ctx.fillStyle = `rgba(255,220,120,${t})`;
      ctx.beginPath(); ctx.arc(pt.x, pt.y, 10 * t + 4, 0, Math.PI * 2); ctx.fill();
    } else if (pt.kind === 'hit' || pt.kind === 'spark') {
      ctx.fillStyle = pt.kind === 'hit' ? `rgba(220,40,40,${t})` : `rgba(255,220,120,${t})`;
      ctx.beginPath(); ctx.arc(pt.x, pt.y, 6 * t + 2, 0, Math.PI * 2); ctx.fill();
    } else if (pt.kind === 'explosion') {
      ctx.fillStyle = `rgba(255,${Math.floor(120 * t)},20,${t})`;
      ctx.beginPath(); ctx.arc(pt.x, pt.y, 46 * (1 - t) + 12, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = `rgba(40,40,40,${t * 0.7})`;
      ctx.beginPath(); ctx.arc(pt.x, pt.y - 10, 26 * (1 - t) + 8, 0, Math.PI * 2); ctx.fill();
    }
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function districtLabel(state) {
  const p = state.player;
  const x = p.inCar ? p.inCar.x : p.x;
  const y = p.inCar ? p.inCar.y : p.y;
  return districtAt(x, y);
}
