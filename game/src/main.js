// Solmar Bay — entry point. Builds the game state, runs the loop, and owns
// the screens: title, playing, paused, wasted, busted. The world itself
// steps through update.js; the city draws through render.js; the HUD draws
// through hud.js.
import { SAVE_KEY, GAME_NAME } from './config.js';
import { makeRng } from './rng.js';
import { Input } from './input.js';
import { City, PLACES } from './world.js';
import { AudioEngine } from './audio.js';
import { makePlayer } from './entities.js';
import { makeCamera, renderWorld, districtLabel } from './render.js';
import { drawHUD, drawTitle, drawPause, drawWasted, drawBusted, drawStoryComplete } from './hud.js';
import { missionState, startMission, say } from './missions.js';
import { stepWorld, seedWorld } from './update.js';
import { writeSave, readSave, saveExists, clearSave } from './save.js';
import { stageShot } from './shots.js';

const canvas = document.getElementById('game');
const statusEl = document.getElementById('status');
const ctx = canvas.getContext('2d');

window.addEventListener('error', (e) => {
  if (statusEl) statusEl.textContent = `Error: ${e.message}`;
});

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const seedParam = Number(params.get('seed') || '7');

function createState() {
  const audio = new AudioEngine();
  const state = {
    city: new City(20261123),
    rng: makeRng(20261123),
    audio,
    input: new Input(canvas),
    player: makePlayer(1500, 1350),
    cars: [],
    peds: [],
    cops: [],
    bullets: [],
    particles: [],
    pickups: [],
    mission: missionState(),
    camera: makeCamera(),
    clockHours: 10,
    time: 0,
    lastCrimeAt: -999,
    events: [],
    toasts: [],
    objective: null,
    currentDialogue: null,
    screen: 'title',
    saveExists: saveExists(),
    saveTimer: 12,
    view: { width: canvas.width, height: canvas.height },
    storyBannerUntil: 0,
    shotMode: !!shotName,
  };
  state.toast = (text, kind = 'info') => {
    state.toasts.push({ text, kind, at: state.time });
    if (state.toasts.length > 5) state.toasts.shift();
  };
  state.saveGame = (force) => {
    if (state.screen !== 'playing' && !force) return;
    writeSave(state);
  };
  return state;
}

let state = createState();
seedWorld(state);
state.camera.x = state.player.x;
state.camera.y = state.player.y;

// --- Shot mode: stage a deterministic scene for screenshots. -------------
if (shotName) {
  const screen = stageShot(shotName, state, seedParam);
  state.screen = screen;
  // Freeze the simulation: the staged frame is the screenshot.
  state.shotFrozen = true;
  if (statusEl) {
    const p = state.player;
    statusEl.textContent = `SHOT ${shotName} cam=${Math.round(state.camera.x)},${Math.round(state.camera.y)} player=${Math.round(p.x)},${Math.round(p.y)} car=${p.inCar ? `${Math.round(p.inCar.x)},${Math.round(p.inCar.y)} speed=${Math.round(Math.hypot(p.inCar.vx, p.inCar.vy))}` : 'none'}`;
  }
}

function newGame() {
  clearSave();
  state = createState();
  seedWorld(state);
  state.camera.x = state.player.x;
  state.camera.y = state.player.y;
  state.screen = 'playing';
  state.audio.ensure();
  startMission(state, 0);
  state.toast('Welcome to Solmar Bay. Steal a car.', 'mission');
}

function continueGame() {
  const save = readSave();
  if (!save) { newGame(); return; }
  state = createState();
  seedWorld(state);
  const p = state.player;
  p.x = save.x; p.y = save.y;
  p.cash = save.cash;
  p.hp = save.hp;
  p.weapon = save.weapon;
  p.ammo = save.ammo;
  p.mag = save.mag;
  p.missionsDone = save.missionsDone;
  p.cashEarned = save.cashEarned;
  p.carsStolen = save.carsStolen;
  state.clockHours = save.clockHours;
  state.mission.index = save.missionIndex;
  state.mission.done = save.storyDone;
  state.camera.x = p.x;
  state.camera.y = p.y;
  state.screen = 'playing';
  state.audio.ensure();
  state.toast('Welcome back to Solmar Bay.', 'good');
}

function handleWasted() {
  const p = state.player;
  const lost = Math.floor(p.cash * 0.1);
  p.cash -= lost;
  p.hp = p.maxHp;
  p.heat = 0;
  p.wanted = 0;
  p.bustedTimer = 0;
  p.x = PLACES.hospital.x;
  p.y = PLACES.hospital.y;
  if (p.inCar) { p.inCar.driver = null; p.inCar.isPlayerCar = false; p.inCar = null; }
  state.cops = [];
  for (const car of state.cars) if (car.isPolice) car.removed = true;
  state.camera.x = p.x;
  state.camera.y = p.y;
  state.toast(`Hospital bill: -$${lost}`, 'bad');
  state.saveGame(true);
}

