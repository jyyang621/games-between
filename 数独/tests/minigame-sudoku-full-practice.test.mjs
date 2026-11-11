import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createSudokuGame, sharedRound } = require('../../微信小程序/src/games/sudoku/index.js');
const { TECHNIQUES } = require('../../微信小程序/src/games/sudoku/logic.js');
const { getPuzzlesByTechnique } = require('../../微信小程序/src/games/sudoku/bank.js');
const SAVE = 'games-between:sudoku:v1';
const TRAINING = 'games-between:sudoku:training:v1';
const PRACTICE = 'games-between:sudoku:full-practice:v1';
const NOW = Date.parse('2026-10-18T08:00:00Z');

function fixture(initial = []) {
  const storage = new Map(initial.map(([k, v]) => [k, structuredClone(v)]));
  const modals = [], sheets = [];
  const game = createSudokuGame({ now: () => NOW, read: key => structuredClone(storage.get(key)),
    write(key, value) { storage.set(key, structuredClone(value)); return true; },
    services: { invalidate() {}, toast() {}, modal(config, confirm) { modals.push({ config, confirm }); }, actionSheet(config) { sheets.push(config); } } });
  game.resize({ width: 320, height: 568, safeTop: 44, safeBottom: 24, capsuleRect: { bottom: 82 } });
  game.enter({}, { source: 'hub' });
  const ctx = new Proxy({ measureText: value => ({ width: String(value).length * 7 }) }, { get: (o, k) => k in o ? o[k] : () => {} });
  return { game, storage, modals, sheets, targets: () => game.render(ctx) };
}
function classroom(f, id = 'naked-pair') {
  assert.equal(f.game.activate('mode', 'training'), true);
  assert.equal(f.game.activate('lesson', id), true);
}
function finish(f) {
  for (let index = 0; index < 81; index++) if (!f.game.model.board[index]) {
    f.game.activate('select', index);
    assert.equal(f.game.activate('digit', f.game.model.solution[index]), true);
  }
  assert.equal(f.game.model.completed, true);
}

test('whole-puzzle training preserves the ordinary round and resumes its own progress', () => {
  const f = fixture(), ordinary = f.game.model;
  const i = ordinary.board.indexOf(0);
  f.game.activate('select', i); f.game.activate('digit', ordinary.solution[i]);
  const ordinaryBoard = ordinary.board.slice(), ordinaryRound = ordinary.roundId;
  classroom(f);
  assert.equal(f.game.activate('trainingFullPuzzle'), true);
  assert.equal(f.game.practiceLessonId, 'naked-pair');
  assert.ok(f.game.model.ratingProfile.techniqueCounts['naked-pair'] > 0);
  const round = f.game.model.roundId, first = f.game.model.board.indexOf(0);
  f.game.activate('select', first); f.game.activate('digit', f.game.model.solution[first]);
  const practiceBoard = f.game.model.board.slice();
  assert.deepEqual(f.storage.get(SAVE).board, ordinaryBoard);
  assert.equal(f.storage.get(PRACTICE).rounds['naked-pair'].roundId, round);
  assert.ok(f.targets().some(t => t.action === 'sudoku:mode' && t.label === '返回课堂'));
  assert.equal(f.targets().some(t => t.action === 'sudoku:difficulty'), false);
  f.game.activate('mode', 'training');
  assert.equal(f.game.model.roundId, ordinaryRound);
  assert.deepEqual(f.game.model.board, ordinaryBoard);
  assert.equal(f.game.training.lessonId, 'naked-pair');
  f.game.activate('trainingFullPuzzle');
  assert.equal(f.game.model.roundId, round);
  assert.deepEqual(f.game.model.board, practiceBoard);
});

test('practice reloads from a separate trusted save and records completion outside ordinary scores', () => {
  const f = fixture(); classroom(f, 'hidden-single'); f.game.activate('trainingFullPuzzle');
  const original = f.storage.get(SAVE), practiceId = f.game.model.bankId;
  const i = f.game.model.board.indexOf(0); f.game.activate('select', i); f.game.activate('digit', f.game.model.solution[i]);
  const board = f.game.model.board.slice();
  const reloaded = fixture([...f.storage]);
  assert.equal(reloaded.game.model.roundId, original.roundId);
  classroom(reloaded, 'hidden-single'); reloaded.game.activate('trainingFullPuzzle');
  assert.deepEqual(reloaded.game.model.board, board);
  finish(reloaded);
  const saved = reloaded.storage.get(TRAINING);
  assert.ok(saved);
  reloaded.game.activate('mode', 'training');
  assert.equal(reloaded.game.training.view.learningProgress['hidden-single'].fullPuzzle, 1);
  assert.equal(reloaded.game.training.view.learningProgress['hidden-single'].fullPuzzleUnhinted, 1);
  assert.deepEqual(reloaded.storage.get(SAVE), original);
  assert.equal(reloaded.game.training.recordFullPuzzle({ id: practiceId, lessonId: 'hidden-single', hints: 0, elapsed: 1 }), false);
});

test('reading a hint, even without applying it, prevents unhinted whole-puzzle credit', () => {
  const f = fixture(); classroom(f, 'naked-single'); f.game.activate('trainingFullPuzzle');
  const before = f.game.model.board.slice();
  f.game.activate('hint');
  assert.ok(f.modals.length);
  assert.deepEqual(f.game.model.board, before);
  f.game.activate('mode', 'training'); f.game.activate('trainingFullPuzzle');
  finish(f);
  f.game.activate('mode', 'training');
  assert.equal(f.game.training.view.learningProgress['naked-single'].fullPuzzle, 1);
  assert.equal(f.game.training.view.learningProgress['naked-single'].fullPuzzleUnhinted, 0);
});

