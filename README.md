# MAINFRAME: BREACH PROTOCOL

A corporate-horror social deduction game set in an isometric 3D Global NOC.
Single-file, no build step, no install.

- `dist/mainframe-breach-protocol.html` — the standalone game. Open it in a browser,
  or serve it over LAN/VPN for peer-to-peer multiplayer.
- `dist/artifact-body.html` — the same page without the document wrapper, for
  publishing as a Claude Artifact.
- `src/game-body.html` — styles + markup. `src/game.js` — the game.
  `dist/*` is assembled from these two; edit the sources, not the build.
- `src/smart-intent.js` — the standalone manifest + boot compiler.
- `docs/gdd.html` — the design bible: pillars, act structure, economies, tuning reference.
- `docs/AUDIT-v1.md` — architectural audit of the v1 prototype this replaces.

## Running it

Solo Shift works from a plain `file://` open. Multiplayer needs the page served
over HTTP(S) so PeerJS can reach a signalling broker — any static server will do:

    python3 -m http.server 8080     # then open http://<host>:8080/dist/mainframe-breach-protocol.html

## Controls

WASD or arrows to move. SPACE to interact, contain a fault, report, vote or
convene the bridge. ESC aborts a task. Touch devices get a d-pad.

## Rebuilding dist

    { cat src/game-body.html; echo; echo '<script>'; cat src/game.js; echo '</script>'; } > dist/artifact-body.html
