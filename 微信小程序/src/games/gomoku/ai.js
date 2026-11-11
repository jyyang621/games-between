'use strict';

const { SIZE, CELLS, DIRECTIONS, winningLine } = require('./engine.js');

const SEARCH_LIMITS = Object.freeze({ depth: 3, widths: Object.freeze([10, 8, 6]), maxNodes: 600 });
const WIN_SCORE = 10000000;

function inside(row, col) { return row >= 0 && row < SIZE && col >= 0 && col < SIZE; }

function candidates(board) {
  const nearby = new Set();
  for (let index = 0; index < CELLS; index += 1) {
    if (!board[index]) continue;
    const row = Math.floor(index / SIZE), col = index % SIZE;
    for (let dy = -2; dy <= 2; dy += 1) {
      for (let dx = -2; dx <= 2; dx += 1) {
        if (inside(row + dy, col + dx)) {
          const next = (row + dy) * SIZE + col + dx;
          if (!board[next]) nearby.add(next);
        }
      }
    }
  }
  return Array.from(nearby).sort((a, b) => a - b);
}

function centerDistance(index) {
  return Math.abs(Math.floor(index / SIZE) - 7) + Math.abs(index % SIZE - 7);
}

// Score only bounded, local patterns. This is a recreational opponent, not a solver.
function threatScore(board, index, color) {
  const row = Math.floor(index / SIZE), col = index % SIZE;
  let score = 0, fours = 0, openThrees = 0;
  for (const [dy, dx] of DIRECTIONS) {
    let line = '';
    for (let offset = -4; offset <= 4; offset += 1) {
      const y = row + dy * offset, x = col + dx * offset;
      const value = offset === 0 ? color : inside(y, x) ? board[y * SIZE + x] : -1;
      line += value === color ? 'X' : value === 0 ? '.' : '#';
    }
    let best = 0;
    for (let start = 0; start <= 4; start += 1) {
      const segment = line.slice(start, start + 5);
      if (segment.includes('#')) continue;
      const count = segment.split('X').length - 1;
      best = Math.max(best, [0, 2, 20, 180, 7000, 1000000][count]);
    }
    if (line.includes('.XXXX.')) best = Math.max(best, 50000);
    if (best >= 7000) fours += 1;
    // Include the center in every recognized open-three pattern.
    for (const pattern of ['.XXX.', '.XX.X.', '.X.XX.']) {
      for (let start = 0; start + pattern.length <= line.length; start += 1) {
        if (start <= 4 && start + pattern.length > 4 && line.slice(start, start + pattern.length) === pattern) {
          best = Math.max(best, 1800); openThrees += 1; break;
        }
      }
    }
    score += best;
  }
  if (fours >= 2) score += 60000;
  if (fours && openThrees) score += 18000;
  if (openThrees >= 2) score += 9000;
  return score;
}

function normalChoice(board, own, pool) {
  const opponent = 3 - own;
  let selected = null, best = -Infinity;
  for (const index of pool) {
    const offense = threatScore(board, index, own), defense = threatScore(board, index, opponent);
    const score = offense + defense * 1.08 - centerDistance(index) * 0.01;
    if (score > best) { best = score; selected = index; }
  }
  return selected;
}

function easyScore(board, index, color) {
  const row = Math.floor(index / SIZE), col = index % SIZE;
  let result = 0;
  for (const [dy, dx] of DIRECTIONS) {
    let length = 1, open = 0;
    for (const sign of [-1, 1]) {
      let step = 1;
      while (inside(row + dy * sign * step, col + dx * sign * step)
        && board[(row + dy * sign * step) * SIZE + col + dx * sign * step] === color) { length += 1; step += 1; }
      if (inside(row + dy * sign * step, col + dx * sign * step)
        && board[(row + dy * sign * step) * SIZE + col + dx * sign * step] === 0) open += 1;
    }
    result += [0, 1, 12, 80, 600, 100000][Math.min(length, 5)] * (open === 2 ? 2 : open === 1 ? 1 : 0.1);
  }
  return result;
}

function easyChoice(round, available) {
  const scored = available.map(index => ({ index, score: easyScore(round.board, index, round.turn)
    + easyScore(round.board, index, 3 - round.turn) * 0.9 - centerDistance(index) * 0.01 }))
    .sort((a, b) => b.score - a.score || a.index - b.index);
  const pool = scored.slice(0, 3).filter(item => item.score >= scored[0].score * 0.72);
  // A history-derived choice is reproducible across save/restore, with no global RNG.
  let seed = 2166136261;
  for (const index of round.moves) seed = Math.imul(seed ^ (index + 1), 16777619) >>> 0;
  return pool[seed % pool.length].index;
}

