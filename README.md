# Rubik's Cube Solver

A Rubik's Cube solver that runs entirely in the browser. Paint the colors of your cube onto the diagram and the solver returns a short sequence of face turns, usually 19 to 22 moves, that you can step through on an animated 3D cube.

It is served at https://ceg.me/rubiks/ and the source is at https://github.com/cegme/rubiks.

## How it works

The solver is Kociemba's two-phase algorithm, written from scratch with no dependencies.

1. Phase 1 uses IDA* to find moves that bring the cube into the subgroup G1 = <U, D, R2, L2, F2, B2>. In G1 the corner twist and edge flip are 0 and the four middle-slice edges are in the middle slice.
2. Phase 2 uses IDA* over G1 moves only to finish the cube.
3. After the first solution the search continues with a shorter length bound until the time limit, so a longer search time finds shorter solutions. The result is near-optimal. It is not proven to be the shortest.

Pruning tables are built when the page loads, in about half a second, so no data files are shipped. The search runs in a Web Worker so the page stays responsive.

Moves are counted in the half-turn metric (U2 counts as 1).

## The 3D player

The solution card shows the cube twice, from opposite corners. One view shows the top, front and right faces and the other shows the bottom, back and left faces, so every face turn is visible in one of them. The face that turns next is marked with an arrow that shows the direction, and the view that contains that face is outlined. Next, Back, Play and the arrow keys animate the turn. Jumping to another step with a chip or Start changes the cube at once. The Speed menu sets the animation time, and the page skips the animation when the browser asks for reduced motion.

The views are plain CSS 3D transforms with no library. The cube is 27 cubies. A turn rotates the 9 cubies of one layer about the cube center, and when it ends the colors are redrawn from the new facelet string and the cubies return to their slots. The frame after the swap is the same as the last frame of the rotation, so there is no visible jump.

The rotation axis and direction come from the same model as the solver. The checks that need a browser measured every sticker in both views for all 18 moves. With the layer rotated to the end of the turn, each moved sticker landed on the slot that `QUARTER_PERMS` predicts, to within 0.001 px.

## Trigger names

A trigger is a short sequence of turns that cubers practice, such as Rightie (R U R' U'). `js/triggers.js` lists the names and finds them in a solution. When one appears, the player boxes its chips and writes the name under them, and the text for the current move says which move of the trigger it is. A trigger also matches when the cube is held differently, so F R F' R' is Rightie with the cube turned. The turned forms come from the 24 rotations of the cube.

The solver chooses solutions for their length, so triggers are rare in its output. In 300 random scrambles solved with a 150 ms budget, none of the solutions contained a trigger written as listed, and 4 contained one once turned forms counted. Hedgeslammer (r' F R F') starts with a wide turn, which the solver never makes, so it is listed but never matched. The moves for Sune and Antisune are the standard ones. Antisune is the inverse of Sune.

## Files

| Path | Purpose |
| --- | --- |
| `index.html`, `css/style.css` | Page and styles |
| `js/app.js` | Cube editor and solution player |
| `js/view3d.js` | 3D cube views and the animated face turns |
| `js/triggers.js` | Trigger names and the matcher that finds them in a solution |
| `js/history.js` | Bounded undo stack for the color editor |
| `js/solver.worker.js` | Web Worker that builds tables and runs searches |
| `js/solver.js` | Two-phase search |
| `js/tables.js` | Coordinates, move tables and pruning tables |
| `js/cube.js` | Facelet and cubie model, validation, move application |
| `tests/` | Tests for the model, the solver, the data behind the 3D view, the trigger matcher and the undo stack |

Sticker positions and quarter turns in `js/cube.js` are derived from 3D coordinates, so the facelet layout and the cubie moves cannot disagree.

## Input conventions

The cube is a 54 character string of face letters in the order U1..U9, R1..R9, F1..F9, D1..D9, L1..L9, B1..B9. Hold the cube with white on top and green facing you. The center stickers define the faces, so the colors are white for U, red for R, green for F, yellow for D, orange for L and blue for B.

The editor keeps the cube in the URL hash, using `.` for stickers that are not set yet, so a state can be shared or bookmarked.

The Undo button, or Ctrl+Z and Cmd+Z, steps back one change. A press and drag across several stickers is one change. Clear, Random scramble and Solved cube can be undone as well.

## Run locally

Modules and workers need a web server, so opening `index.html` from the file system does not work.

```sh
uv run python -m http.server 8000
```

Then open http://localhost:8000/.

## Tests

```sh
node --test
```

The tests check the cube geometry against physical turn behavior, the validation messages, and that every solution returned for random scrambles solves the cube when applied.

## Hosting

The site is plain static files, served by GitHub Pages from the `main` branch. The `.nojekyll` file turns off Jekyll processing. All asset paths are relative, so the app works under any path such as `/rubiks/`.
