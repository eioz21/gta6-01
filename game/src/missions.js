// missions.js — the story of Leo Cruz, a driver fresh out of the county jail
// who owes Rosa's garage one big favour. Five missions, then free roam with
// taxi fares. Each mission is a list of steps the game walks through.

import { makePed } from './entities.js';

export const STORY_INTRO = [
  'SOLMAR BAY — a sun-soaked city where everybody owes somebody.',
  'Leo Cruz just got out. Rosa kept his garage open, and the debt is due.',
  'Steal a car. Make the deliveries. Stay out of the county morgue.',
];

export const MISSIONS = [
  {
    id: 'wheels-up',
    title: '1 — Wheels Up',
    giver: 'Rosa',
    intro: [
      'ROSA: Leo. You owe me, and the garage needs wheels.',
      'ROSA: Any car on the street will do. Bring it to my garage.',
    ],
    reward: 300,
    steps: [
      { type: 'car', label: 'Steal a car — walk up to one and press E' },
      { type: 'goto', place: 'garage', radius: 90, label: "Drive to Rosa's Garage" },
    ],
  },
  {
    id: 'the-drop',
    title: '2 — The Drop',
    giver: 'Rosa',
    intro: [
      'ROSA: A package is waiting at the docks. No questions, no opening it.',
      'ROSA: The hotel wants it tonight. The SBPD might want you more.',
    ],
    reward: 600,
    grant: 'smg',
    steps: [
      { type: 'goto', place: 'docks', radius: 80, label: 'Pick up the package at the Docks' },
      { type: 'goto', place: 'hotel', radius: 90, label: 'Deliver it to Hotel Mirada — the cops are coming' },
    ],
  },
  {
    id: 'debts',
    title: '3 — Collecting Debts',
    giver: 'Rosa',
    intro: [
      'ROSA: Three jokers owe me. Lou at the diner, the plaza kid, the beach bum.',
      'ROSA: Walk up to each one and press E. Be polite. Then be firm.',
    ],
    reward: 800,
    steps: [
      { type: 'interact', place: 'diner', radius: 70, label: "Collect from Lou at the Diner (press E)" },
      { type: 'interact', place: 'plaza', radius: 70, label: 'Collect from the kid at Plaza Verde (press E)' },
      { type: 'interact', place: 'beach', radius: 70, label: 'Collect from the bum at Solmar Beach (press E)' },
    ],
  },
  {
    id: 'heat-wave',
    title: '4 — Heat Wave',
    giver: 'Rosa',
    intro: [
      'ROSA: The SBPD raided the garage. They think you tipped them.',
      'ROSA: Three stars, Leo. Survive the heat, then disappear.',
    ],
    reward: 1000,
    grant: 'shotgun',
    steps: [
      { type: 'survive', seconds: 45, label: 'Survive the police for 45 seconds' },
      { type: 'loseWanted', label: 'Lose the cops — stay out of sight until the stars fall' },
    ],
  },
  {
    id: 'king-of-the-bay',
    title: '5 — King of the Bay',
    giver: 'Rosa',
    intro: [
      'ROSA: The Vipers run the marina now. They raided my garage, Leo.',
      'ROSA: End it. Then come home. The Bay is yours after this.',
    ],
    reward: 2500,
    steps: [
      { type: 'goto', place: 'marina', radius: 120, label: 'Reach the Marina' },
      { type: 'kill', count: 6, label: 'Take out the Viper gang (0/6)' },
      { type: 'goto', place: 'safehouse', radius: 80, label: 'Get back to the Safehouse' },
    ],
  },
];

export function createMissionState() {
  return {
    index: 0, // which mission of MISSIONS is active (-1 = story done)
    stepIndex: 0,
    active: false,
    timer: 0,
    kills: 0,
    gang: [], // hostile gang members for the current mission
    subtitles: [], // {text, until} lines shown at the bottom
    banner: null, // {text, until} big centre message
    fare: null, // the current taxi fare, or null
    fareTimer: 0,
    done: false,
  };
}

export function currentMission(missions) {
  if (missions.index < 0 || missions.index >= MISSIONS.length) return null;
  return MISSIONS[missions.index];
}

export function currentStep(missions) {
  const m = currentMission(missions);
  if (!m) return null;
  return m.steps[missions.stepIndex] || null;
}

