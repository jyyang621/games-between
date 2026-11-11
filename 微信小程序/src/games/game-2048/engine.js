'use strict';

// Pure 2048 rules. All randomness belongs to the round so saves resume exactly.
const SIZE = 4;
const CELL_COUNT = SIZE * SIZE;
const UINT32_MAX = 0xffffffff;
const DEFAULT_SEED = 0x20482048;
const DIRECTIONS = ['left', 'right', 'up', 'down'];

function validTile(value) {
  return value === 0 || (Number.isSafeInteger(value) && value >= 2
    && 2 ** Math.round(Math.log2(value)) === value);
}

function validBoard(board) {
  return Array.isArray(board) && board.length === CELL_COUNT
    && Array.from(board).every(validTile);
}

function maxTile(board) {
  return validBoard(board) ? Math.max(...board) : 0;
}

function cloneRound(round) {
  return {
    board: round.board.slice(),
    score: round.score,
    moves: round.moves,
    rngState: round.rngState,
    won: round.won,
    keepPlaying: round.keepPlaying,
  };
}

function validateRound(snapshot) {
  if (!snapshot || typeof snapshot !== 'object' || !validBoard(snapshot.board)
    || snapshot.board.filter(value => value !== 0).length < 2
    || !Number.isSafeInteger(snapshot.score) || snapshot.score < 0
    || !Number.isSafeInteger(snapshot.moves) || snapshot.moves < 0
    || !Number.isInteger(snapshot.rngState) || snapshot.rngState < 0 || snapshot.rngState > UINT32_MAX
    || typeof snapshot.won !== 'boolean' || typeof snapshot.keepPlaying !== 'boolean') return null;
  const round = cloneRound(snapshot);
  round.won = round.won || maxTile(round.board) >= 2048;
  return round;
}

function random(round) {
  // Mulberry32, including state 0: no absorbing seed and one uint32 save field.
  round.rngState = (round.rngState + 0x6d2b79f5) >>> 0;
  let value = round.rngState;
  value = Math.imul(value ^ (value >>> 15), value | 1);
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
  return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
}

function spawn(round) {
  const empty = [];
  round.board.forEach((value, index) => { if (value === 0) empty.push(index); });
  if (empty.length === 0) return null;
  const index = empty[Math.floor(random(round) * empty.length)];
  const value = random(round) < 0.9 ? 2 : 4;
  round.board[index] = value;
  return { index, value };
}

function newGame(seed = DEFAULT_SEED) {
  const rngState = typeof seed === 'number' && Number.isFinite(seed) ? Math.trunc(seed) >>> 0 : DEFAULT_SEED;
  const round = { board: Array(CELL_COUNT).fill(0), score: 0, moves: 0, rngState, won: false, keepPlaying: false };
  spawn(round);
  spawn(round);
  return round;
}

function canMove(board) {
  if (!validBoard(board) || !board.some(value => value !== 0)) return false;
  for (let index = 0; index < CELL_COUNT; index += 1) {
    if (board[index] === 0) return true;
    if (index % SIZE < SIZE - 1 && board[index] === board[index + 1]) return true;
    if (index < CELL_COUNT - SIZE && board[index] === board[index + SIZE]) return true;
  }
  return false;
}

function lineIndices(direction, line) {
  return Array.from({ length: SIZE }, (_, offset) => {
    if (direction === 'left') return line * SIZE + offset;
    if (direction === 'right') return line * SIZE + SIZE - 1 - offset;
    if (direction === 'up') return offset * SIZE + line;
    return (SIZE - 1 - offset) * SIZE + line;
  });
}

function unchanged(round) {
  return { changed: false, round, transitions: [], spawned: null, mergedIndices: [] };
}

function applyMove(input, direction) {
  const round = validateRound(input);
  if (!round || !DIRECTIONS.includes(direction) || (round.won && !round.keepPlaying) || !canMove(round.board)) {
    return unchanged(round);
  }
  const board = Array(CELL_COUNT).fill(0);
  const transitions = [];
  const mergedIndices = [];
  let gained = 0;
  for (let line = 0; line < SIZE; line += 1) {
    const indices = lineIndices(direction, line);
    const occupied = indices.filter(index => round.board[index] !== 0);
    let destination = 0;
    for (let cursor = 0; cursor < occupied.length; cursor += 1) {
      const from = occupied[cursor];
      const value = round.board[from];
      const to = indices[destination++];
      const next = occupied[cursor + 1];
      const merged = next !== undefined && round.board[next] === value;
      board[to] = merged ? value * 2 : value;
      transitions.push({ from, to, value, merged });
      if (merged) {
        transitions.push({ from: next, to, value, merged: true });
        mergedIndices.push(to);
        gained += board[to];
        cursor += 1;
      }
    }
  }
  if (board.every((value, index) => value === round.board[index])) return unchanged(round);
  // An astronomically long round must never create a snapshot outside safe integers.
  if (!board.every(validTile) || !Number.isSafeInteger(round.score + gained) || !Number.isSafeInteger(round.moves + 1)) {
    return unchanged(round);
  }
  round.board = board;
  round.score += gained;
  round.moves += 1;
  round.won = round.won || maxTile(board) >= 2048;
  const spawned = spawn(round);
  return { changed: true, round, transitions, spawned, mergedIndices };
}

module.exports = { newGame, applyMove, canMove, maxTile, cloneRound, validateRound };
