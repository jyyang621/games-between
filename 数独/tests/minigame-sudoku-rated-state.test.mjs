import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { RatedSudokuGame } = require('../../微信小程序/src/games/sudoku/rated-state.js');
const { SudokuGame } = require('../../微信小程序/src/games/sudoku/state.js');
const { getPuzzle, selectPuzzle, RATING_VERSION } = require('../../微信小程序/src/games/sudoku/bank.js');
const { generatePuzzle, getAllCandidates } = require('../../微信小程序/src/games/sudoku/core/engine.js');
const { createLogicState, analyze, validateStep } = require('../../微信小程序/src/games/sudoku/logic.js');
const clone = value => structuredClone(value);
const create = options => new RatedSudokuGame({ seed: 'rated-state-tests', now: () => 1792252800000, ...options });

function beforeElimination(difficulty = 'expert') {
  const game = create({ difficulty });
  for (let guard = 0; guard < 150; guard += 1) {
    const step = game.nextLogicalStep();
    assert.ok(step, 'rated puzzle must have a justified next step');
    if (step.eliminations.length) return { game, step };
    assert.equal(game.applyLogicalStep(step), true);
  }
  assert.fail('rated puzzle must reach a genuine candidate deduction');
}

test('rated constructor dispatch selects a qualified bank round while the legacy state stays unchanged', () => {
  for (const [tier, difficulty] of ['easy', 'medium', 'hard', 'expert'].entries()) {
    const game = create({ difficulty });
    assert.ok(game instanceof SudokuGame);
    const expected = selectPuzzle('rated-state-tests', difficulty);
    assert.equal(game.bankId, expected.id);
    assert.equal(game.ratingVersion, RATING_VERSION);
    assert.equal(game.ratingProfile.maxTier, tier);
    assert.deepEqual(game.board, expected.puzzle);
    assert.deepEqual(game.solution, expected.solution);
    assert.deepEqual(game.state.deductions, []);
    assert.equal(game.history.length, 0);
    const legacy = new SudokuGame({ seed: 'rated-state-tests', difficulty });
    assert.deepEqual(legacy.board, generatePuzzle('rated-state-tests', difficulty).puzzle);
    assert.equal(legacy.serialize().schemaVersion, 1);
  }
});

test('rated start and restart keep an explicit bank identity and reject invalid new-round fields atomically', () => {
  const game = create({ difficulty: 'hard' });
  const bankId = game.bankId;
  game.hint(); game.tick(5000);
  assert.equal(game.restart(), true);
  assert.equal(game.bankId, bankId);
  assert.equal(game.elapsed, 0);
  assert.equal(game.hints, 0);
  assert.deepEqual(game.state.deductions, []);
  const before = game.serialize();
  for (const args of [['', 'easy'], ['x', 'nonexistent'], ['x', 'easy', 'bad-mode'], ['x', 'easy', 'classic', bankId], ['x', 'hard', 'classic', 'missing-bank-id']]) {
    assert.equal(game.start(...args), false);
    assert.deepEqual(game.serialize(), before);
  }
});

test('schema 2 save and share pin rating version and bank identity, reconstructing trusted givens and solution', () => {
  const game = create({ difficulty: 'hard', mode: 'daily', seed: '2026-10-18' });
  game.hint(); game.tick(1234); game.toggleNotes();
  const saved = game.serialize();
  assert.equal(saved.schemaVersion, 2);
  assert.equal(saved.bankId, game.bankId);
  assert.equal(saved.ratingVersion, RATING_VERSION);
  const query = new URLSearchParams(game.shareQuery());
  assert.equal(query.get('v'), '2'); assert.equal(query.get('b'), game.bankId);
  assert.equal(query.get('p'), '2026-10-18'); assert.equal(query.get('d'), 'hard'); assert.equal(query.get('m'), 'daily');
  saved.puzzle = Array(81).fill(9); saved.solution = Array(81).fill(9); saved.completed = true;
  const restored = create({ saved });
  assert.equal(restored.bankId, game.bankId);
  assert.deepEqual(restored.puzzle, getPuzzle(game.bankId).puzzle);
  assert.deepEqual(restored.solution, game.solution);
  assert.deepEqual(restored.board, game.board);
  assert.equal(restored.completed, false);
  assert.equal(restored.elapsed, 1234);
  assert.equal(restored.noteMode, true);
  assert.equal(restored.history.length, game.history.length);
});

test('logical hints apply a proved action and do not reveal an oracle answer for a wrong player entry', () => {
  const game = create();
  const step = game.nextLogicalStep();
  assert.equal(validateStep(createLogicState(game.board), step), true);
  const hinted = game.hint();
  assert.equal(hinted.step.technique, step.technique);
  assert.equal(game.hints, 1);
  assert.equal(game.board[step.placements[0].index], step.placements[0].value);
  const emptyIndex = game.board.indexOf(0); game.select(emptyIndex);
  const wrong = game.solution[emptyIndex] % 9 + 1;
  assert.equal(game.input(wrong), true);
  assert.equal(game.nextLogicalStep(), null);
  assert.equal(game.hint(), null);
  assert.equal(game.board[emptyIndex], wrong);
  assert.equal(game.applyLogicalStep(step), false);
  game.erase(); game.setPaused(true);
  assert.equal(game.nextLogicalStep(), null);
  assert.equal(game.hint(), null);
});

