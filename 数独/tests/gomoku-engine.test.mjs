import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { SIZE, CELLS, createRound, placeStone, undo, cloneRound, validateRound } = require('../../微信小程序/src/games/gomoku/engine.js');
const { chooseMove } = require('../../微信小程序/src/games/gomoku/ai.js');
const cell = (row, col) => row * SIZE + col;

function play(moves, mode = 'local') {
  const round = createRound(mode);
  for (const index of moves) assert.equal(placeStone(round, index), true, 'legal sample move ' + index);
  return round;
}

test('Gomoku creates independent 15x15 rounds, black starts, mode and side are preserved', () => {
  const first = createRound(), second = createRound('local', 2);
  assert.equal(first.board.length, 225);
  assert.equal(first.turn, 1);
  assert.equal(first.mode, 'ai');
  assert.equal(first.humanColor, 1);
  assert.equal(second.mode, 'local');
  assert.equal(second.humanColor, 2);
  placeStone(first, 112);
  assert.equal(first.turn, 2);
  assert.equal(second.board[112], 0);
  assert.deepEqual(validateRound(first), first);
});

for (const [name, line] of [
  ['horizontal', [cell(0, 0), cell(0, 1), cell(0, 2), cell(0, 3), cell(0, 4)]],
  ['vertical', [cell(0, 14), cell(1, 14), cell(2, 14), cell(3, 14), cell(4, 14)]],
  ['diagonal', [cell(0, 0), cell(1, 1), cell(2, 2), cell(3, 3), cell(4, 4)]],
  ['anti-diagonal', [cell(0, 14), cell(1, 13), cell(2, 12), cell(3, 11), cell(4, 10)]],
]) {
  test('Gomoku detects ' + name + ' five, keeps winning cells and locks terminal play', () => {
    const moves = [];
    line.forEach((index, number) => { moves.push(index); if (number < 4) moves.push(cell(13, number * 2)); });
    const round = play(moves);
    assert.equal(round.status, 'won');
    assert.equal(round.winner, 1);
    assert.deepEqual(round.winningLine, line);
    const before = cloneRound(round);
    assert.equal(placeStone(round, 100), false);
    assert.deepEqual(round, before);
    assert.deepEqual(validateRound(round), before);
  });
}

test('Gomoku white can win and touching indices across row edges are not connected', () => {
  const white = play([120, 0, 122, 1, 124, 2, 126, 3, 128, 4]);
  assert.equal(white.winner, 2);
  const wrapped = play([12, 100, 13, 102, 14, 104, 15, 106, 16]);
  assert.equal(wrapped.status, 'playing');
  assert.deepEqual(wrapped.winningLine, []);
});

test('Gomoku gap-filling overline wins with all six cells highlighted', () => {
  const round = play([0, 150, 1, 152, 2, 154, 4, 156, 5, 158, 3]);
  assert.equal(round.winner, 1);
  assert.deepEqual(round.winningLine, [0, 1, 2, 3, 4, 5]);
});

test('Gomoku rejects invalid or occupied cells without changing state', () => {
  const round = play([112]);
  const before = cloneRound(round);
  for (const index of [112, -1, CELLS, NaN, Infinity, 0.5, '0', null, undefined]) {
    assert.equal(placeStone(round, index), false);
    assert.deepEqual(round, before);
  }
});

test('Gomoku full nonwinning board ends in draw', () => {
  const black = [], white = [];
  for (let row = 0; row < SIZE; row += 1) for (let col = 0; col < SIZE; col += 1) {
    ((row + Math.floor(col / 2)) % 2 === 0 ? black : white).push(cell(row, col));
  }
  const moves = black.flatMap((index, number) => number < white.length ? [index, white[number]] : [index]);
  const round = play(moves);
  assert.equal(round.status, 'draw');
  assert.equal(round.winner, 0);
  assert.equal(round.moves.length, 225);
  assert.equal(chooseMove(round), null);
  assert.deepEqual(validateRound(round), round);
});

test('Gomoku undo reconstructs turn and reopens a finished round; pair undo and excessive count are safe', () => {
  const round = play([0, 150, 1, 152, 2, 154, 3, 156, 4]);
  assert.equal(undo(round), true);
  assert.equal(round.status, 'playing');
  assert.equal(round.winner, 0);
  assert.equal(round.turn, 1);
  assert.deepEqual(round.winningLine, []);
  assert.equal(undo(round, 2), true);
  assert.equal(round.moves.length, 6);
  assert.deepEqual(validateRound(round), round);
  assert.equal(undo(round, 1000), true);
  assert.deepEqual(round, createRound('local'));
  assert.equal(undo(round), false);
});

