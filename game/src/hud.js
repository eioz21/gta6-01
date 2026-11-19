// hud.js — everything drawn over the world: health, cash, wanted stars,
// weapon and ammo, the objective, subtitles, banners, the minimap and the
// clock. All canvas, no DOM, so screenshots show the real HUD.

import { VIEW, PALETTE, WEAPONS } from './config.js';
import { districtAt } from './world.js';
import { objectiveText } from './missions.js';

function star(x, y, size, filled, ctx) {
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const r = i % 2 === 0 ? size : size * 0.45;
    const a = (i * Math.PI) / 5 - Math.PI / 2;
    const px = Math.cos(a) * r;
    const py = Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = filled ? '#ffd34d' : 'rgba(255,255,255,0.18)';
  ctx.strokeStyle = 'rgba(0,0,0,0.7)';
  ctx.lineWidth = 1.5;
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function bar(ctx, x, y, w, h, frac, color, bg = 'rgba(0,0,0,0.6)') {
  ctx.fillStyle = bg;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color;
  ctx.fillRect(x + 1, y + 1, Math.max(0, (w - 2) * Math.min(1, Math.max(0, frac))), h - 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w, h);
}

export function drawMinimap(ctx, g) {
  const size = 190;
  const x0 = VIEW.width - size - 16;
  const y0 = 16;
  const scale = size / 3600;
  ctx.save();
  ctx.fillStyle = 'rgba(8, 12, 20, 0.78)';
  ctx.beginPath();
  ctx.arc(x0 + size / 2, y0 + size / 2, size / 2 + 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x0 + size / 2, y0 + size / 2, size / 2, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = '#3f7a44';
  ctx.fillRect(x0, y0, size, size);
  // Water and sand at the south edge.
  ctx.fillStyle = '#2e7fa8';
  ctx.fillRect(x0, y0 + (3600 - 260) * scale, size, 260 * scale);
  ctx.fillStyle = '#e8d39a';
  ctx.fillRect(x0, y0 + (3600 - 300) * scale, size, 40 * scale);
  // Roads.
  ctx.strokeStyle = '#5a5f6b';
  ctx.lineWidth = 3;
  for (const line of g.city.lines) {
    const p = line * scale;
    ctx.beginPath(); ctx.moveTo(x0 + p, y0); ctx.lineTo(x0 + p, y0 + size); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x0, y0 + p); ctx.lineTo(x0 + size, y0 + p); ctx.stroke();
  }
  // Objective marker.
  const marker = g.objectiveMarker;
  if (marker) {
    const mx = x0 + marker.x * scale;
    const my = y0 + marker.y * scale;
    ctx.fillStyle = '#ffd34d';
    ctx.beginPath();
    ctx.arc(mx, my, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  // Police blips.
  ctx.fillStyle = '#4da3ff';
  for (const cop of g.police.cops) {
    if (cop.dead) continue;
    ctx.fillRect(x0 + cop.x * scale - 2, y0 + cop.y * scale - 2, 4, 4);
  }
  for (const car of g.police.cars) {
    if (car.dead) continue;
    ctx.fillRect(x0 + car.x * scale - 2, y0 + car.y * scale - 2, 4, 4);
  }
  // Player arrow, always centred on the map's view of the world.
  const px = x0 + g.player.x * scale;
  const py = y0 + g.player.y * scale;
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(g.player.angle);
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.moveTo(9, 0);
  ctx.lineTo(-6, -6);
  ctx.lineTo(-3, 0);
  ctx.lineTo(-6, 6);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
  ctx.restore();
  // Compass ring label.
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('N', x0 + size / 2, y0 + size + 16);
  ctx.textAlign = 'left';
}

export function drawHud(ctx, g) {
  const p = g.player;
  ctx.save();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  // Top-left: health, cash, wanted stars, location.
  ctx.fillStyle = PALETTE.hudDark;
  ctx.fillRect(14, 14, 250, 96);
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.strokeRect(14.5, 14.5, 250, 96);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.fillText('LEO CRUZ', 26, 34);
  ctx.fillStyle = p.hp < 30 ? '#e74c3c' : '#2ecc71';
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.fillText(`HP ${Math.ceil(p.hp)}`, 26, 56);
  bar(ctx, 76, 46, 140, 11, p.hp / 100, p.hp < 30 ? '#e74c3c' : '#2ecc71');
  ctx.fillStyle = '#ffd34d';
  ctx.font = 'bold 16px system-ui, sans-serif';
  ctx.fillText(`$${Math.floor(g.money).toLocaleString('en-US')}`, 26, 82);
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillText(districtAt(p.x, p.y), 140, 82);
  const stars = Math.ceil(g.police.stars);
  for (let i = 0; i < 5; i += 1) star(30 + i * 26, 100, 9, i < stars, ctx);

  // Top-centre: clock and day.
  const clock = g.clock;
  const hh = Math.floor(clock / 60) % 24;
  const mm = Math.floor(clock % 60);
  ctx.fillStyle = PALETTE.hudDark;
  ctx.fillRect(VIEW.width / 2 - 70, 14, 140, 30);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}  DAY ${g.day}`, VIEW.width / 2, 35);
  ctx.textAlign = 'left';

  drawMinimap(ctx, g);

  // Bottom-left: weapon and ammo, speed when driving.
  ctx.fillStyle = PALETTE.hudDark;
  ctx.fillRect(14, VIEW.height - 74, 220, 60);
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.strokeRect(14.5, VIEW.height - 73.5, 220, 60);
  const w = WEAPONS[p.weapon];
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 14px system-ui, sans-serif';
  ctx.fillText(w.name, 26, VIEW.height - 48);
  ctx.fillStyle = '#ffd34d';
  ctx.font = 'bold 15px system-ui, sans-serif';
  const ammoText = p.weapon === 'fists' ? '—' : `${p.ammo[p.weapon] ?? 0}`;
  ctx.fillText(`AMMO ${ammoText}`, 26, VIEW.height - 26);
  if (p.car) {
    const kmh = Math.round(Math.abs(p.car.speed) * 0.32);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`${kmh}`, VIEW.width - 230, VIEW.height - 30);
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillText('km/h', VIEW.width - 196, VIEW.height - 30);
    ctx.textAlign = 'left';
  }

  // Objective line under the clock.
  const obj = objectiveText(g);
  ctx.font = 'bold 14px system-ui, sans-serif';
  const tw = ctx.measureText(obj).width;
  ctx.fillStyle = PALETTE.hudDark;
  ctx.fillRect(VIEW.width / 2 - tw / 2 - 14, 52, tw + 28, 28);
  ctx.fillStyle = '#ffd34d';
  ctx.textAlign = 'center';
  ctx.fillText(obj, VIEW.width / 2, 71);
  ctx.textAlign = 'left';

  // Banner (mission title / completion).
  if (g.missions.banner && g.time < g.missions.banner.until) {
    ctx.font = 'bold 30px system-ui, sans-serif';
    const bw = ctx.measureText(g.missions.banner.text).width;
    ctx.fillStyle = 'rgba(8,12,20,0.8)';
    ctx.fillRect(VIEW.width / 2 - bw / 2 - 18, 96, bw + 36, 46);
    ctx.fillStyle = '#ffd34d';
    ctx.textAlign = 'center';
    ctx.fillText(g.missions.banner.text, VIEW.width / 2, 128);
    ctx.textAlign = 'left';
  }

  // Subtitles at the bottom.
  let sy = VIEW.height - 96;
  ctx.font = '15px system-ui, sans-serif';
  for (const sub of g.missions.subtitles) {
    if (g.time > sub.until) continue;
    const sw = ctx.measureText(sub.text).width;
    ctx.fillStyle = 'rgba(0,0,0,0.72)';
    ctx.fillRect(VIEW.width / 2 - sw / 2 - 10, sy - 18, sw + 20, 24);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText(sub.text, VIEW.width / 2, sy);
    ctx.textAlign = 'left';
    sy -= 30;
  }

  // Controls hint, first minute of play.
  if (g.time - g.playStartedAt < 25 && !g.shotMode) {
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillText('WASD move / drive · Mouse aim · Click shoot · E enter car · Shift run · Q weapon · M mute · Esc pause', 16, VIEW.height - 88);
  }

  // Damage flash and low-health pulse.
  if (g.hurtFlash > 0) {
    ctx.fillStyle = `rgba(200, 20, 20, ${Math.min(0.35, g.hurtFlash)})`;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  }
  ctx.restore();
}

export function drawTitle(ctx, g) {
  ctx.save();
  const grad = ctx.createLinearGradient(0, 0, 0, VIEW.height);
  grad.addColorStop(0, 'rgba(10, 16, 34, 0.55)');
  grad.addColorStop(0.55, 'rgba(10, 16, 34, 0.25)');
  grad.addColorStop(1, 'rgba(10, 16, 34, 0.78)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd34d';
  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.fillText('WELCOME TO', VIEW.width / 2, 150);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 96px system-ui, sans-serif';
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = 18;
  ctx.fillText('SOLMAR BAY', VIEW.width / 2, 250);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#ffd34d';
  ctx.font = 'bold 26px system-ui, sans-serif';
  ctx.fillText('— an open-world crime story —', VIEW.width / 2, 292);

  ctx.fillStyle = '#fff';
  ctx.font = '17px system-ui, sans-serif';
  const lines = [
    'Steal cars. Outrun the SBPD. Run five missions for Rosa.',
    'A living city: traffic, pedestrians, taxi fares, the beach and the docks.',
  ];
  lines.forEach((line, i) => ctx.fillText(line, VIEW.width / 2, 340 + i * 26));

  const hasSave = g.hasSave;
  const options = hasSave
    ? ['CONTINUE  — pick up where you left off', 'NEW GAME  — start the story over', 'HOW TO PLAY']
    : ['NEW GAME  — start the story', 'HOW TO PLAY'];
  ctx.font = 'bold 20px system-ui, sans-serif';
  options.forEach((opt, i) => {
    const y = 440 + i * 44;
    const hover = g.titleHover === i;
    ctx.fillStyle = hover ? '#ffd34d' : 'rgba(255,255,255,0.92)';
    if (hover) {
      ctx.fillStyle = 'rgba(255,211,77,0.18)';
      const w = ctx.measureText(opt).width + 36;
      ctx.fillRect(VIEW.width / 2 - w / 2, y - 26, w, 36);
      ctx.fillStyle = '#ffd34d';
    }
    ctx.fillText(opt, VIEW.width / 2, y);
  });

  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillText('WASD move & drive · Mouse aim · Click shoot · E enter / exit car · Shift sprint · Q switch weapon · M mute · Esc pause', VIEW.width / 2, VIEW.height - 60);
  ctx.fillText('An original game. No real city, no real people, no borrowed assets — every pixel drawn in code.', VIEW.width / 2, VIEW.height - 36);
  ctx.restore();
}

export function drawHowTo(ctx) {
  ctx.save();
  ctx.fillStyle = 'rgba(6, 10, 20, 0.92)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd34d';
  ctx.font = 'bold 34px system-ui, sans-serif';
  ctx.fillText('HOW TO PLAY', VIEW.width / 2, 90);
  ctx.fillStyle = '#fff';
  ctx.font = '17px system-ui, sans-serif';
  ctx.textAlign = 'left';
  const rows = [
    ['Move / drive', 'W A S D or arrow keys — W accelerates in a car, S brakes and reverses'],
    ['Aim & shoot', 'Mouse aims, left click fires. Q switches weapon (fists, pistol, SMG, shotgun)'],
    ['Steal a car', 'Walk up to any car and press E. Stealing in front of the police raises your wanted level'],
    ['On foot', 'Shift sprints. Space punches when you have no gun out'],
    ['Wanted level', 'Stars rise when you commit crimes. Hide from the police and they fall'],
    ['Missions', 'Follow the yellow marker. Talk is cheap — Rosa pays in cash'],
    ['Taxi fares', 'After the first mission, drive up to a waiting fare (yellow shirt) for quick cash'],
    ['Save', 'Your money and mission progress save automatically. Esc pauses'],
  ];
  rows.forEach(([head, body], i) => {
    const y = 150 + i * 52;
    ctx.fillStyle = '#ffd34d';
    ctx.font = 'bold 17px system-ui, sans-serif';
    ctx.fillText(head, 220, y);
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = '16px system-ui, sans-serif';
    ctx.fillText(body, 220, y + 22);
  });
  ctx.fillStyle = '#ffd34d';
  ctx.font = 'bold 19px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Press Esc or click to go back', VIEW.width / 2, VIEW.height - 70);
  ctx.restore();
}

export function drawPaused(ctx, g) {
  ctx.save();
  ctx.fillStyle = 'rgba(6, 10, 20, 0.72)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 44px system-ui, sans-serif';
  ctx.fillText('PAUSED', VIEW.width / 2, 260);
  ctx.fillStyle = '#ffd34d';
  ctx.font = 'bold 20px system-ui, sans-serif';
  const options = ['RESUME', 'RESTART MISSION', 'SAVE & QUIT TO TITLE'];
  options.forEach((opt, i) => {
    const y = 340 + i * 44;
    const hover = g.pauseHover === i;
    ctx.fillStyle = hover ? '#ffd34d' : 'rgba(255,255,255,0.92)';
    ctx.fillText(opt, VIEW.width / 2, y);
  });
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = '14px system-ui, sans-serif';
  ctx.fillText('Esc resumes · M toggles sound', VIEW.width / 2, 520);
  ctx.restore();
}

export function drawGameOver(ctx, g) {
  ctx.save();
  ctx.fillStyle = 'rgba(20, 4, 6, 0.82)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#e74c3c';
  ctx.font = 'bold 64px system-ui, sans-serif';
  ctx.fillText('BUSTED', VIEW.width / 2, 280);
  ctx.fillStyle = '#fff';
  ctx.font = '20px system-ui, sans-serif';
  ctx.fillText('Leo got caught. The Bay keeps your cash — half of it, anyway.', VIEW.width / 2, 330);
  ctx.fillStyle = '#ffd34d';
  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.fillText('Click to try again from the safehouse', VIEW.width / 2, 400);
  ctx.restore();
}
