import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { WIDTH, HEIGHT, LEVELS, MAX_MOVES, newRound, isSolved, canMove, move, undo, cloneRound, validateRound } = require('../../微信小程序/src/games/huarongdao/engine.js');
const solutions = JSON.parse(fs.readFileSync(new URL('./fixtures/huarongdao-solutions.json', import.meta.url)));

function assertBoard(round) {
  const board = Array(WIDTH * HEIGHT).fill(null);
  for (const piece of round.pieces) {
    assert.ok(Number.isInteger(piece.x) && Number.isInteger(piece.y));
    assert.ok(piece.x >= 0 && piece.x + piece.w <= WIDTH && piece.y >= 0 && piece.y + piece.h <= HEIGHT);
    for (let y = piece.y; y < piece.y + piece.h; y += 1) for (let x = piece.x; x < piece.x + piece.w; x += 1) {
      assert.equal(board[y * WIDTH + x], null, `Overlapping piece ${piece.id}`);
      board[y * WIDTH + x] = piece.id;
    }
  }
  assert.equal(board.filter(value => value === null).length, 2);
  return board;
}

test('huarongdao exposes three immutable fixed 4x5 levels with ten correctly sized blocks', () => {
  assert.equal(WIDTH, 4); assert.equal(HEIGHT, 5); assert.equal(MAX_MOVES, 10000);
  assert.deepEqual(LEVELS.map(level => level.id), ['beginner', 'intermediate', 'classic']);
  for (const level of LEVELS) {
    const round = newRound(level.id);
    assertBoard(round);
    assert.equal(round.pieces.length, 10);
    assert.equal(round.pieces.filter(piece => piece.w === 2 && piece.h === 2).length, 1);
    assert.equal(round.pieces.filter(piece => piece.w === 2 && piece.h === 1).length, 1);
    assert.equal(round.pieces.filter(piece => piece.w === 1 && piece.h === 2).length, 4);
    assert.equal(round.pieces.filter(piece => piece.w === 1 && piece.h === 1).length, 4);
    assert.equal(isSolved(round), false);
    assert.ok(Object.isFrozen(level) && Object.isFrozen(level.pieces) && level.pieces.every(Object.isFrozen));
  }
});

test('classic opening matches the verified 横刀立马 geometry and central bottom exit', () => {
  assert.deepEqual(assertBoard(newRound()), [
    'zhang','cao','cao','zhao', 'zhang','cao','cao','zhao',
    'ma','guan','guan','huang', 'ma','soldier-1','soldier-2','huang',
    'soldier-3',null,null,'soldier-4',
  ]);
  assert.equal(newRound().levelId, 'classic');
  assert.equal(newRound('missing').levelId, 'classic');
});

test('new rounds never share mutable pieces or histories with the level data or another round', () => {
  const a = newRound(), b = newRound();
  a.pieces[0].x = 0; a.moves.push({ id: 'cao', dx: -1, dy: 0 });
  assert.equal(b.pieces[0].x, 1); assert.equal(b.moves.length, 0);
  assert.equal(LEVELS[2].pieces[0].x, 1);
});

test('canMove is a pure query and allows only unobstructed orthogonal unit slides', () => {
  const round = newRound(), original = cloneRound(round);
  assert.equal(canMove(round, 'soldier-1', 0, 1), true);
  assert.equal(canMove(round, 'soldier-3', 1, 0), true);
  assert.equal(canMove(round, 'cao', 0, 1), false);
  assert.equal(canMove(round, 'zhang', -1, 0), false);
  assert.equal(canMove(round, 'soldier-4', 0, 1), false);
  assert.equal(canMove(round, 'missing', 1, 0), false);
  assert.deepEqual(round, original);
  for (const [dx, dy] of [[0, 0], [1, 1], [0, 2], [-2, 0], [0.5, 0], [NaN, 1], ['0', 1], [Infinity, 0]]) {
    assert.equal(canMove(round, 'soldier-1', dx, dy), false);
    assert.equal(move(round, 'soldier-1', dx, dy), false);
  }
  assert.deepEqual(round, original);
});

test('successful moves append exact one-cell history while blocked moves change nothing', () => {
  const round = newRound();
  assert.equal(move(round, 'soldier-1', 0, 1), true);
  assert.deepEqual(round.moves, [{ id: 'soldier-1', dx: 0, dy: 1 }]);
  assert.equal(round.pieces.find(piece => piece.id === 'soldier-1').y, 4);
  const before = cloneRound(round);
  assert.equal(move(round, 'soldier-1', 0, 1), false);
  assert.deepEqual(round, before);
  assertBoard(round);
});

test('vertical and horizontal pieces may slide across their short axis when space permits', () => {
  const round = newRound('intermediate');
  assert.equal(move(round, 'zhang', 0, -1), true);
  assert.equal(move(round, 'zhao', 0, -1), true);
  const path = solutions.intermediate;
  const replay = newRound('intermediate');
  let sawVerticalAcross = false, sawHorizontalAcross = false;
  for (const step of path) {
    const piece = replay.pieces.find(item => item.id === step.id);
    if (piece.w === 1 && piece.h === 2 && step.dx !== 0) sawVerticalAcross = true;
    if (piece.w === 2 && piece.h === 1 && step.dy !== 0) sawHorizontalAcross = true;
    assert.equal(move(replay, step.id, step.dx, step.dy), true);
  }
  assert.equal(sawVerticalAcross, true); assert.equal(sawHorizontalAcross, true);
});

