'use strict';

// Original, deterministic falling-block rules. No platform or rendering state.
const WIDTH = 10;
const HEIGHT = 20;
const TYPES = Object.freeze(['I', 'O', 'T', 'S', 'Z', 'J', 'L']);
const BASE = {
  I: { size: 4, cells: [[0, 1], [1, 1], [2, 1], [3, 1]] },
  O: { size: 2, cells: [[0, 0], [1, 0], [0, 1], [1, 1]] },
  T: { size: 3, cells: [[1, 0], [0, 1], [1, 1], [2, 1]] },
  S: { size: 3, cells: [[1, 0], [2, 0], [0, 1], [1, 1]] },
  Z: { size: 3, cells: [[0, 0], [1, 0], [1, 1], [2, 1]] },
  J: { size: 3, cells: [[0, 0], [0, 1], [1, 1], [2, 1]] },
  L: { size: 3, cells: [[2, 0], [0, 1], [1, 1], [2, 1]] },
};
const SHAPES = Object.freeze(Object.fromEntries(TYPES.map(type => [type,
  Object.freeze(Array.from({ length: 4 }, (_, rotation) => Object.freeze(BASE[type].cells.map(([a, b]) => {
    let x = a, y = b;
    for (let i = 0; type !== 'O' && i < rotation; i += 1) [x, y] = [BASE[type].size - 1 - y, x];
    return Object.freeze([x, y]);
  })))),
])));
// Small, predictable wall/floor kicks; intentionally not the SRS rotation system.
const KICKS = Object.freeze([[0, 0], [-1, 0], [1, 0], [-2, 0], [2, 0], [0, -1], [-1, -1], [1, -1], [0, -2]]);
const LINE_POINTS = Object.freeze([0, 100, 300, 500, 800]);
const MAX_COUNT = Math.floor(Number.MAX_SAFE_INTEGER / 4);
const integer = (value, min, max) => Number.isSafeInteger(value) && value >= min && value <= max;
const addScore = (round, points) => { round.score = Math.min(Number.MAX_SAFE_INTEGER, round.score + points); };

function cells(piece) {
  if (!piece || !TYPES.includes(piece.type) || !integer(piece.rotation, 0, 3)) return [];
  return SHAPES[piece.type][piece.rotation].map(([x, y]) => [x + piece.x, y + piece.y]);
}

function fits(round, piece) {
  const blocks = cells(piece);
  return blocks.length === 4 && blocks.every(([x, y]) => x >= 0 && x < WIDTH && y >= -2 && y < HEIGHT
    && (y < 0 || round.board[y * WIDTH + x] === 0));
}

