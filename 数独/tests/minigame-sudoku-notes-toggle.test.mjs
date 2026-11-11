import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { SudokuGame } = require('../../微信小程序/src/games/sudoku/state.js');
const { RatedSudokuGame } = require('../../微信小程序/src/games/sudoku/rated-state.js');
const { getAllCandidates } = require('../../微信小程序/src/games/sudoku/core/engine.js');
const copy = value => structuredClone(value);
const blankNotes = () => Array.from({ length: 81 }, () => []);
const create = (Model, options = {}) => new Model({ seed: 'notes-toggle-tests', now: () => 1792252800000, ...options });
const removeToggleMetadata = saved => {
  for (const snapshot of [saved, ...saved.history]) {
    delete snapshot.fillNotesActive;
    delete snapshot.notesBeforeFill;
  }
  return saved;
};

for (const Model of [SudokuGame, RatedSudokuGame]) {
  const name = Model.name;

  test(`${name}: filling and cancelling preserve manual notes and each undo restores one toggle`, () => {
    const game = create(Model);
    const index = game.board.indexOf(0);
    game.select(index); game.toggleNotes(); game.input(game.solution[index]);
    const before = game.serialize();
    const manual = copy(game.notes);
    assert.equal(game.fillNotesActive, false);
    assert.equal(game.toggleFillAllNotes(), true);
    assert.equal(game.fillNotesActive, true);
    assert.deepEqual(game.notes, getAllCandidates(game.board));
    assert.equal(game.history.length, before.history.length + 1);
    const filled = game.serialize();
    assert.equal(game.toggleFillAllNotes(), true);
    assert.equal(game.fillNotesActive, false);
    assert.deepEqual(game.notes, manual);
    assert.deepEqual(game.board, before.board);
    assert.equal(game.history.length, before.history.length + 2);
    assert.equal(game.undo(), true);
    assert.deepEqual(game.serialize(), filled);
    assert.equal(game.undo(), true);
    assert.deepEqual(game.serialize(), before);
  });

  test(`${name}: cancellation keeps later digits and cleans the restored manual peer marks`, () => {
    const game = create(Model);
    const candidates = getAllCandidates(game.board);
    const index = game.board.findIndex((value, at) => !value && candidates.some((list, other) =>
      !game.board[other] && other !== at && Math.floor(other / 9) === Math.floor(at / 9) && list.includes(game.solution[at])));
    assert.ok(index >= 0);
    const peer = game.board.findIndex((value, other) => !value && other !== index &&
      Math.floor(other / 9) === Math.floor(index / 9) && candidates[other].includes(game.solution[index]));
    game.toggleNotes();
    game.select(peer); game.input(game.solution[index]);
    game.select(index); game.input(game.solution[index]);
    game.toggleNotes(); game.toggleFillAllNotes();
    assert.equal(game.input(game.solution[index]), true);
    const currentBoard = game.board.slice();
    assert.equal(game.toggleFillAllNotes(), true);
    assert.deepEqual(game.board, currentBoard);
    assert.equal(game.notes[index].length, 0);
    assert.equal(game.notes[peer].includes(game.solution[index]), false);
    assert.deepEqual(game.notes, blankNotes());
    assert.equal(game.undo(), true);
    assert.deepEqual(game.board, currentBoard);
    assert.equal(game.fillNotesActive, true);
  });

  test(`${name}: cancellation preserves an original manual mistake when no board action changed it`, () => {
    const game = create(Model, { seed: 'review-note-backup' });
    const candidates = getAllCandidates(game.board);
    const index = game.board.findIndex((value, at) => !value && candidates[at].length < 9);
    const digit = Array.from({ length: 9 }, (_, at) => at + 1).find(value => !candidates[index].includes(value));
    game.select(index); game.toggleNotes(); game.input(digit);
    const manual = copy(game.notes);
    game.toggleFillAllNotes();
    assert.equal(game.notes[index].includes(digit), false);
    game.toggleFillAllNotes();
    assert.deepEqual(game.notes, manual);
  });

  test(`${name}: manual edits during full notes survive cancellation without retaining all generated marks`, () => {
    const game = create(Model);
    const candidates = getAllCandidates(game.board);
    const index = candidates.findIndex(list => list.length >= 2);
    const [first, second] = candidates[index];
    game.select(index); game.toggleNotes(); game.input(first);
    game.toggleFillAllNotes();
    game.input(first); // Explicitly remove the original manual mark.
    game.input(second); game.input(second); // Explicitly re-add this generated mark.
    assert.equal(game.toggleFillAllNotes(), true);
    assert.deepEqual(game.notes[index], [second]);
    assert.ok(game.notes.every((list, at) => at === index || list.length === 0));
    game.toggleFillAllNotes();
    assert.equal(game.erase(), true);
    game.toggleFillAllNotes();
    assert.deepEqual(game.notes, blankNotes());
  });

  test(`${name}: active toggle and backup survive pause, storage and cancellation undo without aliases`, () => {
    const game = create(Model);
    game.select(game.board.indexOf(0)); game.toggleNotes(); game.input(game.solution[game.selected]);
    const manual = copy(game.notes);
    game.toggleFillAllNotes(); game.setPaused(true);
    const saved = game.serialize();
    const restored = create(Model, { saved });
    assert.equal(restored.fillNotesActive, true);
    assert.equal(restored.paused, true);
    assert.equal(restored.toggleFillAllNotes(), false);
    assert.deepEqual(restored.serialize(), saved);
    saved.notesBeforeFill[game.selected] = [];
    assert.deepEqual(restored.state.notesBeforeFill, manual);
    restored.setPaused(false); restored.toggleFillAllNotes();
    assert.deepEqual(restored.notes, manual);
    const cancelled = create(Model, { saved: restored.serialize() });
    assert.equal(cancelled.fillNotesActive, false);
    assert.equal(cancelled.undo(), true);
    assert.equal(cancelled.fillNotesActive, true);
    assert.deepEqual(cancelled.notes, game.notes);
  });

  test(`${name}: legacy full notes can be cancelled immediately while partial manual notes remain manual`, () => {
    const filled = create(Model);
    filled.fillAllNotes();
    const oldFull = removeToggleMetadata(filled.serialize());
    const restored = create(Model, { saved: oldFull });
    assert.equal(restored.fillNotesActive, true);
    assert.equal(restored.toggleFillAllNotes(), true);
    assert.deepEqual(restored.notes, blankNotes());
    assert.equal(restored.undo(), true);
    assert.equal(restored.fillNotesActive, true);
    assert.deepEqual(restored.notes, filled.notes);

    const partial = create(Model);
    partial.toggleNotes(); partial.input(partial.solution[partial.selected]);
    const oldPartial = removeToggleMetadata(partial.serialize());
    const manual = create(Model, { saved: oldPartial });
    assert.equal(manual.fillNotesActive, false);
    assert.deepEqual(manual.notes, partial.notes);
    manual.toggleFillAllNotes(); manual.toggleFillAllNotes();
    assert.deepEqual(manual.notes, partial.notes);
  });

  test(`${name}: malformed active backups are rejected in current saves and undo history`, () => {
    const game = create(Model);
    game.toggleFillAllNotes(); game.toggleFillAllNotes();
    const before = game.serialize();
    const given = game.puzzle.findIndex(Boolean);
    const index = game.board.indexOf(0);
    for (const corrupt of [
      saved => { saved.fillNotesActive = 'true'; },
      saved => { saved.fillNotesActive = true; saved.notesBeforeFill = []; },
      saved => { saved.fillNotesActive = true; saved.notesBeforeFill = blankNotes(); saved.notesBeforeFill[given] = [1]; },
      saved => { saved.history[1].notesBeforeFill[index] = [1, 1]; },
      saved => { saved.history[1].notesBeforeFill[index] = [0]; },
      saved => { saved.history[1].notesBeforeFill = Array(81); },
      saved => { saved.history[0].fillNotesActive = false; saved.history[0].notesBeforeFill = blankNotes(); },
    ]) {
      const malformed = copy(before); corrupt(malformed);
      assert.equal(game.restore(malformed), false, corrupt.toString());
      assert.deepEqual(game.serialize(), before);
    }
  });
}