function makeSearchState(source) {
  const board = source.slice(), nearby = new Uint8Array(CELLS);
  const scores = [null, new Float64Array(CELLS), new Float64Array(CELLS)];
  const neighborhoods = [], affected = [];
  for (let index = 0; index < CELLS; index += 1) {
    const row = Math.floor(index / SIZE), col = index % SIZE, near = [], changed = new Set([index]);
    for (let dy = -2; dy <= 2; dy += 1) for (let dx = -2; dx <= 2; dx += 1) {
      if (inside(row + dy, col + dx)) near.push((row + dy) * SIZE + col + dx);
    }
    for (const [dy, dx] of DIRECTIONS) for (let step = -4; step <= 4; step += 1) {
      if (inside(row + dy * step, col + dx * step)) changed.add((row + dy * step) * SIZE + col + dx * step);
    }
    neighborhoods.push(near); affected.push(Array.from(changed));
    if (board[index]) for (const neighbor of near) nearby[neighbor] += 1;
  }
  for (let index = 0; index < CELLS; index += 1) if (!board[index]) {
    scores[1][index] = threatScore(board, index, 1); scores[2][index] = threatScore(board, index, 2);
  }
  return {
    board, nearby, scores,
    play(index, color) {
      const previous = affected[index].map(cell => [cell, scores[1][cell], scores[2][cell]]);
      board[index] = color;
      for (const neighbor of neighborhoods[index]) nearby[neighbor] += 1;
      for (const cell of affected[index]) if (!board[cell]) {
        scores[1][cell] = threatScore(board, cell, 1); scores[2][cell] = threatScore(board, cell, 2);
      }
      return previous;
    },
    undo(index, previous) {
      board[index] = 0;
      for (const neighbor of neighborhoods[index]) nearby[neighbor] -= 1;
      for (const [cell, black, white] of previous) { scores[1][cell] = black; scores[2][cell] = white; }
    },
  };
}

function analyze(state, own, width) {
  const opponent = 3 - own, ranked = [], wins = [], blocks = [];
  let ownBest = 0, ownSecond = 0, enemyBest = 0, enemySecond = 0;
  for (let index = 0; index < CELLS; index += 1) {
    if (state.board[index] || !state.nearby[index]) continue;
    const attack = state.scores[own][index], defense = state.scores[opponent][index];
    if (attack >= 1000000) wins.push(index);
    if (defense >= 1000000) blocks.push(index);
    if (attack > ownBest) { ownSecond = ownBest; ownBest = attack; } else ownSecond = Math.max(ownSecond, attack);
    if (defense > enemyBest) { enemySecond = enemyBest; enemyBest = defense; } else enemySecond = Math.max(enemySecond, defense);
    const score = attack + defense * 1.08 - centerDistance(index) * 0.01;
    let at = 0;
    while (at < ranked.length && ranked[at].score >= score) at += 1;
    if (at < width) {
      ranked.splice(at, 0, { index, score });
      if (ranked.length > width) ranked.pop();
    }
  }
  return { wins, blocks, moves: blocks.length ? blocks : ranked.map(item => item.index),
    value: ownBest * 1.05 + ownSecond * 0.15 - enemyBest - enemySecond * 0.15 };
}

function hardChoice(round, fallback) {
  const state = makeSearchState(round.board);
  let nodes = 0;
  function search(color, depth, ply, alpha, beta) {
    nodes += 1;
    const result = analyze(state, color, SEARCH_LIMITS.widths[Math.min(ply, 2)]);
    if (result.wins.length) return WIN_SCORE - ply;
    // With no immediate win of our own, two different enemy winning points cannot both be blocked.
    if (result.blocks.length > 1) return -WIN_SCORE + ply + 1;
    if (!result.moves.length) return 0;
    if (depth === 0 || nodes >= SEARCH_LIMITS.maxNodes) return result.value;
    let best = -Infinity;
    for (const index of result.moves) {
      const previous = state.play(index, color);
      const value = -search(3 - color, depth - 1, ply + 1, -beta, -alpha);
      state.undo(index, previous);
      best = Math.max(best, value); alpha = Math.max(alpha, value);
      if (alpha >= beta || nodes >= SEARCH_LIMITS.maxNodes) break;
    }
    return best;
  }
  const root = analyze(state, round.turn, SEARCH_LIMITS.widths[0]);
  let selected = fallback, best = -Infinity, alpha = -Infinity;
  for (const index of root.moves) {
    const previous = state.play(index, round.turn);
    const value = -search(3 - round.turn, SEARCH_LIMITS.depth - 1, 1, -Infinity, -alpha);
    state.undo(index, previous);
    if (value > best) { best = value; selected = index; }
    alpha = Math.max(alpha, value);
    if (nodes >= SEARCH_LIMITS.maxNodes) break;
  }
  return selected;
}

function chooseMove(round) {
  if (!round || round.status !== 'playing') return null;
  const board = round.board, own = round.turn, opponent = 3 - own;
  const available = candidates(board);
  if (!available.length) return board.every(value => value === 0) ? Math.floor(CELLS / 2) : null;
  // Every level takes an immediate win before blocking an immediate loss.
  const ownWins = available.filter(index => winningLine(board, index, own).length > 0);
  const enemyWins = available.filter(index => winningLine(board, index, opponent).length > 0);
  const pool = ownWins.length ? ownWins : enemyWins.length ? enemyWins : available;
  const normal = normalChoice(board, own, pool);
  if (ownWins.length || enemyWins.length) return normal;
  if (round.difficulty === 'easy') return easyChoice(round, available);
  if (round.difficulty === 'hard') return hardChoice(round, normal);
  return normal;
}

module.exports = { chooseMove, SEARCH_LIMITS };