function random(round) {
  round.rngState = (round.rngState + 0x6D2B79F5) >>> 0;
  let t = round.rngState;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function refill(round) {
  while (round.queue.length < 5) {
    if (!round.bag.length) {
      round.bag = TYPES.slice();
      for (let i = round.bag.length - 1; i > 0; i -= 1) {
        const j = Math.floor(random(round) * (i + 1));
        [round.bag[i], round.bag[j]] = [round.bag[j], round.bag[i]];
      }
    }
    round.queue.push(round.bag.shift());
  }
}

function spawn(round) {
  refill(round);
  const type = round.queue.shift();
  round.active = { type, rotation: 0, x: Math.floor((WIDTH - BASE[type].size) / 2), y: -1 };
  refill(round);
  if (!fits(round, round.active)) { round.active = null; round.status = 'over'; }
}

function newRound(seed = 0) {
  const round = { board: Array(WIDTH * HEIGHT).fill(0), active: null, queue: [], bag: [],
    rngState: Number(seed) >>> 0, score: 0, lines: 0, level: 1, pieces: 0, status: 'playing' };
  spawn(round);
  return round;
}

function move(round, dx, dy) {
  if (!round || round.status !== 'playing' || !round.active
    || !integer(dx, -1, 1) || !integer(dy, 0, 1) || Math.abs(dx) + dy !== 1) return false;
  const next = { ...round.active, x: round.active.x + dx, y: round.active.y + dy };
  if (!fits(round, next)) return false;
  round.active = next;
  return true;
}

function rotate(round, direction = 1) {
  if (!round || round.status !== 'playing' || !round.active || round.active.type === 'O'
    || ![1, -1].includes(direction)) return false;
  const rotation = (round.active.rotation + direction + 4) % 4;
  for (const [dx, dy] of KICKS) {
    const next = { ...round.active, rotation, x: round.active.x + dx, y: round.active.y + dy };
    if (fits(round, next)) { round.active = next; return true; }
  }
  return false;
}

function dropDistance(round) {
  if (!round || round.status !== 'playing' || !round.active || !fits(round, round.active)) return 0;
  let distance = 0;
  while (fits(round, { ...round.active, y: round.active.y + distance + 1 })) distance += 1;
  return distance;
}

function lockPiece(round) {
  const result = { lines: 0, topOut: false, locked: false };
  if (!round || round.status !== 'playing' || !round.active || !fits(round, round.active) || dropDistance(round) > 0) return result;
  const blocks = cells(round.active);
  result.locked = true;
  if (blocks.some(([, y]) => y < 0)) {
    // Do not discard hidden cells or clear a row to rescue a topped-out piece.
    round.active = null; round.status = 'over'; result.topOut = true;
    return result;
  }
  const value = TYPES.indexOf(round.active.type) + 1;
  for (const [x, y] of blocks) round.board[y * WIDTH + x] = value;
  const remaining = [];
  for (let y = 0; y < HEIGHT; y += 1) {
    const row = round.board.slice(y * WIDTH, (y + 1) * WIDTH);
    if (row.every(Boolean)) result.lines += 1;
    else remaining.push(...row);
  }
  round.board = Array(result.lines * WIDTH).fill(0).concat(remaining);
  addScore(round, LINE_POINTS[result.lines] * round.level);
  round.lines += result.lines;
  round.pieces += 1;
  round.level = Math.min(20, 1 + Math.floor(round.lines / 10));
  spawn(round);
  result.topOut = round.status === 'over';
  return result;
}

function hardDrop(round) {
  const distance = dropDistance(round);
  if (!round || round.status !== 'playing' || !round.active || !fits(round, round.active)) return { distance: 0, lines: 0, topOut: false, locked: false };
  round.active = { ...round.active, y: round.active.y + distance };
  addScore(round, distance * 2);
  return { distance, ...lockPiece(round) };
}

function cloneRound(round) {
  return { board: round.board.slice(), active: round.active ? { ...round.active } : null,
    queue: round.queue.slice(), bag: round.bag.slice(), rngState: round.rngState,
    score: round.score, lines: round.lines, level: round.level, pieces: round.pieces, status: round.status };
}

function validateRound(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  if (!Array.isArray(raw.board) || raw.board.length !== WIDTH * HEIGHT
    || !Array.from(raw.board).every(value => integer(value, 0, TYPES.length))) return null;
  if (!integer(raw.rngState, 0, 0xffffffff) || !integer(raw.score, 0, Number.MAX_SAFE_INTEGER)
    || !integer(raw.pieces, 0, MAX_COUNT) || !integer(raw.lines, 0, MAX_COUNT)
    || !integer(raw.level, 1, 20) || raw.level !== Math.min(20, 1 + Math.floor(raw.lines / 10))) return null;
  if (!Array.isArray(raw.queue) || raw.queue.length !== 5 || !Array.from(raw.queue).every(type => TYPES.includes(type))
    || !Array.isArray(raw.bag) || raw.bag.length > 6 || !Array.from(raw.bag).every(type => TYPES.includes(type))) return null;
  const tail = raw.queue.concat(raw.bag).slice(-7);
  if (new Set(tail).size !== tail.length) return null;
  if (!['playing', 'over'].includes(raw.status)) return null;
  const occupied = raw.board.filter(Boolean).length;
  if (raw.lines > Math.floor(4 * raw.pieces / 10) || 4 * raw.pieces - 10 * raw.lines !== occupied) return null;
  for (let y = 0; y < HEIGHT; y += 1) {
    if (raw.board.slice(y * WIDTH, (y + 1) * WIDTH).every(Boolean)) return null;
  }
  if (raw.status === 'playing') {
    const active = raw.active;
    if (!active || !TYPES.includes(active.type) || !integer(active.rotation, 0, 3)
      || !integer(active.x, -3, WIDTH - 1) || !integer(active.y, -4, HEIGHT - 1) || !fits(raw, active)) return null;
  } else if (raw.active !== null) return null;
  return cloneRound(raw);
}

module.exports = { WIDTH, HEIGHT, TYPES, SHAPES, cells, newRound, move, rotate, dropDistance, lockPiece, hardDrop, cloneRound, validateRound };
