// save.js — autosave to localStorage: money, mission progress, weapons,
// the player's spot in the city and the clock. Nothing leaves the browser.

const KEY = 'solmar-bay-save-v1';

export function hasSave() {
  try {
    return localStorage.getItem(KEY) !== null;
  } catch {
    return false;
  }
}

export function saveGame(g) {
  try {
    const data = {
      version: 1,
      money: Math.floor(g.money),
      missionIndex: g.missions.index,
      missionDone: g.missions.done,
      weapons: g.player.weapons,
      ammo: g.player.ammo,
      player: { x: g.player.x, y: g.player.y, hp: g.player.hp },
      clock: g.clock,
      day: g.day,
      savedAt: Date.now(),
    };
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.version !== 1) return null;
    return data;
  } catch {
    return null;
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* storage unavailable; nothing to clear */
  }
}