function beforeElimination() {
  const game = create(RatedSudokuGame, { difficulty: 'expert' });
  for (let guard = 0; guard < 150; guard += 1) {
    const step = game.nextLogicalStep();
    assert.ok(step);
    if (step.eliminations.length) return { game, step };
    game.applyLogicalStep(step);
  }
  assert.fail('expert fixture must reach a logical elimination');
}

test('rated placement and elimination hints preserve unrelated original manual mistakes', () => {
  for (const elimination of [false, true]) {
    const { game, step } = elimination ? beforeElimination() : (() => {
      const game = create(RatedSudokuGame);
      return { game, step: game.nextLogicalStep() };
    })();
    const candidates = getAllCandidates(game.board);
    const sameHouse = (a, b) => Math.floor(a / 9) === Math.floor(b / 9) || a % 9 === b % 9 ||
      (Math.floor(a / 27) === Math.floor(b / 27) && Math.floor(a % 9 / 3) === Math.floor(b % 9 / 3));
    let mark = null;
    for (let index = 0; index < 81 && !mark; index += 1) if (!game.board[index]) {
      for (let digit = 1; digit <= 9; digit += 1) if (!candidates[index].includes(digit) &&
        !step.placements.some(item => item.index === index || (sameHouse(item.index, index) && item.value === digit)) &&
        !step.eliminations.some(item => item.index === index && item.digit === digit)) {
        mark = { index, digit }; break;
      }
    }
    assert.ok(mark);
    game.state.notes = blankNotes();
    game.select(mark.index); game.toggleNotes(); game.input(mark.digit);
    game.toggleFillAllNotes();
    assert.equal(game.applyLogicalStep(step), true);
    assert.equal(game.state.notesBeforeFill[mark.index].includes(mark.digit), true);
    game.toggleFillAllNotes();
    assert.deepEqual(game.notes[mark.index], [mark.digit]);
    const expected = blankNotes(); expected[mark.index] = [mark.digit];
    assert.deepEqual(game.notes, expected);
  }
});

