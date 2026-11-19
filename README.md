# Solmar Bay — an open-world crime story

[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/eioz21/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/eioz21/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01)

A top-down open-world crime game that runs in a desktop browser from static
files, no network requests. Built for make.fun's **gta6-01** bounty.

You are Leo Cruz, fresh out of jail, in debt to Rosa's garage. Steal cars,
outrun the SBPD, run five story missions across Solmar Bay — a sun-soaked
coastal city with traffic, pedestrians, taxi fares, the beach and the docks —
and become King of the Bay.

## Play

Serve `game/` with any static server and open `index.html` in desktop Chrome:

```sh
node serve.ts
# then open http://localhost:8080
```

Or open `game/index.html` directly from disk.

## Controls

| Key | Action |
| --- | --- |
| WASD / arrows | Move on foot, drive in a car |
| Mouse | Aim |
| Left click | Shoot |
| E | Enter / exit a car |
| Space | Punch |
| Shift | Sprint |
| Q | Switch weapon |
| M | Mute |
| Esc | Pause |

## Features

- A 3600×3600 explorable city: Downtown, Old Town, North Hills, the Docks,
  the Marina and Solmar Beach, with a day/night cycle
- Driving with arcade physics — steal any car, run over the kerb, ram the cops
- Traffic and pedestrians with their own routines; witnesses call the police
- Wanted level (1–5 stars) with foot cops and police interceptors that chase
- Combat: fists, pistol, SMG, shotgun; health, ammo and cash pickups
- Five story missions with dialogue, objectives and rewards, then free roam
  with taxi fares
- HUD with health, cash, wanted stars, clock, weapon/ammo and a live minimap
- Synthesised sound (WebAudio): engine, sirens, gunshots, music — no audio files
- Autosave to localStorage; continue from the title screen

## Entry

`main.ts` (Node 22, standard library only) copies `game/` and `screenshots/`
to the output directory and writes `dossier.json` with the kit's vendored
`vendor/makefun-game.ts`:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

Everything in `game/` is original code written for this entry — no engine,
no library, no borrowed assets.
