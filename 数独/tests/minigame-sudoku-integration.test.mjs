import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createSudokuGame, sharedRound } = require('../../微信小程序/src/games/sudoku/index.js');
const { SudokuGame } = require('../../微信小程序/src/games/sudoku/state.js');
const { RatedSudokuGame } = require('../../微信小程序/src/games/sudoku/rated-state.js');
const { findSteps, createLogicState } = require('../../微信小程序/src/games/sudoku/logic.js');
const SAVE_KEY = 'games-between:sudoku:v1';
const TRAINING_KEY = 'games-between:sudoku:training:v1';
const NOW = Date.parse('2026-10-17T16:00:00Z');

function fixture(initial = []) {
  const storage = new Map(initial.map(([key, value]) => [key, structuredClone(value)])), modals = [], toasts = [];
  const game = createSudokuGame({ now: () => NOW, read: key => structuredClone(storage.get(key)),
    write(key, value) { storage.set(key, structuredClone(value)); return true; },
    services: { storageAvailable: true, modal: (config, confirm) => modals.push({ config, confirm }), toast: value => toasts.push(value), invalidate() {} } });
  game.resize({ width: 390, height: 844, safeTop: 44, safeBottom: 34, capsuleRect: { bottom: 82 } });
  const ctx = new Proxy({ measureText: value => ({ width: Array.from(String(value)).length * 8 }) }, { get: (object, key) => key in object ? object[key] : () => {} });
  return { game, storage, modals, toasts, targets: () => game.render(ctx) };
}
function click(f, action, choose = () => true) {
  const target = f.targets().find(item => item.action === `sudoku:${action}` && choose(item.payload, item));
  assert.ok(target, `a rendered ${action} target must exist`);
  assert.ok(target.label && target.w > 0 && target.h > 0);
  assert.equal(f.game.activate(target.action, target.payload), true);
  return target;
}
function open(f, id = 'naked-pair', mode = 'independent') {
  f.game.enter({}, { source: 'hub' });
  click(f, 'mode', value => value === 'training');
  const page = Math.floor(f.game.training.lessons.findIndex(item => item.id === id) / 4);
  for (let i = 0; i < page; i++) click(f, 'coursePage', value => value === 1);
  click(f, 'lesson', value => value === id);
  click(f, 'practice', value => value.id === id && value.mode === mode);
}
function solve(f, step = f.game.training.training.step) {
  click(f, 'trainingMode', value => value === 'support');
  for (const index of step.cells) click(f, 'trainingCell', value => value === index);
  if (step.placements.length) {
    click(f, 'trainingMode', value => value === 'place');
    const placement = step.placements[0];
    click(f, 'trainingCell', value => value === placement.index);
    click(f, 'trainingDigit', value => value === placement.value);
  } else {
    click(f, 'trainingMode', value => value === 'eliminate');
    const elimination = step.eliminations[0];
    click(f, 'trainingCell', value => value === elimination.index);
    click(f, 'trainingCandidate', value => value.index === elimination.index && value.digit === elimination.digit);
  }
  click(f, 'trainingCheck');
}

test('fresh ordinary games use the rated bank and entering a real classroom target preserves their board and time', () => {
  const f = fixture(); f.game.enter({}, { source: 'hub' });
  assert.ok(f.game.model instanceof RatedSudokuGame);
  f.game.tick(1500);
  const index = f.game.model.board.indexOf(0);
  f.game.activate('sudoku:select', index); f.game.activate('sudoku:digit', f.game.model.solution[index]);
  const board = f.game.model.board.slice(), roundId = f.game.model.roundId;
  click(f, 'mode', value => value === 'training');
  assert.equal(f.game.section, 'training'); assert.equal(f.game.model.paused, true);
  f.game.tick(60000);
  assert.equal(f.game.model.elapsed, 1500);
  assert.equal(f.game.model.roundId, roundId);
  assert.deepEqual(f.game.model.board, board);
  assert.ok(f.storage.has(TRAINING_KEY));
  assert.equal(f.game.training.screen, 'catalog');
  click(f, 'trainingBack');
  assert.equal(f.game.section, 'play');
  assert.equal(f.game.model.paused, true, 'returning from a course does not silently restart the clock');
  assert.deepEqual(f.game.model.board, board);
});