test('verified candidate deductions survive repeated fill-all and are not derived from manual pencil marks', () => {
  const { game, step } = beforeElimination();
  const board = game.board.slice();
  const first = step.eliminations[0];
  assert.ok(getAllCandidates(board)[first.index].includes(first.digit));
  assert.equal(game.applyLogicalStep(step), true);
  assert.deepEqual(game.board, board);
  assert.equal(game.state.deductions.length, 1);
  assert.equal(game.notes[first.index].includes(first.digit), false);
  game.fillAllNotes();
  assert.equal(game.notes[first.index].includes(first.digit), false);
  game.select(first.index); game.toggleNotes();
  assert.equal(game.input(first.digit), true);
  assert.equal(game.notes[first.index].includes(first.digit), true);
  game.fillAllNotes();
  assert.equal(game.notes[first.index].includes(first.digit), false);
  assert.equal(game.state.deductions.length, 1);
  const expected = game.nextLogicalStep();
  game.state.notes = Array.from({ length: 81 }, () => []);
  assert.deepEqual(game.nextLogicalStep(), expected);
});

test('logical application accepts a proved partial action with omitted empty arrays and rejects malformed actions', () => {
  const singleGame = create();
  const single = singleGame.nextLogicalStep();
  assert.equal(singleGame.applyLogicalStep({ technique: single.technique, cells: single.cells, placements: single.placements }), true);
  const { game, step } = beforeElimination();
  const first = step.eliminations[0];
  assert.equal(game.applyLogicalStep({ technique: step.technique, cells: step.cells, eliminations: [first] }), true);
  assert.equal(game.notes[first.index].includes(first.digit), false);
  assert.equal(game.state.deductions.length, 1);
  const before = game.serialize();
  for (const invalid of [null, {}, { technique: 'magic', cells: [0], eliminations: [first] },
    { technique: step.technique, cells: step.cells, eliminations: [{ index: first.index, digit: game.solution[first.index] }] }]) {
    assert.equal(game.applyLogicalStep(invalid), false);
    assert.deepEqual(game.serialize(), before);
  }
});

test('adding a correct value retains prior deductions but erasing that value invalidates the proof anchors', () => {
  const { game, step } = beforeElimination(); game.applyLogicalStep(step);
  const first = step.eliminations[0];
  const index = game.board.findIndex((value, at) => !value && at !== first.index);
  game.select(index);
  assert.equal(game.input(game.solution[index]), true);
  assert.equal(game.state.deductions.length, 1);
  game.fillAllNotes();
  assert.equal(game.notes[first.index].includes(first.digit), false);
  game.select(index);
  assert.equal(game.erase(), true);
  assert.deepEqual(game.state.deductions, []);
  game.fillAllNotes();
  assert.ok(game.notes[first.index].includes(first.digit));
});

test('undo and restore preserve each deduction prefix, including multiple proofs on advancing boards', () => {
  const { game, step } = beforeElimination();
  const before = game.serialize();
  assert.equal(game.applyLogicalStep(step), true);
  assert.equal(game.undo(), true);
  assert.deepEqual(game.board, before.board);
  assert.deepEqual(game.notes, before.notes);
  assert.deepEqual(game.state.deductions, before.deductions);
  assert.equal(game.hints, before.hints + 1);
  assert.equal(game.applyLogicalStep(step), true);
  for (let guard = 0; guard < 40 && game.state.deductions.length < 3 && !game.completed; guard += 1) assert.ok(game.hint());
  assert.ok(game.state.deductions.length >= 2);
  const saved = game.serialize();
  const restored = create({ saved });
  assert.equal(restored.bankId, game.bankId);
  assert.deepEqual(restored.state.deductions, game.state.deductions);
  assert.deepEqual(restored.notes, game.notes);
  assert.deepEqual(restored.nextLogicalStep(), game.nextLogicalStep());
  assert.equal(restored.undo(), true); assert.equal(game.undo(), true);
  assert.deepEqual(restored.board, game.board);
  assert.deepEqual(restored.state.deductions, game.state.deductions);
  restored.fillAllNotes(); game.fillAllNotes();
  assert.deepEqual(restored.notes, game.notes);
});

test('replacing or removing a placed value clears proofs and undo restores their original anchors', () => {
  const { game, step } = beforeElimination(); game.applyLogicalStep(step);
  const proofCount = game.state.deductions.length;
  const placed = game.board.findIndex((value, index) => value && !game.puzzle[index]);
  assert.ok(placed >= 0); game.select(placed);
  assert.equal(game.erase(), true);
  assert.deepEqual(game.state.deductions, []);
  assert.equal(game.undo(), true);
  assert.equal(game.state.deductions.length, proofCount);
  game.select(placed);
  assert.equal(game.input(game.solution[placed] % 9 + 1), true);
  assert.deepEqual(game.state.deductions, []);
  assert.equal(game.undo(), true);
  assert.equal(game.state.deductions.length, proofCount);
});

