// The HUD: health, cash, wanted stars, clock, weapon, minimap, objective,
// dialogue subtitles, toasts — plus the title, pause, wasted and busted
// screens. All drawn on the same canvas, in screen space.
import { WORLD, ROAD_LINES, WEAPONS, clamp } from './config.js';
import { darknessAt } from './render.js';
import { districtAt } from './world.js';

export function drawHUD(ctx, state, view) {
  const w = view.width; const h = view.height;
  const p = state.player;
  const hour = state.clockHours;
  drawMinimap(ctx, state, w, h);
  drawTopBar(ctx, state, w, h);
  drawHealth(ctx, state, w, h);
  drawWeapon(ctx, state, w, h);
  drawObjective(ctx, state, w, h);
  drawDialogue(ctx, state, w, h);
  drawToasts(ctx, state, w, h);
  if (p.inCar) drawSpeed(ctx, state, w, h);
  if (state.mission.timeLeft > 0 && state.mission.active) drawTimer(ctx, state, w, h);
}

function drawTopBar(ctx, state, w, h) {
  const p = state.player;
  const hour = state.clockHours;
  const hh = Math.floor(hour);
  const mm = Math.floor((hour - hh) * 60);
  const timeStr = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  const x = p.x; const y = p.y;
  const px = p.inCar ? p.inCar.x : p.x;
  const py = p.inCar ? p.inCar.y : p.y;
  const district = districtAt(px, py);
  ctx.save();
  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';
  // Cash.
  ctx.font = 'bold 26px Arial';
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillText(`$${Math.floor(p.cash).toLocaleString('en-US')}`, w - 18, 12);
  ctx.fillStyle = '#7ee787';
  ctx.fillText(`$${Math.floor(p.cash).toLocaleString('en-US')}`, w - 20, 10);
  // Clock + district.
  ctx.font = 'bold 17px Arial';
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillText(`${timeStr}  •  ${district}`, w - 18, 44);
  ctx.fillStyle = '#fff';
  ctx.fillText(`${timeStr}  •  ${district}`, w - 20, 42);
  // Wanted stars.
  const stars = p.wanted;
  ctx.font = '30px Arial';
  ctx.textAlign = 'right';
  for (let i = 0; i < 5; i += 1) {
    const sx = w - 28 - i * 34;
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillText('★', sx + 2, 72);
    ctx.fillStyle = i < stars ? '#ffd23f' : 'rgba(255,255,255,0.35)';
    ctx.fillText('★', sx, 70);
  }
  ctx.restore();
}

function drawHealth(ctx, state, w, h) {
  const p = state.player;
  const bw = 220; const bh = 16;
  const x = 20; const y = 20;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(x - 2, y - 2, bw + 4, bh + 4);
  ctx.fillStyle = '#333';
  ctx.fillRect(x, y, bw, bh);
  const frac = clamp(p.hp / p.maxHp, 0, 1);
  ctx.fillStyle = frac > 0.5 ? '#4fc46a' : frac > 0.25 ? '#e8a020' : '#d81e3c';
  ctx.fillRect(x, y, bw * frac, bh);
  ctx.font = 'bold 13px Arial';
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(`HP ${Math.ceil(p.hp)}`, x + 8, y + bh / 2 + 0.5);
  // Car health when driving.
  if (p.inCar) {
    const cy = y + bh + 10;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(x - 2, cy - 2, bw + 4, bh + 4);
    ctx.fillStyle = '#333';
    ctx.fillRect(x, cy, bw, bh);
    const cfrac = clamp(p.inCar.health / 100, 0, 1);
    ctx.fillStyle = cfrac > 0.5 ? '#5a8fd8' : '#d81e3c';
    ctx.fillRect(x, cy, bw * cfrac, bh);
    ctx.fillStyle = '#fff';
    ctx.fillText(`${p.inCar.def.name} ${Math.ceil(p.inCar.health)}%`, x + 8, cy + bh / 2 + 0.5);
  }
  ctx.restore();
}

function drawWeapon(ctx, state, w, h) {
  const p = state.player;
  const x = 20; const y = h - 64;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(x, y, 190, 44);
  ctx.fillStyle = '#ffd23f';
  ctx.font = 'bold 16px Arial';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  const weapon = WEAPONS[p.weapon];
  if (p.weapon === 'pistol') {
    ctx.fillText(`🔫 ${weapon.name}`, x + 12, y + 14);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 15px Arial';
    ctx.fillText(`${p.mag} / ${p.ammo}`, x + 12, y + 32);
  } else {
    ctx.fillText(`✊ ${weapon.name}`, x + 12, y + 14);
    ctx.fillStyle = '#ccc';
    ctx.font = '13px Arial';
    ctx.fillText('Press 2 for pistol', x + 12, y + 32);
  }
  ctx.restore();
}