test('Gomoku invalid undo counts leave a live round unchanged', () => {
  const round = play([112, 113]);
  const before = cloneRound(round);
  for (const count of [0, -1, 0.5, NaN, Infinity, '2']) assert.equal(undo(round, count), false);
  assert.deepEqual(round, before);
});

test('Gomoku clone and validated saves own their arrays', () => {
  const round = play([112, 113]), clone = cloneRound(round), restored = validateRound(round);
  clone.board[112] = 0; clone.moves.push(10); clone.winningLine.push(1);
  restored.board[113] = 0; restored.moves.push(9);
  assert.equal(round.board[112], 1);
  assert.equal(round.board[113], 2);
  assert.deepEqual(round.moves, [112, 113]);
  assert.deepEqual(round.winningLine, []);
});

test('Gomoku rejects corrupt saves, duplicates, holes, forged winner and history after winning', () => {
  const sample = play([112, 113]);
  const corruptions = [
    value => { value.mode = 'online'; }, value => { value.humanColor = 0; },
    value => { value.turn = 2; }, value => { value.winner = 1; },
    value => { value.status = 'won'; }, value => { value.winningLine = [112]; },
    value => { value.board[112] = 2; }, value => { value.board[114] = '0'; },
    value => { value.board.pop(); }, value => { delete value.board[0]; },
    value => { value.moves = [112, 112]; }, value => { value.moves = [112, -1]; },
    value => { delete value.moves[0]; }, value => { value.moves.push(0.5); },
  ];
  for (const corrupt of corruptions) { const value = cloneRound(sample); corrupt(value); assert.equal(validateRound(value), null); }
  for (const value of [null, {}, [], 0]) assert.equal(validateRound(value), null);
  const won = play([0, 150, 1, 152, 2, 154, 3, 156, 4]);
  won.moves.push(100); won.board[100] = 2;
  assert.equal(validateRound(won), null);
});

test('Gomoku AI opens centrally, is deterministic, and never mutates its input', () => {
  assert.equal(chooseMove(createRound()), 112);
  const round = play([112, 113, 97, 127], 'ai');
  const before = cloneRound(round), move = chooseMove(round);
  assert.equal(round.board[move], 0);
  assert.equal(chooseMove(round), move);
  assert.deepEqual(round, before);
  assert.equal(placeStone(round, move), true);
});

test('Gomoku AI takes immediate victory before blocking the opponent', () => {
  const round = play([0, 150, 1, 151, 2, 152, 3, 153], 'ai');
  assert.equal(chooseMove(round), 4);
});

for (const [name, threat, fillers, block] of [
  ['edge horizontal', [0, 1, 2, 3], [150, 152, 154, 156], 4],
  ['edge vertical', [14, 29, 44, 59], [150, 152, 154, 156], 74],
  ['diagonal', [0, 16, 32, 48], [150, 152, 154, 156], 64],
  ['anti-diagonal', [14, 28, 42, 56], [150, 152, 154, 156], 70],
  ['gap', [0, 1, 3, 4], [150, 152, 154, 156], 2],
]) {
  test('Gomoku AI blocks immediate ' + name + ' loss', () => {
    const round = play(threat.flatMap((index, number) => [fillers[number], index]), 'ai');
    assert.equal(chooseMove(round), block);
  });
}

test('Gomoku AI detects an own gap-winning move', () => {
  const round = play([0, 150, 1, 152, 3, 154, 4, 156], 'ai');
  assert.equal(chooseMove(round), 2);
});

test('Gomoku deterministic AI self-play remains legal and terminates within a full board', () => {
  const round = createRound();
  while (round.status === 'playing') {
    const before = cloneRound(round), index = chooseMove(round);
    assert.deepEqual(round, before);
    assert.equal(placeStone(round, index), true);
    assert.ok(round.moves.length <= CELLS);
  }
  assert.ok(['won', 'draw'].includes(round.status));
  assert.deepEqual(validateRound(round), round);
  assert.equal(chooseMove(round), null);
});
