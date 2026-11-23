// The story of Solmar Bay: five missions from Vince Kessler, plus the taxi
// side job. Missions are a small state machine: each step is a goto, a wait
// or a getCar, with dialogue shown as subtitles.
import { PLACES } from './world.js';
import { clamp } from './config.js';

// Kai Mercer owes $50,000 to Vince Kessler. Vince is the fixer who hands out
// the work; Mara Solano runs the garage; Detective Ada Ruiz runs the PD.
export const STORY = {
  hero: 'Kai Mercer',
  fixer: 'Vince Kessler',
  mechanic: 'Mara Solano',
  detective: 'Det. Ada Ruiz',
  debt: 50000,
};

export const MISSIONS = [
  {
    id: 'm1', title: 'First Wheels', reward: 250,
    briefing: [
      { who: 'Vince', text: 'Kai. You owe me fifty grand, and I collect. First job: get yourself wheels.' },
      { who: 'Vince', text: 'Any car on the street will do. Walk up and press E. Try not to make a scene.' },
      { who: 'Kai', text: 'Yeah, yeah. Wheels first, lecture later.' },
    ],
    steps: [
      { type: 'getCar', text: 'Steal a car — walk up to one and press E' },
      { type: 'goto', pos: 'marasGarage', radius: 80, text: "Drive to Mara's Garage" },
    ],
    complete: [
      { who: 'Mara', text: 'Nice ride. For a stolen one, anyway. Here — a pistol. You will need it in this town.' },
      { who: 'Kai', text: 'Thanks, Mara. Vince sends his regards, probably.' },
    ],
    onComplete(state) {
      state.player.weapon = 'pistol';
      state.player.mag = 12;
      state.player.ammo = 36;
    },
  },
  {
    id: 'm2', title: 'The Pickup', reward: 500,
    briefing: [
      { who: 'Vince', text: 'A crate came in at the Harbor Docks. My name is on it. Go get it, bring it to my office.' },
      { who: 'Vince', text: 'Keep it quiet. The docks have eyes.' },
    ],
    steps: [
      { type: 'goto', pos: 'harborDocks', radius: 70, text: 'Go to the Harbor Docks' },
      { type: 'collect', pos: 'harborDocks', radius: 70, seconds: 2, text: 'Pick up the crate' },
      { type: 'goto', pos: 'vinceOffice', radius: 80, text: "Deliver the crate to Vince's Office" },
    ],
    complete: [
      { who: 'Vince', text: 'Clean work. Five hundred, as agreed. The debt is down to forty-nine-five. Do not spend it all at once.' },
    ],
  },
  {
    id: 'm3', title: 'Hot Delivery', reward: 800, timeLimit: 110,
    briefing: [
      { who: 'Vince', text: 'A client at the Palmetto Casino needs a package at the airfield. One hundred and ten seconds. No excuses.' },
      { who: 'Kai', text: 'Across town in under two minutes? You are kidding.' },
      { who: 'Vince', text: 'Then drive like you mean it.' },
    ],
    steps: [
      { type: 'goto', pos: 'casino', radius: 70, text: 'Pick up the package at the Palmetto Casino' },
      { type: 'goto', pos: 'airport', radius: 90, text: 'Deliver to Solmar Airfield — fast!' },
    ],
    complete: [
      { who: 'Client', text: 'Right on time. Tell Vince the route is good.' },
      { who: 'Vince', text: 'Eight hundred. You drive like the city owes you money. It does. So do you.' },
    ],
    onStart(state) {
      state.player.heat = Math.max(state.player.heat, 10);
      state.player.wanted = 1;
    },
  },
  {
    id: 'm4', title: 'Three Crates', reward: 1200,
    briefing: [
      { who: 'Vince', text: 'Three crates in the Industrial Yard have my mark. The yard crew is paid to look away. The cops are not.' },
      { who: 'Vince', text: 'Grab all three. Expect company.' },
    ],
    steps: [
      { type: 'collect', pos: { x: 880, y: 2480 }, radius: 60, seconds: 2, text: 'Grab crate 1 of 3 — Industrial Yard' },
      { type: 'collect', pos: { x: 1120, y: 2620 }, radius: 60, seconds: 2, text: 'Grab crate 2 of 3 — Industrial Yard' },
      { type: 'collect', pos: { x: 960, y: 2720 }, radius: 60, seconds: 2, text: 'Grab crate 3 of 3 — Industrial Yard' },
      { type: 'goto', pos: 'vinceOffice', radius: 80, text: "Bring the crates to Vince's Office" },
    ],
    complete: [
      { who: 'Vince', text: 'Twelve hundred. The yard crew sends its thanks — in the form of not talking.' },
    ],
    onStart(state) {
      state.player.heat = Math.max(state.player.heat, 30);
      state.player.wanted = 2;
    },
  },
  {
    id: 'm5', title: 'The Big Score', reward: 5000,
    briefing: [
      { who: 'Vince', text: 'This is the one, Kai. Solmar Bank. The vault, the whole take, and we are square.' },
      { who: 'Kai', text: 'And if the alarm goes off?' },
      { who: 'Vince', text: 'It will. Drive fast, and do not stop until you see my office.' },
    ],
    steps: [
      { type: 'goto', pos: 'solmarBank', radius: 80, text: 'Get to Solmar Bank' },
      { type: 'wait', pos: 'solmarBank', radius: 80, seconds: 12, text: 'Crack the vault — stay at the bank!' },
      { type: 'goto', pos: 'vinceOffice', radius: 80, text: 'Escape the cops — get to Vince!' },
    ],
    complete: [
      { who: 'Vince', text: 'Five thousand. The debt is paid, Kai. You are a free man.' },
      { who: 'Kai', text: 'Free. Huh. Same city, same streets — but the wheel is mine now.' },
      { who: 'Vince', text: 'Free roam, kid. The city is yours. Drive it like you own it.' },
    ],
    onStart(state) {
      state.player.heat = Math.max(state.player.heat, 55);
      state.player.wanted = 3;
    },
  },
];