function drawObjective(ctx, state, w, h) {
  const obj = state.objective;
  if (!obj) return;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.font = 'bold 17px Arial';
  const label = obj.label;
  const tw = ctx.measureText(label).width;
  const x = w / 2; const y = 16;
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(x - tw / 2 - 14, y, tw + 28, 30);
  ctx.fillStyle = obj.taxi ? '#f2b705' : '#ffd23f';
  ctx.fillText(label, x, y + 16);
  // Distance readout.
  const p = state.player;
  const px = p.inCar ? p.inCar.x : p.x;
  const py = p.inCar ? p.inCar.y : p.y;
  const d = Math.hypot(obj.x - px, obj.y - py);
  ctx.font = '13px Arial';
  ctx.fillStyle = '#fff';
  ctx.fillText(`${Math.round(d)}m`, x, y + 48);
  ctx.restore();
  drawEdgeArrow(ctx, state, w, h, obj);
}

// A pulsing arrow at the screen edge pointing at an off-screen objective.
function drawEdgeArrow(ctx, state, w, h, obj) {
  const cam = state.camera;
  const sx = (obj.x - cam.x) * cam.zoom + w / 2;
  const sy = (obj.y - cam.y) * cam.zoom + h / 2;
  if (sx > 40 && sx < w - 40 && sy > 40 && sy < h - 40) return;
  const cx = clamp(sx, 50, w - 50);
  const cy = clamp(sy, 90, h - 50);
  const angle = Math.atan2(sy - cy, sx - cx);
  const pulse = 1 + Math.sin(state.time * 5) * 0.15;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  ctx.scale(pulse, pulse);
  ctx.fillStyle = '#ffd23f';
  ctx.beginPath();
  ctx.moveTo(16, 0);
  ctx.lineTo(-8, -10);
  ctx.lineTo(-8, 10);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawMinimap(ctx, state, w, h) {
  const size = 190;
  const x = w - size - 16;
  const y = h - size - 16;
  const scale = size / WORLD;
  ctx.save();
  ctx.fillStyle = 'rgba(10,14,24,0.78)';
  ctx.fillRect(x - 4, y - 4, size + 8, size + 8);
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x - 4, y - 4, size + 8, size + 8);
  // Water.
  ctx.fillStyle = '#2f7fb8';
  ctx.fillRect(x, y, 120 * scale, size);
  ctx.fillRect(x, y + 3120 * scale, size, size - 3120 * scale);
  // Roads.
  ctx.strokeStyle = 'rgba(200,200,200,0.75)';
  ctx.lineWidth = 2;
  for (const line of ROAD_LINES) {
    ctx.beginPath(); ctx.moveTo(x + line * scale, y); ctx.lineTo(x + line * scale, y + size); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x, y + line * scale); ctx.lineTo(x + size, y + line * scale); ctx.stroke();
  }
  // Objective marker.
  const obj = state.objective;
  if (obj && !obj.self) {
    const pulse = 1 + Math.sin(state.time * 4) * 0.3;
    ctx.fillStyle = obj.taxi ? '#f2b705' : '#ffd23f';
    ctx.beginPath();
    ctx.arc(x + obj.x * scale, y + obj.y * scale, 5 * pulse, 0, Math.PI * 2);
    ctx.fill();
  }
  // Police dots.
  ctx.fillStyle = '#4f8ef7';
  for (const car of state.cars) {
    if (!car.isPolice) continue;
    ctx.fillRect(x + car.x * scale - 2, y + car.y * scale - 2, 4, 4);
  }
  ctx.fillStyle = '#7ab8ff';
  for (const cop of state.cops) {
    ctx.fillRect(x + cop.x * scale - 2, y + cop.y * scale - 2, 4, 4);
  }
  // Player arrow.
  const p = state.player;
  const px = p.inCar ? p.inCar.x : p.x;
  const py = p.inCar ? p.inCar.y : p.y;
  const angle = p.inCar ? p.inCar.angle : p.angle;
  ctx.save();
  ctx.translate(x + px * scale, y + py * scale);
  ctx.rotate(angle);
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.moveTo(8, 0);
  ctx.lineTo(-6, -5);
  ctx.lineTo(-6, 5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  // North + night tint hint.
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.font = 'bold 11px Arial';
  ctx.textAlign = 'left';
  ctx.fillText('N', x + 4, y + 12);
  ctx.restore();
}

