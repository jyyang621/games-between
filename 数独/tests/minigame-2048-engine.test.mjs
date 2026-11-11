import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { newGame, applyMove, canMove, maxTile, cloneRound, validateRound } = require('../../微信小程序/src/games/game-2048/engine.js');

function fixture(rows, extra = {}) {
  return { board: rows.flat(), score: 0, moves: 0, rngState: 12345, won: false, keepPlaying: false, ...extra };
}
const emptyRow = [0, 0, 0, 0];
function withoutSpawn(result) {
  const board = result.round.board.slice();
  if (result.spawned) board[result.spawned.index] = 0;
  return board;
}

test('2048 seeded new rounds contain two distinct 2/4 tiles and do not depend on global randomness', () => {
  const first = newGame(731);
  assert.deepEqual(first, newGame(731));
  assert.notDeepEqual(first, newGame(732));
  assert.equal(first.board.filter(Boolean).length, 2);
  assert.ok(first.board.every(value => value === 0 || value === 2 || value === 4));
  assert.equal(first.score, 0);
  assert.equal(first.moves, 0);
  assert.equal(first.won, false);
  assert.ok(validateRound(newGame(0)));
});

test('2048 four equal tiles merge into two pairs only once per move, scoring merged values', () => {
  const source = fixture([[2, 2, 2, 2], emptyRow, emptyRow, emptyRow]);
  const before = structuredClone(source);
  const result = applyMove(source, 'left');
  assert.equal(result.changed, true);
  assert.deepEqual(withoutSpawn(result), [4, 4, 0, 0, ...Array(12).fill(0)]);
  assert.equal(result.round.score, 8);
  assert.equal(result.round.moves, 1);
  assert.deepEqual(result.mergedIndices, [0, 1]);
  assert.deepEqual(result.transitions, [
    { from: 0, to: 0, value: 2, merged: true }, { from: 1, to: 0, value: 2, merged: true },
    { from: 2, to: 1, value: 2, merged: true }, { from: 3, to: 1, value: 2, merged: true },
  ]);
  assert.deepEqual(source, before);
});

test('2048 merging skips gaps but never merges a newly formed tile twice', () => {
  const result = applyMove(fixture([[2, 0, 2, 4], [4, 4, 8, 0], emptyRow, emptyRow]), 'left');
  assert.deepEqual(withoutSpawn(result).slice(0, 8), [4, 4, 0, 0, 8, 8, 0, 0]);
  assert.equal(result.round.score, 12);
  assert.equal(result.transitions.length, 6);
  assert.equal(new Set(result.transitions.map(item => item.from)).size, 6);
});

test('2048 direction transforms use the leading edge and preserve independent rows/columns', () => {
  const board = fixture([[2, 0, 0, 2], [0, 4, 0, 0], [2, 0, 4, 0], [0, 0, 0, 2]]);
  const expectations = {
    left: [[4, 0, 0, 0], [4, 0, 0, 0], [2, 4, 0, 0], [2, 0, 0, 0]],
    right: [[0, 0, 0, 4], [0, 0, 0, 4], [0, 0, 2, 4], [0, 0, 0, 2]],
    up: [[4, 4, 4, 4], emptyRow, emptyRow, emptyRow],
    down: [emptyRow, emptyRow, emptyRow, [4, 4, 4, 4]],
  };
  for (const [direction, expected] of Object.entries(expectations)) {
    const result = applyMove(board, direction);
    assert.deepEqual(withoutSpawn(result), expected.flat(), direction);
    assert.equal(result.transitions.length, 6, direction);
    assert.equal(result.round.moves, 1, direction);
  }
  const three = fixture([[2, 2, 2, 0], emptyRow, emptyRow, emptyRow]);
  assert.deepEqual(withoutSpawn(applyMove(three, 'right')).slice(0, 4), [0, 0, 2, 4]);
});

test('2048 ineffective swipes neither spawn, score, advance moves nor consume random state', () => {
  const source = fixture([[2, 4, 8, 16], emptyRow, emptyRow, emptyRow], { score: 23, moves: 8 });
  const result = applyMove(source, 'left');
  assert.deepEqual(result, { changed: false, round: source, transitions: [], spawned: null, mergedIndices: [] });
  assert.notEqual(result.round, source);
  assert.notEqual(result.round.board, source.board);
  assert.deepEqual(applyMove(source, 'diagonal').round, source);
});

test('2048 each valid move spawns exactly one tile into an empty cell after all merges', () => {
  const source = fixture([[0, 2, 4, 8], emptyRow, emptyRow, emptyRow]);
  const result = applyMove(source, 'left');
  assert.equal(result.changed, true);
  assert.ok(result.spawned.index >= 3);
  assert.ok(result.spawned.value === 2 || result.spawned.value === 4);
  assert.equal(result.round.board[result.spawned.index], result.spawned.value);
  assert.equal(result.round.board.filter(Boolean).length, 4);
  assert.equal(result.round.score, 0);
  assert.notEqual(result.round.rngState, source.rngState);
});

test('2048 full boards finish only when neither horizontal nor vertical neighbors can merge', () => {
  const dead = fixture([[2, 4, 2, 4], [4, 2, 4, 2], [2, 4, 2, 4], [4, 2, 4, 2]]);
  assert.equal(canMove(dead.board), false);
  for (const direction of ['up', 'down', 'left', 'right']) assert.deepEqual(applyMove(dead, direction).round, dead);
  const horizontal = dead.board.slice(); horizontal[1] = 2;
  const vertical = dead.board.slice(); vertical[4] = 2;
  assert.equal(canMove(horizontal), true);
  assert.equal(canMove(vertical), true);
  assert.equal(canMove(Array(16).fill(0)), false);
});

