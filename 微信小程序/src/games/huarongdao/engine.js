'use strict';

const { LEVELS } = require('./levels.js');
const WIDTH = 4;
const HEIGHT = 5;
const MAX_MOVES = 10000;
const pieceFields = ['id', 'label', 'w', 'h', 'x', 'y'];

function newRound(levelId = 'classic') {
  const level = LEVELS.find(item => item.id === levelId) || LEVELS.find(item => item.id === 'classic');
  return { levelId: level.id, pieces: level.pieces.map(piece => ({ ...piece })), moves: [], status: 'playing' };
}

function isSolved(round) {
  const cao = round && Array.isArray(round.pieces) && round.pieces.find(piece => piece && piece.id === 'cao');
  return Boolean(cao && cao.x === 1 && cao.y === 3 && cao.w === 2 && cao.h === 2);
}

function fits(pieces, piece, dx, dy) {
  const x = piece.x + dx, y = piece.y + dy;
  if (x < 0 || y < 0 || x + piece.w > WIDTH || y + piece.h > HEIGHT) return false;
  return pieces.every(other => other === piece || x + piece.w <= other.x || other.x + other.w <= x
    || y + piece.h <= other.y || other.y + other.h <= y);
}

function canMove(round, id, dx, dy) {
  if (!round || round.status !== 'playing' || !Array.isArray(round.pieces) || !Array.isArray(round.moves)
    || round.moves.length >= MAX_MOVES || !Number.isInteger(dx) || !Number.isInteger(dy)
    || Math.abs(dx) + Math.abs(dy) !== 1) return false;
  const piece = round.pieces.find(item => item.id === id);
  return Boolean(piece && fits(round.pieces, piece, dx, dy));
}

function move(round, id, dx, dy) {
  if (!canMove(round, id, dx, dy)) return false;
  const piece = round.pieces.find(item => item.id === id);
  piece.x += dx; piece.y += dy;
  round.moves.push({ id, dx, dy });
  round.status = isSolved(round) ? 'won' : 'playing';
  return true;
}

function undo(round) {
  if (!round || !Array.isArray(round.moves) || !round.moves.length) return false;
  const previous = round.moves[round.moves.length - 1];
  const piece = round.pieces.find(item => item.id === previous.id);
  if (!piece || !fits(round.pieces, piece, -previous.dx, -previous.dy)) return false;
  piece.x -= previous.dx; piece.y -= previous.dy;
  round.moves.pop();
  round.status = isSolved(round) ? 'won' : 'playing';
  return true;
}

function cloneRound(round) {
  return { levelId: round.levelId, pieces: round.pieces.map(piece => ({ ...piece })),
    moves: round.moves.map(step => ({ id: step.id, dx: step.dx, dy: step.dy })), status: round.status };
}

function validateRound(raw) {
  if (!raw || typeof raw !== 'object' || !LEVELS.some(level => level.id === raw.levelId)
    || !Array.isArray(raw.pieces) || raw.pieces.length !== 10
    || !Array.isArray(raw.moves) || raw.moves.length > MAX_MOVES
    || !['playing', 'won'].includes(raw.status)) return null;
  const replay = newRound(raw.levelId);
  for (const step of raw.moves) {
    if (!step || typeof step !== 'object' || !move(replay, step.id, step.dx, step.dy)) return null;
  }
  if (replay.status !== raw.status) return null;
  for (let i = 0; i < replay.pieces.length; i += 1) {
    const piece = raw.pieces[i];
    if (!piece || typeof piece !== 'object' || pieceFields.some(field => piece[field] !== replay.pieces[i][field])) return null;
  }
  return replay;
}

module.exports = { WIDTH, HEIGHT, MAX_MOVES, LEVELS, newRound, isSolved, canMove, move, undo, cloneRound, validateRound };