export function startMission(g, index) {
  const missions = g.missions;
  missions.index = index;
  missions.stepIndex = 0;
  missions.timer = 0;
  missions.kills = 0;
  missions.gang = [];
  missions.active = true;
  const m = MISSIONS[index];
  for (const line of m.intro) pushSubtitle(g, line, 4.5);
  pushBanner(g, m.title, 3);
  g.audio.missionStart();
  g.audio.phone();
}

export function pushSubtitle(g, text, seconds) {
  g.missions.subtitles.push({ text, until: g.time + seconds });
  if (g.missions.subtitles.length > 3) g.missions.subtitles.shift();
}

export function pushBanner(g, text, seconds) {
  g.missions.banner = { text, until: g.time + seconds };
}

function placeOf(g, step) {
  return g.city.places[step.place];
}

/** Spawn the Viper gang on the roads around the marina for the final mission. */
export function spawnGang(g, count) {
  // Road positions around the marina: the vertical road west of it and the
  // coast road south of it — never inside a building.
  const spots = [
    { x: 2760, y: 2920 }, { x: 2790, y: 3000 }, { x: 2730, y: 3080 },
    { x: 2900, y: 3180 }, { x: 3020, y: 3180 }, { x: 3140, y: 3180 },
  ];
  const gang = [];
  for (let i = 0; i < count; i += 1) {
    const spot = spots[i % spots.length];
    const ped = makePed(spot.x + g.rng.range(-14, 14), spot.y + g.rng.range(-14, 14), g.rng);
    ped.gang = true;
    ped.hp = 70;
    ped.speed = 130;
    ped.shirt = '#8e44ad';
    ped.color = '#2c2c54';
    ped.shootCooldown = g.rng.range(0.5, 2);
    gang.push(ped);
  }
  return gang;
}

export function updateGangMember(g, member, dt) {
  if (member.dead) return;
  const player = g.player;
  const dx = player.x - member.x;
  const dy = player.y - member.y;
  const d = Math.hypot(dx, dy) || 1;
  member.angle = Math.atan2(dy, dx);
  if (d > 260) {
    const { moveWithCollision } = g.worldHelpers;
    moveWithCollision(g.city, member, (dx / d) * member.speed * dt, (dy / d) * member.speed * dt);
  }
  member.shootCooldown -= dt;
  if (d < 430 && member.shootCooldown <= 0 && !player.dead) {
    member.shootCooldown = 1.2 + Math.random() * 0.8;
    const aim = Math.atan2(dy, dx) + (Math.random() - 0.5) * 0.2;
    g.fireBullet(member.x, member.y, aim, 520, 9, 'gang', member);
  }
}

/**
 * Advance the active mission one frame. Returns 'complete' when the mission
 * is finished, 'failed' when it cannot continue, or null.
 */
export function updateMission(g, dt) {
  const missions = g.missions;
  const m = currentMission(missions);
  if (!m || !missions.active) return null;
  const step = currentStep(missions);
  if (!step) return 'complete';
  const player = g.player;

  if (step.type === 'car') {
    if (player.car) return advanceStep(g);
  } else if (step.type === 'goto') {
    const p = placeOf(g, step);
    if (Math.hypot(player.x - p.x, player.y - p.y) < step.radius) {
      if (m.id === 'the-drop' && missions.stepIndex === 0) {
        g.police.stars = Math.max(g.police.stars, 2);
        pushSubtitle(g, 'ROSA: Package secured. Now move — the SBPD is on you!', 4);
        g.audio.wantedUp();
      }
      if (m.id === 'king-of-the-bay' && missions.stepIndex === 0) {
        missions.gang = spawnGang(g, 6);
        pushSubtitle(g, 'The Vipers are here. Take them all out.', 4);
      }
      return advanceStep(g);
    }
  } else if (step.type === 'interact') {
    const p = placeOf(g, step);
    if (Math.hypot(player.x - p.x, player.y - p.y) < step.radius && g.input.wasPressed('KeyE')) {
      g.money += 150;
      g.audio.cash();
      spawnCashBurst(g, player.x, player.y);
      return advanceStep(g);
    }
  } else if (step.type === 'survive') {
    missions.timer += dt;
    if (g.police.stars < 3) g.police.stars = 3;
    if (missions.timer >= step.seconds) {
      missions.timer = 0;
      return advanceStep(g);
    }
  } else if (step.type === 'loseWanted') {
    if (g.police.stars <= 0) return advanceStep(g);
  } else if (step.type === 'kill') {
    missions.kills = missions.gang.filter((x) => x.dead).length;
    if (missions.kills >= step.count) return advanceStep(g);
  }
  return null;
}