function handleBusted() {
  const p = state.player;
  const fine = Math.min(200, Math.floor(p.cash));
  p.cash -= fine;
  p.hp = p.maxHp;
  p.heat = 0;
  p.wanted = 0;
  p.bustedTimer = 0;
  p.x = PLACES.policeHQ.x;
  p.y = PLACES.policeHQ.y;
  if (p.inCar) { p.inCar.driver = null; p.inCar.isPlayerCar = false; p.inCar = null; }
  state.cops = [];
  for (const car of state.cars) if (car.isPolice) car.removed = true;
  state.camera.x = p.x;
  state.camera.y = p.y;
  state.toast(`Fine paid: -$${fine}`, 'bad');
  state.saveGame(true);
}

function updateTitle(dt) {
  const input = state.input;
  // The title screen sits over the city at golden hour; the clock drifts
  // slowly so the light stays warm behind the menu.
  state.time += dt;
  state.clockHours = (state.clockHours + dt * 0.6 / 60) % 24;
  if (input.justPressed('confirm')) {
    if (state.saveExists) continueGame();
    else newGame();
  } else if (input.justPressed('new')) {
    newGame();
  }
}

function updatePlaying(dt) {
  const input = state.input;
  if (input.justPressed('pause')) {
    state.screen = 'paused';
    state.audio.uiClick();
    state.saveGame(true);
    return;
  }
  if (input.justPressed('mute')) {
    state.audio.setMuted(!state.audio.muted);
    state.toast(state.audio.muted ? 'Sound off' : 'Sound on', 'info');
  }
  stepWorld(state, input, dt);
  // Wasted / busted events.
  for (const event of state.events) {
    if (event.type === 'wasted') { state.screen = 'wasted'; handleWasted(); }
    if (event.type === 'busted') { state.screen = 'busted'; handleBusted(); }
  }
  state.events = [];
  // Story-complete banner.
  if (state.mission.done && state.storyBannerUntil === 0) {
    state.storyBannerUntil = state.time + 6;
  }
}

function updatePaused(dt) {
  const input = state.input;
  if (input.justPressed('pause')) {
    state.screen = 'playing';
    state.audio.uiClick();
    return;
  }
  if (input.justPressed('quit')) {
    state.saveGame(true);
    state.screen = 'title';
    state.saveExists = saveExists();
    state.audio.uiClick();
  }
  if (input.justPressed('mute')) {
    state.audio.setMuted(!state.audio.muted);
    state.toast(state.audio.muted ? 'Sound off' : 'Sound on', 'info');
  }
}

function updateEndScreen(dt) {
  const input = state.input;
  if (input.justPressed('confirm')) {
    state.screen = 'playing';
    state.audio.uiClick();
  }
}

function update(dt) {
  state.view.width = canvas.width;
  state.view.height = canvas.height;
  const input = state.input;
  // First gesture unlocks audio.
  if (input.anyKey || input.mousePressed) state.audio.ensure();
  if (state.screen === 'title') updateTitle(dt);
  else if (state.screen === 'playing') updatePlaying(dt);
  else if (state.screen === 'paused') updatePaused(dt);
  else if (state.screen === 'wasted' || state.screen === 'busted') updateEndScreen(dt);
  input.endFrame();
}

function render() {
  const view = { width: canvas.width, height: canvas.height };
  if (state.screen === 'title') {
    // Title over a live downtown view.
    state.camera.x = 1600;
    state.camera.y = 1600;
    renderWorld(ctx, state, view);
    drawTitle(ctx, state, view);
    return;
  }
  renderWorld(ctx, state, view);
  if (state.screen === 'playing') {
    drawHUD(ctx, state, view);
    if (state.mission.done && state.time < state.storyBannerUntil) {
      drawStoryComplete(ctx, state, view);
    }
  } else if (state.screen === 'paused') {
    drawHUD(ctx, state, view);
    drawPause(ctx, state, view);
  } else if (state.screen === 'wasted') {
    drawWasted(ctx, state, view);
  } else if (state.screen === 'busted') {
    drawBusted(ctx, state, view);
  }
}

// Fixed-step loop (60 Hz), with a cap so a slow frame cannot spiral.
let last = performance.now();
let acc = 0;
const STEP = 1 / 60;
function frame(now) {
  requestAnimationFrame(frame);
  let dt = (now - last) / 1000;
  last = now;
  if (dt > 0.25) dt = 0.25;
  if (state.shotFrozen) {
    render();
    return;
  }
  acc += dt;
  let guard = 0;
  while (acc >= STEP && guard < 5) {
    update(STEP);
    acc -= STEP;
    guard += 1;
  }
  if (guard === 5) acc = 0;
  render();
}
requestAnimationFrame(frame);

// Screen-reader status line.
if (statusEl) {
  if (state.shotMode) {
    const p = state.player;
    statusEl.textContent = `SHOT ${shotName} cam=${Math.round(state.camera.x)},${Math.round(state.camera.y)} player=${Math.round(p.x)},${Math.round(p.y)} car=${p.inCar ? `${Math.round(p.inCar.x)},${Math.round(p.inCar.y)} speed=${Math.round(Math.hypot(p.inCar.vx, p.inCar.vy))}` : 'none'}`;
  } else {
    statusEl.textContent = `${GAME_NAME}: an open-world crime game in Solmar Bay. Press Enter to play.`;
  }
}
