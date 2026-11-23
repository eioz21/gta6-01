// Autosave: the player's progress in localStorage, loaded on Continue.
// The save holds position, cash, health, ammo, mission progress, the clock
// and the stats. Nothing leaves the browser.
import { SAVE_KEY } from './config.js';

export function saveExists() {
  try {
    return !!window.localStorage.getItem(SAVE_KEY);
  } catch (e) {
    return false;
  }
}

export function writeSave(state) {
  try {
    const p = state.player;
    const data = {
      version: 1,
      savedAt: new Date().toISOString(),
      x: p.inCar ? p.inCar.x : p.x,
      y: p.inCar ? p.inCar.y : p.y,
      cash: Math.floor(p.cash),
      hp: Math.ceil(p.hp),
      weapon: p.weapon,
      ammo: p.ammo,
      mag: p.mag,
      missionIndex: state.mission.index,
      missionsDone: p.missionsDone,
      cashEarned: Math.floor(p.cashEarned),
      carsStolen: p.carsStolen,
      clockHours: state.clockHours,
      storyDone: state.mission.done,
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    return false;
  }
}

export function readSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.version !== 1) return null;
    return data;
  } catch (e) {
    return null;
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch (e) { /* storage unavailable */ }
}