export function missionState() {
  return {
    index: 0, // next mission to start
    active: null, // the running mission definition
    step: 0,
    stepProgress: 0,
    timeLeft: 0,
    failed: false,
    done: false, // whole story done
    dialogue: [], // queued {who, text}
    dialogueTimer: 0,
    // taxi side job
    taxi: { active: false, phase: 'none', px: 0, py: 0, dx: 0, dy: 0, fare: 0, passenger: null },
  };
}

export function say(state, who, text) {
  state.mission.dialogue.push({ who, text });
}

export function updateDialogue(state, dt, input) {
  const m = state.mission;
  if (m.dialogue.length === 0) return;
  m.dialogueTimer += dt;
  const skip = input && (input.justPressed('confirm') || input.mousePressed);
  if (m.dialogueTimer > 4.2 || skip) {
    m.dialogue.shift();
    m.dialogueTimer = 0;
  }
}

export function currentDialogue(state) {
  return state.mission.dialogue.length > 0 ? state.mission.dialogue[0] : null;
}

export function startMission(state, index) {
  const def = MISSIONS[index];
  if (!def) return;
  const m = state.mission;
  m.active = def;
  m.step = 0;
  m.stepProgress = 0;
  m.failed = false;
  m.timeLeft = def.timeLimit || 0;
  for (const line of def.briefing) say(state, line.who, line.text);
  state.toast(`Mission: ${def.title}`, 'mission');
  state.audio.missionStart();
  if (def.onStart) def.onStart(state);
}

export function failMission(state, reason) {
  const m = state.mission;
  if (!m.active) return;
  state.toast(`Mission failed — ${reason}. Go back to Vince to retry.`, 'bad');
  state.audio.missionFail();
  m.active = null;
  m.step = 0;
  m.stepProgress = 0;
  m.failed = true;
}

export function completeMission(state) {
  const m = state.mission;
  const def = m.active;
  if (!def) return;
  const p = state.player;
  p.cash += def.reward;
  p.cashEarned += def.reward;
  p.missionsDone += 1;
  for (const line of def.complete) say(state, line.who, line.text);
  if (def.onComplete) def.onComplete(state);
  state.toast(`Mission complete: ${def.title} — $${def.reward}`, 'good');
  state.audio.missionComplete();
  state.saveGame(true);
  m.index += 1;
  m.active = null;
  m.step = 0;
  m.stepProgress = 0;
  if (m.index >= MISSIONS.length) {
    m.done = true;
    say(state, 'Kai', 'Debt paid. Solmar Bay is mine now.');
  }
}

function stepPos(step) {
  if (typeof step.pos === 'string') return PLACES[step.pos];
  return step.pos;
}

export function missionObjective(state) {
  const m = state.mission;
  if (m.active) {
    const step = m.active.steps[m.step];
    if (!step) return null;
    if (step.type === 'getCar') return { x: state.player.x, y: state.player.y, label: 'Steal a car', self: true };
    const pos = stepPos(step);
    return { x: pos.x, y: pos.y, label: step.text, radius: step.radius || 60 };
  }
  if (!m.done) {
    const place = PLACES.vinceOffice;
    return { x: place.x, y: place.y, label: `Next mission: ${MISSIONS[m.index].title} — go to Vince`, marker: 'V', radius: 70 };
  }
  return null;
}

