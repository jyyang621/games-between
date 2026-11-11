import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { VERSION, DIFFICULTIES, createRound, reveal, toggleFlag, chord, cloneRound, validateRound, neighbors, adjacentMines }
  = require('../../微信小程序/src/games/minesweeper/engine.js');

function started(difficulty = 'beginner', seed = 1024, index = 40) {
  const round = createRound(difficulty, seed);
  assert.equal(reveal(round, index), true);
  return round;
}

function chordFixture() {
  for (let seed = 1; seed < 100; seed += 1) {
    const round = started('beginner', seed);
    const index = round.revealed.findIndex((shown, index) => shown && adjacentMines(round, index) > 0
      && neighbors(round, index).some(neighbor => !round.revealed[neighbor] && !round.mines[neighbor]));
    if (index >= 0) return { round, index };
  }
  assert.fail('sample seeds must include a chord opportunity');
}

test('minesweeper offers three mobile portrait difficulties with independent empty ready boards', () => {
  assert.deepEqual(DIFFICULTIES.map(({ id, rows, cols, mines }) => ({ id, rows, cols, mines })), [
    { id: 'beginner', rows: 9, cols: 9, mines: 10 },
    { id: 'intermediate', rows: 12, cols: 9, mines: 20 },
    { id: 'expert', rows: 16, cols: 12, mines: 40 },
  ]);
  for (const difficulty of DIFFICULTIES) {
    const round = createRound(difficulty.id, 0);
    assert.equal(round.version, VERSION);
    assert.equal(round.status, 'ready');
    assert.equal(round.started, false);
    assert.equal(round.firstIndex, -1);
    assert.equal(round.exploded, -1);
    assert.equal(round.elapsedMs, 0);
    assert.equal(round.seed, 0);
    assert.equal(round.mines.length, difficulty.rows * difficulty.cols);
    assert.ok(round.mines.every(value => value === false));
    assert.deepEqual(validateRound(round), round);
  }
  const first = createRound(), second = createRound();
  toggleFlag(first, 0);
  assert.equal(second.flags[0], false);
  assert.equal(createRound('unknown').difficulty, 'beginner');
  assert.equal(createRound('beginner', -1).seed, 0xffffffff);
});

test('minesweeper seeded placement is deterministic and independent of global randomness', () => {
  const first = started('beginner', 0), second = started('beginner', 0);
  assert.deepEqual(first, second);
  assert.notDeepEqual(first.mines, started('beginner', 1).mines);
  assert.notDeepEqual(first.mines, started('beginner', 0, 0).mines);
  const original = Math.random;
  Math.random = () => { throw new Error('global randomness must not be used'); };
  try { assert.deepEqual(started('beginner', 0), first); } finally { Math.random = original; }
});

test('minesweeper every sampled first cell has a mine-free zero opening and exact mine count', () => {
  for (const difficulty of DIFFICULTIES) {
    const count = difficulty.rows * difficulty.cols;
    for (const index of [0, difficulty.cols - 1, count - difficulty.cols, count - 1, Math.floor(count / 2)]) {
      for (let seed = 0; seed < 32; seed += 1) {
        const round = started(difficulty.id, seed, index);
        assert.equal(round.mines.filter(Boolean).length, difficulty.mines);
        assert.equal(round.mines[index], false);
        assert.equal(adjacentMines(round, index), 0);
        assert.ok(neighbors(round, index).every(neighbor => !round.mines[neighbor]));
        assert.ok(round.revealed[index]);
        assert.ok(round.revealed.every((shown, cell) => !shown || !round.mines[cell]));
        assert.ok(validateRound(round));
      }
    }
  }
});