test('rendered catalog, lesson and exercise controls can complete an independent training step', () => {
  const f = fixture(); open(f);
  assert.equal(f.game.training.screen, 'exercise');
  assert.ok(f.targets().every(item => item.action.startsWith('sudoku:')));
  const initial = f.game.model.board.slice(), source = f.game.training.training.board.slice();
  solve(f);
  assert.equal(f.game.training.training.completed, true);
  assert.deepEqual(f.game.training.progress['naked-pair'], { solved: 1, independent: 1 });
  assert.deepEqual(f.game.model.board, initial);
  assert.deepEqual(f.game.training.training.board, source);
  assert.ok(f.targets().some(item => item.action === 'sudoku:trainingNext'));
  click(f, 'trainingNext');
  assert.equal(f.game.training.training.completed, false);
  assert.deepEqual(f.game.training.training.selectedCells, []);
});

test('three levels of hints reveal complete reasoning in a modal and do not count as independent success', () => {
  const f = fixture(); open(f, 'x-wing');
  for (let level = 1; level <= 3; level++) {
    click(f, 'trainingHint');
    assert.equal(f.game.training.training.hintLevel, level);
    assert.equal(f.modals.length, level === 3 ? 1 : 0);
  }
  assert.equal(f.modals[0].config.content, f.game.training.training.step.explanation);
  assert.ok(f.modals[0].config.content.length > 20);
  const snapshot = structuredClone(f.game.training.training);
  f.modals[0].confirm();
  assert.deepEqual(f.game.training.training, snapshot, 'reading reasoning does not apply or submit the step');
  click(f, 'trainingExplanation');
  assert.equal(f.modals.at(-1).config.content, snapshot.step.explanation);
  solve(f);
  assert.deepEqual(f.game.training.progress['x-wing'], { solved: 1, independent: 0 });
});

test('training accepts a different legal structure rather than only the stored example answer', () => {
  const f = fixture(); open(f, 'pointing');
  const training = f.game.training.training;
  const alternative = findSteps(createLogicState(training.board, training.candidates), { techniqueId: 'pointing' })
    .find(step => step.cells.join(',') !== training.step.cells.join(','));
  assert.ok(alternative, 'the fixture must have a second legal structure');
  solve(f, alternative);
  assert.equal(f.game.training.training.completed, true);
  assert.deepEqual(f.game.training.progress.pointing, { solved: 1, independent: 1 });
});

test('classroom drafts reopen from their own save without replacing ordinary game progress', () => {
  const f = fixture(); open(f, 'hidden-single');
  const step = f.game.training.training.step;
  click(f, 'trainingCell', value => value === step.cells[0]);
  click(f, 'trainingMode', value => value === 'place');
  click(f, 'trainingCell', value => value === step.placements[0].index);
  click(f, 'trainingDigit', value => value === step.placements[0].value);
  const draft = structuredClone(f.game.training.submission()), ordinary = structuredClone(f.storage.get(SAVE_KEY));
  const reloaded = fixture([...f.storage]);
  reloaded.game.enter({}, { source: 'hub' });
  click(reloaded, 'mode', value => value === 'training');
  assert.equal(reloaded.game.training.screen, 'exercise');
  assert.deepEqual(reloaded.game.training.submission(), draft);
  assert.deepEqual(reloaded.game.model.serialize(), ordinary);
  click(reloaded, 'trainingCheck');
  assert.equal(reloaded.game.training.training.completed, true);
});

test('v2 shares restore the exact bank id while original seed links and saves remain legacy puzzles', () => {
  const sender = fixture(); sender.game.enter({}, { source: 'hub' });
  sender.game.activate('sudoku:difficulty', 'hard');
  const query = Object.fromEntries(new URLSearchParams(sender.game.sharePayload().query));
  assert.equal(query.v, '2'); assert.equal(query.b, sender.game.model.bankId);
  assert.equal(sharedRound(query).bankId, query.b);
  const receiver = fixture(); receiver.game.enter(query, { source: 'launch' });
  assert.ok(receiver.game.model instanceof RatedSudokuGame);
  assert.equal(receiver.game.model.bankId, sender.game.model.bankId);
  assert.deepEqual(receiver.game.model.puzzle, sender.game.model.puzzle);
  assert.equal(sharedRound({ ...query, b: 'absent' }), null);
  assert.equal(sharedRound({ ...query, d: 'easy' }), null);
  assert.equal(sharedRound({ ...query, v: '9000' }), null);
  const oldQuery = { g: 'sudoku', p: 'legacy-朋友', d: 'expert', m: 'classic' };
  const old = fixture(); old.game.enter(oldQuery, { source: 'launch' });
  const expected = new SudokuGame({ now: () => NOW, seed: oldQuery.p, difficulty: oldQuery.d, mode: oldQuery.m });
  assert.ok(old.game.model instanceof SudokuGame);
  assert.equal(old.game.model.ratingVersion, undefined);
  assert.deepEqual(old.game.model.puzzle, expected.puzzle);
  const resumed = fixture([...old.storage]); resumed.game.enter({}, { source: 'hub' });
  assert.equal(resumed.game.model.ratingVersion, undefined);
  assert.deepEqual(resumed.game.model.serialize(), old.game.model.serialize());
  assert.equal(new URLSearchParams(resumed.game.sharePayload().query).has('v'), false);
});

