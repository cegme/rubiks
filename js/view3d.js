/**
 * 3D cube view built from CSS transforms, with animated face turns.
 *
 * The cube is 27 cubies. A turn rotates the 9 cubies of one layer about the
 * cube center. When the rotation ends, the cubies go back to their slots and
 * the sticker colors are redrawn from the new facelet string. That frame looks
 * the same as the finished rotation, so the swap is not visible.
 *
 * Coordinates follow cube.js: x to the right, y up, z toward the viewer. CSS
 * has y pointing down, so the rotation axis flips its y component.
 */

import { FACE_LETTERS, SOLVED, STICKERS, VECTORS, applyMoves, parseMove } from './cube.js';

/**
 * Camera angles in degrees. The front view shows the U, F and R faces and the
 * back view shows D, B and L, so every face turn is visible in one of them.
 */
export const CAMERAS = [
  { name: 'front', rx: -32, ry: -42, faces: 'URF' },
  { name: 'back', rx: 34, ry: 138, faces: 'DBL' },
];

/* ---------- pure helpers ---------- */

/** Cubie positions in the outer layer of a face. Each coordinate is -1, 0 or 1. */
export function layerPositions(face) {
  const [vx, vy, vz] = VECTORS[face];
  const positions = [];
  for (let x = -1; x <= 1; x++) {
    for (let y = -1; y <= 1; y++) {
      for (let z = -1; z <= 1; z++) {
        if (x * vx + y * vy + z * vz === 1) positions.push([x, y, z]);
      }
    }
  }
  return positions;
}

/** The 27 cubies with the facelet indices and faces of their stickers. */
export function cubiePlan() {
  const cubies = new Map();
  for (let x = -1; x <= 1; x++) {
    for (let y = -1; y <= 1; y++) {
      for (let z = -1; z <= 1; z++) cubies.set([x, y, z].join(','), { pos: [x, y, z], stickers: [] });
    }
  }
  STICKERS.forEach(({ pos }, index) => {
    cubies.get(pos.join(',')).stickers.push({ index, face: FACE_LETTERS[(index / 9) | 0] });
  });
  return [...cubies.values()];
}

/**
 * How a move turns the cube on screen. Quarters is 1 for a clockwise quarter
 * turn, 2 for a half turn and -1 for a counterclockwise quarter turn. A
 * clockwise turn seen from outside the face is a right-handed rotation about
 * the inward direction. Mirroring y for CSS reverses the handedness, so the
 * CSS angle is +90 degrees per quarter turn about the outward vector with its
 * y component flipped.
 */
export function turnSpec(move) {
  const index = parseMove(move);
  const face = FACE_LETTERS[(index / 3) | 0];
  const [x, y, z] = VECTORS[face];
  return { face, quarters: [1, 2, -1][index % 3], axis: [x, -y, z] };
}

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/** SVG markup of the arrow shown on the face that is about to turn. */
export function arrowMarkup(move) {
  const { quarters } = turnSpec(move);
  const radius = 31;
  const at = (deg, r = radius) => {
    const a = (deg * Math.PI) / 180;
    return [50 + r * Math.cos(a), 50 + r * Math.sin(a)];
  };
  const arc = (from, sweep) => {
    const end = from + sweep;
    const [x0, y0] = at(from);
    const [x1, y1] = at(end);
    const a = (end * Math.PI) / 180;
    const tip = [x1 - Math.sin(a) * 13, y1 + Math.cos(a) * 13];
    const left = [x1 + Math.cos(a) * 10, y1 + Math.sin(a) * 10];
    const right = [x1 - Math.cos(a) * 10, y1 - Math.sin(a) * 10];
    const path = `M${x0.toFixed(1)} ${y0.toFixed(1)}A${radius} ${radius} 0 ${sweep > 180 ? 1 : 0} 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`;
    const head = [tip, left, right].map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
    return `<path d="${path}"/><polygon points="${head}"/>`;
  };
  const shape = quarters === 2 ? arc(-100, 120) + arc(80, 120) : arc(-150, 250);
  const mirror = quarters < 0 ? ' transform="translate(100 0) scale(-1 1)"' : '';
  return (
    '<svg viewBox="0 0 100 100" aria-hidden="true">' +
    `<g class="halo"${mirror}>${shape}</g><g class="ink"${mirror}>${shape}</g>` +
    `<text x="50" y="50">${move}</text></svg>`
  );
}

/* ---------- views ---------- */

const el = (tag, className) => {
  const node = document.createElement(tag);
  node.className = className;
  return node;
};

