import assert from 'node:assert/strict';
import { test } from 'node:test';

import { FACE_LETTERS, QUARTER_PERMS, STICKERS, VECTORS } from '../js/cube.js';
import { arrowMarkup, cubiePlan, layerPositions, turnSpec } from '../js/view3d.js';

const MOVES = FACE_LETTERS.split('').flatMap((face) => [face, `${face}2`, `${face}'`]);

test('each face layer is the 9 cubies on that side', () => {
  for (const face of FACE_LETTERS) {
    const layer = layerPositions(face);
    assert.equal(layer.length, 9);
    for (const p of layer) {
      const along = p.reduce((sum, v, i) => sum + v * VECTORS[face][i], 0);
      assert.equal(along, 1, `${face} layer has a cubie off the face: ${p}`);
    }
  }
});

test('stickers that a quarter turn moves belong to the cubies of that layer', () => {
  FACE_LETTERS.split('').forEach((face, f) => {
    const layer = new Set(layerPositions(face).map((p) => p.join(',')));
    QUARTER_PERMS[f].forEach((from, slot) => {
      if (from === slot) return;
      assert.ok(layer.has(STICKERS[slot].pos.join(',')), `${face}: slot ${slot} is outside the layer`);
      assert.ok(layer.has(STICKERS[from].pos.join(',')), `${face}: sticker ${from} is outside the layer`);
    });
  });
});

test('the cubie plan has 27 cubies and gives every sticker to one cubie', () => {
  const plan = cubiePlan();
  assert.equal(plan.length, 27);
  const seen = plan.flatMap((c) => c.stickers.map((s) => s.index)).sort((a, b) => a - b);
  assert.deepEqual(seen, Array.from({ length: 54 }, (_, i) => i));
  const counts = plan.map((c) => c.stickers.length).sort();
  assert.equal(counts.filter((n) => n === 3).length, 8, 'corners');
  assert.equal(counts.filter((n) => n === 2).length, 12, 'edges');
  assert.equal(counts.filter((n) => n === 1).length, 6, 'centers');
  assert.equal(counts.filter((n) => n === 0).length, 1, 'core');
});

test('turn specs give the face, the quarter count and a unit axis', () => {
  for (const move of MOVES) {
    const spec = turnSpec(move);
    assert.equal(spec.face, move[0]);
    assert.equal(spec.quarters, move.endsWith('2') ? 2 : move.endsWith("'") ? -1 : 1);
    assert.equal(spec.axis.reduce((sum, v) => sum + Math.abs(v), 0), 1);
  }
});

test('the arrow is drawn for every move and mirrors counterclockwise turns', () => {
  for (const move of MOVES) {
    const svg = arrowMarkup(move);
    assert.ok(svg.includes(`>${move}</text>`), `${move} label`);
    assert.equal(svg.includes('scale(-1 1)'), move.endsWith("'"), `${move} mirror`);
  }
});