function drawSpeed(ctx, state, w, h) {
  const car = state.player.inCar;
  const speed = Math.hypot(car.vx, car.vy);
  const kmh = Math.round(speed * 0.36);
  ctx.save();
  ctx.textAlign = 'right';
  ctx.font = 'bold 34px Arial';
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillText(`${kmh}`, w - 218, h - 18);
  ctx.fillStyle = '#fff';
  ctx.fillText(`${kmh}`, w - 220, h - 20);
  ctx.font = 'bold 13px Arial';
  ctx.fillStyle = '#ccc';
  ctx.fillText('km/h', w - 218, h - 52);
  ctx.restore();
}

function drawTimer(ctx, state, w, h) {
  const t = Math.max(0, state.mission.timeLeft);
  const mm = Math.floor(t / 60);
  const ss = Math.floor(t % 60);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.font = 'bold 30px Arial';
  const str = `${mm}:${String(ss).padStart(2, '0')}`;
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillText(str, w / 2 + 2, 102);
  ctx.fillStyle = t < 15 ? '#ff5a5a' : '#fff';
  ctx.fillText(str, w / 2, 100);
  ctx.restore();
}

function drawDialogue(ctx, state, w, h) {
  const line = state.currentDialogue;
  if (!line) return;
  ctx.save();
  const text = `${line.who}: ${line.text}`;
  ctx.font = '16px Arial';
  const tw = Math.min(ctx.measureText(text).width, w - 120);
  const x = w / 2;
  const y = h - 150;
  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  ctx.fillRect(x - tw / 2 - 16, y - 22, tw + 32, 40);
  ctx.fillStyle = '#ffd23f';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y - 1, w - 120);
  ctx.restore();
}

function drawToasts(ctx, state, w, h) {
  ctx.save();
  ctx.textAlign = 'left';
  ctx.font = 'bold 15px Arial';
  let y = 120;
  const now = state.time;
  for (const toast of state.toasts) {
    const age = now - toast.at;
    if (age > 5) continue;
    const alpha = age > 4 ? 1 - (age - 4) : 1;
    ctx.globalAlpha = alpha;
    const tw = ctx.measureText(toast.text).width;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(20, y, tw + 24, 28);
    ctx.fillStyle = toast.kind === 'bad' ? '#ff7a7a' : toast.kind === 'good' ? '#7ee787' : toast.kind === 'mission' ? '#ffd23f' : '#fff';
    ctx.fillText(toast.text, 32, y + 15);
    y += 34;
  }
  ctx.restore();
}

// --- Screens ---------------------------------------------------------------

export function drawTitle(ctx, state, view) {
  const w = view.width; const h = view.height;
  // Dim the world behind the title.
  ctx.fillStyle = 'rgba(8,10,24,0.55)';
  ctx.fillRect(0, 0, w, h);
  ctx.save();
  ctx.textAlign = 'center';
  // Sun-soaked title.
  ctx.font = 'bold 84px Arial';
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillText('SOLMAR BAY', w / 2 + 4, h * 0.30 + 4);
  const grad = ctx.createLinearGradient(0, h * 0.22, 0, h * 0.32);
  grad.addColorStop(0, '#ffd23f');
  grad.addColorStop(0.55, '#ff8a3d');
  grad.addColorStop(1, '#ff5a5a');
  ctx.fillStyle = grad;
  ctx.fillText('SOLMAR BAY', w / 2, h * 0.30);
  ctx.font = 'bold 22px Arial';
  ctx.fillStyle = '#fff';
  ctx.fillText('A sun-soaked open-world crime story', w / 2, h * 0.30 + 38);
  ctx.font = '16px Arial';
  ctx.fillStyle = '#ffd9a0';
  ctx.fillText('Kai Mercer owes $50,000 to Vince Kessler. The city is the way out.', w / 2, h * 0.30 + 66);
  // Menu.
  const cy = h * 0.52;
  ctx.font = 'bold 24px Arial';
  const hasSave = !!state.saveExists;
  const lines = [
    hasSave ? '[ ENTER ]  Continue — pick up where you left off' : '[ ENTER ]  New Game — start the story',
    '[ N ]  New Game — start over from the beginning',
    '',
    'WASD move / drive   •   E enter & steal cars   •   Mouse aim, Click shoot',
    'F punch   •   1 / 2 weapons   •   R reload   •   Space handbrake',
    'T taxi shift (in a taxi)   •   P pause   •   M mute',
  ];
  lines.forEach((line, i) => {
    ctx.fillStyle = i === 0 ? '#ffd23f' : '#e8e8e8';
    ctx.font = i === 0 ? 'bold 24px Arial' : '16px Arial';
    ctx.fillText(line, w / 2, cy + i * 30);
  });
  ctx.font = '13px Arial';
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.fillText('Steal cars, outrun the Solmar PD, run 5 story missions, drive taxi fares. Autosaves as you play.', w / 2, h - 30);
  ctx.restore();
}

