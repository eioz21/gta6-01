[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/eioz21/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/eioz21/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

# Solmar Bay — an open-world crime game

A complete open-world crime game in the spirit of GTA 6, built from scratch
as static files that play offline in a desktop browser. No network requests,
no external libraries, no assets but code: the city, the cars, the people,
the story, the art, the sound and the music are all original.

## The story

Kai Mercer owes $50,000 to Vince Kessler, the fixer who runs Solmar Bay from
a Downtown office. Five story missions pay the debt down — stealing wheels,
running packages, a timed delivery, a three-crate grab, and the big score at
Solmar Bank — and when the debt is paid, the city is yours to free-roam.

## The city

Solmar Bay is a sun-soaked coastal city: Downtown towers, Old Town, the
Harbor docks, the Marina, Beachfront and the Industrial Yard, all on a
drivable road grid with traffic, pedestrians, parks, parking lots, a day/night
cycle and golden-hour light. The Solmar PD answers crimes with a 1–5 star
wanted system: cruisers chase and ram, officers on foot try to arrest you.

## What is in the game

- Explore on foot and by car; steal any car on the street (jack a driven one
  and the heat rises)
- Traffic and pedestrians with routines; pedestrians flee gunfire
- Wanted system (1–5 stars) with police cruisers and foot officers
- Combat: fists and a pistol, with health, ammo and cash pickups
- 5 story missions with dialogue, objectives, timers and rewards
- Taxi side job: drive a cab, pick up passengers, collect fares
- HUD with health, cash, wanted stars, clock, district, weapon/ammo and a
  live minimap; objective marker with an edge arrow
- Day/night cycle, start screen, pause menu, autosave to localStorage with
  Continue
- Synthesised WebAudio sound: engine hum, sirens, gunshots, pickups and a
  low-key city groove — no audio files

## Controls

| Key | Action |
| --- | --- |
| WASD / arrows | Move / drive |
| Shift | Sprint |
| Mouse | Aim (on foot) |
| Click | Shoot / punch |
| E | Enter & steal car / exit car |
| F | Punch |
| 1 / 2 | Fists / pistol |
| R | Reload |
| Space | Handbrake |
| T | Taxi shift (while driving a taxi) |
| P / Esc | Pause |
| M | Mute |

## Play

Serve `game/` with any static server and open `index.html`:

```sh
node serve.ts
# game/ is on http://localhost:8080
```

Press Enter on the title screen. The first mission starts right away: steal
a car and drive it to Mara's Garage. Between missions, go to the yellow `V`
marker at Vince's Office to start the next one. Get wasted and you wake up
at Solmar General minus 10% of your cash; get busted and Det. Ruiz fines you
$200.

## Screenshots

The four screenshots in `screenshots/` are real renders of the game, taken
in headless Chromium from deterministic scenes:

1. `1-start.jpg` — title screen over Downtown at golden hour
2. `2-drive.jpg` — driving a sports car through traffic at noon
3. `3-chase.jpg` — a three-star police chase at night
4. `4-mission.jpg` — the Harbor Docks pickup mission at sunset

They are staged with `?shot=start|drive|chase|mission&seed=7`, which plays
the real game forward from a fixed seed.

## Files

- `game/index.html` — entry point
- `game/src/config.js` — constants, car types, weapons
- `game/src/rng.js` — seeded random numbers
- `game/src/input.js` — keyboard + mouse
- `game/src/world.js` — city generation, collision, districts
- `game/src/vehicles.js` — car physics and traffic AI
- `game/src/entities.js` — player, pedestrians, population
- `game/src/police.js` — wanted system and police AI
- `game/src/combat.js` — fists, pistol, bullets, explosions
- `game/src/missions.js` — the 5-mission story, dialogue, taxi job
- `game/src/audio.js` — synthesised WebAudio sound and music
- `game/src/render.js` — the canvas city and day/night light
- `game/src/hud.js` — HUD, minimap, menus
- `game/src/update.js` — one fixed step of the living city
- `game/src/save.js` — localStorage autosave
- `game/src/shots.js` — deterministic screenshot scenes
- `game/src/main.js` — entry point, screens, game loop

`main.ts` (Node 22, standard library only) copies `game/` and `screenshots/`
to `/output` and writes `/output/dossier.json` with the vendored make.fun
library.

## License

MIT — see `LICENSE`.
