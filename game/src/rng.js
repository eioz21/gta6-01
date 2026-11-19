// rng.js — a tiny seeded generator (mulberry32) so the city and every staged
// screenshot are reproducible from one seed, and plain helpers on top of it.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeRng(seed) {
  const rand = mulberry32(seed);
  return {
    next: rand,
    range(min, max) {
      return min + rand() * (max - min);
    },
    int(min, max) {
      return Math.floor(min + rand() * (max - min + 1));
    },
    pick(list) {
      return list[Math.floor(rand() * list.length)];
    },
    chance(p) {
      return rand() < p;
    },
  };
}
