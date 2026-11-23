// Screenshot scenes behind ?shot=start|drive|chase|mission. Each one plays
// the real rules forward from a fresh, seeded world for a fixed number of
// steps, steered by scripted input, so the frame is what a short game really
// looks like and the same seed always gives the same frame.
import { makeRng } from './rng.js';
import { PLACES } from './world.js';
import { makePlayer, makePed } from './entities.js';
import { makeCar, makeTrafficCar } from './vehicles.js';
import { missionState, startMission } from './missions.js';
import { stepWorld, seedWorld } from './update.js';

const STEP = 1 / 60;

// A stand-in for Input with fixed keys held, so the world can be driven
// without a real keyboard.
function scriptedInput(held) {
  return {
    is: (action) => !!held[action],
    justPressed: () => false,
    mouseX: 640,
    mouseY: 360,
    mouseDown: false,
    mousePressed: false,
    anyKey: false,
    endFrame() {},
  };
}

function resetState(state, seed) {
  state.rng = makeRng(seed);
  state.cars = [];
  state.peds = [];
  state.cops = [];
  state.bullets = [];
  state.particles = [];
  state.pickups = [];
  state.toasts = [];
  state.events = [];
  state.mission = missionState();
  state.view = { width: 1280, height: 720 };
  state.time = 0;
  state.lastCrimeAt = -999;
}

function stepN(state, input, n) {
  for (let i = 0; i < n; i += 1) stepWorld(state, input, STEP);
}

function putPlayerInCar(state, car) {
  const p = state.player;
  car.driver = 'player';
  car.isPlayerCar = true;
  p.inCar = car;
  p.x = car.x;
  p.y = car.y;
  p.angle = car.angle;
  state.camera.x = car.x;
  state.camera.y = car.y;
}

/**
 * Set `state` to the named scene and return the screen to draw over it.
 * start: the title over downtown at golden hour.
 * drive: Kai driving a sports car through traffic at noon.
 * chase: a three-star police chase at night.
 * mission: the Harbor Docks pickup at sunset, objective on the HUD.
 */
export function stageShot(name, state, seed = 7) {
  resetState(state, seed);
  if (name === 'drive') {
    state.clockHours = 12;
    state.player = makePlayer(800, 1800);
    seedWorld(state);
    const car = makeCar('sport', 800, 1800, 0, state.rng);
    state.cars.push(car);
    putPlayerInCar(state, car);
    // Traffic sharing the road.
    for (const [x, y, type] of [[1150, 1785, 'sedan'], [1500, 1815, 'taxi'], [600, 1815, 'van'], [1900, 1785, 'coupe']]) {
      const t = makeTrafficCar(type, x, y, state.rng);
      t.ai.dir = 0;
      t.angle = 0;
      state.cars.push(t);
    }
    stepN(state, scriptedInput({ up: true }), 150);
    // Snap the camera to the car: the screenshot may only run a few frames.
    state.camera.x = state.player.x;
    state.camera.y = state.player.y;
    return 'playing';
  }
  if (name === 'chase') {
    state.clockHours = 21.5;
    state.player = makePlayer(1400, 1800);
    state.player.heat = 62;
    state.player.wanted = 3;
    state.lastCrimeAt = 9999; // no heat decay while the scene is staged
    seedWorld(state);
    const car = makeCar('muscle', 1400, 1800, 0, state.rng);
    state.cars.push(car);
    putPlayerInCar(state, car);
    // Three cruisers closing in from behind.
    for (const [x, y] of [[1180, 1800], [1260, 1762], [1230, 1840]]) {
      const cop = makeCar('police', x, y, 0, state.rng);
      cop.isPolice = true;
      cop.ai = { police: true, target: null, stuck: 0 };
      state.cars.push(cop);
    }
    stepN(state, scriptedInput({ up: true }), 90);
    state.camera.x = state.player.x;
    state.camera.y = state.player.y;
    return 'playing';
  }
  if (name === 'mission') {
    state.clockHours = 18.2;
    state.player = makePlayer(430, 610);
    seedWorld(state);
    startMission(state, 1);
    // A couple of dock workers nearby.
    for (const [x, y] of [[420, 560], [610, 700]]) {
      state.peds.push(makePed(x, y, state.rng));
    }
    const t = makeTrafficCar('truck', 900, 600, state.rng);
    t.ai.dir = 2;
    t.angle = Math.PI;
    state.cars.push(t);
    stepN(state, scriptedInput({}), 30);
    state.camera.x = state.player.x;
    state.camera.y = state.player.y;
    return 'playing';
  }
  // start (default): title screen over downtown at golden hour.
  state.clockHours = 17.5;
  state.player = makePlayer(1600, 1500);
  seedWorld(state);
  for (const [x, y, type] of [[1450, 1400, 'sedan'], [1750, 1600, 'taxi'], [1600, 1250, 'coupe']]) {
    const t = makeTrafficCar(type, x, y, state.rng);
    state.cars.push(t);
  }
  stepN(state, scriptedInput({}), 40);
  state.camera.x = 1600;
  state.camera.y = 1600;
  return 'title';
}