/** One camera onto the cube. */
export class CubeView {
  constructor(root, camera) {
    this.root = root;
    this.faces = camera.faces;
    this.facelets = SOLVED;
    this.stickers = [];
    this.cubies = new Map();

    const scene = el('div', 'scene');
    scene.style.transform = `rotateX(${camera.rx}deg) rotateY(${camera.ry}deg)`;

    for (const { pos, stickers } of cubiePlan()) {
      const cubie = el('div', 'cubie');
      const slot = el('div', 'slot');
      slot.style.setProperty('--x', pos[0]);
      slot.style.setProperty('--y', -pos[1]);
      slot.style.setProperty('--z', pos[2]);
      for (const face of FACE_LETTERS) {
        const side = el('div', `f o-${face}`);
        const sticker = stickers.find((s) => s.face === face);
        if (sticker) {
          const dot = el('i', 'tile');
          dot.dataset.i = sticker.index;
          if (sticker.index % 9 === 4) {
            dot.classList.add('center');
            dot.dataset.l = face;
          }
          side.append(dot);
          this.stickers[sticker.index] = dot;
        }
        slot.append(side);
      }
      cubie.append(slot);
      scene.append(cubie);
      this.cubies.set(pos.join(','), cubie);
    }

    this.plates = {};
    for (const face of FACE_LETTERS) {
      const plate = el('div', `plate o-${face}`);
      this.plates[face] = plate;
      scene.append(plate);
    }

    this.layers = {};
    for (const face of FACE_LETTERS) {
      this.layers[face] = layerPositions(face).map((p) => this.cubies.get(p.join(',')));
    }
    root.replaceChildren(scene);
  }

  /** Shows a facelet string with no turn in progress. */
  set(facelets) {
    this.facelets = facelets;
    this.reset();
    this.paint();
    this.preview(null);
  }

  /** Rotates the layer of a move to a fraction (0 to 1) of the full turn. */
  pose(move, fraction) {
    const { face, quarters, axis } = turnSpec(move);
    const degrees = quarters * 90 * fraction;
    const transform = fraction === 0 ? '' : `rotate3d(${axis.join(',')},${degrees}deg)`;
    for (const cubie of this.layers[face]) cubie.style.transform = transform;
  }

  /** Ends a turn: applies the move to the colors and puts the cubies back. */
  commit(move) {
    this.facelets = applyMoves(this.facelets, [move]);
    this.reset();
    this.paint();
  }

  /** Marks the face of a move with an arrow, or clears the mark when move is null. */
  preview(move) {
    for (const plate of Object.values(this.plates)) {
      plate.classList.remove('on');
      plate.replaceChildren();
    }
    for (const tile of this.stickers) tile.classList.remove('covered');
    this.root.classList.remove('active');
    if (!move) return;
    const { face } = turnSpec(move);
    const plate = this.plates[face];
    plate.innerHTML = arrowMarkup(move);
    plate.classList.add('on');
    this.stickers[FACE_LETTERS.indexOf(face) * 9 + 4].classList.add('covered');
    this.root.classList.toggle('active', this.faces.includes(face));
  }

  reset() {
    for (const cubie of this.cubies.values()) cubie.style.transform = '';
  }

  paint() {
    this.stickers.forEach((dot, index) => (dot.dataset.c = this.facelets[index]));
  }
}

/** Several views of one cube that turn together. */
export class CubeStage {
  constructor(roots) {
    this.views = roots.map((root, i) => new CubeView(root, CAMERAS[i]));
    this.finishTurn = null;
  }

  set(facelets) {
    this.settle();
    for (const view of this.views) view.set(facelets);
  }

  preview(move) {
    for (const view of this.views) view.preview(move);
  }

  /** Completes a turn that is still running, if there is one. */
  settle() {
    if (this.finishTurn) this.finishTurn();
  }

  /** Animates one move over the given milliseconds. The promise resolves when the turn is done. */
  turn(move, ms) {
    this.settle();
    this.preview(null);
    if (!(ms > 0)) {
      for (const view of this.views) view.commit(move);
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      const start = performance.now();
      let frame = 0;
      const finish = () => {
        cancelAnimationFrame(frame);
        this.finishTurn = null;
        for (const view of this.views) view.commit(move);
        resolve();
      };
      const step = (now) => {
        const t = Math.min(1, (now - start) / ms);
        for (const view of this.views) view.pose(move, ease(t));
        if (t < 1) frame = requestAnimationFrame(step);
        else finish();
      };
      this.finishTurn = finish;
      frame = requestAnimationFrame(step);
    });
  }
}
