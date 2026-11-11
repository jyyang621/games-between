'use strict';

// Freestyle Gomoku: black starts, and five or more connected stones win.
const SIZE = 15;
const CELLS = SIZE * SIZE;
const EMPTY = 0, BLACK = 1, WHITE = 2;
const DIRECTIONS = Object.freeze([[0, 1], [1, 0], [1, 1], [1, -1]].map(Object.freeze));
const DEFAULT_DIFFICULTY = 'normal';
const DIFFICULTIES = Object.freeze([
  { id: 'easy', label: '简单' }, { id: 'normal', label: '普通' }, { id: 'hard', label: '困难' },
].map(Object.freeze));
const validDifficulty = value => DIFFICULTIES.some(item => item.id === value);

function createRound(mode = 'ai', humanColor = BLACK, difficulty = DEFAULT_DIFFICULTY) {
  return {
    board: Array(CELLS).fill(EMPTY), moves: [], turn: BLACK,
    status: 'playing', winner: EMPTY, winningLine: [],
    mode: mode === 'local' ? 'local' : 'ai', humanColor: humanColor === WHITE ? WHITE : BLACK,
    difficulty: validDifficulty(difficulty) ? difficulty : DEFAULT_DIFFICULTY,
  };
}

function validIndex(index) { return Number.isInteger(index) && index >= 0 && index < CELLS; }
function inside(row, col) { return row >= 0 && row < SIZE && col >= 0 && col < SIZE; }

function winningLine(board, index, color = board[index]) {
  if (!validIndex(index) || (color !== BLACK && color !== WHITE)) return [];
  const row = Math.floor(index / SIZE), col = index % SIZE;
  for (const [dy, dx] of DIRECTIONS) {
    const before = [], after = [];
    for (let step = 1; inside(row - dy * step, col - dx * step); step += 1) {
      const next = (row - dy * step) * SIZE + col - dx * step;
      if (board[next] !== color) break;
      before.push(next);
    }
    for (let step = 1; inside(row + dy * step, col + dx * step); step += 1) {
      const next = (row + dy * step) * SIZE + col + dx * step;
      if (board[next] !== color) break;
      after.push(next);
    }
    if (before.length + after.length >= 4) return before.reverse().concat(index, after);
  }
  return [];
}

function placeStone(round, index) {
  if (!round || round.status !== 'playing' || !validIndex(index) || round.board[index] !== EMPTY) return false;
  const color = round.turn;
  round.board[index] = color;
  round.moves.push(index);
  round.turn = 3 - color;
  round.winningLine = winningLine(round.board, index, color);
  if (round.winningLine.length) {
    round.status = 'won'; round.winner = color;
  } else if (round.moves.length === CELLS) {
    round.status = 'draw';
  }
  return true;
}

function cloneRound(round) {
  return {
    board: round.board.slice(), moves: round.moves.slice(), turn: round.turn,
    status: round.status, winner: round.winner, winningLine: round.winningLine.slice(),
    mode: round.mode, humanColor: round.humanColor,
    difficulty: round.difficulty || DEFAULT_DIFFICULTY,
  };
}

function undo(round, count = 1) {
  if (!round || !Number.isInteger(count) || count <= 0 || round.moves.length === 0) return false;
  const rebuilt = createRound(round.mode, round.humanColor, round.difficulty);
  for (const index of round.moves.slice(0, Math.max(0, round.moves.length - count))) placeStone(rebuilt, index);
  Object.assign(round, rebuilt);
  return true;
}

function sameArray(actual, expected) {
  return Array.isArray(actual) && actual.length === expected.length
    && Array.from(actual).every((value, index) => value === expected[index]);
}

function validateRound(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || !['ai', 'local'].includes(value.mode) || ![BLACK, WHITE].includes(value.humanColor)
    || (value.difficulty !== undefined && !validDifficulty(value.difficulty))
    || !Array.isArray(value.moves) || value.moves.length > CELLS
    || !Array.isArray(value.board) || value.board.length !== CELLS) return null;
  const expected = createRound(value.mode, value.humanColor, value.difficulty);
  // Replaying also rejects duplicates, sparse arrays and moves after the game ended.
  for (const index of value.moves) if (!placeStone(expected, index)) return null;
  if (value.turn !== expected.turn || value.status !== expected.status || value.winner !== expected.winner
    || !sameArray(value.board, expected.board) || !sameArray(value.winningLine, expected.winningLine)) return null;
  return expected;
}

module.exports = { SIZE, CELLS, EMPTY, BLACK, WHITE, DIRECTIONS, DIFFICULTIES, DEFAULT_DIFFICULTY, createRound, placeStone, undo, cloneRound, validateRound, winningLine };
