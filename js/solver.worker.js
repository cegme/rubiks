/**
 * Web Worker that builds the solver tables once and then solves cubes on request.
 *
 * Messages in:  { type: 'solve', id, facelets, timeLimitMs, names }
 * Messages out: { type: 'ready', ms }
 *               { type: 'solution', id, moves, ms }   each improved solution
 *               { type: 'done', id, ok, moves, error, elapsedMs, exhausted }
 *               { type: 'error', id, message }
 */

import { solve } from './solver.js';
import { getTables } from './tables.js';

const started = performance.now();
getTables();
postMessage({ type: 'ready', ms: Math.round(performance.now() - started) });

self.onmessage = ({ data }) => {
  if (data.type !== 'solve') return;
  try {
    const result = solve(data.facelets, {
      timeLimitMs: data.timeLimitMs,
      names: data.names,
      onSolution: (moves, ms) => postMessage({ type: 'solution', id: data.id, moves, ms }),
    });
    postMessage({ type: 'done', id: data.id, ...result });
  } catch (error) {
    postMessage({ type: 'error', id: data.id, message: String(error?.message ?? error) });
  }
};
