'use strict';

// Pure rules: seed and firstIndex completely determine the delayed mine layout.
const VERSION = 2;
const OPENING_ATTEMPTS = 64;
const UINT32_MAX = 0xffffffff;
const DEFAULT_SEED = 0x6d696e65;
const DIFFICULTIES = Object.freeze([
  Object.freeze({ id: 'beginner', label: '初级', rows: 9, cols: 9, mines: 10 }),
  Object.freeze({ id: 'intermediate', label: '中级', rows: 12, cols: 9, mines: 20 }),
  Object.freeze({ id: 'expert', label: '高级', rows: 16, cols: 12, mines: 40 }),
]);

function difficultyById(id) {
  return DIFFICULTIES.find(item => item.id === id) || null;
}

function createRound(difficulty = 'beginner', seed = DEFAULT_SEED) {
  const settings = difficultyById(difficulty) || DIFFICULTIES[0];
  const size = settings.rows * settings.cols;
  return {
    version: VERSION,
    difficulty: settings.id,
    rows: settings.rows,
    cols: settings.cols,
    mineCount: settings.mines,
    seed: typeof seed === 'number' && Number.isFinite(seed) ? Math.trunc(seed) >>> 0 : DEFAULT_SEED,
    mines: Array(size).fill(false),
    revealed: Array(size).fill(false),
    flags: Array(size).fill(false),
    started: false,
    status: 'ready',
    elapsedMs: 0,
    exploded: -1,
    firstIndex: -1,
  };
}

function cloneRound(round) {
  return {
    version: round.version,
    difficulty: round.difficulty,
    rows: round.rows,
    cols: round.cols,
    mineCount: round.mineCount,
    seed: round.seed,
    mines: round.mines.slice(),
    revealed: round.revealed.slice(),
    flags: round.flags.slice(),
    started: round.started,
    status: round.status,
    elapsedMs: round.elapsedMs,
    exploded: round.exploded,
    firstIndex: round.firstIndex,
  };
}

function validIndex(round, index) {
  return Number.isInteger(index) && index >= 0 && index < round.rows * round.cols;
}

function neighbors(round, index) {
  if (!validIndex(round, index)) return [];
  const row = Math.floor(index / round.cols), col = index % round.cols;
  const result = [];
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      if (dx === 0 && dy === 0) continue;
      const y = row + dy, x = col + dx;
      if (y >= 0 && y < round.rows && x >= 0 && x < round.cols) result.push(y * round.cols + x);
    }
  }
  return result;
}

function adjacentMines(round, index) {
  return neighbors(round, index).reduce((count, neighbor) => count + (round.mines[neighbor] ? 1 : 0), 0);
}

function generateMines(round, firstIndex) {
  const excluded = new Set([firstIndex, ...neighbors(round, firstIndex)]);
  const available = [];
  for (let index = 0; index < round.rows * round.cols; index += 1) {
    if (!excluded.has(index)) available.push(index);
  }
  let state = round.seed;
  function random() {
    // Mulberry32 accepts every uint32 seed, including zero.
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  }
  // Version 1 remains reproducible for existing saved boards. New boards use
  // bounded rejection sampling of whole random layouts, never partial floods.
  // This deliberately favors smaller openings; it is not uniform over all
  // legal layouts, a guaranteed size limit, or a no-guess solver.
  const attempts = round.version === 1 ? 1 : OPENING_ATTEMPTS;
  const openingLimit = Math.max(9, Math.floor((round.rows * round.cols - round.mineCount) * 0.30));
  let best = null, smallest = Infinity;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const pool = available.slice();
    const mines = Array(round.rows * round.cols).fill(false);
    // Partial Fisher-Yates samples distinct allowed cells without retry loops.
    for (let cursor = 0; cursor < round.mineCount; cursor += 1) {
      const selected = cursor + Math.floor(random() * (pool.length - cursor));
      [pool[cursor], pool[selected]] = [pool[selected], pool[cursor]];
      mines[pool[cursor]] = true;
    }
    if (round.version === 1) return mines;
    const probe = { ...round, mines, revealed: mines.map(() => false), flags: mines.map(() => false) };
    revealSafeArea(probe, firstIndex);
    const count = probe.revealed.filter(Boolean).length;
    if (count <= openingLimit) return mines;
    if (count < smallest) { smallest = count; best = mines; }
  }
  // Rare fallback is still a complete legal board with its full opening.
  return best;
}

function finishIfWon(round) {
  if (round.status === 'playing' && round.revealed.every((shown, index) => shown || round.mines[index])) {
    round.status = 'won';
  }
}