test('one-step undo reverses coordinates and history without mutating the initial level', () => {
  const round = newRound(), original = cloneRound(round);
  assert.equal(undo(round), false);
  move(round, 'soldier-1', 0, 1); move(round, 'soldier-2', 0, 1);
  assert.equal(undo(round), true); assert.equal(round.moves.length, 1);
  assert.equal(undo(round), true); assert.deepEqual(round, original);
  assert.equal(undo(round), false);
});

test('the exact bottom-center target is a win; reaching another bottom position is not', () => {
  const round = newRound(), cao = round.pieces[0];
  cao.y = 3;
  for (const x of [0, 2]) { cao.x = x; assert.equal(isSolved(round), false); }
  cao.x = 1; assert.equal(isSolved(round), true);
  cao.y = 2; assert.equal(isSolved(round), false);
  assert.equal(isSolved(null), false);
});

for (const levelId of ['beginner', 'intermediate', 'classic']) {
  test(`independent BFS fixture solves ${levelId}, each intermediate snapshot restores, and all steps undo`, () => {
    const round = newRound(levelId), initial = cloneRound(round), steps = solutions[levelId];
    assert.equal(steps.length, { beginner: 12, intermediate: 40, classic: 116 }[levelId]);
    for (let i = 0; i < steps.length; i += 1) {
      const { id, dx, dy } = steps[i];
      assert.equal(canMove(round, id, dx, dy), true, `step ${i + 1}`);
      assert.equal(move(round, id, dx, dy), true);
      assertBoard(round);
      assert.deepEqual(validateRound(round), round);
      assert.equal(round.status, i === steps.length - 1 ? 'won' : 'playing');
    }
    const won = cloneRound(round), final = steps.at(-1);
    assert.equal(isSolved(round), true);
    assert.equal(move(round, final.id, -final.dx, -final.dy), false);
    assert.deepEqual(round, won);
    assert.equal(undo(round), true); assert.equal(round.status, 'playing');
    while (round.moves.length) assert.equal(undo(round), true);
    assert.deepEqual(round, initial);
  });
}

test('practice level positions are exact prefixes of the independently computed classic solution', () => {
  for (const [levelId, prefix] of [['beginner', 104], ['intermediate', 76]]) {
    const round = newRound('classic');
    for (const { id, dx, dy } of solutions.classic.slice(0, prefix)) assert.equal(move(round, id, dx, dy), true);
    assert.deepEqual(round.pieces, newRound(levelId).pieces);
  }
});

test('restored and cloned state have independent piece and history records', () => {
  const round = newRound(); move(round, 'soldier-1', 0, 1);
  const clone = cloneRound(round), restored = validateRound(round);
  for (const other of [clone, restored]) {
    assert.deepEqual(other, round);
    assert.notEqual(other.pieces, round.pieces); assert.notEqual(other.pieces[0], round.pieces[0]);
    assert.notEqual(other.moves, round.moves); assert.notEqual(other.moves[0], round.moves[0]);
  }
  restored.pieces[0].label = 'changed'; restored.moves[0].id = 'cao';
  assert.deepEqual(round, clone);
});

test('snapshot validation rejects forged positions, dimensions, labels, history and status', () => {
  const changes = [
    r => { r.levelId = 'missing'; }, r => { r.pieces[0].x = 0; }, r => { r.pieces[0].w = 1; },
    r => { r.pieces[0].label = 'fake'; }, r => { r.pieces[0].id = 'soldier-1'; }, r => { r.pieces.pop(); },
    r => { r.pieces.reverse(); }, r => { delete r.pieces[0]; }, r => { r.status = 'won'; },
    r => { r.status = 'over'; }, r => { r.moves = [{}]; }, r => { r.moves = [null]; },
    r => { r.moves = [{ id: 'cao', dx: 0, dy: 1 }]; },
    r => { r.moves = [{ id: 'soldier-1', dx: 0, dy: 1 }]; },
    r => { r.moves = [{ id: 'soldier-1', dx: 1, dy: 1 }]; },
    r => { r.moves = Array(1); }, r => { r.moves = Array(MAX_MOVES + 1); },
  ];
  for (const mutate of changes) { const round = newRound(); mutate(round); assert.equal(validateRound(round), null, mutate.toString()); }
  for (const raw of [null, false, 7, 'round', [], {}]) assert.equal(validateRound(raw), null);
});

test('a replay may not append extra moves after the winning position', () => {
  const round = newRound('beginner');
  for (const { id, dx, dy } of solutions.beginner) move(round, id, dx, dy);
  round.moves.push({ id: 'cao', dx: -1, dy: 0 });
  round.pieces[0].x -= 1; round.status = 'playing';
  assert.equal(validateRound(round), null);
});

test('move history is bounded at 10000, still restores, and undo re-enables movement', () => {
  const round = newRound();
  for (let i = 0; i < MAX_MOVES; i += 1) assert.equal(move(round, 'soldier-1', 0, i % 2 ? -1 : 1), true);
  assert.equal(round.moves.length, MAX_MOVES);
  assert.equal(move(round, 'soldier-1', 0, 1), false);
  assert.ok(validateRound(round));
  assert.equal(undo(round), true);
  assert.equal(move(round, 'soldier-1', 0, -1), true);
  assert.equal(round.moves.length, MAX_MOVES);
});