test('minesweeper neighbor enumeration respects row boundaries and clues match an independent count', () => {
  const round = started();
  assert.deepEqual(neighbors(round, 0), [1, 9, 10]);
  assert.deepEqual(neighbors(round, 8), [7, 16, 17]);
  assert.deepEqual(neighbors(round, 80), [70, 71, 79]);
  assert.equal(neighbors(round, 40).length, 8);
  for (let index = 0; index < 81; index += 1) {
    let expected = 0;
    for (let mine = 0; mine < 81; mine += 1) {
      if (mine === index || !round.mines[mine]) continue;
      if (Math.abs(Math.floor(mine / 9) - Math.floor(index / 9)) <= 1
        && Math.abs(mine % 9 - index % 9) <= 1) expected += 1;
    }
    assert.equal(adjacentMines(round, index), expected);
  }
});

test('minesweeper flood opens connected zeros and their numbered perimeter while preserving flags', () => {
  const baseline = started();
  assert.ok(baseline.revealed.filter(Boolean).length > 9);
  for (let index = 0; index < 81; index += 1) {
    if (baseline.revealed[index] && adjacentMines(baseline, index) === 0) {
      assert.ok(neighbors(baseline, index).every(neighbor => baseline.revealed[neighbor]));
    }
  }
  const safeFlag = baseline.revealed.findIndex((shown, index) => shown && index !== 40);
  const round = createRound('beginner', 1024);
  assert.equal(toggleFlag(round, safeFlag), true);
  assert.equal(reveal(round, 40), true);
  assert.equal(round.revealed[safeFlag], false);
  assert.equal(round.flags[safeFlag], true);
  assert.deepEqual(round.mines, baseline.mines);
  assert.equal(reveal(round, safeFlag), false);
  toggleFlag(round, safeFlag);
  assert.equal(reveal(round, safeFlag), true);
  assert.equal(round.revealed[safeFlag], true);
  assert.ok(validateRound(round));
});

test('minesweeper flags before first reveal neither place mines nor start the timer', () => {
  const round = createRound();
  assert.equal(toggleFlag(round, 0), true);
  assert.equal(reveal(round, 0), false);
  assert.equal(round.status, 'ready');
  assert.equal(round.started, false);
  assert.equal(round.elapsedMs, 0);
  assert.equal(round.mines.some(Boolean), false);
  assert.ok(validateRound(round));
  toggleFlag(round, 0);
  reveal(round, 0);
  assert.equal(toggleFlag(round, 0), false);
});

test('minesweeper only revealing all safe cells wins; flags alone never win', () => {
  const round = createRound('beginner', 101);
  for (let index = 0; index < 81; index += 1) toggleFlag(round, index);
  assert.equal(round.status, 'ready');
  for (let index = 0; index < 81; index += 1) toggleFlag(round, index);
  reveal(round, 40);
  for (let index = 0; index < 81; index += 1) {
    if (round.mines[index]) toggleFlag(round, index);
  }
  assert.equal(round.status, 'playing');
  for (let index = 0; index < 81; index += 1) {
    if (!round.mines[index]) reveal(round, index);
  }
  assert.equal(round.status, 'won');
  assert.equal(round.revealed.filter(Boolean).length, 71);
  assert.equal(round.exploded, -1);
  assert.ok(validateRound(round));
  const snapshot = cloneRound(round);
  assert.equal(reveal(round, round.mines.indexOf(true)), false);
  assert.equal(toggleFlag(round, round.mines.indexOf(true)), false);
  assert.equal(chord(round, 40), false);
  assert.deepEqual(round, snapshot);
});

test('minesweeper opening a mine loses once and records its index without revealing every mine', () => {
  const round = started();
  round.elapsedMs = 15123.75;
  const mine = round.mines.indexOf(true);
  assert.equal(reveal(round, mine), true);
  assert.equal(round.status, 'lost');
  assert.equal(round.exploded, mine);
  assert.equal(round.revealed.filter((shown, index) => shown && round.mines[index]).length, 1);
  assert.equal(round.elapsedMs, 15123.75);
  assert.ok(validateRound(round));
  const snapshot = cloneRound(round);
  assert.equal(reveal(round, 1), false);
  assert.equal(toggleFlag(round, 1), false);
  assert.equal(chord(round, 40), false);
  assert.deepEqual(round, snapshot);
});

