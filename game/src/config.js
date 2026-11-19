// Solmar Bay — a top-down open-world crime game. All original: own city, names, story.
// config.js — every tuning constant in one place so the rest of the game reads cleanly.

export const WORLD = {
  size: 3600, // the city is a square, 3600 x 3600 world units
  roadGap: 420, // distance between road centrelines
  roadWidth: 132, // drivable asphalt width
  sidewalk: 26, // pavement strip each side of a road
  blockInset: 96, // buildings sit this far inside a block
};

export const VIEW = {
  width: 1280,
  height: 720,
};

export const PLAYER = {
  walkSpeed: 170,
  runSpeed: 300,
  radius: 14,
  maxHp: 100,
  punchDamage: 12,
  punchRange: 34,
  punchCooldown: 0.38,
};

export const WEAPONS = {
  fists: { name: 'Fists', damage: 12, range: 34, cooldown: 0.38, ammo: Infinity, auto: false },
  pistol: { name: 'P-9 Pistol', damage: 34, range: 520, cooldown: 0.28, ammo: 120, auto: false, bulletSpeed: 900 },
  smg: { name: 'Vex SMG', damage: 16, range: 460, cooldown: 0.085, ammo: 240, auto: true, bulletSpeed: 980 },
  shotgun: { name: 'Boomstick', damage: 22, range: 300, cooldown: 0.7, ammo: 40, auto: false, bulletSpeed: 820, pellets: 6 },
};

// Car models: top speed, acceleration, grip, colour palette, size.
export const CAR_MODELS = {
  sedan: { name: 'Solano', top: 330, accel: 210, grip: 2.6, len: 52, wid: 26, colors: ['#c0392b', '#2e86c1', '#7d3c98', '#b7950b', '#5d6d7e'] },
  taxi: { name: 'Bay Cab', top: 300, accel: 200, grip: 2.6, len: 52, wid: 26, colors: ['#f1c40f'] },
  sports: { name: 'Vortex GT', top: 470, accel: 330, grip: 3.4, len: 54, wid: 26, colors: ['#e74c3c', '#f39c12', '#1abc9c', '#ecf0f1'] },
  van: { name: 'Hauler', top: 250, accel: 150, grip: 2.2, len: 62, wid: 30, colors: ['#95a5a6', '#7f8c8d', '#a04000'] },
  truck: { name: 'Dock Rig', top: 220, accel: 120, grip: 1.9, len: 78, wid: 32, colors: ['#2c3e50', '#6e2c00'] },
  police: { name: 'SBPD Interceptor', top: 420, accel: 300, grip: 3.2, len: 54, wid: 26, colors: ['#1b2631'] },
  muscle: { name: 'Cobra 500', top: 400, accel: 280, grip: 2.9, len: 56, wid: 28, colors: ['#922b21', '#1a5276', '#145a32'] },
};

export const WANTED = {
  maxStars: 5,
  decayDelay: 6, // seconds out of sight before stars start to fall
  decayRate: 0.12, // stars per second once decaying
  copFootAt: 1, // stars needed before foot cops spawn
  copCarAt: 2, // stars needed before police cars spawn
  maxCops: 14,
  maxPoliceCars: 6,
};

// Cash the player starts with, mission rewards, pickups.
export const ECONOMY = {
  startMoney: 150,
  pickupCash: 40,
  healthPickup: 35,
  ammoPickup: 36,
  fareReward: 120,
};

export const DISTRICTS = [
  { name: 'Downtown', x0: 1200, y0: 900, x1: 2400, y1: 2100, tall: true },
  { name: 'Marina', x0: 2400, y0: 2100, x1: 3600, y1: 3600, tall: false },
  { name: 'Docks', x0: 0, y0: 2100, x1: 900, y1: 3600, tall: false },
  { name: 'North Hills', x0: 900, y0: 0, x1: 3600, y1: 900, tall: false },
  { name: 'Old Town', x0: 0, y0: 0, x1: 1200, y1: 2100, tall: false },
];

// Palette: a sun-soaked coastal city at golden hour.
export const PALETTE = {
  grass: '#5da24a',
  parkGrass: '#4c8f3e',
  sand: '#e8d39a',
  water: '#2e7fa8',
  waterDeep: '#1f5f82',
  road: '#3a3f4a',
  roadLine: '#e8e6c8',
  sidewalk: '#9a9a92',
  buildingRoof: '#8d6e63',
  buildingEdge: '#5d4037',
  hudDark: 'rgba(8, 12, 20, 0.72)',
  hudAccent: '#ffd34d',
};
