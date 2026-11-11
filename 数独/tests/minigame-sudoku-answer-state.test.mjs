import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { SudokuGame } = require('../../微信小程序/src/games/sudoku/state.js');
const { RatedSudokuGame } = require('../../微信小程序/src/games/sudoku/rated-state.js');
const { getAllCandidates } = require('../../微信小程序/src/games/sudoku/core/engine.js');
const copy = value => structuredClone(value);
const create = (Model, options = {}) => new Model({ seed: 'answer-state-tests', now: () => 1792252800000, ...options });
function wrongCell(game) {
  const candidates = getAllCandidates(game.board);
  const index = game.board.findIndex((value, at) => !value && candidates[at].some(digit => digit !== game.solution[at]));
  assert.ok(index >= 0, 'fixture has a plausible incorrect digit without a direct house conflict');
  return { index, wrong: candidates[index].find(digit => digit !== game.solution[index]), correct: game.solution[index] };
}
function finish(game, except = -1) {
  for (let i = 0; i < 81; i++) if (!game.puzzle[i] && i !== except) {
    game.select(i); game.input(game.solution[i]);
  }
}
for (const Model of [SudokuGame, RatedSudokuGame]) {
  test(Model.name + ': answer viewing changes only its independent assistance flag', () => {
    const game = create(Model);
    const index = game.board.indexOf(0);
    game.select(index); game.input(game.solution[index]); game.toggleNotes(); game.tick(1250);
    const before = game.serialize();
    assert.equal(game.answerViewed, false);
    assert.equal(game.markAnswerViewed(), true);
    assert.equal(game.answerViewed, true);
    assert.deepEqual({ ...game.serialize(), answerViewed: before.answerViewed }, before);
    const viewed = game.serialize();
    assert.equal(game.markAnswerViewed(), false);
    assert.deepEqual(game.serialize(), viewed);
    assert.equal(game.undo(), true);
    assert.equal(game.board[index], 0);
    assert.equal(game.answerViewed, true, 'undo cannot erase exposure to the solution');
    assert.equal(game.hints, before.hints);
    assert.equal(game.elapsed, before.elapsed);
  });

  test(Model.name + ': answer viewing survives pause, cold restoration and later undo', () => {
    const game = create(Model);
    const { index, wrong } = wrongCell(game);
    game.select(index); game.input(wrong); game.markAnswerViewed(); game.setPaused(true);
    const saved = game.serialize();
    const restored = create(Model, { saved });
    assert.equal(restored.roundId, game.roundId);
    assert.equal(restored.paused, true);
    assert.equal(restored.answerViewed, true);
    assert.deepEqual(restored.serialize(), saved);
    restored.setPaused(false);
    assert.equal(restored.undo(), true);
    assert.equal(restored.answerViewed, true);
    assert.equal(restored.board[index], 0);
    assert.equal(create(Model, { saved: restored.serialize() }).answerViewed, true);
    assert.equal(restored.restart(), true);
    assert.equal(restored.answerViewed, false, 'a deliberately restarted new round has fresh metadata');
  });

  test(Model.name + ': old saves default to unviewed and malformed flags reject without mutation', () => {
    const game = create(Model);
    const oldSave = copy(game.serialize());
    delete oldSave.answerViewed;
    const restored = create(Model, { saved: oldSave });
    assert.equal(restored.roundId, game.roundId);
    assert.equal(restored.answerViewed, false);
    assert.equal(restored.serialize().schemaVersion, oldSave.schemaVersion);
    const before = restored.serialize();
    for (const value of [null, 0, 1, 'true', [], {}]) {
      assert.equal(restored.restore({ ...copy(oldSave), answerViewed: value }), false);
      assert.deepEqual(restored.serialize(), before);
    }
    assert.equal(restored.restore({ ...copy(oldSave), answerViewed: false }), true);
    assert.equal(restored.answerViewed, false);
    assert.equal(restored.restore({ ...copy(oldSave), answerViewed: true }), true);
    assert.equal(restored.answerViewed, true);
  });

  test(Model.name + ': viewing after an independently completed round does not alter that round', () => {
    const game = create(Model);
    finish(game);
    assert.equal(game.completed, true);
    const before = game.serialize();
    assert.equal(game.markAnswerViewed(), false);
    assert.equal(game.answerViewed, false);
    assert.deepEqual(game.serialize(), before);
  });

  test(Model.name + ': correction repairs a plausible wrong value as one undoable hint even in note mode', () => {
    const game = create(Model);
    const { index, wrong, correct } = wrongCell(game);
    game.select(index); game.input(wrong); game.toggleNotes(); game.tick(3200);
    const before = game.serialize();
    assert.equal(game.applyCorrectionHint(index), true);
    assert.equal(game.board[index], correct);
    assert.equal(game.selected, index);
    assert.equal(game.noteMode, true, 'correcting a digit never enters it as a pencil mark');
    assert.equal(game.hints, before.hints + 1);
    assert.equal(game.elapsed, before.elapsed);
    assert.equal(game.history.length, before.history.length + 1);
    assert.equal(game.undo(), true);
    assert.deepEqual(game.board, before.board);
    assert.deepEqual(game.notes, before.notes);
    assert.equal(game.selected, before.selected);
    assert.equal(game.noteMode, before.noteMode);
    assert.equal(game.hints, before.hints + 1, 'undo does not turn an assisted round into an unassisted one');
  });

  test(Model.name + ': correction rejects givens, empty/correct cells and paused rounds without side effects', () => {
    const game = create(Model);
    const empty = game.board.indexOf(0), given = game.puzzle.findIndex(Boolean);
    const before = game.serialize();
    for (const index of [-1, 81, 0.5, null, undefined, '0', empty, given]) {
      assert.equal(game.applyCorrectionHint(index), false);
      assert.deepEqual(game.serialize(), before);
    }
    game.select(empty); game.input(game.solution[empty]);
    const correct = game.serialize();
    assert.equal(game.applyCorrectionHint(empty), false);
    assert.deepEqual(game.serialize(), correct);
    const { index, wrong } = wrongCell(game);
    game.select(index); game.input(wrong); game.setPaused(true);
    const paused = game.serialize();
    assert.equal(game.applyCorrectionHint(index), false);
    assert.deepEqual(game.serialize(), paused);
    game.setPaused(false);
    assert.equal(game.applyCorrectionHint(index), true);
  });

  test(Model.name + ': correction updates generated and backup peer notes, and undo restores both', () => {
    const game = create(Model);
    const { index, wrong, correct } = wrongCell(game);
    const peer = game.board.findIndex((value, other) => !value && other !== index && Math.floor(other / 9) === Math.floor(index / 9));
    assert.ok(peer >= 0);
    game.toggleNotes(); game.select(peer); game.input(correct); game.toggleNotes();
    game.select(index); game.input(wrong);
    assert.equal(game.notes[peer].includes(correct), true);
    game.toggleFillAllNotes();
    assert.equal(game.state.notesBeforeFill[peer].includes(correct), true);
    game.toggleNotes();
    const before = game.serialize();
    assert.equal(game.applyCorrectionHint(index), true);
    assert.equal(game.fillNotesActive, true);
    assert.equal(game.noteMode, true);
    assert.equal(game.notes[index].length, 0);
    assert.equal(game.state.notesBeforeFill[index].length, 0);
    assert.equal(game.notes[peer].includes(correct), false);
    assert.equal(game.state.notesBeforeFill[peer].includes(correct), false);
    assert.equal(game.undo(), true);
    assert.deepEqual(game.board, before.board);
    assert.deepEqual(game.notes, before.notes);
    assert.deepEqual(game.state.notesBeforeFill, before.notesBeforeFill);
    assert.equal(game.fillNotesActive, before.fillNotesActive);
  });

  test(Model.name + ': correcting the final wrong entry completes a valid board and remains undoable', () => {
    const game = create(Model);
    const { index, wrong, correct } = wrongCell(game);
    finish(game, index); game.select(index); game.input(wrong);
    assert.equal(game.completed, false);
    assert.equal(game.applyCorrectionHint(index), true);
    assert.equal(game.completed, true);
    assert.equal(game.board[index], correct);
    const before = game.serialize();
    assert.equal(game.applyCorrectionHint(index), false);
    assert.deepEqual(game.serialize(), before);
    assert.equal(game.undo(), true);
    assert.equal(game.completed, false);
    assert.equal(game.board[index], wrong);
    assert.equal(game.hints, 1);
  });
}