test('stale hint and replacement confirmations cannot change a new round or interrupt a classroom', () => {
  const fresh = fixture(); fresh.game.enter({}, { source: 'hub' });
  fresh.game.activate('sudoku:hint');
  const oldHint = fresh.modals.at(-1);
  fresh.game.activate('sudoku:newGame');
  const replacement = structuredClone(fresh.game.model.serialize());
  oldHint.confirm();
  assert.deepEqual(fresh.game.model.serialize(), replacement);

  const classroom = fixture(); classroom.game.enter({}, { source: 'hub' });
  const index = classroom.game.model.board.indexOf(0);
  classroom.game.activate('sudoku:select', index);
  classroom.game.activate('sudoku:digit', classroom.game.model.solution[index]);
  classroom.game.activate('sudoku:newGame');
  const oldReplacement = classroom.modals.at(-1), round = classroom.game.model.roundId;
  click(classroom, 'mode', value => value === 'training');
  click(classroom, 'lesson', value => value === 'naked-single');
  const course = structuredClone(classroom.game.training.serialize());
  oldReplacement.confirm();
  assert.equal(classroom.game.section, 'training');
  assert.equal(classroom.game.model.roundId, round);
  assert.deepEqual(classroom.game.training.serialize(), course);
});

test('foundation lessons expose their own explanation and share the tutorial entrance', () => {
  const f = fixture(); f.game.enter({}, { source: 'hub' });
  click(f, 'mode', value => value === 'training'); click(f, 'foundationBasics');
  assert.match(f.game.statusText, /基础入门.*先认识棋盘/);
  click(f, 'foundationExplanation');
  assert.match(f.modals.at(-1).config.content, /9 行.*9 列/);
  const query = Object.fromEntries(new URLSearchParams(f.game.sharePayload().query));
  assert.equal(query.learn, 'basics');
  const receiver = fixture(); receiver.game.enter(query, { source: 'launch' });
  assert.equal(receiver.game.training.screen, 'foundation');
});

test('mixed sharing retains a blind practice entrance while recognition sharing retains the trusted claim', () => {
  const f = fixture(); open(f, 'pointing'); click(f, 'trainingBack'); click(f, 'trainingBack');
  click(f, 'trainingMixed');
  assert.match(f.game.statusText, /混合练习/);
  assert.equal(f.game.statusText.includes('指向'), false);
  const mixed = Object.fromEntries(new URLSearchParams(f.game.sharePayload().query));
  assert.equal(mixed.learn, 'mixed');
  const receiver = fixture(); receiver.game.enter(mixed, { source: 'launch' });
  assert.equal(receiver.game.training.training.hideTechnique, true);
  f.game.activate('trainingBack');
  assert.equal(f.game.activate('lesson', 'pointing'), true);
  assert.equal(f.game.activate('trainingRecognize'), true);
  const query = Object.fromEntries(new URLSearchParams(f.game.sharePayload().query));
  assert.equal(query.rc, f.game.training.training.id);
  const recognition = fixture(); recognition.game.enter(query, { source: 'launch' });
  assert.equal(recognition.game.training.training.sessionMode, 'recognize');
  assert.equal(recognition.game.training.training.id, f.game.training.training.id);
  assert.deepEqual(recognition.game.training.training.claimStep, f.game.training.training.claimStep);
});

test('an ordinary share of the current puzzle exits class without resetting the round', () => {
  const f = fixture(); f.game.enter({}, { source: 'hub' });
  const round = f.game.model.roundId, query = Object.fromEntries(new URLSearchParams(f.game.sharePayload().query));
  click(f, 'mode', value => value === 'training');
  f.game.enter(query, { source: 'show' });
  assert.equal(f.game.section, 'play');
  assert.equal(f.game.model.roundId, round);
});