function revealSafeArea(round, firstIndex) {
  const queue = [firstIndex];
  const visited = new Set();
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const index = queue[cursor];
    if (visited.has(index) || round.revealed[index] || round.flags[index] || round.mines[index]) continue;
    visited.add(index);
    round.revealed[index] = true;
    if (adjacentMines(round, index) === 0) {
      for (const neighbor of neighbors(round, index)) {
        if (!visited.has(neighbor)) queue.push(neighbor);
      }
    }
  }
}

function active(round) {
  return round && (round.status === 'ready' || round.status === 'playing');
}

function reveal(round, index) {
  if (!active(round) || !validIndex(round, index) || round.revealed[index] || round.flags[index]) return false;
  if (!round.started) {
    round.mines = generateMines(round, index);
    round.started = true;
    round.firstIndex = index;
    round.status = 'playing';
  }
  if (round.mines[index]) {
    round.revealed[index] = true;
    round.exploded = index;
    round.status = 'lost';
  } else {
    revealSafeArea(round, index);
    finishIfWon(round);
  }
  return true;
}

function toggleFlag(round, index) {
  if (!active(round) || !validIndex(round, index) || round.revealed[index]) return false;
  // Flags are guesses and may exceed the mine count; they never imply a win.
  round.flags[index] = !round.flags[index];
  return true;
}

function chord(round, index) {
  if (!round || round.status !== 'playing' || !validIndex(round, index)
    || !round.revealed[index] || round.mines[index]) return false;
  const adjacent = neighbors(round, index);
  const clue = adjacentMines(round, index);
  if (adjacent.filter(neighbor => round.flags[neighbor]).length !== clue) return false;
  const targets = adjacent.filter(neighbor => !round.revealed[neighbor] && !round.flags[neighbor]);
  if (targets.length === 0) return false;
  const exploded = targets.find(neighbor => round.mines[neighbor]);
  for (const target of targets) {
    if (!round.mines[target]) revealSafeArea(round, target);
  }
  if (exploded !== undefined) {
    round.revealed[exploded] = true;
    round.exploded = exploded;
    round.status = 'lost';
  } else {
    finishIfWon(round);
  }
  return true;
}

function booleanArray(value, length) {
  return Array.isArray(value) && value.length === length
    && Array.from(value).every(item => typeof item === 'boolean');
}

function validateRound(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || ![1, VERSION].includes(value.version)) return null;
  const difficulty = difficultyById(value.difficulty);
  if (!difficulty || value.rows !== difficulty.rows || value.cols !== difficulty.cols
    || value.mineCount !== difficulty.mines
    || !Number.isInteger(value.seed) || value.seed < 0 || value.seed > UINT32_MAX
    || typeof value.started !== 'boolean'
    || !['ready', 'playing', 'won', 'lost'].includes(value.status)
    || typeof value.elapsedMs !== 'number' || !Number.isFinite(value.elapsedMs)
    || value.elapsedMs < 0 || value.elapsedMs > Number.MAX_SAFE_INTEGER) return null;
  const size = value.rows * value.cols;
  if (!booleanArray(value.mines, size) || !booleanArray(value.revealed, size) || !booleanArray(value.flags, size)
    || !Number.isInteger(value.firstIndex) || !Number.isInteger(value.exploded)
    || value.revealed.some((shown, index) => shown && value.flags[index])) return null;
  if (!value.started) {
    if (value.status !== 'ready' || value.firstIndex !== -1 || value.exploded !== -1
      || value.elapsedMs !== 0 || value.mines.some(Boolean) || value.revealed.some(Boolean)) return null;
    return cloneRound(value);
  }
  if (value.status === 'ready' || !validIndex(value, value.firstIndex) || !value.revealed[value.firstIndex]) return null;
  const expectedMines = generateMines(value, value.firstIndex);
  if (!value.mines.every((mine, index) => mine === expectedMines[index])) return null;
  const shownMines = value.revealed.flatMap((shown, index) => shown && value.mines[index] ? [index] : []);
  const completed = value.revealed.every((shown, index) => shown || value.mines[index]);
  if (value.status === 'lost') {
    if (!validIndex(value, value.exploded) || !value.mines[value.exploded]
      || shownMines.length !== 1 || shownMines[0] !== value.exploded || completed) return null;
  } else if (value.exploded !== -1 || shownMines.length !== 0 || (value.status === 'won') !== completed) {
    return null;
  }
  return cloneRound(value);
}

module.exports = { VERSION, DIFFICULTIES, createRound, reveal, toggleFlag, chord, cloneRound, validateRound, neighbors, adjacentMines };
