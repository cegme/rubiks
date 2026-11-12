import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createHistory } from '../js/history.js';

test('snapshots come back latest first', () => {
  const history = createHistory();
  history.push(['a']);
  history.push(['b']);
  assert.equal(history.size, 2);
  assert.deepEqual(history.pop(), ['b']);
  assert.deepEqual(history.pop(), ['a']);
  assert.equal(history.pop(), undefined);
  assert.equal(history.size, 0);
});

test('a pushed snapshot is a copy', () => {
  const history = createHistory();
  const cube = ['U', null, 'R'];
  history.push(cube);
  cube[1] = 'F';
  assert.deepEqual(history.pop(), ['U', null, 'R']);
});

test('the oldest snapshot is dropped when the limit is reached', () => {
  const history = createHistory(3);
  for (const letter of 'abcde') history.push([letter]);
  assert.equal(history.size, 3);
  assert.deepEqual([history.pop(), history.pop(), history.pop()], [['e'], ['d'], ['c']]);
});