test('rated logical eliminations remain proved after cancelling and cannot restore an excluded manual note', () => {
  const { game, step } = beforeElimination();
  const { index, digit } = step.eliminations[0];
  // Logical hints already filled notes; record just one manual note before the switch.
  game.state.notes = blankNotes();
  game.select(index); game.toggleNotes(); game.input(digit);
  game.toggleFillAllNotes();
  assert.equal(game.notes[index].includes(digit), true);
  assert.equal(game.applyLogicalStep(step), true);
  assert.equal(game.notes[index].includes(digit), false);
  const proofs = copy(game.state.deductions);
  const next = game.nextLogicalStep();
  const restored = create(RatedSudokuGame, { saved: game.serialize() });
  assert.equal(restored.toggleFillAllNotes(), true);
  assert.equal(restored.fillNotesActive, false);
  assert.deepEqual(restored.notes, blankNotes());
  assert.deepEqual(restored.state.deductions, proofs);
  assert.deepEqual(restored.nextLogicalStep(), next);
  assert.equal(restored.undo(), true);
  assert.equal(restored.fillNotesActive, true);
  assert.deepEqual(restored.state.deductions, proofs);
  assert.equal(restored.notes[index].includes(digit), false);
  restored.toggleFillAllNotes(); restored.toggleFillAllNotes();
  assert.equal(restored.notes[index].includes(digit), false);
});

test('legacy rated full notes infer the active switch from verified deductions rather than raw candidates', () => {
  const { game, step } = beforeElimination();
  game.applyLogicalStep(step);
  const old = removeToggleMetadata(game.serialize());
  const restored = create(RatedSudokuGame, { saved: old });
  assert.equal(restored.fillNotesActive, true);
  restored.toggleFillAllNotes();
  assert.deepEqual(restored.notes, blankNotes());
  assert.deepEqual(restored.state.deductions, game.state.deductions);
  restored.toggleFillAllNotes();
  for (const { index, digit } of step.eliminations) assert.equal(restored.notes[index].includes(digit), false);
});