test('rated correction clears invalid deductions while both undo steps recover their own proof state', () => {
  const game = create(RatedSudokuGame, { seed: 'notes-toggle-tests', difficulty: 'expert' });
  let found = false;
  for (let guard = 0; guard < 150; guard++) {
    const step = game.nextLogicalStep();
    assert.ok(step, 'expert fixture reaches a genuine elimination');
    assert.equal(game.applyLogicalStep(step), true);
    if (step.eliminations.length) { found = true; break; }
  }
  assert.equal(found, true);
  const proofs = copy(game.state.deductions), next = game.nextLogicalStep();
  assert.ok(proofs.length);
  const { index, wrong } = wrongCell(game);
  const original = game.board.slice();
  game.select(index); game.input(wrong);
  assert.deepEqual(game.state.deductions, []);
  assert.equal(game.nextLogicalStep(), null);
  assert.equal(game.applyCorrectionHint(index), true);
  assert.deepEqual(game.state.deductions, []);
  assert.ok(game.nextLogicalStep(), 'logical hints resume after removing the incorrect value');
  const restored = create(RatedSudokuGame, { saved: game.serialize() });
  assert.deepEqual(restored.state.deductions, []);
  assert.deepEqual(restored.nextLogicalStep(), game.nextLogicalStep());
  assert.equal(game.undo(), true);
  assert.equal(game.board[index], wrong);
  assert.deepEqual(game.state.deductions, []);
  assert.equal(game.undo(), true);
  assert.deepEqual(game.board, original);
  assert.deepEqual(game.state.deductions, proofs);
  assert.deepEqual(game.nextLogicalStep(), next);
});