test('minesweeper chording requires an exposed clue and matching flag count', () => {
  const { round, index } = chordFixture();
  const snapshot = cloneRound(round);
  assert.equal(chord(round, index), false);
  assert.equal(chord(round, 40), false);
  assert.equal(chord(round, round.mines.indexOf(true)), false);
  assert.deepEqual(round, snapshot);
  for (const neighbor of neighbors(round, index)) {
    if (round.mines[neighbor]) toggleFlag(round, neighbor);
  }
  const hiddenSafe = neighbors(round, index).filter(neighbor => !round.revealed[neighbor] && !round.mines[neighbor]);
  assert.equal(chord(round, index), true);
  assert.ok(hiddenSafe.every(neighbor => round.revealed[neighbor]));
  assert.notEqual(round.status, 'lost');
  assert.equal(chord(round, index), false);
  assert.ok(validateRound(round));
});

test('minesweeper an equal but incorrect set of chord flags can explode an unflagged mine', () => {
  const { round, index } = chordFixture();
  const adjacent = neighbors(round, index);
  const mines = adjacent.filter(neighbor => round.mines[neighbor]);
  const safe = adjacent.find(neighbor => !round.mines[neighbor] && !round.revealed[neighbor]);
  toggleFlag(round, safe);
  for (const mine of mines.slice(1)) toggleFlag(round, mine);
  assert.equal(adjacent.filter(neighbor => round.flags[neighbor]).length, adjacentMines(round, index));
  assert.equal(chord(round, index), true);
  assert.equal(round.status, 'lost');
  assert.equal(round.exploded, mines[0]);
  assert.equal(round.revealed[safe], false);
  assert.equal(round.flags[safe], true);
  assert.ok(validateRound(round));
});

test('minesweeper chording an exposed zero opens an unflagged neighbor left behind by a prior flag', () => {
  const round = createRound('beginner', 1024);
  toggleFlag(round, 41);
  reveal(round, 40);
  assert.equal(adjacentMines(round, 40), 0);
  assert.equal(round.revealed[41], false);
  assert.equal(chord(round, 40), false);
  toggleFlag(round, 41);
  assert.equal(chord(round, 40), true);
  assert.equal(round.revealed[41], true);
  assert.ok(validateRound(round));
});

test('minesweeper a correct final chord can complete the round', () => {
  const { round, index } = chordFixture();
  const lastSafe = neighbors(round, index).find(neighbor => !round.revealed[neighbor] && !round.mines[neighbor]);
  // Keep the final safe cell closed while every other safe cell is opened.
  toggleFlag(round, lastSafe);
  for (let cell = 0; cell < round.mines.length; cell += 1) {
    if (!round.mines[cell] && cell !== lastSafe) reveal(round, cell);
  }
  assert.equal(round.status, 'playing');
  toggleFlag(round, lastSafe);
  for (const neighbor of neighbors(round, index)) {
    if (round.mines[neighbor]) toggleFlag(round, neighbor);
  }
  assert.equal(chord(round, index), true);
  assert.equal(round.status, 'won');
  assert.ok(validateRound(round));
});

test('minesweeper clone and validated saves own their arrays and resume deterministic operations', () => {
  const round = started('expert', 4294967295, 80);
  round.elapsedMs = 4000.5;
  const snapshot = JSON.parse(JSON.stringify(round));
  const recovered = validateRound(snapshot), copied = cloneRound(round);
  assert.deepEqual(recovered, round);
  for (const name of ['mines', 'revealed', 'flags']) {
    assert.notEqual(recovered[name], snapshot[name]);
    assert.notEqual(copied[name], round[name]);
  }
  for (let index = 0; index < round.mines.length; index += 1) {
    if (round.mines[index]) {
      assert.equal(toggleFlag(round, index), toggleFlag(recovered, index));
    } else {
      assert.equal(reveal(round, index), reveal(recovered, index));
    }
    assert.deepEqual(recovered, round);
  }
  assert.deepEqual(validateRound(snapshot), copied);
});