function advanceStep(g) {
  const missions = g.missions;
  missions.stepIndex += 1;
  missions.timer = 0;
  g.audio.pickup();
  const m = currentMission(missions);
  if (m && missions.stepIndex >= m.steps.length) return 'complete';
  return null;
}

export function completeMission(g) {
  const m = currentMission(g.missions);
  g.missions.active = false;
  g.missions.stepIndex = 0;
  if (m) {
    g.money += m.reward;
    if (m.grant) g.player.weapons[m.grant] = true;
    pushBanner(g, `${m.title} — COMPLETE  +$${m.reward}`, 4);
    pushSubtitle(g, `ROSA: Good work, Leo. $${m.reward} is yours.`, 5);
    g.audio.missionDone();
  }
  g.missions.index += 1;
  if (g.missions.index >= MISSIONS.length) {
    g.missions.index = -1;
    g.missions.done = true;
    pushBanner(g, 'KING OF THE BAY — story complete. The city is yours.', 6);
    pushSubtitle(g, 'Free roam: pick up taxi fares, cause chaos, or just drive the coast.', 6);
  }
}

function spawnCashBurst(g, x, y) {
  const { spawnParticles } = g.combatHelpers;
  spawnParticles(g.particles, x, y - 10, '#ffd34d', 14, 140, 0.6, 3);
}

// ---------------------------------------------------------------- taxi fares

/** Offer a fare now and then, once the story's first mission is done. */
export function updateFare(g, dt) {
  const missions = g.missions;
  if (missions.index === 0 && !missions.done) return; // fares open after mission 1
  if (missions.fare) {
    const fare = missions.fare;
    if (fare.state === 'waiting') {
      fare.wait -= dt;
      if (fare.wait <= 0) { missions.fare = null; return; }
      if (g.player.car && Math.hypot(g.player.x - fare.ped.x, g.player.y - fare.ped.y) < 70) {
        fare.state = 'riding';
        fare.ped.dead = true; // they get in the car
        pushSubtitle(g, `FARE: Take me to ${fare.destName}, quick!`, 4);
        g.audio.phone();
      }
    } else if (fare.state === 'riding') {
      if (Math.hypot(g.player.x - fare.dest.x, g.player.y - fare.dest.y) < 90) {
        g.money += fare.reward;
        pushSubtitle(g, `FARE: Thanks! +$${fare.reward}`, 4);
        g.audio.cash();
        missions.fare = null;
      } else if (!g.player.car) {
        pushSubtitle(g, 'FARE: You left the cab — the fare walked off.', 4);
        missions.fare = null;
      }
    }
    return;
  }
  missions.fareTimer -= dt;
  if (missions.fareTimer > 0) return;
  missions.fareTimer = 45 + Math.random() * 30;
  // A fare spawns near the player, wanting to go somewhere across town.
  const places = Object.values(g.city.places);
  const dest = places[Math.floor(Math.random() * places.length)];
  const ped = makePed(
    g.player.x + (Math.random() < 0.5 ? -1 : 1) * (180 + Math.random() * 220),
    g.player.y + (Math.random() < 0.5 ? -1 : 1) * (180 + Math.random() * 220),
    g.rng,
  );
  ped.fare = true;
  ped.shirt = '#f1c40f';
  g.peds.push(ped);
  missions.fare = {
    ped,
    dest: { x: dest.x, y: dest.y },
    destName: dest.name,
    state: 'waiting',
    wait: 40,
    reward: 120,
  };
  pushSubtitle(g, 'A fare is waiting nearby — drive up in a car to pick them up.', 5);
}

/** The text the HUD shows for the current objective. */
export function objectiveText(g) {
  const m = currentMission(g.missions);
  if (!m) {
    if (g.missions.fare) {
      const f = g.missions.fare;
      return f.state === 'waiting' ? 'Pick up the taxi fare' : `Drive the fare to ${f.destName}`;
    }
    return 'Free roam — press M for the mission list';
  }
  const step = currentStep(g.missions);
  if (!step) return m.title;
  let label = step.label;
  if (step.type === 'kill') label = `Take out the Viper gang (${g.missions.kills}/${step.count})`;
  if (step.type === 'survive') label = `Survive the police — ${Math.max(0, Math.ceil(step.seconds - g.missions.timer))}s left`;
  return `${m.title}: ${label}`;
}