export function updateMissions(state, dt) {
  const m = state.mission;
  const p = state.player;
  if (!m.active) {
    // Between missions: standing at Vince's office starts the next one.
    if (!m.done) {
      const v = PLACES.vinceOffice;
      const d = Math.hypot(p.x - v.x, p.y - v.y);
      const inCar = p.inCar ? Math.hypot(p.inCar.x - v.x, p.inCar.y - v.y) : Infinity;
      if (Math.min(d, inCar) < 80) startMission(state, m.index);
    }
    return;
  }
  const def = m.active;
  if (def.timeLimit) {
    m.timeLeft -= dt;
    if (m.timeLeft <= 0) {
      failMission(state, 'out of time');
      return;
    }
  }
  const step = def.steps[m.step];
  if (!step) { completeMission(state); return; }
  const px = p.inCar ? p.inCar.x : p.x;
  const py = p.inCar ? p.inCar.y : p.y;
  if (step.type === 'getCar') {
    if (p.inCar) { m.step += 1; m.stepProgress = 0; }
    return;
  }
  const pos = stepPos(step);
  const d = Math.hypot(px - pos.x, py - pos.y);
  if (step.type === 'goto') {
    if (d < (step.radius || 60)) {
      m.step += 1;
      m.stepProgress = 0;
      state.audio.objective();
    }
    return;
  }
  if (step.type === 'wait' || step.type === 'collect') {
    if (d < (step.radius || 60)) {
      m.stepProgress += dt;
      if (m.stepProgress >= (step.seconds || 2)) {
        m.step += 1;
        m.stepProgress = 0;
        state.audio.objective();
        if (step.type === 'collect') state.toast('Crate secured.', 'good');
      }
    }
    return;
  }
}

// --- Taxi side job --------------------------------------------------------
// Press T while driving a taxi to start a shift. A passenger waits on a
// sidewalk; drive to them, then to their destination, and collect the fare.
export function toggleTaxi(state) {
  const p = state.player;
  const t = state.mission.taxi;
  if (t.active) {
    t.active = false;
    t.phase = 'none';
    state.toast('Taxi shift ended.', 'info');
    return;
  }
  if (!p.inCar || p.inCar.type !== 'taxi') {
    state.toast('You need to be driving a taxi. Find a yellow cab.', 'info');
    return;
  }
  t.active = true;
  t.phase = 'pickup';
  const spot = state.city.randomSidewalkPoint(state.rng);
  t.px = spot.x; t.py = spot.y;
  t.fare = 0;
  state.toast('Taxi shift started — pick up the passenger.', 'mission');
  state.audio.objective();
}

export function updateTaxi(state, dt) {
  const t = state.mission.taxi;
  const p = state.player;
  if (!t.active) return;
  if (!p.inCar || p.inCar.type !== 'taxi') {
    t.active = false;
    t.phase = 'none';
    state.toast('You left the taxi — shift over.', 'info');
    return;
  }
  const car = p.inCar;
  if (t.phase === 'pickup') {
    const d = Math.hypot(car.x - t.px, car.y - t.py);
    if (d < 70) {
      t.phase = 'dropoff';
      const dest = state.city.randomRoadPoint(state.rng);
      t.dx = dest.x; t.dy = dest.y;
      t.fare = state.rng.int(35, 85);
      state.toast('Passenger in! Drive to the destination.', 'mission');
      state.audio.objective();
    }
    return;
  }
  if (t.phase === 'dropoff') {
    const d = Math.hypot(car.x - t.dx, car.y - t.dy);
    if (d < 60) {
      const tip = state.rng.int(0, 20);
      const total = t.fare + tip;
      p.cash += total;
      p.cashEarned += total;
      state.toast(`Fare collected: $${total}${tip > 0 ? ` (incl. $${tip} tip)` : ''}`, 'good');
      state.audio.missionComplete();
      state.saveGame(true);
      // Next passenger.
      t.phase = 'pickup';
      const spot = state.city.randomSidewalkPoint(state.rng);
      t.px = spot.x; t.py = spot.y;
    }
  }
}

export function taxiObjective(state) {
  const t = state.mission.taxi;
  if (!t.active) return null;
  if (t.phase === 'pickup') return { x: t.px, y: t.py, label: 'Pick up the passenger', radius: 40, taxi: true };
  if (t.phase === 'dropoff') return { x: t.dx, y: t.dy, label: `Drop off — fare $${t.fare}`, radius: 50, taxi: true };
  return null;
}