test('a delayed hint cannot alter the ordinary round after returning to class', () => {
  const f = fixture(); classroom(f); f.game.activate('trainingFullPuzzle'); f.game.activate('hint');
  const delayed = f.modals.at(-1);
  f.game.activate('mode', 'training');
  const snapshot = f.game.model.serialize();
  delayed.confirm();
  assert.deepEqual(f.game.model.serialize(), snapshot);
  assert.equal(f.game.section, 'training');
});

test('a forged practice board is discarded and a bank puzzle is started instead', () => {
  const f = fixture(); classroom(f); f.game.activate('trainingFullPuzzle');
  const saves = [...f.storage].map(([k, v]) => [k, structuredClone(v)]);
  const fake = saves.find(([k]) => k === PRACTICE)[1].rounds['naked-pair'];
  fake.board.fill(9); fake.roundId = 'forged';
  const reloaded = fixture(saves); classroom(reloaded); reloaded.game.activate('trainingFullPuzzle');
  assert.notEqual(reloaded.game.model.roundId, 'forged');
  assert.deepEqual(reloaded.game.model.board, reloaded.game.model.puzzle);
});

test('a whole-puzzle share opens the same course puzzle and preserves the recipient ordinary round', () => {
  const sender = fixture(); classroom(sender, 'x-wing'); sender.game.activate('trainingFullPuzzle');
  const query = Object.fromEntries(new URLSearchParams(sender.game.sharePayload().query));
  assert.equal(query.fp, 'x-wing');
  assert.equal(sharedRound(query).practiceLessonId, 'x-wing');
  assert.equal(sharedRound({ ...query, fp: 'made-up' }), null);
  const receiver = fixture(), ordinary = receiver.game.model.serialize();
  receiver.game.enter(query, { source: 'launch' });
  assert.equal(receiver.game.practiceLessonId, 'x-wing');
  assert.equal(receiver.game.model.bankId, sender.game.model.bankId);
  assert.deepEqual(receiver.game.model.puzzle, sender.game.model.puzzle);
  receiver.game.activate('mode', 'training');
  assert.equal(receiver.game.model.roundId, ordinary.roundId);
  assert.deepEqual(receiver.game.model.board, ordinary.board);
});

test('restarting a practice puzzle retains the fact that its hint was already read', () => {
  const f = fixture(); classroom(f, 'naked-single'); f.game.activate('trainingFullPuzzle');
  const bankId = f.game.model.bankId;
  f.game.activate('hint'); f.game.activate('more');
  f.sheets.at(-1).success({ tapIndex: 1 });
  f.modals.at(-1).confirm();
  assert.equal(f.game.model.bankId, bankId);
  finish(f); f.game.activate('mode', 'training');
  assert.equal(f.game.training.view.learningProgress['naked-single'].fullPuzzleUnhinted, 0);
});

test('each lesson whole-puzzle exercise stays within that lesson and its prerequisite techniques', () => {
  for (const [index, technique] of TECHNIQUES.entries()) {
    const f = fixture(); classroom(f, technique.id);
    assert.equal(f.game.activate('trainingFullPuzzle'), true, technique.id);
    const allowed = new Set(TECHNIQUES.slice(0, index + 1).map(item => item.id));
    assert.equal(f.game.model.ratingProfile.maxTier, technique.tier);
    assert.ok(f.game.model.ratingProfile.techniqueCounts[technique.id] > 0);
    assert.ok(Object.keys(f.game.model.ratingProfile.techniqueCounts).every(id => allowed.has(id)), technique.id);
  }
});

test('a friend course share cannot replace an unfinished practice draft before confirmation', () => {
  const f = fixture(); classroom(f, 'x-wing'); f.game.activate('trainingFullPuzzle');
  const i = f.game.model.board.indexOf(0); f.game.activate('select', i); f.game.activate('digit', f.game.model.solution[i]);
  const draft = structuredClone(f.game.model.serialize()), ordinary = f.storage.get(SAVE);
  const other = getPuzzlesByTechnique('x-wing', { difficulty: 'hard' }).find(item => item.id !== draft.bankId);
  const query = { g: 'sudoku', p: 'friend-practice', d: other.difficulty, b: other.id, v: '2', fp: 'x-wing' };
  f.game.enter(query, { source: 'show' });
  assert.equal(f.modals.at(-1).config.cancelText, '保留进度');
  assert.deepEqual(f.game.model.serialize(), draft, 'declining leaves the active draft unchanged');
  assert.equal(f.storage.get(PRACTICE).rounds['x-wing'].bankId, draft.bankId);
  assert.deepEqual(f.storage.get(SAVE), ordinary);
  const reloaded = fixture([...f.storage]), normalId = reloaded.game.model.roundId;
  reloaded.game.enter(query, { source: 'launch' });
  assert.equal(reloaded.game.model.roundId, normalId, 'an inactive saved course draft is protected too');
  assert.match(reloaded.modals.at(-1).config.content, /未完成/);
  reloaded.modals.at(-1).confirm();
  assert.equal(reloaded.game.model.bankId, other.id);
  assert.equal(reloaded.game.practiceLessonId, 'x-wing');
  assert.equal(reloaded.storage.get(SAVE).roundId, normalId);
});