test('corrupted and forged deductions are discarded and cannot remove a solution candidate', () => {
  const { game, step } = beforeElimination(); game.applyLogicalStep(step);
  const original = game.serialize();
  const target = game.board.indexOf(0);
  const corruptions = [
    saved => { saved.deductions = [{ board: saved.board, step: { technique: 'naked-pair', cells: [target], placements: [], eliminations: [{ index: target, digit: game.solution[target] }] } }]; },
    saved => { saved.deductions[0].step.eliminations.push({ index: target, digit: game.solution[target] }); },
    saved => { saved.deductions[0].step.cells = [80]; },
    saved => {
      const index = saved.deductions[0].board.findIndex(Boolean);
      saved.deductions[0].board[index] = game.solution[index] % 9 + 1;
    },
    saved => { saved.deductions[0].board[game.puzzle.findIndex(Boolean)] = 0; },
    saved => { saved.deductions = Array(129).fill(saved.deductions[0]); },
    saved => { saved.deductions = 'invalid'; },
  ];
  for (const corrupt of corruptions) {
    const saved = clone(original); corrupt(saved);
    const restored = create({ saved });
    assert.equal(restored.bankId, game.bankId);
    assert.deepEqual(restored.state.deductions, []);
    restored.fillAllNotes();
    assert.deepEqual(restored.notes, getAllCandidates(restored.board));
    for (let index = 0; index < 81; index += 1) if (!restored.board[index]) assert.ok(restored.notes[index].includes(restored.solution[index]));
  }
});

test('a proof with fewer anchored player values remains admissible when the rule still proves it', () => {
  const { game, step } = beforeElimination(); game.applyLogicalStep(step);
  const saved = game.serialize(), proof = saved.deductions[0];
  const removable = proof.board.findIndex((value, index) => {
    if (!value || game.puzzle[index]) return false;
    const weakened = proof.board.slice(); weakened[index] = 0;
    return validateStep(createLogicState(weakened), proof.step);
  });
  assert.ok(removable >= 0, 'fixture has an unrelated player value which the proof does not require');
  proof.board[removable] = 0;
  const restored = create({ saved });
  assert.equal(restored.state.deductions.length, 1);
  restored.fillAllNotes();
  for (let index = 0; index < 81; index++) if (!restored.board[index]) assert.ok(restored.notes[index].includes(restored.solution[index]));
});

test('restore rejects modified givens, bank mismatches, incompatible versions, and malformed fields atomically', () => {
  const game = create({ difficulty: 'hard' }); game.hint();
  const original = game.serialize();
  const given = game.puzzle.findIndex(Boolean);
  const corruptions = [
    saved => { saved.bankId = 'missing'; }, saved => { saved.difficulty = 'easy'; },
    saved => { saved.ratingVersion = 'future'; }, saved => { saved.schemaVersion = 1; },
    saved => { saved.board[given] = 0; }, saved => { saved.board[given] = game.solution[given] % 9 + 1; },
    saved => { saved.elapsed = -1; }, saved => { saved.hints = 0.5; }, saved => { saved.selected = 81; },
    saved => { saved.noteMode = 1; }, saved => { saved.paused = 'false'; }, saved => { saved.seed = '\ud800'; },
    saved => { saved.roundId = ''; }, saved => { saved.history = Array(101).fill({}); },
    saved => { saved.notes[game.board.indexOf(0)] = [1, 1]; },
    saved => { saved.history[0].board[given] = 0; }, saved => { saved.history[0].notes = []; },
  ];
  for (const corrupt of corruptions) {
    const saved = clone(original); corrupt(saved);
    assert.equal(game.restore(saved), false);
    assert.deepEqual(game.serialize(), original);
  }
  const fresh = create({ saved: { ...original, ratingVersion: 'incompatible' } });
  assert.equal(fresh.completed, false);
  assert.equal(fresh.history.length, 0);
  assert.deepEqual(fresh.board, selectPuzzle('rated-state-tests', 'easy').puzzle);
});

test('each rated round can finish using explained hints with the advertised highest technique tier', () => {
  for (const [tier, difficulty] of ['easy', 'medium', 'hard', 'expert'].entries()) {
    const game = create({ difficulty });
    const independent = analyze(game.puzzle, { trace: true });
    assert.equal(independent.maxTier, tier);
    let highest = 0;
    for (let guard = 0; guard < 200 && !game.completed; guard += 1) {
      const hint = game.hint();
      assert.ok(hint, difficulty); highest = Math.max(highest, hint.step.tier);
    }
    assert.equal(game.completed, true);
    assert.equal(highest, tier);
    assert.deepEqual(game.board, game.solution);
    assert.equal(game.nextLogicalStep(), null);
    assert.equal(game.hint(), null);
    assert.equal(game.fillAllNotes(), false);
    const restored = create({ saved: game.serialize() });
    assert.equal(restored.completed, true);
    assert.equal(restored.paused, false);
  }
});
