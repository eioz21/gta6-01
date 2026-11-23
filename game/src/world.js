// Solmar Bay itself: the road grid, the blocks, the buildings, the beach and
// the harbor, plus collision and district lookups. The city is generated from
// a fixed seed, so every playthrough walks the same streets.
import { WORLD, ROAD_LINES, ROAD_HALF, ROAD_SPACING, clamp } from './config.js';
import { makeRng, hash2 } from './rng.js';

const BUILDING_COLORS = [
  '#c9a37e', '#b98d6e', '#a8b8c4', '#c4b49a', '#8fa8b8', '#d8c8a8',
  '#b8a0a0', '#9ab8a0', '#c4a8b8', '#e0d0b8', '#7a90a8', '#d0b090',
];
const DOWNTOWN_COLORS = ['#5a6b84', '#4a5a74', '#6b7a94', '#3e4c64', '#7a8aa8', '#54647e'];
const ROOF_COLORS = ['#5a4a3a', '#6b5a4a', '#4a5a6b', '#7a6a5a', '#3a4a3a'];

// Named places the missions use (world coordinates).
export const PLACES = {
  vinceOffice: { x: 1600, y: 1400, name: "Vince's Office" },
  marasGarage: { x: 1000, y: 2200, name: "Mara's Garage" },
  harborDocks: { x: 260, y: 600, name: 'Harbor Docks' },
  solmarBank: { x: 1800, y: 1600, name: 'Solmar Bank' },
  casino: { x: 2200, y: 1800, name: 'The Palmetto Casino' },
  hospital: { x: 1400, y: 1000, name: 'Solmar General Hospital' },
  policeHQ: { x: 2000, y: 1000, name: 'Solmar PD HQ' },
  beachPier: { x: 1600, y: 3080, name: 'Beach Pier' },
  industrial: { x: 1000, y: 2600, name: 'Industrial Yard' },
  airport: { x: 2800, y: 2800, name: 'Solmar Airfield' },
};

export function districtAt(x, y) {
  if (x < 260) return 'Harbor';
  if (y > 2960) return 'Beachfront';
  if (x > 2960) return 'Marina';
  if (x >= 1200 && x <= 2200 && y >= 1200 && y <= 2200) return 'Downtown';
  if (x < 1200 && y < 1200) return 'Old Town';
  if (x >= 2200 && y < 1200) return 'Hillside';
  if (x < 1200 && y >= 2200) return 'Southside';
  if (x >= 2200 && y >= 2200) return 'Eastside';
  return 'Northgate';
}

export function streetNameAt(x, y) {
  const ns = ['Harbor Row', 'Coral Ave', 'Palm Blvd', 'Sunset Dr', 'Marina Way', 'Juniper St', 'Cactus Ln', 'Bayview Ave'];
  const ew = ['Ocean Pkwy', 'Sierra St', 'Flamingo Ave', 'Lighthouse Rd', 'Citrus Blvd', 'Anchor St', 'Pelican Way', 'Boardwalk'];
  let best = null; let bestD = Infinity; let axis = 'ns';
  for (let i = 0; i < ROAD_LINES.length; i += 1) {
    const d = Math.abs(x - ROAD_LINES[i]);
    if (d < bestD) { bestD = d; best = ns[i]; axis = 'ns'; }
    const d2 = Math.abs(y - ROAD_LINES[i]);
    if (d2 < bestD) { bestD = d2; best = ew[i]; axis = 'ew'; }
  }
  return { name: best, axis };
}

export class City {
  constructor(seed = 20261123) {
    this.seed = seed;
    this.buildings = [];
    this.parks = [];
    this.trees = [];
    this.lamps = [];
    this.parkingLots = [];
    this.generate();
  }

