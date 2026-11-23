// Solmar Bay — shared constants: the city, the cars, the weapons, the clock.
// Everything here is original: the city of Solmar Bay, its districts, streets
// and people are invented for this game.
export const WORLD = 3200; // world is WORLD x WORLD px
export const ROAD_SPACING = 400;
export const ROAD_HALF = 36; // road half-width
export const ROAD_LINES = [200, 600, 1000, 1400, 1800, 2200, 2600, 3000];
export const SAVE_KEY = 'solmar-bay-save-v1';

export const GAME_NAME = 'SOLMAR BAY';
export const GAME_TAGLINE = 'A sun-soaked open-world crime story';

// In-game clock: one real second is this many in-game minutes.
export const MINUTES_PER_SECOND = 0.6;

// Wanted heat thresholds per star.
export const WANTED_THRESHOLDS = [0, 10, 30, 55, 75, 90];
export const HEAT = {
  stealCar: 26,
  punchPed: 14,
  killPed: 42,
  shoot: 8,
  killCop: 55,
  ramCop: 20,
  decayPerSecond: 1.1,
};

export const PLAYER = {
  radius: 13,
  walkSpeed: 165,
  runSpeed: 265,
  maxHp: 100,
  punchDamage: 18,
  punchRange: 34,
  punchArc: 1.15,
  punchCooldown: 0.38,
};

// Car types. accel in px/s^2, topSpeed in px/s, grip steers the car.
export const CAR_TYPES = {
  sedan:  { name: 'Sedan',    accel: 430, topSpeed: 430, reverseSpeed: 150, turn: 2.6, grip: 6.5, length: 46, width: 22, colors: ['#c23b2e', '#2e5fa3', '#d8d3c8', '#3f7a4e', '#7a4a8f'] },
  taxi:   { name: 'Taxi',     accel: 420, topSpeed: 420, reverseSpeed: 150, turn: 2.6, grip: 6.5, length: 46, width: 22, colors: ['#f2b705'] },
  coupe:  { name: 'Coupe',    accel: 520, topSpeed: 480, reverseSpeed: 160, turn: 3.0, grip: 7.2, length: 44, width: 21, colors: ['#1d1d22', '#8f1d1d', '#c8c8d0'] },
  sport:  { name: 'Sport',    accel: 640, topSpeed: 560, reverseSpeed: 170, turn: 3.3, grip: 8.0, length: 46, width: 22, colors: ['#e8a020', '#d81e3c', '#1899d8'] },
  muscle: { name: 'Muscle',   accel: 560, topSpeed: 500, reverseSpeed: 160, turn: 2.7, grip: 6.8, length: 48, width: 23, colors: ['#4a2a6e', '#b3541e', '#222831'] },
  van:    { name: 'Van',      accel: 340, topSpeed: 360, reverseSpeed: 130, turn: 2.2, grip: 5.5, length: 54, width: 24, colors: ['#e8e4da', '#5a6b7a', '#8a6d3b'] },
  truck:  { name: 'Truck',    accel: 300, topSpeed: 330, reverseSpeed: 120, turn: 1.9, grip: 5.0, length: 62, width: 26, colors: ['#7a7a72', '#a33b2e', '#3e6b4f'] },
  police: { name: 'Cruiser',  accel: 600, topSpeed: 540, reverseSpeed: 170, turn: 3.1, grip: 7.6, length: 47, width: 22, colors: ['#1c2a44'] },
};

export const WEAPONS = {
  fists: { name: 'Fists', damage: PLAYER.punchDamage, range: PLAYER.punchRange, cooldown: PLAYER.punchCooldown, auto: false, spread: 0, bulletSpeed: 0, magSize: Infinity, icon: '✊' },
  pistol: { name: 'Pistol', damage: 34, range: 520, cooldown: 0.22, auto: false, spread: 0.045, bulletSpeed: 900, magSize: 12, icon: '🔫' },
};

// Pedestrian shirt palette.
export const PED_COLORS = ['#d86a5a', '#5a8fd8', '#7ac74f', '#e0a83c', '#9b6bd8', '#e06ba8', '#4fc4c4', '#d8d8d8', '#8a5a3b', '#3b3b3b'];
export const PED_SHIRTS = PED_COLORS;

// Street names for flavour (shown on the HUD when crossing a street).
export const STREETS_NS = ['Harbor Row', 'Coral Ave', 'Palm Blvd', 'Sunset Dr', 'Marina Way', 'Juniper St', 'Cactus Ln', 'Bayview Ave'];
export const STREETS_EW = ['Ocean Pkwy', 'Sierra St', 'Flamingo Ave', 'Lighthouse Rd', 'Citrus Blvd', 'Anchor St', 'Pelican Way', 'Boardwalk'];

export function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function dist2(ax, ay, bx, by) { const dx = ax - bx; const dy = ay - by; return dx * dx + dy * dy; }
export function angleLerp(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}
export function angleDiff(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}
