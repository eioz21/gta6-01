// Solmar Bay — gta6-01 entry program (Node 22, standard library only).
//
// The game lives in this repository's game/ folder as plain static files: an
// index.html plus ES modules, no build step, no network request. This program
// hands it in: it copies game/ and screenshots/ beside this file into the
// output directory and writes /output/dossier.json with the vendored make.fun
// library (vendor/makefun-game.ts, the kit's copy, unchanged).
//
// Run it locally with:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Outside the grader MAKEFUN_OUTPUT_DIR stands in for /output.
// Play the game locally with `node serve.ts` (http://localhost:8080).

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

// The gate's caps (reference/gate.json): text_max_bytes shapes the dossier's
// text; the other limits refuse an entry the scorer would refuse (more than 4
// screenshots, one over 256 KiB; game/ over 993 files or 48 MiB, a game/ path
// over 1000 bytes). /output itself caps at 1000 entries and 64 MiB, shared
// by game/, screenshots/ and dossier.json, so leave it room.
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