test('minesweeper operations reject invalid cell indices without mutating a round', () => {
  for (const index of [-1, 81, 1.5, NaN, Infinity, '0', null, undefined]) {
    const round = createRound(), snapshot = cloneRound(round);
    assert.equal(reveal(round, index), false);
    assert.equal(toggleFlag(round, index), false);
    assert.equal(chord(round, index), false);
    assert.deepEqual(neighbors(round, index), []);
    assert.deepEqual(round, snapshot);
  }
});

test('minesweeper validates versions, dimensions, booleans, timers and uint32 seeds strictly', () => {
  const round = started();
  const bad = [null, {}, [], { ...round, version: 0 }, { ...round, version: 2 },
    { ...round, difficulty: 'unknown' }, { ...round, rows: 8 }, { ...round, cols: 10 }, { ...round, mineCount: 9 },
    { ...round, started: 1 }, { ...round, status: 'paused' },
    ...[-1, 1.5, NaN, Infinity, 2 ** 32, '1'].map(seed => ({ ...round, seed })),
    ...[-1, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, '0'].map(elapsedMs => ({ ...round, elapsedMs })),
    ...['mines', 'revealed', 'flags'].flatMap(name => [
      { ...round, [name]: Array(80).fill(false) }, { ...round, [name]: Array(81) },
      { ...round, [name]: round[name].map((value, index) => index === 0 ? 0 : value) },
    ])];
  for (const value of bad) assert.equal(validateRound(value), null);
  assert.ok(validateRound({ ...round, elapsedMs: 0.25 }));
});

test('minesweeper validation rejects inconsistent ready, playing, win and loss saves', () => {
  const ready = createRound(), playing = started();
  for (const mutation of [
    { started: true }, { status: 'playing' }, { firstIndex: 0 }, { exploded: 0 }, { elapsedMs: 1 },
    { mines: ready.mines.map((value, index) => index === 0) },
    { revealed: ready.revealed.map((value, index) => index === 0) },
  ]) assert.equal(validateRound({ ...ready, ...mutation }), null);
  const shown = playing.revealed.indexOf(true), mine = playing.mines.indexOf(true);
  const malformed = [
    { ...playing, started: false }, { ...playing, status: 'ready' }, { ...playing, firstIndex: -1 },
    { ...playing, firstIndex: mine }, { ...playing, exploded: mine },
    { ...playing, status: 'won' }, { ...playing, status: 'lost', exploded: mine },
    { ...playing, mines: Array(81).fill(false) }, { ...playing, seed: (playing.seed + 1) >>> 0 },
    { ...playing, revealed: playing.mines.map(value => !value) },
    { ...playing, flags: playing.flags.map((value, index) => index === shown) },
    { ...playing, revealed: playing.revealed.map((value, index) => value || index === mine) },
  ];
  for (const value of malformed) assert.equal(validateRound(value), null);
  const tampered = cloneRound(playing);
  const unshownSafe = tampered.mines.findIndex((value, index) => !value && !tampered.revealed[index]);
  tampered.mines[mine] = false;
  tampered.mines[unshownSafe] = true;
  assert.equal(validateRound(tampered), null);
  const loss = cloneRound(playing);
  reveal(loss, mine);
  assert.ok(validateRound(loss));
  assert.equal(validateRound({ ...loss, exploded: -1 }), null);
  assert.equal(validateRound({ ...loss, status: 'playing' }), null);
});

test('minesweeper deterministic safe-cell play samples preserve valid snapshots through wins', () => {
  let actions = 0;
  for (const difficulty of DIFFICULTIES) {
    for (let seed = 0; seed < 24; seed += 1) {
      const round = started(difficulty.id, seed, Math.floor(difficulty.rows * difficulty.cols / 2));
      for (let index = 0; index < round.mines.length; index += 1) {
        if (!round.mines[index] && reveal(round, index)) {
          actions += 1;
          assert.ok(validateRound(round));
        }
      }
      assert.equal(round.status, 'won');
      assert.ok(validateRound(round));
    }
  }
  assert.ok(actions > 1000, `${actions} deterministic sample actions`);
});