  generate() {
    const rng = makeRng(this.seed);
    // Blocks sit between roads. Block (i, j) spans the square between road
    // lines i and i+1 horizontally and j and j+1 vertically.
    for (let i = 0; i < ROAD_LINES.length - 1; i += 1) {
      for (let j = 0; j < ROAD_LINES.length - 1; j += 1) {
        const x0 = ROAD_LINES[i] + ROAD_HALF + 14;
        const y0 = ROAD_LINES[j] + ROAD_HALF + 14;
        const x1 = ROAD_LINES[i + 1] - ROAD_HALF - 14;
        const y1 = ROAD_LINES[j + 1] - ROAD_HALF - 14;
        const cx = (x0 + x1) / 2; const cy = (y0 + y1) / 2;
        const downtown = cx >= 1200 && cx <= 2200 && cy >= 1200 && cy <= 2200;
        const roll = hash2(i, j, this.seed);
        if (roll < 0.12) {
          // Park: green square with trees.
          this.parks.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
          const n = 5 + Math.floor(hash2(i, j, 7) * 5);
          for (let t = 0; t < n; t += 1) {
            this.trees.push({ x: x0 + 30 + hash2(i, j, 100 + t) * (x1 - x0 - 60), y: y0 + 30 + hash2(i, j, 200 + t) * (y1 - y0 - 60), r: 9 + hash2(i, j, 300 + t) * 7 });
          }
          continue;
        }
        if (roll < 0.2) {
          // Parking lot: flat asphalt with painted bays.
          this.parkingLots.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
          continue;
        }
        const palette = downtown ? DOWNTOWN_COLORS : BUILDING_COLORS;
        const tall = downtown && hash2(i, j, 11) < 0.6;
        if (hash2(i, j, 21) < 0.45) {
          // One big building filling most of the block.
          const inset = 14 + hash2(i, j, 31) * 30;
          const b = {
            x: x0 + inset, y: y0 + inset,
            w: x1 - x0 - inset * 2, h: y1 - y0 - inset * 2,
            color: palette[Math.floor(hash2(i, j, 41) * palette.length)],
            roof: ROOF_COLORS[Math.floor(hash2(i, j, 51) * ROOF_COLORS.length)],
            height: tall ? 3 + Math.floor(hash2(i, j, 61) * 4) : 1 + Math.floor(hash2(i, j, 61) * 2),
            seed: Math.floor(hash2(i, j, 71) * 1e9),
            downtown,
          };
          this.buildings.push(b);
        } else {
          // Four smaller buildings, one per quadrant.
          const mx = (x0 + x1) / 2; const my = (y0 + y1) / 2;
          const quads = [[x0, y0, mx, my], [mx, y0, x1, my], [x0, my, mx, y1], [mx, my, x1, y1]];
          for (let q = 0; q < 4; q += 1) {
            if (hash2(i, j, 80 + q) < 0.18) {
              this.trees.push({ x: (quads[q][0] + quads[q][2]) / 2, y: (quads[q][1] + quads[q][3]) / 2, r: 12 });
              continue;
            }
            const inset = 8 + hash2(i, j, 90 + q) * 14;
            this.buildings.push({
              x: quads[q][0] + inset, y: quads[q][1] + inset,
              w: quads[q][2] - quads[q][0] - inset * 2, h: quads[q][3] - quads[q][1] - inset * 2,
              color: palette[Math.floor(hash2(i, j, 100 + q) * palette.length)],
              roof: ROOF_COLORS[Math.floor(hash2(i, j, 110 + q) * ROOF_COLORS.length)],
              height: tall ? 2 + Math.floor(hash2(i, j, 120 + q) * 3) : 1,
              seed: Math.floor(hash2(i, j, 130 + q) * 1e9),
              downtown,
            });
          }
        }
        // A tree or two on the block corners.
        if (hash2(i, j, 140) < 0.5) {
          this.trees.push({ x: x0 + 12, y: y0 + 12, r: 8 + hash2(i, j, 141) * 6 });
          this.trees.push({ x: x1 - 12, y: y1 - 12, r: 8 + hash2(i, j, 142) * 6 });
        }
      }
    }
    // Street lamps along every road, every 200 px.
    for (const line of ROAD_LINES) {
      for (let p = 100; p < WORLD; p += 200) {
        this.lamps.push({ x: line + ROAD_HALF + 6, y: p });
        this.lamps.push({ x: p, y: line - ROAD_HALF - 6 });
      }
    }
    // Palm trees along the beach.
    for (let x = 300; x < WORLD; x += 130) {
      this.trees.push({ x: x + rng.range(-20, 20), y: 3020 + rng.range(-8, 8), r: 11, palm: true });
    }
  }

  isOnRoad(x, y) {
    for (const line of ROAD_LINES) {
      if (Math.abs(x - line) <= ROAD_HALF || Math.abs(y - line) <= ROAD_HALF) return true;
    }
    return false;
  }

  isWater(x, y) { return x < 120 || x > 3080 || y > 3120; }
  isSand(x, y) { return y > 2960 && y <= 3120 && x >= 120 && x <= 3080; }

  buildingAt(x, y) {
    for (let i = 0; i < this.buildings.length; i += 1) {
      const b = this.buildings[i];
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b;
    }
    return null;
  }

  // Circle vs buildings + world bounds. Returns the building hit, or null.
  collideCircle(x, y, r) {
    if (x - r < 0 || y - r < 0 || x + r > WORLD || y + r > WORLD) return 'bounds';
    for (let i = 0; i < this.buildings.length; i += 1) {
      const b = this.buildings[i];
      const cx = clamp(x, b.x, b.x + b.w);
      const cy = clamp(y, b.y, b.y + b.h);
      const dx = x - cx; const dy = y - cy;
      if (dx * dx + dy * dy < r * r) return b;
    }
    return null;
  }

  // Axis-aligned box vs buildings. Used by cars (approximated by their centre circle).
  collideCar(x, y, r) { return this.collideCircle(x, y, r); }

  nearestRoadPoint(x, y) {
    let bx = x; let by = y; let best = Infinity;
    for (const line of ROAD_LINES) {
      const d = Math.abs(x - line);
      if (d < best) { best = d; bx = line; by = y; }
      const d2 = Math.abs(y - line);
      if (d2 < best) { best = d2; bx = x; by = line; }
    }
    return { x: bx, y: by };
  }

  randomRoadPoint(rng) {
    const vertical = rng.chance(0.5);
    const line = rng.pick(ROAD_LINES);
    const along = rng.range(160, WORLD - 160);
    return vertical ? { x: line, y: along } : { x: along, y: line };
  }

  randomSidewalkPoint(rng) {
    // A point on a block edge (the sidewalk ring around a block).
    const i = rng.int(0, ROAD_LINES.length - 2);
    const j = rng.int(0, ROAD_LINES.length - 2);
    const x0 = ROAD_LINES[i] + ROAD_HALF + 6;
    const y0 = ROAD_LINES[j] + ROAD_HALF + 6;
    const x1 = ROAD_LINES[i + 1] - ROAD_HALF - 6;
    const y1 = ROAD_LINES[j + 1] - ROAD_HALF - 6;
    const side = rng.int(0, 3);
    if (side === 0) return { x: rng.range(x0, x1), y: y0 };
    if (side === 1) return { x: rng.range(x0, x1), y: y1 };
    if (side === 2) return { x: x0, y: rng.range(y0, y1) };
    return { x: x1, y: rng.range(y0, y1) };
  }

  randomIntersection(rng) {
    return { x: rng.pick(ROAD_LINES), y: rng.pick(ROAD_LINES) };
  }
}
