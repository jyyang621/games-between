import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { WIDTH, HEIGHT, TYPES, cells, newRound, move, rotate, dropDistance, lockPiece, hardDrop, cloneRound, validateRound } = require('../../微信小程序/src/games/tetris/engine.js');

const fixture = (type = 'T', extra = {}) => ({ ...newRound(812), active: { type, rotation: 0, x: 3, y: 5 }, ...extra });
const occupied = round => round.board.filter(Boolean).length;

test('tetris starts with an empty 10 by 20 board and a valid deterministic seven-bag state', () => {
  assert.equal(WIDTH, 10); assert.equal(HEIGHT, 20);
  const round = newRound(73);
  assert.deepEqual(round, newRound(73));
  assert.notDeepEqual(round, newRound(74));
  assert.equal(occupied(round), 0);
  assert.equal(round.active.y, -1);
  assert.equal(round.queue.length, 5);
  assert.equal(new Set([round.active.type, ...round.queue, ...round.bag]).size, 7);
  assert.deepEqual(validateRound(round), round);
  assert.ok(validateRound(newRound(0)));
});

test('tetris each group of seven pieces contains all seven types and future pieces survive restore', () => {
  for (const seed of [0, 1, 999, 0xffffffff]) {
    const round = newRound(seed), sequence = [];
    for (let i = 0; i < 140; i += 1) {
      sequence.push(round.active.type);
      hardDrop(round);
      round.board.fill(0); // Separate the bag check from the player's stacking decisions.
      round.pieces = 0;
      assert.ok(validateRound(round));
    }
    for (let i = 0; i < sequence.length; i += 7) assert.deepEqual(sequence.slice(i, i + 7).sort(), TYPES.slice().sort());
  }
  const round = newRound(883), copy = validateRound(round);
  for (let i = 0; i < 8; i += 1) {
    move(round, i % 2 ? 1 : -1, 0); move(copy, i % 2 ? 1 : -1, 0);
    assert.deepEqual(hardDrop(copy), hardDrop(round));
    assert.deepEqual(copy, round);
  }
});

test('tetris cells produce four distinct coordinates for all rotations and ignore unknown shapes', () => {
  for (const type of TYPES) for (let rotation = 0; rotation < 4; rotation += 1) {
    const points = cells({ type, rotation, x: 2, y: 3 });
    assert.equal(points.length, 4);
    assert.equal(new Set(points.map(pair => pair.join(','))).size, 4);
  }
  for (const type of ['__proto__', 'toString', 'bad', null]) assert.deepEqual(cells({ type, rotation: 0, x: 0, y: 0 }), []);
  assert.deepEqual(cells(null), []);
});

test('tetris movement stops at walls, floor and settled blocks without changing scores', () => {
  const round = fixture('O', { active: { type: 'O', rotation: 0, x: 0, y: 18 } });
  const original = cloneRound(round);
  assert.equal(move(round, -1, 0), false);
  assert.equal(move(round, 0, 1), false);
  assert.deepEqual(round, original);
  assert.equal(move(round, 1, 0), true);
  round.board[18 * WIDTH + 3] = 1;
  assert.equal(move(round, 1, 0), false);
  assert.equal(round.score, 0);
  assert.equal(round.pieces, 0);
});

test('tetris invalid movement cannot teleport through cells or move upwards', () => {
  const round = fixture(), original = cloneRound(round);
  for (const [dx, dy] of [[2, 0], [0, 2], [1, 1], [0, -1], [0, 0], [0.5, 0], [NaN, 0], ['1', 0]]) assert.equal(move(round, dx, dy), false);
  assert.deepEqual(round, original);
});

test('tetris rotation cycles return to original geometry in empty space', () => {
  for (const type of TYPES.filter(type => type !== 'O')) {
    const round = fixture(type), original = cloneRound(round);
    for (let i = 0; i < 4; i += 1) assert.equal(rotate(round), true);
    assert.deepEqual(round, original);
    assert.equal(rotate(round, -1), true);
    assert.equal(rotate(round), true);
    assert.deepEqual(round, original);
  }
  const square = fixture('O'), original = cloneRound(square);
  assert.equal(rotate(square), false);
  assert.equal(rotate(square, 5), false);
  assert.deepEqual(square, original);
});

test('tetris ordinary wall kicks rescue a vertical I at both walls', () => {
  const left = fixture('I', { active: { type: 'I', rotation: 1, x: -2, y: 5 } });
  assert.equal(rotate(left), true);
  assert.ok(cells(left.active).every(([x]) => x >= 0));
  const right = fixture('I', { active: { type: 'I', rotation: 1, x: 7, y: 5 } });
  assert.equal(rotate(right), true);
  assert.ok(cells(right.active).every(([x]) => x < WIDTH));
});

