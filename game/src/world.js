// world.js — builds Solmar Bay: a road grid, city blocks full of buildings,
// parks, a beach and water along the south edge, and the docks on the west.
// It also answers the two questions the rest of the game keeps asking:
// "is this point inside a solid building?" and "where is the nearest road?"

import { WORLD, PALETTE } from './config.js';
import { makeRng } from './rng.js';

const ROOF_COLORS = ['#8d6e63', '#a1887f', '#6d4c41', '#795548', '#7b8d8f', '#546e7a', '#b0a090', '#93806a'];
const WALL_COLORS = ['#bcaaa4', '#a5a5a0', '#c9b8a8', '#9db3b8', '#c4b49a'];

export function roadCentres() {
  const lines = [];
  for (let p = 240; p < WORLD.size; p += WORLD.roadGap) lines.push(p);
  return lines;
}

/** Build the whole city from a seed. Deterministic: same seed, same city. */
export function buildCity(seed) {
  const rng = makeRng(seed);
  const lines = roadCentres();
  const buildings = [];
  const parks = [];
  const trees = [];
  const props = []; // crates, containers, lamps, benches — small decor with no collision

  const beachTop = WORLD.size - 260; // sand strip, then water to the edge
  const dockX = 300; // the docks occupy the west edge below the old town

  // One block = the square between four roads. Fill most blocks with buildings.
  for (let i = 0; i < lines.length - 1; i += 1) {
    for (let j = 0; j < lines.length - 1; j += 1) {
      const x0 = lines[i] + WORLD.roadWidth / 2 + WORLD.sidewalk;
      const y0 = lines[j] + WORLD.roadWidth / 2 + WORLD.sidewalk;
      const x1 = lines[i + 1] - WORLD.roadWidth / 2 - WORLD.sidewalk;
      const y1 = lines[j + 1] - WORLD.roadWidth / 2 - WORLD.sidewalk;
      if (y0 > beachTop) continue; // beach, no buildings
      if (x0 < dockX && y0 > 2200) continue; // docks, handled below
      const cx = (x0 + x1) / 2;
      const cy = (y0 + y1) / 2;
      const downtown = cx > 1200 && cx < 2400 && cy > 900 && cy < 2100;
      if (rng.chance(downtown ? 0.06 : 0.16)) {
        // A park instead of buildings.
        parks.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
        const n = rng.int(4, 9);
        for (let t = 0; t < n; t += 1) {
          trees.push({ x: rng.range(x0 + 14, x1 - 14), y: rng.range(y0 + 14, y1 - 14), r: rng.range(7, 12) });
        }
        continue;
      }
      // Split the block into 1-4 buildings.
      const splitX = rng.chance(0.55);
      const splitY = rng.chance(0.55);
      const xs = splitX ? [x0, (x0 + x1) / 2, x1] : [x0, x1];
      const ys = splitY ? [y0, (y0 + y1) / 2, y1] : [y0, y1];
      for (let a = 0; a < xs.length - 1; a += 1) {
        for (let b = 0; b < ys.length - 1; b += 1) {
          if (rng.chance(0.12)) continue; // an empty lot
          const bx = xs[a] + 8;
          const by = ys[b] + 8;
          const bw = xs[a + 1] - xs[a] - 16;
          const bh = ys[b + 1] - ys[b] - 16;
          if (bw < 30 || bh < 30) continue;
          const tall = downtown && rng.chance(0.7);
          buildings.push({
            x: bx,
            y: by,
            w: bw,
            h: bh,
            height: tall ? rng.int(26, 60) : rng.int(8, 20),
            roof: rng.pick(ROOF_COLORS),
            wall: rng.pick(WALL_COLORS),
            downtown,
          });
        }
      }
    }
  }

  // Docks: container stacks and warehouses along the west edge.
  for (let y = 2300; y < WORLD.size - 300; y += 190) {
    buildings.push({
      x: 40, y, w: 170, h: 120, height: 14, roof: '#5d4037', wall: '#8d6e63', downtown: false, warehouse: true,
    });
    for (let c = 0; c < 3; c += 1) {
      props.push({
        kind: 'container',
        x: 250 + c * 46,
        y: y + 20 + (c % 2) * 44,
        w: 40,
        h: 20,
        color: rng.pick(['#c0392b', '#2471a3', '#b7950b', '#1e8449']),
      });
    }
  }

  // Lamps along every road, on both sides.
  for (const line of lines) {
    for (let p = 300; p < WORLD.size - 100; p += 420) {
      props.push({ kind: 'lamp', x: line - WORLD.roadWidth / 2 - 8, y: p, w: 4, h: 4, color: '#f5d76e' });
      props.push({ kind: 'lamp', x: line + WORLD.roadWidth / 2 + 8, y: p + 210, w: 4, h: 4, color: '#f5d76e' });
    }
  }

  return {
    seed,
    lines,
    buildings,
    parks,
    trees,
    props,
    beachTop,
    dockX,
    // Named places the missions and the HUD point at.
    places: {
      safehouse: { x: 660, y: 660, name: 'Safehouse' },
      garage: { x: 1500, y: 2700, name: "Rosa's Garage" },
      docks: { x: 220, y: 2700, name: 'Solmar Docks' },
      marina: { x: 3050, y: 3050, name: 'Marina' },
      hotel: { x: 2100, y: 1500, name: 'Hotel Mirada' },
      bank: { x: 1800, y: 1200, name: 'Bay National Bank' },
      diner: { x: 1020, y: 1860, name: "Lou's Diner" },
      plaza: { x: 1800, y: 1800, name: 'Plaza Verde' },
      beach: { x: 1800, y: 3450, name: 'Solmar Beach' },
      hospital: { x: 2700, y: 660, name: 'St. Ana Hospital' },
    },
  };
}

