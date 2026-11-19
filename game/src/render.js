// render.js — draws Solmar Bay from above, camera following the player.
// Buildings get a fake height (a dark side wall and a roof offset toward the
// sun), roads get lane dashes, and the day/night cycle tints the whole scene.

import { WORLD, PALETTE, VIEW } from './config.js';

function drawBuilding(ctx, b, cam) {
  const x = b.x - cam.x;
  const y = b.y - cam.y;
  const h = b.height;
  // The wall: the building's footprint shifted down-right, as if the sun
  // is up and to the left.
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.fillRect(x + h * 0.35, y + h * 0.35, b.w, b.h);
  ctx.fillStyle = b.wall;
  ctx.fillRect(x + h * 0.35, y + h * 0.35, b.w, b.h);
  // The roof.
  ctx.fillStyle = b.roof;
  ctx.fillRect(x, y, b.w, b.h);
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 1, y + 1, b.w - 2, b.h - 2);
  // Roof details: a lighter inner panel, and a skylight on tall towers.
  ctx.fillStyle = 'rgba(255,255,255,0.10)';
  ctx.fillRect(x + 6, y + 6, b.w - 12, b.h - 12);
  if (b.height > 24) {
    ctx.fillStyle = 'rgba(180,220,255,0.55)';
    ctx.fillRect(x + b.w / 2 - 8, y + b.h / 2 - 8, 16, 16);
  } else if (b.warehouse) {
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.fillRect(x + 8, y + b.h / 2 - 3, b.w - 16, 6);
  }
}