test('tetris floor kick permits a horizontal I to rotate without leaving the board', () => {
  const round = fixture('I', { active: { type: 'I', rotation: 0, x: 3, y: 18 } });
  assert.equal(rotate(round), true);
  assert.equal(round.active.y, 16);
  assert.ok(cells(round.active).every(([, y]) => y < HEIGHT));
});

test('tetris rotation blocked in a tight pocket leaves the complete round unchanged', () => {
  const round = fixture('T');
  round.board.fill(7);
  for (const [x, y] of cells(round.active)) round.board[y * WIDTH + x] = 0;
  const original = cloneRound(round);
  assert.equal(rotate(round), false);
  assert.deepEqual(round, original);
});

test('tetris drop preview measures free fall without mutating gameplay', () => {
  const round = fixture('O', { active: { type: 'O', rotation: 0, x: 4, y: 1 } });
  assert.equal(dropDistance(round), 17);
  round.board[14 * WIDTH + 4] = 1;
  const original = cloneRound(round);
  assert.equal(dropDistance(round), 11);
  assert.deepEqual(round, original);
});

test('tetris hard drop awards two points per row and locks exactly one piece', () => {
  const round = fixture('O', { active: { type: 'O', rotation: 0, x: 4, y: 1 } });
  assert.deepEqual(hardDrop(round), { distance: 17, lines: 0, topOut: false, locked: true });
  assert.equal(round.score, 34);
  assert.equal(occupied(round), 4);
  assert.equal(round.pieces, 1);
  assert.equal(round.active.y, -1);
  assert.ok(validateRound(round));
});

test('tetris hard-drop scoring saturates safely so extreme valid scores remain restorable', () => {
  const round = fixture('O', { active: { type: 'O', rotation: 0, x: 4, y: 1 }, score: Number.MAX_SAFE_INTEGER - 1 });
  hardDrop(round);
  assert.equal(round.score, Number.MAX_SAFE_INTEGER);
  assert.ok(validateRound(round));
});

test('tetris snapshots retain all legal hidden-row rotations without clamping the active piece', () => {
  for (const type of TYPES) for (let rotation = 0; rotation < 4; rotation += 1) {
    const round = newRound(17);
    const localMinY = Math.min(...cells({ type, rotation, x: 0, y: 0 }).map(([, y]) => y));
    round.active = { type, rotation, x: 3, y: -2 - localMinY };
    const restored = validateRound(round);
    assert.ok(restored, `${type} rotation ${rotation}`);
    assert.deepEqual(restored.active, round.active);
    assert.equal(Math.min(...cells(restored.active).map(([, y]) => y)), -2);
    round.active.y -= 1;
    assert.equal(validateRound(round), null);
  }
});

test('tetris lock cannot freeze a piece while it is still falling', () => {
  const round = fixture(), original = cloneRound(round);
  assert.deepEqual(lockPiece(round), { lines: 0, topOut: false, locked: false });
  assert.deepEqual(round, original);
});

for (const lineCount of [1, 2, 3, 4]) {
  test(`tetris ${lineCount}-line clear removes rows together, shifts upper rows and uses current level`, () => {
    const round = fixture('I', { active: { type: 'I', rotation: 1, x: 2, y: 16 }, level: 3, lines: 20 });
    for (let y = HEIGHT - lineCount; y < HEIGHT; y += 1) {
      for (let x = 0; x < WIDTH; x += 1) if (x !== 4) round.board[y * WIDTH + x] = 2;
    }
    round.board[10 * WIDTH] = 6;
    const result = lockPiece(round);
    assert.equal(result.lines, lineCount);
    assert.equal(result.locked, true);
    assert.equal(round.score, [0, 100, 300, 500, 800][lineCount] * 3);
    assert.equal(round.lines, 20 + lineCount);
    assert.equal(round.board[(10 + lineCount) * WIDTH], 6);
    assert.ok(round.board.slice(0, lineCount * WIDTH).every(value => value === 0));
    assert.equal(occupied(round), 5 - lineCount);
  });
}

test('tetris crossing ten lines scores at the old level then advances level, capped at twenty', () => {
  const round = fixture('I', { active: { type: 'I', rotation: 0, x: 6, y: 18 }, lines: 9 });
  round.board.fill(2, 190, 196);
  assert.equal(lockPiece(round).lines, 1);
  assert.equal(round.score, 100);
  assert.equal(round.level, 2);
  const high = fixture('I', { active: { type: 'I', rotation: 0, x: 6, y: 18 }, lines: 199, level: 20 });
  high.board.fill(2, 190, 196);
  lockPiece(high);
  assert.equal(high.level, 20);
  assert.equal(high.score, 2000);
});