export function drawPause(ctx, state, view) {
  const w = view.width; const h = view.height;
  ctx.fillStyle = 'rgba(8,10,24,0.6)';
  ctx.fillRect(0, 0, w, h);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.font = 'bold 48px Arial';
  ctx.fillStyle = '#fff';
  ctx.fillText('PAUSED', w / 2, h * 0.32);
  const p = state.player;
  ctx.font = '18px Arial';
  ctx.fillStyle = '#ffd23f';
  ctx.fillText(`Cash $${Math.floor(p.cash).toLocaleString('en-US')}   •   Missions ${p.missionsDone}/5   •   Cars stolen ${p.carsStolen}   •   Earned $${Math.floor(p.cashEarned).toLocaleString('en-US')}`, w / 2, h * 0.32 + 40);
  ctx.font = 'bold 20px Arial';
  ctx.fillStyle = '#fff';
  const lines = [
    '[ P / Esc ]  Resume',
    '[ Q ]  Save & quit to title',
    '[ M ]  Sound on/off',
  ];
  lines.forEach((line, i) => ctx.fillText(line, w / 2, h * 0.5 + i * 32));
  ctx.font = '15px Arial';
  ctx.fillStyle = '#ccc';
  ctx.fillText('WASD move / drive  •  E enter car  •  Mouse aim + Click shoot  •  F punch  •  1/2 weapons  •  R reload', w / 2, h * 0.5 + 130);
  ctx.fillText('Space handbrake  •  T taxi shift (drive a taxi)  •  Your progress autosaves', w / 2, h * 0.5 + 156);
  ctx.restore();
}

export function drawWasted(ctx, state, view) {
  const w = view.width; const h = view.height;
  ctx.fillStyle = 'rgba(40,0,0,0.72)';
  ctx.fillRect(0, 0, w, h);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.font = 'bold 72px Arial';
  ctx.fillStyle = '#ff5a5a';
  ctx.fillText('WASTED', w / 2, h * 0.42);
  ctx.font = '20px Arial';
  ctx.fillStyle = '#fff';
  ctx.fillText('Solmar General patched you up. The hospital bill stings a little.', w / 2, h * 0.42 + 40);
  ctx.font = 'bold 20px Arial';
  ctx.fillStyle = '#ffd23f';
  ctx.fillText('[ ENTER ]  Get back out there', w / 2, h * 0.42 + 90);
  ctx.restore();
}

export function drawBusted(ctx, state, view) {
  const w = view.width; const h = view.height;
  ctx.fillStyle = 'rgba(0,10,40,0.72)';
  ctx.fillRect(0, 0, w, h);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.font = 'bold 72px Arial';
  ctx.fillStyle = '#7ab8ff';
  ctx.fillText('BUSTED', w / 2, h * 0.42);
  ctx.font = '20px Arial';
  ctx.fillStyle = '#fff';
  ctx.fillText('Det. Ruiz let you off with a fine and a warning. This time.', w / 2, h * 0.42 + 40);
  ctx.font = 'bold 20px Arial';
  ctx.fillStyle = '#ffd23f';
  ctx.fillText('[ ENTER ]  Walk free', w / 2, h * 0.42 + 90);
  ctx.restore();
}

export function drawStoryComplete(ctx, state, view) {
  const w = view.width; const h = view.height;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.font = 'bold 40px Arial';
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillText('DEBT PAID — SOLMAR BAY IS YOURS', w / 2 + 3, h * 0.22 + 3);
  ctx.fillStyle = '#ffd23f';
  ctx.fillText('DEBT PAID — SOLMAR BAY IS YOURS', w / 2, h * 0.22);
  ctx.font = '18px Arial';
  ctx.fillStyle = '#fff';
  ctx.fillText('Free roam: drive taxi fares, steal cars, and see how long you can stay clean.', w / 2, h * 0.22 + 34);
  ctx.restore();
}
