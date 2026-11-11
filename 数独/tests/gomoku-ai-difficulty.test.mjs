import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createRound, placeStone, cloneRound, winningLine } = require('../../微信小程序/src/games/gomoku/engine.js');
const { chooseMove } = require('../../微信小程序/src/games/gomoku/ai.js');
const LEVELS = ['easy', 'normal', 'hard'];

function position(moves, difficulty = 'normal') {
  const round = createRound('ai', 1, difficulty);
  round.difficulty = difficulty;
  for (const index of moves) assert.equal(placeStone(round, index), true, 'legal fixture move ' + index);
  return round;
}

function wins(round, color) {
  return round.board.flatMap((value, index) => !value && winningLine(round.board, index, color).length ? [index] : []);
}

for (const difficulty of LEVELS) {
  for (const [label, moves] of [
    ['black takes a win', [0, 150, 1, 152, 2, 154, 3, 156]],
    ['white takes a win', [150, 0, 152, 1, 154, 2, 156, 3, 158]],
    ['black blocks white', [150, 0, 152, 1, 154, 2, 156, 3]],
    ['white blocks black', [0, 150, 1, 152, 2, 154, 3]],
  ]) test(`Gomoku ${difficulty}: ${label} before any deeper evaluation`, () => {
    assert.equal(chooseMove(position(moves, difficulty)), 4);
  });

  test(`Gomoku ${difficulty}: own immediate victory takes priority over defense`, () => {
    assert.equal(chooseMove(position([0, 150, 1, 151, 2, 152, 3, 153], difficulty)), 4);
    assert.equal(chooseMove(position([0, 150, 1, 151, 2, 152, 3, 153, 20], difficulty)), 154);
  });

  test(`Gomoku ${difficulty}: decisions are legal, reproducible and preserve their input`, () => {
    for (const moves of [[], [112], [112, 97], [112, 113, 97, 127], [128, 142, 101, 157, 113, 172, 100, 158, 143, 174]]) {
      const round = position(moves, difficulty), before = structuredClone(round);
      const first = chooseMove(round), second = chooseMove(structuredClone(round));
      assert.equal(first, second);
      assert.ok(Number.isInteger(first) && first >= 0 && first < 225);
      assert.equal(round.board[first], 0);
      assert.deepEqual(round, before);
    }
    const won = position([0, 150, 1, 152, 2, 154, 3, 156, 4], difficulty);
    assert.equal(chooseMove(won), null);
  });
}

test('Gomoku normal preserves the original heuristic and is the default for old rounds', () => {
  for (const [moves, expected] of [
    [[112], 97], [[112, 97], 111], [[112, 113], 97], [[112, 113, 97, 127], 99],
    [[128, 142, 101, 157, 113, 172, 100, 158, 143, 174], 127],
  ]) {
    const round = position(moves);
    assert.equal(chooseMove(round), expected);
    delete round.difficulty;
    assert.equal(chooseMove(round), expected);
  }
});

test('Gomoku easy has a distinct shallow, history-seeded choice while keeping tactical safety', () => {
  const round = position([112, 97], 'easy');
  assert.equal(chooseMove(round), 96);
  assert.equal(chooseMove({ ...round, difficulty: 'normal' }), 111);
  // Reconstructing exactly the same game history reproduces its relaxed choice.
  assert.equal(chooseMove(position(round.moves, 'easy')), 96);
});

test('Gomoku hard finds a forced attack that normal misses, verified against every legal defense', () => {
  const round = position([128, 142, 101, 157, 113, 172, 100, 158, 143, 174], 'hard');
  const before = cloneRound(round);
  assert.equal(chooseMove(round), 98);
  assert.deepEqual(round, before);
  assert.equal(chooseMove({ ...round, difficulty: 'normal' }), 127);

  const normal = cloneRound(round);
  assert.equal(placeStone(normal, 127), true);
  assert.equal(placeStone(normal, 126), true);
  assert.deepEqual(wins(normal, 1), []);
  assert.deepEqual(wins(normal, 2), [110, 190]); // Black cannot block both and has no winning reply.

  assert.equal(placeStone(round, 98), true);
  assert.deepEqual(wins(round, 1), [83]);
  assert.deepEqual(wins(round, 2), []);
  for (let defense = 0; defense < 225; defense += 1) {
    if (round.board[defense] || defense === 83) continue;
    const reply = cloneRound(round);
    assert.equal(placeStone(reply, defense), true);
    assert.equal(reply.status, 'playing'); // White cannot win instead of blocking.
    assert.ok(wins(reply, 1).includes(83));
  }
  assert.equal(placeStone(round, 83), true);
  assert.equal(chooseMove(round), 99);
  assert.equal(placeStone(round, 99), true);
  assert.deepEqual(wins(round, 1), [97, 102]);
  assert.deepEqual(wins(round, 2), []);
  for (let defense = 0; defense < 225; defense += 1) {
    if (round.board[defense]) continue;
    const reply = cloneRound(round);
    assert.equal(placeStone(reply, defense), true);
    assert.equal(reply.status, 'playing');
    assert.ok(wins(reply, 1).length > 0); // Every defense still leaves Black a winning move.
  }
});