test('tetris hidden-cell top out does not clear a row or partially commit the piece', () => {
  const round = fixture('O', { active: { type: 'O', rotation: 0, x: 4, y: -1 } });
  round.board[WIDTH + 4] = 1;
  for (let x = 0; x < WIDTH; x += 1) if (x !== 4 && x !== 5) round.board[x] = 2;
  const before = round.board.slice();
  assert.deepEqual(lockPiece(round), { lines: 0, topOut: true, locked: true });
  assert.deepEqual(round.board, before);
  assert.equal(round.active, null);
  assert.equal(round.status, 'over');
  assert.equal(round.lines, 0);
  assert.equal(round.score, 0);
});

test('tetris occupied spawn space ends the game after the previous piece locks', () => {
  const round = fixture('O', { active: { type: 'O', rotation: 0, x: 0, y: 18 } });
  round.queue[0] = 'O';
  round.board[4] = 3;
  assert.equal(lockPiece(round).topOut, true);
  assert.equal(round.status, 'over');
  assert.equal(round.active, null);
  assert.equal(round.pieces, 1);
  assert.equal(round.board[190], 2);
});

test('tetris all actions are inert after game over', () => {
  const round = fixture('O', { status: 'over', active: null }), original = cloneRound(round);
  assert.equal(move(round, 1, 0), false);
  assert.equal(rotate(round), false);
  assert.equal(dropDistance(round), 0);
  assert.deepEqual(hardDrop(round), { distance: 0, lines: 0, topOut: false, locked: false });
  assert.deepEqual(lockPiece(round), { lines: 0, topOut: false, locked: false });
  assert.deepEqual(round, original);
});

test('tetris cloned and restored rounds share no mutable board, active piece or random queue', () => {
  const round = newRound(11), restored = validateRound(round), copy = cloneRound(round);
  for (const other of [restored, copy]) {
    assert.notEqual(other.board, round.board);
    assert.notEqual(other.active, round.active);
    assert.notEqual(other.queue, round.queue);
    assert.notEqual(other.bag, round.bag);
    assert.deepEqual(other, round);
  }
  restored.board[0] = 7; restored.active.x += 1; restored.queue.reverse(); restored.bag.push('I');
  assert.deepEqual(round, copy);
});

test('tetris rejects corrupted counters, sparse arrays, impossible boards and random generator state', () => {
  const changes = [
    r => { r.board = Array(200); }, r => { r.board.pop(); }, r => { r.board[0] = 8; },
    r => { r.board[0] = '1'; }, r => { r.board[0] = 1; }, r => { r.rngState = -1; },
    r => { r.rngState = 2 ** 32; }, r => { r.score = NaN; }, r => { r.score = 0.5; },
    r => { r.lines = 1; }, r => { r.lines = 10; r.level = 1; }, r => { r.level = 21; },
    r => { r.pieces = -1; }, r => { r.queue.pop(); }, r => { delete r.queue[0]; },
    r => { r.queue[0] = 'X'; }, r => { r.queue[0] = r.queue[1]; }, r => { r.bag = Array(7).fill('I'); },
    r => { r.status = 'won'; }, r => { r.active = null; }, r => { r.active.x = 20; },
    r => { r.active.y = -10; }, r => { r.active.type = '__proto__'; }, r => { r.active.rotation = 4; },
    r => { r.status = 'over'; }, r => { r.pieces = 10; r.board.fill(1, 190); },
  ];
  for (const mutate of changes) {
    const round = newRound(12); mutate(round);
    assert.equal(validateRound(round), null, mutate.toString());
  }
  for (const raw of [null, false, 'round', [], {}, 3]) assert.equal(validateRound(raw), null);
});

test('tetris deterministic multi-round play never produces an unrestorable engine snapshot', () => {
  for (let seed = 0; seed < 30; seed += 1) {
    const round = newRound(seed);
    for (let turn = 0; turn < 100 && round.status === 'playing'; turn += 1) {
      for (let n = 0; n < turn % 4; n += 1) rotate(round);
      for (let n = 0; n < turn % 5; n += 1) move(round, turn % 2 ? 1 : -1, 0);
      hardDrop(round);
      assert.ok(validateRound(round), `seed ${seed}, piece ${turn}`);
    }
    assert.equal(round.status, 'over');
  }
});