function drawCarShape(ctx, car, cam) {
  const x = car.x - cam.x;
  const y = car.y - cam.y;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(car.angle);
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(-car.len / 2 + 3, -car.wid / 2 + 3, car.len, car.wid);
  // Body.
  ctx.fillStyle = car.color;
  ctx.beginPath();
  ctx.roundRect(-car.len / 2, -car.wid / 2, car.len, car.wid, 7);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.45)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // Cabin and windshield.
  ctx.fillStyle = 'rgba(20,30,45,0.85)';
  ctx.beginPath();
  ctx.roundRect(-car.len * 0.18, -car.wid / 2 + 4, car.len * 0.36, car.wid - 8, 4);
  ctx.fill();
  ctx.fillStyle = 'rgba(160,210,240,0.7)';
  ctx.fillRect(car.len * 0.18, -car.wid / 2 + 5, 5, car.wid - 10);
  // Headlights and tail lights.
  ctx.fillStyle = '#fff8c9';
  ctx.fillRect(car.len / 2 - 3, -car.wid / 2 + 3, 3, 5);
  ctx.fillRect(car.len / 2 - 3, car.wid / 2 - 8, 3, 5);
  ctx.fillStyle = car.brakeLight ? '#ff2d2d' : '#a33';
  ctx.fillRect(-car.len / 2, -car.wid / 2 + 3, 3, 5);
  ctx.fillRect(-car.len / 2, car.wid / 2 - 8, 3, 5);
  if (car.police) {
    // Light bar, flashing red/blue.
    const flash = Math.floor(performance.now() / 180) % 2 === 0;
    ctx.fillStyle = flash ? '#ff2d2d' : '#2d7dff';
    ctx.fillRect(-6, -car.wid / 2 + 2, 12, 5);
    ctx.fillStyle = flash ? '#2d7dff' : '#ff2d2d';
    ctx.fillRect(-6, car.wid / 2 - 7, 12, 5);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 8px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SBPD', 0, 3);
  }
  if (car.model === 'taxi') {
    ctx.fillStyle = '#111';
    ctx.font = 'bold 8px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('TAXI', 0, 3);
  }
  ctx.restore();
  if (car.smoke > 0.05) {
    ctx.fillStyle = `rgba(120,120,120,${Math.min(0.6, car.smoke)})`;
    ctx.beginPath();
    ctx.arc(x - Math.cos(car.angle) * car.len * 0.6, y - Math.sin(car.angle) * car.len * 0.6, 8 + (1 - car.smoke) * 8, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawPerson(ctx, p, cam, isPlayer) {
  const x = p.x - cam.x;
  const y = p.y - cam.y;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(p.angle);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(2, 3, 11, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  // Body: a circle for the torso, a smaller one for the head.
  ctx.fillStyle = p.shirt;
  ctx.beginPath();
  ctx.arc(0, 0, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = p.color;
  ctx.beginPath();
  ctx.arc(2, 0, 6.5, 0, Math.PI * 2);
  ctx.fill();
  // Direction nose so the facing is readable.
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.moveTo(12, 0);
  ctx.lineTo(5, -4);
  ctx.lineTo(5, 4);
  ctx.closePath();
  ctx.fill();
  if (isPlayer) {
    // A white ring so the player never gets lost in a crowd.
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, 0, 15, 0, Math.PI * 2);
    ctx.stroke();
    // The gun, when armed.
    if (p.weapon && p.weapon !== 'fists') {
      ctx.strokeStyle = '#222';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(10, 0);
      ctx.lineTo(22, 0);
      ctx.stroke();
    }
  }
  if (p.gang) {
    ctx.fillStyle = '#8e44ad';
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.rotate(-p.angle);
    ctx.fillText('VIPER', 0, -20);
  }
  if (p.fare) {
    ctx.fillStyle = '#ffd34d';
    ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.rotate(-p.angle);
    ctx.fillText('!', 0, -20);
  }
  ctx.restore();
}

/** The yellow objective marker: a pulsing diamond and a beam of light. */
function drawMarker(ctx, marker, cam, time) {
  if (!marker) return;
  const x = marker.x - cam.x;
  const y = marker.y - cam.y;
  const pulse = 1 + Math.sin(time * 5) * 0.12;
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = 'rgba(255, 211, 77, 0.14)';
  ctx.beginPath();
  ctx.ellipse(0, 0, 46 * pulse, 20 * pulse, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffd34d';
  ctx.strokeStyle = '#7a5c00';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, -34 * pulse);
  ctx.lineTo(12, -16 * pulse);
  ctx.lineTo(0, 2);
  ctx.lineTo(-12, -16 * pulse);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

export function renderWorld(ctx, g) {
  const cam = g.camera;
  const city = g.city;
  const vw = VIEW.width;
  const vh = VIEW.height;
  const left = cam.x;
  const top = cam.y;
  const right = cam.x + vw;
  const bottom = cam.y + vh;

  // Ground: grass everywhere, then the beach and the sea.
  ctx.fillStyle = PALETTE.grass;
  ctx.fillRect(0, 0, vw, vh);
  const beachY = city.beachTop - top;
  if (beachY < vh) {
    ctx.fillStyle = PALETTE.sand;
    ctx.fillRect(0, Math.max(0, beachY), vw, vh - Math.max(0, beachY));
    ctx.fillStyle = PALETTE.water;
    ctx.fillRect(0, Math.max(0, beachY + 120), vw, vh);
    ctx.fillStyle = PALETTE.waterDeep;
    for (let i = 0; i < 5; i += 1) {
      const wy = beachY + 170 + i * 46 - top * 0;
      if (wy > 0 && wy < vh) {
        ctx.fillRect(((i * 260 + g.time * 12) % (vw + 200)) - 100, wy, 90, 3);
      }
    }
  }

  // Parks.
  for (const park of city.parks) {
    if (park.x > right || park.x + park.w < left || park.y > bottom || park.y + park.h < top) continue;
    ctx.fillStyle = PALETTE.parkGrass;
    ctx.fillRect(park.x - left, park.y - top, park.w, park.h);
    ctx.strokeStyle = 'rgba(0,0,0,0.2)';
    ctx.strokeRect(park.x - left, park.y - top, park.w, park.h);
  }

  // Roads and sidewalks.
  const half = WORLD.roadWidth / 2;
  for (const line of city.lines) {
    if (line + half > left && line - half < right) {
      ctx.fillStyle = PALETTE.sidewalk;
      ctx.fillRect(line - half - WORLD.sidewalk - left, 0, WORLD.roadWidth + WORLD.sidewalk * 2, vh);
      ctx.fillStyle = PALETTE.road;
      ctx.fillRect(line - half - left, 0, WORLD.roadWidth, vh);
    }
    if (line + half > top && line - half < bottom) {
      ctx.fillStyle = PALETTE.sidewalk;
      ctx.fillRect(0, line - half - WORLD.sidewalk - top, vw, WORLD.roadWidth + WORLD.sidewalk * 2);
      ctx.fillStyle = PALETTE.road;
      ctx.fillRect(0, line - half - top, vw, WORLD.roadWidth);
    }
  }
  // Lane dashes.
  ctx.fillStyle = PALETTE.roadLine;
  for (const line of city.lines) {
    if (line > left - 4 && line < right + 4) {
      for (let y = Math.floor(top / 44) * 44; y < bottom; y += 44) {
        ctx.fillRect(line - left - 2, y - top, 4, 22);
      }
    }
    if (line > top - 4 && line < bottom + 4) {
      for (let x = Math.floor(left / 44) * 44; x < right; x += 44) {
        ctx.fillRect(x - left, line - top - 2, 22, 4);
      }
    }
  }

  // Docks: concrete apron and the water line on the west edge (world coords).
  ctx.fillStyle = '#8a8d90';
  ctx.fillRect(0 - left, 2200 - top, 300, WORLD.size - 2200);
  ctx.fillStyle = PALETTE.water;
  ctx.fillRect(0 - left, 2200 - top, 24, WORLD.size - 2200);

  // Trees.
  for (const t of city.trees) {
    if (t.x < left - 20 || t.x > right + 20 || t.y < top - 20 || t.y > bottom + 20) continue;
    ctx.fillStyle = '#2d6a2e';
    ctx.beginPath();
    ctx.arc(t.x - left, t.y - top, t.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3f8f3a';
    ctx.beginPath();
    ctx.arc(t.x - left - 3, t.y - top - 3, t.r * 0.6, 0, Math.PI * 2);
    ctx.fill();
  }

  // Props: containers and lamps.
  for (const prop of city.props) {
    if (prop.x < left - 60 || prop.x > right + 60 || prop.y < top - 60 || prop.y > bottom + 60) continue;
    if (prop.kind === 'container') {
      ctx.fillStyle = prop.color;
      ctx.fillRect(prop.x - left, prop.y - top, prop.w, prop.h);
      ctx.strokeStyle = 'rgba(0,0,0,0.4)';
      ctx.strokeRect(prop.x - left, prop.y - top, prop.w, prop.h);
    } else if (prop.kind === 'lamp') {
      ctx.fillStyle = '#333';
      ctx.fillRect(prop.x - left, prop.y - top, 3, 10);
      ctx.fillStyle = '#ffe98a';
      ctx.beginPath();
      ctx.arc(prop.x - left + 1, prop.y - top, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Buildings, sorted so nearer ones draw over farther ones (painter's order).
  const visible = city.buildings.filter((b) => b.x + b.w > left - 80 && b.x < right + 80 && b.y + b.h > top - 80 && b.y < bottom + 80);
  visible.sort((a, b) => a.y - b.y);
  for (const b of visible) drawBuilding(ctx, b, cam);

  drawMarker(ctx, g.objectiveMarker, cam, g.time);

  // Pickups.
  for (const pk of g.pickups) {
    if (pk.dead) continue;
    const x = pk.x - left;
    const y = pk.y - top + Math.sin(pk.bob) * 3;
    ctx.save();
    ctx.translate(x, y);
    if (pk.kind === 'cash') {
      ctx.fillStyle = '#2ecc71';
      ctx.beginPath();
      ctx.arc(0, 0, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('$', 0, 5);
    } else if (pk.kind === 'health') {
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(0, 0, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#e74c3c';
      ctx.fillRect(-2.5, -8, 5, 16);
      ctx.fillRect(-8, -2.5, 16, 5);
    } else if (pk.kind === 'ammo') {
      ctx.fillStyle = '#f39c12';
      ctx.beginPath();
      ctx.arc(0, 0, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#222';
      ctx.fillRect(-6, -3, 12, 6);
    }
    ctx.restore();
  }

  // Cars: traffic and police behind the player, then the player's car.
  const cars = [...g.cars, ...g.police.cars].filter((c) => !c.dead);
  cars.sort((a, b) => a.y - b.y);
  for (const car of cars) {
    if (car === g.player.car) continue;
    if (car.x < left - 80 || car.x > right + 80 || car.y < top - 80 || car.y > bottom + 80) continue;
    drawCarShape(ctx, car, cam);
  }
  if (g.player.car && !g.player.car.dead) drawCarShape(ctx, g.player.car, cam);

  // People.
  const people = [...g.peds, ...g.police.cops, ...g.missions.gang].filter((p) => !p.dead);
  people.sort((a, b) => a.y - b.y);
  for (const p of people) {
    if (p.x < left - 30 || p.x > right + 30 || p.y < top - 30 || p.y > bottom + 30) continue;
    drawPerson(ctx, p, cam, false);
  }
  // Dead bodies stay visible for a while.
  for (const p of [...g.peds, ...g.police.cops, ...g.missions.gang]) {
    if (!p.dead || p.faded) continue;
    const x = p.x - left;
    const y = p.y - top;
    if (x < -30 || x > vw + 30 || y < -30 || y > vh + 30) continue;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(p.angle + Math.PI / 2);
    ctx.fillStyle = p.shirt;
    ctx.beginPath();
    ctx.ellipse(0, 0, 13, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(14, 0, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  if (!g.player.dead && !g.player.car) drawPerson(ctx, g.player, cam, true);

  // Bullets.
  ctx.fillStyle = '#ffe98a';
  for (const b of g.bullets) {
    if (b.dead) continue;
    const x = b.x - left;
    const y = b.y - top;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(b.angle);
    ctx.fillRect(-7, -1.5, 14, 3);
    ctx.restore();
  }

  // Particles.
  for (const p of g.particles) {
    if (p.dead) continue;
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x - left, p.y - top, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Day/night tint: golden hour by day, blue dark by night.
  const hour = (g.clock / 60) % 24;
  let tint = null;
  if (hour >= 19 || hour < 6) tint = 'rgba(16, 24, 64, 0.30)';
  else if (hour >= 17) tint = 'rgba(255, 150, 60, 0.10)';
  else if (hour >= 6 && hour < 8) tint = 'rgba(255, 170, 90, 0.12)';
  if (tint) {
    ctx.fillStyle = tint;
    ctx.fillRect(0, 0, vw, vh);
  }

  // A soft vignette so the edges fall away like a camera lens.
  const vig = ctx.createRadialGradient(vw / 2, vh / 2, vh * 0.45, vw / 2, vh / 2, vh * 0.95);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(0,0,0,0.28)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, vw, vh);
}