test('2048 reaching the goal pauses new moves until explicitly choosing to keep playing', () => {
  const source = fixture([[1024, 1024, 0, 0], emptyRow, emptyRow, emptyRow]);
  const win = applyMove(source, 'left');
  assert.equal(win.round.won, true);
  assert.equal(win.round.keepPlaying, false);
  assert.equal(maxTile(win.round.board), 2048);
  assert.equal(win.round.score, 2048);
  assert.equal(applyMove(win.round, 'right').changed, false);
  const continued = cloneRound(win.round); continued.keepPlaying = true;
  const next = applyMove(continued, 'right');
  assert.equal(next.changed, true);
  assert.equal(next.round.won, true);
  assert.equal(next.round.keepPlaying, true);
});

test('2048 restored PRNG yields the same future boards and does not mutate snapshots', () => {
  let first = newGame(0);
  for (const direction of ['left', 'down', 'right', 'up', 'up', 'left']) first = applyMove(first, direction).round;
  const snapshot = JSON.parse(JSON.stringify(first));
  const recovered = validateRound(snapshot);
  for (const direction of ['down', 'left', 'left', 'up', 'right', 'down']) {
    const one = applyMove(first, direction), two = applyMove(recovered, direction);
    assert.deepEqual(one, two);
    first = one.round;
    Object.assign(recovered, two.round);
  }
  assert.notDeepEqual(first, snapshot);
  assert.deepEqual(validateRound(snapshot), snapshot);
});

test('2048 spawn distribution uses both allowed values with about ten percent fours', () => {
  let fours = 0;
  const samples = 10000;
  const source = fixture([[0, 2, 4, 8], emptyRow, emptyRow, emptyRow]);
  for (let seed = 0; seed < samples; seed += 1) {
    const result = applyMove({ ...source, rngState: seed }, 'left');
    if (result.spawned.value === 4) fours += 1;
    else assert.equal(result.spawned.value, 2);
  }
  assert.ok(fours > 850 && fours < 1150, `${fours} fours out of ${samples}`);
});

test('2048 deterministic play samples conserve tile mass and produce complete animation records', () => {
  const directions = ['up', 'right', 'down', 'left'];
  let validMoves = 0;
  for (let seed = 1; seed <= 30; seed += 1) {
    let round = newGame(seed);
    for (let step = 0; step < 150 && canMove(round.board); step += 1) {
      round.keepPlaying = round.won;
      const result = directions.map((_, offset) => applyMove(round, directions[(step + seed + offset) % 4]))
        .find(candidate => candidate.changed);
      assert.ok(result, 'a movable board must permit at least one direction');
      const sum = values => values.reduce((total, value) => total + value, 0);
      assert.equal(sum(result.round.board), sum(round.board) + result.spawned.value);
      assert.equal(result.round.score - round.score, sum(result.transitions.filter(item => item.merged).map(item => item.value)));
      assert.deepEqual(result.transitions.map(item => item.from).sort((a, b) => a - b),
        round.board.flatMap((value, index) => value ? [index] : []));
      assert.ok(validateRound(result.round));
      round = result.round;
      validMoves += 1;
    }
  }
  assert.ok(validMoves >= 1500, `${validMoves} sample moves checked`);
});

test('2048 snapshot validation rejects malformed fields and unsafe or non-power tiles', () => {
  const round = newGame(22);
  const bad = [null, {}, [], { ...round, board: Array(15).fill(0) },
    { ...round, board: Array(16).fill(0) }, { ...round, board: [2, ...Array(15).fill(0)] },
    { ...round, board: Array(16) }, ...[-2, 1, 3, NaN, Infinity, 2 ** 53, 2 ** 52 - 1, '2'].map(value => ({ ...round, board: [value, ...Array(15).fill(0)] })),
    ...[-1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, '0'].flatMap(value => [{ ...round, score: value }, { ...round, moves: value }]),
    ...[-1, 1.5, NaN, Infinity, 2 ** 32, '0'].map(value => ({ ...round, rngState: value })),
    { ...round, won: 1 }, { ...round, keepPlaying: undefined }];
  for (const value of bad) assert.equal(validateRound(value), null);
  const high = fixture([[2 ** 52, 2, 0, 0], emptyRow, emptyRow, emptyRow]);
  assert.ok(validateRound(high));
  const hiddenWin = fixture([[2048, 2, 0, 0], emptyRow, emptyRow, emptyRow]);
  const restored = validateRound(hiddenWin);
  assert.equal(restored.won, true);
  assert.equal(hiddenWin.won, false);
  restored.board[0] = 2;
  assert.equal(hiddenWin.board[0], 2048);
});

test('2048 rejects extreme integer overflow without consuming RNG or destroying a valid save', () => {
  const source = fixture([[2, 2, 0, 0], emptyRow, emptyRow, emptyRow], { score: Number.MAX_SAFE_INTEGER });
  assert.deepEqual(applyMove(source, 'left').round, source);
  const maximum = fixture([[2 ** 52, 2 ** 52, 0, 0], emptyRow, emptyRow, emptyRow], { won: true, keepPlaying: true });
  assert.deepEqual(applyMove(maximum, 'left').round, maximum);
  assert.deepEqual(applyMove({ ...source, score: 0, moves: Number.MAX_SAFE_INTEGER }, 'left').round, { ...source, score: 0, moves: Number.MAX_SAFE_INTEGER });
});