/** True when a circle at (x, y) with radius r overlaps any building or the map edge. */
export function isSolid(city, x, y, r) {
  if (x < r || y < r || x > WORLD.size - r || y > WORLD.size - r) return true;
  for (let i = 0; i < city.buildings.length; i += 1) {
    const b = city.buildings[i];
    if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return true;
  }
  return false;
}

/** Slide a circle along the world: try x then y, so it hugs walls instead of sticking. */
export function moveWithCollision(city, obj, dx, dy) {
  if (!isSolid(city, obj.x + dx, obj.y, obj.radius)) obj.x += dx;
  if (!isSolid(city, obj.x, obj.y + dy, obj.radius)) obj.y += dy;
}

/** The nearest point on any road centreline to (x, y). */
export function nearestRoadPoint(city, x, y) {
  let bestX = city.lines[0];
  let bestD = Infinity;
  for (const line of city.lines) {
    const d = Math.abs(line - x);
    if (d < bestD) { bestD = d; bestX = line; }
  }
  let bestY = city.lines[0];
  bestD = Infinity;
  for (const line of city.lines) {
    const d = Math.abs(line - y);
    if (d < bestD) { bestD = d; bestY = line; }
  }
  return { x: bestX, y: bestY };
}

/** True when the point is on asphalt (drivable road surface). */
export function onRoad(city, x, y) {
  const half = WORLD.roadWidth / 2;
  for (const line of city.lines) {
    if (Math.abs(x - line) <= half || Math.abs(y - line) <= half) return true;
  }
  return false;
}

/** Which district a point is in, for the HUD's location label. */
export function districtAt(x, y) {
  if (y > WORLD.size - 260) return 'Solmar Beach';
  if (x < 300 && y > 2200) return 'Solmar Docks';
  if (x > 1200 && x < 2400 && y > 900 && y < 2100) return 'Downtown';
  if (y > 2100 && x > 2400) return 'Marina District';
  if (y < 900) return 'North Hills';
  return 'Old Town';
}

export { PALETTE };
